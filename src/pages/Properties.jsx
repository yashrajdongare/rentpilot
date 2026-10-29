
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-28">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-5 py-3.5 sticky top-0 z-20 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">
            All <span className="text-[#1e3a5f]">Properties</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
            {properties.length} Properties Registered
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#1e3a5f] hover:bg-[#162b47] text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-[#1e3a5f]/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Property</span>
        </button>
      </header>

      <main className="p-4 space-y-4 max-w-md mx-auto">
        {(error || actionError) && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-xs font-semibold break-words"
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

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Property List ({properties.length})
          </h3>

          {loading ? (
            <p className="text-xs text-slate-500 text-center py-8">
              Loading properties...
            </p>
          ) : properties.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                No properties added yet.
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-3 px-4 py-2 bg-[#1e3a5f] text-white text-xs font-bold rounded-xl shadow-xs"
              >
                + Add First Property
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {properties.map((prop) => {
                const propTenantsCount = tenants.filter(
                  (t) => t.propertyId === prop.id && t.status === 'active'
                ).length;

                return (
                  <div
                    key={prop.id}
                    onClick={() => navigate(`/properties/${prop.id}`)}
                    className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60 hover:bg-slate-100/70 transition cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-11 h-11 shrink-0 rounded-xl bg-[#1e3a5f]/10 border border-[#1e3a5f]/20 text-[#1e3a5f] flex items-center justify-center font-bold">
                          <Building2 className="w-6 h-6" />
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 break-words">
                            {prop.name}
                          </h4>

                          <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span>{prop.type}</span>
                            <span>•</span>
                            <span className="text-[#1e3a5f] font-bold flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {propTenantsCount} Tenants
                            </span>
                          </p>

                          {prop.address && (
                            <p className="text-xs text-slate-500 flex items-start gap-1 mt-1.5 break-words">
                              <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>{prop.address}</span>
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md border bg-indigo-50 text-indigo-700 border-indigo-200">
                              Post-Paid (Fixed) • Default Due Day {prop.dueDay || 10}
                            </span>
                          </div>
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                    </div>

                    <div
                      className="flex gap-2 mt-4 pt-3 border-t border-slate-200/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openEditModal(prop)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteProperty(prop)}
                        disabled={deletingId === prop.id}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deletingId === prop.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <AddPropertyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onPropertyAdded={handleAddPropertySuccess}
      />

      {editingProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Edit Property
                </h2>
                <p className="text-sm text-gray-500">
                  Update your property details
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={savingEdit}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                aria-label="Close edit form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditProperty} className="space-y-5 p-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
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
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
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
                  className="w-full resize-y rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
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
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option>Residential Flat / Apartment</option>
                  <option>Independent House / Villa</option>
                  <option>Commercial Shop / Office</option>
                  <option>Hostel / PG Building</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/80">
                <div>
                  <label className="block text-xs font-bold text-slate-800">
                    Default Rent Due Day
                  </label>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Rent is due on this day in the following month (1–28)
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
                    className="w-16 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-slate-900 text-center outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-slate-500 font-bold">th</span>
                </div>
              </div>

              {actionError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 break-words">
                  {actionError}
                </p>
              )}

              <div className="flex gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={savingEdit}
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save size={16} />
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
