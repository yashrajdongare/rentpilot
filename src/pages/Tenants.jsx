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
  Phone,
} from 'lucide-react';
import AddTenantModal from '../components/AddTenantModal';
import GlassCard from '../components/ui/GlassCard';
import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
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
    <div className="min-h-screen text-ink dark:text-[#eef1ff] pb-24">
      {/* Sticky Glass Top Header */}
      <header className="sticky top-0 z-30 px-5 py-3.5 glass-panel-strong border-b border-white/80 dark:border-white/10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-ink dark:text-white leading-none">
            Tenant Directory
          </h1>
          <p className="text-[10px] font-bold text-muted dark:text-[#98a3c4] uppercase tracking-wider mt-0.5">
            {tenants.length} Total Registered
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white text-xs font-extrabold px-3.5 py-2 rounded-btn flex items-center gap-1.5 shadow-md shadow-[#3d4fe0]/25 active:scale-95 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Tenant</span>
        </button>
      </header>

      <main className="p-4 sm:p-5 space-y-4">
        {/* Search Bar */}
        <div className="relative animate-fade-up">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search name, property, flat or phone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
          />
        </div>

        {/* Filter Tiles (Active vs Moved Out) */}
        <div className="grid grid-cols-2 gap-3 animate-fade-up">
          <button
            type="button"
            onClick={() => setFilterTab('ACTIVE')}
            className={`rounded-tile p-3.5 text-left transition-all duration-200 cursor-pointer active:scale-95 border ${filterTab === 'ACTIVE'
              ? 'bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white shadow-glass-sm border-transparent'
              : 'glass-panel text-ink dark:text-white border-white/90 dark:border-white/10 hover:bg-white/80'
              }`}
          >
            <div className="flex items-center justify-between gap-2">
              <UserRoundCheck className="w-5 h-5 stroke-[2]" />
              <span className="text-xl font-black">
                {activeTenants.length}
              </span>
            </div>
            <p className="text-xs font-extrabold mt-2">Active</p>
            <p className={`text-[10px] mt-0.5 font-medium ${filterTab === 'ACTIVE' ? 'text-white/80' : 'text-muted dark:text-[#98a3c4]'
              }`}>
              Currently living
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('MOVED_OUT')}
            className={`rounded-tile p-3.5 text-left transition-all duration-200 cursor-pointer active:scale-95 border ${filterTab === 'MOVED_OUT'
              ? 'bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white shadow-glass-sm border-transparent'
              : 'glass-panel text-ink dark:text-white border-white/90 dark:border-white/10 hover:bg-white/80'
              }`}
          >
            <div className="flex items-center justify-between gap-2">
              <History className="w-5 h-5 stroke-[2]" />
              <span className="text-xl font-black">
                {movedOutTenants.length}
              </span>
            </div>
            <p className="text-xs font-extrabold mt-2">Moved Out</p>
            <p className={`text-[10px] mt-0.5 font-medium ${filterTab === 'MOVED_OUT' ? 'text-white/80' : 'text-muted dark:text-[#98a3c4]'
              }`}>
              Historical records
            </p>
          </button>
        </div>

        {/* Tenant List */}
        <GlassCard className="animate-fade-up space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-ink dark:text-white uppercase tracking-wider">
              {filterTab === 'ACTIVE' ? 'Active Tenants' : 'Moved Out Tenants'} ({filteredTenants.length})
            </h3>
          </div>

          {error && (
            <div className="rounded-btn border border-rose/30 bg-rose/15 p-3 text-xs text-rose font-bold space-y-2">
              <p>{error}</p>
              <button
                onClick={loadTenants}
                className="font-black underline"
              >
                Try again
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-xs font-semibold text-muted">
              Loading tenants...
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-tile glass-panel">
              {filterTab === 'ACTIVE' ? (
                <Users className="w-10 h-10 text-muted mx-auto mb-2 stroke-[1.5]" />
              ) : (
                <History className="w-10 h-10 text-muted mx-auto mb-2 stroke-[1.5]" />
              )}
              <p className="text-xs font-extrabold text-ink dark:text-white">
                {query
                  ? 'No tenants match your search.'
                  : filterTab === 'ACTIVE'
                    ? 'No active tenants found.'
                    : 'No moved-out tenants found.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredTenants.map((tenant) => {
                const isActive = tenant.status === 'active';

                return (
                  <div
                    key={tenant.id}
                    onClick={() => navigate(`/tenants/${tenant.id}`)}
                    className="rounded-tile p-3.5 glass-panel-strong hover:bg-white dark:hover:bg-[#1c244c] flex items-center justify-between gap-3 transition-all duration-200 cursor-pointer active:scale-[0.99] group border border-white/90 dark:border-white/15"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={tenant.name} size="md" />

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-extrabold text-ink dark:text-white group-hover:text-primary dark:group-hover:text-[#a5b4fc] transition truncate">
                            {tenant.name}
                          </h4>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/15 text-primary dark:text-[#a5b4fc] border border-primary/25 flex items-center gap-1">
                            <Home className="w-3 h-3 stroke-[2]" />
                            <span>{tenant.unit}</span>
                          </span>
                        </div>

                        <p className="text-[11px] text-muted dark:text-[#94a3b8] font-semibold truncate">
                          {tenant.propertyName}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted dark:text-[#94a3b8] font-semibold mt-0.5">
                          <span>
                            Rent: <strong className="text-ink dark:text-white font-extrabold">₹{tenant.rent.toLocaleString('en-IN')}/mo</strong>
                          </span>
                          {tenant.phone && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 stroke-[2]" />
                                <span>{tenant.phone}</span>
                              </span>
                            </>
                          )}
                        </div>

                        {!isActive && tenant.move_out_date && (
                          <p className="text-[10px] text-muted dark:text-[#94a3b8] font-bold mt-0.5">
                            Moved out: {tenant.move_out_date}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={isActive ? 'PAID' : 'INACTIVE'} />
                      <ChevronRight className="w-4 h-4 text-muted group-hover:text-ink dark:group-hover:text-white transition" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </main>

      <AddTenantModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onTenantAdded={handleAddTenantSuccess}
      />
    </div>
  );
}
