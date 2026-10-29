
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  ChevronRight,
  Home,
  UserRoundCheck,
  History,
} from 'lucide-react';
import AddTenantModal from '../components/AddTenantModal';
import { supabase } from '../lib/supabase';

export default function Tenants() {
  const navigate = useNavigate();

  const [tenants, setTenants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('ACTIVE');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTenants = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      const user = authData?.user;

      if (!user) {
        setTenants([]);
        setError('Please sign in to view your tenants.');
        return;
      }

      const { data: tenantRows, error: tenantError } = await supabase
        .from('tenants')
        .select(
          'id, owner_id, property_id, full_name, phone, permanent_address, unit_label, monthly_rent, security_deposit, move_in_date, move_out_date, status, created_at'
        )
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (tenantError) throw tenantError;

      const propertyIds = [
        ...new Set(
          (tenantRows || [])
            .map((tenant) => tenant.property_id)
            .filter(Boolean)
        ),
      ];

      let propertyNames = {};

      if (propertyIds.length > 0) {
        const { data: propertyRows, error: propertyError } = await supabase
          .from('properties')
          .select('id, name')
          .in('id', propertyIds)
          .eq('owner_id', user.id);

        if (propertyError) throw propertyError;

        propertyNames = Object.fromEntries(
          (propertyRows || []).map((property) => [
            property.id,
            property.name,
          ])
        );
      }

      const formattedTenants = (tenantRows || []).map((tenant) => {
        const propertyName =
          propertyNames[tenant.property_id] || 'Property unavailable';

        return {
          ...tenant,
          name: tenant.full_name,
          propertyName,
          unit: tenant.unit_label || 'Unit not specified',
          rent: Number(tenant.monthly_rent) || 0,
          deposit: Number(tenant.security_deposit) || 0,
          address: tenant.permanent_address || '',
          startDate: tenant.move_in_date || '',
          status: (tenant.status || 'active').toLowerCase(),
        };
      });

      setTenants(formattedTenants);
    } catch (err) {
      console.error('Error loading tenants:', err);
      setError(err.message || 'Could not load tenants. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const handleAddTenantSuccess = async () => {
    await loadTenants();
    setIsAddModalOpen(false);
  };

  const query = searchQuery.trim().toLowerCase();

  const activeTenants = tenants.filter(
    (tenant) => tenant.status === 'active'
  );

  const movedOutTenants = tenants.filter(
    (tenant) => tenant.status !== 'active'
  );

  const visibleTenants =
    filterTab === 'ACTIVE' ? activeTenants : movedOutTenants;

  const filteredTenants = visibleTenants.filter((tenant) => {
    return (
      tenant.name?.toLowerCase().includes(query) ||
      tenant.unit?.toLowerCase().includes(query) ||
      tenant.propertyName?.toLowerCase().includes(query) ||
      tenant.phone?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-28">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-5 py-3.5 sticky top-0 z-20 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">
            Tenant <span className="text-[#1e3a5f]">Directory</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            {tenants.length} Total Registered
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#1e3a5f] hover:bg-[#162b47] text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-[#1e3a5f]/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Tenant</span>
        </button>
      </header>

      <main className="p-4 space-y-4 max-w-md mx-auto">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search name, property, flat or phone..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1e3a5f]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setFilterTab('ACTIVE')}
            className={`rounded-2xl border p-3 text-left transition ${
              filterTab === 'ACTIVE'
                ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <UserRoundCheck className="w-5 h-5" />
              <span className="text-lg font-black">
                {activeTenants.length}
              </span>
            </div>
            <p className="text-xs font-bold mt-2">Active</p>
            <p className={`text-[10px] mt-0.5 ${
              filterTab === 'ACTIVE' ? 'text-slate-200' : 'text-slate-500'
            }`}>
              Currently living
            </p>
          </button>

          <button
            onClick={() => setFilterTab('MOVED_OUT')}
            className={`rounded-2xl border p-3 text-left transition ${
              filterTab === 'MOVED_OUT'
                ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <History className="w-5 h-5" />
              <span className="text-lg font-black">
                {movedOutTenants.length}
              </span>
            </div>
            <p className="text-xs font-bold mt-2">Moved Out</p>
            <p className={`text-[10px] mt-0.5 ${
              filterTab === 'MOVED_OUT' ? 'text-slate-200' : 'text-slate-500'
            }`}>
              Historical records
            </p>
          </button>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            {filterTab === 'ACTIVE' ? 'Active Tenants' : 'Moved Out Tenants'}
            {' '}({filteredTenants.length})
          </h3>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 space-y-2">
              <p>{error}</p>
              <button
                onClick={loadTenants}
                className="font-bold underline"
              >
                Try again
              </button>
            </div>
          )}

          {isLoading ? (
            <p className="text-center py-8 text-xs font-semibold text-slate-500">
              Loading tenants...
            </p>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-8">
              {filterTab === 'ACTIVE' ? (
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              ) : (
                <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              )}
              <p className="text-xs font-bold text-slate-700">
                {error
                  ? 'Tenants could not be loaded.'
                  : query
                    ? 'No tenants match your search.'
                    : filterTab === 'ACTIVE'
                      ? 'No active tenants found.'
                      : 'No moved-out tenants found.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTenants.map((tenant) => {
                const isActive = tenant.status === 'active';

                return (
                  <button
                    type="button"
                    key={tenant.id}
                    onClick={() => navigate(`/tenants/${tenant.id}`)}
                    className="w-full text-left bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-3 hover:bg-slate-100/70 transition cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-bold text-xs border ${
                        isActive
                          ? 'bg-[#1e3a5f]/10 text-[#1e3a5f] border-[#1e3a5f]/20'
                          : 'bg-slate-200 text-slate-600 border-slate-300'
                      }`}>
                        {tenant.name
                          ? tenant.name.substring(0, 2).toUpperCase()
                          : 'TN'}
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {tenant.name}
                        </h4>

                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {tenant.propertyName}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium mt-1">
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <Home className="w-3 h-3 text-slate-400" />
                            {tenant.unit}
                          </span>
                          <span>•</span>
                          <span>₹{tenant.rent.toLocaleString('en-IN')}/mo</span>
                        </div>

                        {!isActive && tenant.move_out_date && (
                          <p className="text-[10px] text-slate-500 mt-1">
                            Moved out: {tenant.move_out_date}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-200 text-slate-700 border border-slate-300'
                      }`}>
                        {isActive ? 'ACTIVE' : 'MOVED OUT'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <AddTenantModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onTenantAdded={handleAddTenantSuccess}
      />
    </div>
  );
}
