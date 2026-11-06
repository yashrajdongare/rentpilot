import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Users,
  ChevronRight,
  MapPin,
  Pencil,
  Trash2,
  X,
  Save,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import AddPropertyModal from '../components/AddPropertyModal';
import GlassCard from '../components/ui/GlassCard';
import BottomSheet from '../components/ui/BottomSheet';

const emptyEditForm = {
  name: '',
  address: '',
  type: 'Residential Flat / Apartment',
  rent: '',
  rentCollectionMode: 'POST_PAID',
  rentCalculationMethod: 'FIXED',
  dueDay: '10',
};

export default function Properties() {
  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const loadProperties = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        throw new Error('Please log in to view your properties.');
      }

      const { data, error: fetchError } = await supabase
        .from('properties')
        .select(
          'id, name, property_type, base_monthly_rent, address, notes, rent_collection_mode, rent_calculation_method, due_day, created_at'
        )
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mappedProperties = (data || []).map((item) => ({
        id: item.id,
        name: item.name,
        type: item.property_type || 'Residential Flat / Apartment',
        rent: Number(item.base_monthly_rent) || 0,
        address: item.address || '',
        notes: item.notes || '',
        rentCollectionMode: item.rent_collection_mode || 'POST_PAID',
        rentCalculationMethod: item.rent_calculation_method || 'RELATIVE',
        dueDay: Number(item.due_day) || 10,
      }));

      setProperties(mappedProperties);

      const { data: tenantRows, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, property_id, unit_label, full_name, status')
        .eq('owner_id', user.id);
      if (tenantsError) throw tenantsError;
      setTenants((tenantRows || []).map((tenant) => ({
        id: tenant.id,
        propertyId: tenant.property_id,
        unit: tenant.unit_label || '',
        name: tenant.full_name || '',
        status: (tenant.status || 'active').toLowerCase(),
      })));
    } catch (err) {
      setError(err.message || 'Unable to load properties.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const handleAddPropertySuccess = async (newProperty) => {
    setActionError('');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) {
      throw new Error('Please log in again before adding a property.');
    }

    const { data, error: insertError } = await supabase
      .from('properties')
      .insert({
        owner_id: user.id,
        name: newProperty.name,
        property_type: newProperty.type,
        base_monthly_rent: newProperty.rent,
        address: newProperty.address?.trim() || null,
        rent_collection_mode: newProperty.rentCollectionMode || 'POST_PAID',
        rent_calculation_method: newProperty.rentCalculationMethod || 'RELATIVE',
        due_day: Number(newProperty.dueDay) || 10,
        notes: newProperty.notes?.trim() || null,
      })
      .select(
        'id, name, property_type, base_monthly_rent, address, notes, rent_collection_mode, rent_calculation_method, due_day, created_at'
      )
      .single();

    if (insertError) throw insertError;

    const savedProperty = {
      id: data.id,
      name: data.name,
      type: data.property_type || 'Residential Flat / Apartment',
      rent: Number(data.base_monthly_rent) || 0,
      address: data.address || '',
      notes: data.notes || '',
      rentCollectionMode: data.rent_collection_mode || newProperty.rentCollectionMode || 'POST_PAID',
      rentCalculationMethod: data.rent_calculation_method || newProperty.rentCalculationMethod || 'RELATIVE',
      dueDay: Number(data.due_day) || Number(newProperty.dueDay) || 10,
    };

    setProperties((current) => [savedProperty, ...current]);
  };

  const openEditModal = (property) => {
    setActionError('');
    setEditingProperty(property);
    setEditForm({
      name: property.name || '',
      address: property.address || '',
      type: property.type || 'Residential Flat / Apartment',
      rent: String(property.rent ?? ''),
      rentCollectionMode: property.rentCollectionMode || 'POST_PAID',
      rentCalculationMethod: property.rentCalculationMethod || 'RELATIVE',
      dueDay: String(property.dueDay || '10'),
    });
  };

  const closeEditModal = () => {
    if (savingEdit) return;
    setEditingProperty(null);
    setEditForm(emptyEditForm);
  };

  const handleEditProperty = async (e) => {
    e.preventDefault();
    setActionError('');

    if (!editingProperty) return;

    const rentValue = Number(editForm.rent);

    if (!editForm.name.trim()) {
      setActionError('Please enter a property name.');
      return;
    }

    if (
      editForm.rent.trim() === '' ||
      !Number.isFinite(rentValue) ||
      rentValue < 0
    ) {
      setActionError('Please enter a valid monthly rent.');
      return;
    }

    setSavingEdit(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Please log in again.');

      const { data, error: updateError } = await supabase
        .from('properties')
        .update({
          name: editForm.name.trim(),
          address: editForm.address.trim() || null,
          property_type: editForm.type,
          base_monthly_rent: rentValue,
          rent_collection_mode: editForm.rentCollectionMode || 'POST_PAID',
          rent_calculation_method: editForm.rentCalculationMethod || 'RELATIVE',
          due_day: Number(editForm.dueDay) || 10,
        })
        .eq('id', editingProperty.id)
        .eq('owner_id', user.id)
        .select(
          'id, name, property_type, base_monthly_rent, address, notes, rent_collection_mode, rent_calculation_method, due_day'
        )
        .single();

      if (updateError) throw updateError;

      const updatedProperty = {
        id: data.id,
        name: data.name,
        type: data.property_type || 'Residential Flat / Apartment',
        rent: Number(data.base_monthly_rent) || 0,
        address: data.address || '',
        notes: data.notes || '',
        rentCollectionMode: data.rent_collection_mode || editForm.rentCollectionMode || 'POST_PAID',
        rentCalculationMethod: data.rent_calculation_method || editForm.rentCalculationMethod || 'RELATIVE',
        dueDay: Number(data.due_day) || Number(editForm.dueDay) || 10,
      };

      setProperties((current) =>
        current.map((property) =>
          property.id === updatedProperty.id
            ? updatedProperty
            : property
        )
      );

      setEditingProperty(null);
      setEditForm(emptyEditForm);
    } catch (err) {
      setActionError(err.message || 'Unable to update property.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteProperty = async (property) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${property.name}"?\n\nThis action cannot be undone. Check that no tenant or rent records need this property before proceeding.`
    );

    if (!confirmed) return;

    setActionError('');
    setDeletingId(property.id);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Please log in again.');

      const { data, error: deleteError } = await supabase
        .from('properties')
        .delete()
        .eq('id', property.id)
        .eq('owner_id', user.id)
        .select('id');

      if (deleteError) throw deleteError;

      if (!data || data.length === 0) {
        throw new Error(
          'Property was not deleted. It may not exist, or you may not have permission to delete it.'
        );
      }

      setProperties((current) =>
        current.filter((item) => item.id !== property.id)
      );

      if (editingProperty?.id === property.id) {
        setEditingProperty(null);
      }
    } catch (err) {
      setActionError(
        err.message ||
        'Unable to delete property. Check whether related records prevent deletion.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen text-ink dark:text-[#eef1ff] pb-24">
      {/* Sticky Glass Top Header */}
      <header className="sticky top-0 z-30 px-5 py-3.5 glass-panel-strong border-b border-white/80 dark:border-white/10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-ink dark:text-white leading-none">
            All Properties
          </h1>
          <p className="text-[10px] font-bold text-muted dark:text-[#98a3c4] uppercase tracking-wider mt-0.5">
            {properties.length} Properties Registered
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white text-xs font-extrabold px-3.5 py-2 rounded-btn flex items-center gap-1.5 shadow-md shadow-[#3d4fe0]/25 active:scale-95 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Property</span>
        </button>
      </header>

      <main className="p-4 sm:p-5 space-y-4">
        {(error || actionError) && (
          <div
            role="alert"
            className="rounded-tile border border-rose/30 bg-rose/15 p-3.5 text-xs font-bold text-rose animate-fade-up break-words"
          >
            {actionError || error}

            {error && (
              <button
                onClick={loadProperties}
                className="block mt-2 underline font-bold"
              >
                Retry loading properties
              </button>
            )}

            {actionError && (
              <button
                onClick={() => setActionError('')}
                className="block mt-2 underline font-bold"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        <GlassCard className="animate-fade-up space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-ink dark:text-white uppercase tracking-wider">
              Property List ({properties.length})
            </h3>
          </div>

          {loading ? (
            <div className="text-center py-8 text-xs font-semibold text-muted">
              Loading properties...
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-tile glass-panel">
              <Building2 className="w-10 h-10 text-muted mx-auto mb-2 stroke-[1.5]" />
              <p className="text-xs font-extrabold text-ink dark:text-white">
                No properties added yet.
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-3 px-4 py-2 rounded-btn bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white text-xs font-extrabold shadow-sm active:scale-95 transition cursor-pointer"
              >
                + Add First Property
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {properties.map((prop) => {
                const propTenantsCount = tenants.filter(
                  (t) => t.propertyId === prop.id && t.status === 'active'
                ).length;

                return (
                  <div
                    key={prop.id}
                    onClick={() => navigate(`/properties/${prop.id}`)}
                    className="rounded-tile p-4 glass-panel-strong hover:bg-white dark:hover:bg-[#1c244c] transition-all duration-200 cursor-pointer active:scale-[0.99] group border border-white/90 dark:border-white/15"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-11 h-11 shrink-0 rounded-tile bg-primary/15 text-primary dark:text-[#a5b4fc] border border-primary/25 flex items-center justify-center font-bold">
                          <Building2 className="w-5 h-5 stroke-[2]" />
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-sm font-extrabold text-ink dark:text-white group-hover:text-primary dark:group-hover:text-[#a5b4fc] transition break-words">
                            {prop.name}
                          </h4>

                          <p className="text-xs text-muted dark:text-[#94a3b8] font-semibold flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span>{prop.type}</span>
                            <span>•</span>
                            <span className="text-primary dark:text-[#a5b4fc] font-bold flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 stroke-[2]" />
                              {propTenantsCount} Tenants
                            </span>
                          </p>

                          {prop.address && (
                            <p className="text-xs text-muted dark:text-[#94a3b8] flex items-start gap-1 mt-1.5 break-words">
                              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 stroke-[2]" />
                              <span>{prop.address}</span>
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/15 text-primary dark:text-[#a5b4fc] border border-primary/25">
                              Post-Paid • Due {prop.dueDay || 10}th
                            </span>
                          </div>
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-muted group-hover:text-ink dark:group-hover:text-white shrink-0 mt-1 transition" />
                    </div>

                    <div
                      className="flex gap-2 mt-3.5 pt-3 border-t border-white/80 dark:border-white/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openEditModal(prop)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-btn glass-panel px-3 py-2 text-xs font-extrabold text-primary dark:text-[#a5b4fc] hover:bg-primary/15 transition active:scale-95 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5 stroke-[2]" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteProperty(prop)}
                        disabled={deletingId === prop.id}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-btn bg-rose/10 hover:bg-rose/20 text-rose border border-rose/20 px-3 py-2 text-xs font-extrabold transition active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
                        <span>{deletingId === prop.id ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </main>

      <AddPropertyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onPropertyAdded={handleAddPropertySuccess}
      />

      {/* Edit Property BottomSheet */}
      <BottomSheet
        isOpen={!!editingProperty}
        onClose={closeEditModal}
        title="Edit Property"
        subtitle={`Update details for ${editingProperty?.name || 'Property'}`}
      >
        <form onSubmit={handleEditProperty} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink dark:text-white mb-1">
              Property Name *
            </label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((current) => ({
                  ...current,
                  name: e.target.value,
                }))
              }
              required
              className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink dark:text-white mb-1">
              Property Address
            </label>
            <textarea
              value={editForm.address}
              onChange={(e) =>
                setEditForm((current) => ({
                  ...current,
                  address: e.target.value,
                }))
              }
              placeholder="Street, area, city, or full address"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink dark:text-white mb-1">
              Property Type *
            </label>
            <select
              value={editForm.type}
              onChange={(e) =>
                setEditForm((current) => ({
                  ...current,
                  type: e.target.value,
                }))
              }
              className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            >
              <option>Residential Flat / Apartment</option>
              <option>Independent House / Villa</option>
              <option>Commercial Shop / Office</option>
              <option>Hostel / PG Building</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-tile glass-panel border border-white/80 dark:border-white/10">
            <div>
              <label className="block text-xs font-bold text-ink dark:text-white">
                Default Rent Due Day
              </label>
              <p className="text-[10px] text-muted dark:text-[#98a3c4] font-medium mt-0.5">
                Due on this day in following month (1–28)
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                max="28"
                value={editForm.dueDay}
                onChange={(e) =>
                  setEditForm((current) => ({
                    ...current,
                    dueDay: e.target.value,
                  }))
                }
                placeholder="10"
                required
                className="w-16 px-2.5 py-1.5 rounded-btn glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-extrabold text-ink dark:text-white text-center focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-muted font-bold">th</span>
            </div>
          </div>

          {actionError && (
            <div className="p-3 rounded-btn bg-rose/15 border border-rose/30 text-rose text-xs font-bold">
              {actionError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={closeEditModal}
              disabled={savingEdit}
              className="py-3 px-3 rounded-btn glass-panel text-muted hover:text-ink dark:hover:text-white font-bold text-xs active:scale-95 transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={savingEdit}
              className="py-3 px-3 rounded-btn bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white font-extrabold text-xs shadow-md shadow-[#3d4fe0]/25 active:scale-95 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>{savingEdit ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}
