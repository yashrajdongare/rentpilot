
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Users,
  Calendar,
  ChevronRight,
  Plus,
  Home,
} from 'lucide-react';
import AddTenantModal from '../components/AddTenantModal';
import { supabase } from '../lib/supabase';

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [property, setProperty] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const loadPropertyDetails = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error('Please sign in to view property details.');
      }

      // Load the selected property from Supabase.
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select(
          'id, owner_id, name, property_type, base_monthly_rent, address, notes, created_at'
        )
        .eq('id', id)
        .eq('owner_id', user.id)
        .maybeSingle();

      if (propertyError) throw propertyError;

      if (!propertyData) {
        throw new Error('Property not found or you do not have access.');
      }

      setProperty({
        ...propertyData,
        type: propertyData.property_type || 'Property',
      });

      // Load only tenants who currently live in this property.
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select(
          'id, owner_id, property_id, full_name, phone, unit_label, monthly_rent, move_in_date, status'
        )
        .eq('owner_id', user.id)
        .eq('property_id', id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (tenantError) throw tenantError;

      const formattedTenants = (tenantData || []).map((tenant) => ({
        ...tenant,
        name: tenant.full_name,
        unit: tenant.unit_label || 'Unit not specified',
        rent: Number(tenant.monthly_rent) || 0,
        startDate: tenant.move_in_date || '',
      }));

      setTenants(formattedTenants);
    } catch (error) {
      console.error('Error loading property details:', error);
      setLoadError(error.message || 'Failed to load property details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPropertyDetails();
  }, [loadPropertyDetails, refreshKey]);

  const handleTenantAdded = () => {
    setIsAddTenantOpen(false);
    setRefreshKey((previous) => previous + 1);
  };

  const totalRent = tenants.reduce(
    (total, tenant) => total + tenant.rent,
    0
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <p className="text-sm font-semibold text-slate-500">
          Loading property details...
        </p>
      </div>
    );
  }

  if (loadError || !property) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-sm font-semibold text-rose-600 text-center">
          {loadError || 'Property not found.'}
        </p>
        <button
          onClick={() => navigate('/properties')}
          className="bg-[#1e3a5f] text-white px-4 py-2 rounded-xl text-sm font-bold"
        >
          Back to Properties
        </button>
        <button
          onClick={loadPropertyDetails}
          className="text-sm font-semibold text-[#1e3a5f]"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-28">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 hover:bg-slate-100 rounded-xl transition"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-900" />
          </button>

          <div>
            <h1 className="text-base font-bold text-slate-900">
              {property.name}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase">
              {property.type}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddTenantOpen(true)}
          className="bg-[#1e3a5f] hover:bg-[#162b47] text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-[#1e3a5f]/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Tenant</span>
        </button>
      </header>

      <main className="p-4 space-y-4 max-w-md mx-auto">
        <div className="bg-white rounded-[32px] p-6 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-[#1e3a5f]/10 border border-[#1e3a5f]/20 text-[#1e3a5f] flex items-center justify-center font-bold">
                <Building2 className="w-6 h-6" />
              </div>

              <div className="min-w-0">
                <h2 className="text-xl font-black text-slate-900 break-words">
                  {property.name}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {property.type}
                </p>
              </div>
            </div>

            <span className="shrink-0 px-3 py-1 bg-[#1e3a5f]/10 text-[#1e3a5f] rounded-full text-xs font-bold">
              {tenants.length} Tenants
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-100">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">
                Monthly Rent Potential
              </p>
              <p className="text-lg font-black text-slate-900 mt-0.5">
                ₹{totalRent.toLocaleString('en-IN')}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">
                Active Tenants
              </p>
              <p className="text-sm font-bold text-emerald-600 mt-1">
                {tenants.length} Currently Living
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            All Tenants & Flats ({tenants.length})
          </h3>

          {tenants.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                No active tenants registered for this property.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Add a tenant to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {tenants.map((tenant) => {
                const dueDay = tenant.startDate
                  ? new Date(`${tenant.startDate}T00:00:00`).getDate()
                  : null;

                return (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => navigate(`/tenants/${tenant.id}`)}
                    className="w-full text-left bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-3 hover:bg-slate-100/70 transition cursor-pointer active:scale-[0.99]"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900">
                          {tenant.name}
                        </h4>

                        <span className="text-[11px] font-extrabold text-[#1e3a5f] bg-[#1e3a5f]/10 border border-[#1e3a5f]/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <Home className="w-3 h-3 text-[#1e3a5f]" />
                          {tenant.unit}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 font-medium">
                        <span>
                          Rent:{' '}
                          <strong className="text-slate-800">
                            ₹{tenant.rent.toLocaleString('en-IN')}
                          </strong>
                        </span>

                        {dueDay && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-600 font-semibold">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              Moved in: <strong>{tenant.startDate}</strong>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
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
        isOpen={isAddTenantOpen}
        onClose={() => setIsAddTenantOpen(false)}
        onTenantAdded={handleTenantAdded}
      />
    </div>
  );
}
