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
  MapPin,
} from 'lucide-react';
import AddTenantModal from '../components/AddTenantModal';
import GlassCard from '../components/ui/GlassCard';
import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
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
      <div className="min-h-screen flex items-center justify-center p-6 text-ink dark:text-white">
        <p className="text-xs font-bold text-muted">
          Loading property details...
        </p>
      </div>
    );
  }

  if (loadError || !property) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center gap-4">
        <div className="rounded-card p-6 glass-panel text-center max-w-sm space-y-3">
          <p className="text-xs font-bold text-rose">
            {loadError || 'Property not found.'}
          </p>
          <button
            onClick={() => navigate('/properties')}
            className="w-full py-2.5 rounded-btn bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white text-xs font-extrabold active:scale-95 shadow-sm"
          >
            Back to Properties
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-ink dark:text-[#eef1ff] pb-24">
      {/* Sticky Glass Top Header */}
      <header className="sticky top-0 z-30 px-5 py-3.5 glass-panel-strong border-b border-white/80 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-btn glass-panel flex items-center justify-center text-muted hover:text-ink dark:hover:text-white transition active:scale-95 cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          </button>

          <div>
            <h1 className="text-base font-black text-ink dark:text-white leading-none">
              {property.name}
            </h1>
            <p className="text-[10px] text-muted dark:text-[#98a3c4] font-extrabold uppercase tracking-wider mt-0.5">
              {property.type}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddTenantOpen(true)}
          className="bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white text-xs font-extrabold px-3 py-2 rounded-btn flex items-center gap-1.5 shadow-md shadow-[#3d4fe0]/25 active:scale-95 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Tenant</span>
        </button>
      </header>

      <main className="p-4 sm:p-5 space-y-4">
        {/* Main Property Overview Glass Card */}
        <GlassCard className="animate-fade-up space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 shrink-0 rounded-tile bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
                <Building2 className="w-6 h-6 stroke-[2]" />
              </div>

              <div className="min-w-0">
                <h2 className="text-xl font-black text-ink dark:text-white break-words tracking-tight">
                  {property.name}
                </h2>
                <p className="text-xs text-muted dark:text-[#98a3c4] font-semibold">
                  {property.type}
                </p>
              </div>
            </div>

            <span className="shrink-0 px-3 py-1 bg-primary/10 text-primary dark:text-[#8d99ff] border border-primary/20 rounded-full text-xs font-extrabold">
              {tenants.length} Tenants
            </span>
          </div>

          {property.address && (
            <p className="text-xs text-muted dark:text-[#98a3c4] font-medium flex items-center gap-1.5 pt-1">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0 stroke-[2]" />
              <span>{property.address}</span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/80 dark:border-white/10">
            <div className="rounded-tile p-3 glass-panel-strong border border-white/90 dark:border-white/10">
              <p className="text-[10px] text-muted dark:text-[#98a3c4] uppercase font-extrabold tracking-wider">
                Monthly Rent Potential
              </p>
              <p className="text-lg font-black text-ink dark:text-white mt-0.5 tracking-tight">
                ₹{totalRent.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="rounded-tile p-3 bg-teal/10 border border-teal/20">
              <p className="text-[10px] text-teal uppercase font-extrabold tracking-wider">
                Active Tenants
              </p>
              <p className="text-sm font-black text-teal mt-1">
                {tenants.length} Currently Living
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Tenant list card */}
        <GlassCard className="animate-fade-up space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-ink dark:text-white uppercase tracking-wider">
              Flats &amp; Tenants ({tenants.length})
            </h3>
          </div>

          {tenants.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-tile glass-panel">
              <Users className="w-10 h-10 text-muted mx-auto mb-2 stroke-[1.5]" />
              <p className="text-xs font-extrabold text-ink dark:text-white">
                No active tenants registered for this property.
              </p>
              <button
                onClick={() => setIsAddTenantOpen(true)}
                className="mt-3 px-4 py-2 rounded-btn bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white text-xs font-extrabold active:scale-95 transition"
              >
                + Add Tenant
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  onClick={() => navigate(`/tenants/${tenant.id}`)}
                  className="rounded-tile p-3.5 glass-panel-strong hover:bg-white dark:hover:bg-[#1a2142] flex items-center justify-between gap-3 transition-all duration-200 cursor-pointer active:scale-[0.99] group border border-white/90 dark:border-white/10"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={tenant.name} size="md" />

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-extrabold text-ink dark:text-white group-hover:text-primary transition truncate">
                          {tenant.name}
                        </h4>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                          <Home className="w-3 h-3 stroke-[2]" />
                          <span>{tenant.unit}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted dark:text-[#98a3c4] font-semibold">
                        <span>
                          Rent: <strong className="text-ink dark:text-white font-extrabold">₹{tenant.rent.toLocaleString('en-IN')}</strong>
                        </span>
                        {tenant.startDate && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-[11px]">
                              <Calendar className="w-3 h-3 stroke-[2]" />
                              <span>From {tenant.startDate}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status="PAID" />
                    <ChevronRight className="w-4 h-4 text-muted group-hover:text-ink dark:group-hover:text-white transition" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </main>

      <AddTenantModal
        isOpen={isAddTenantOpen}
        onClose={() => setIsAddTenantOpen(false)}
        onTenantAdded={handleTenantAdded}
      />
    </div>
  );
}
