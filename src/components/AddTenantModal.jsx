
import React, { useState, useEffect } from 'react';
import { X, UserPlus, MapPin, Calendar, Info, ShieldCheck, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AddTenantModal({
  isOpen,
  onClose,
  onTenantAdded,
}) {
  const DRAFT_KEY = 'rentpilot_add_tenant_draft_v1';
  const readDraft = () => {
    try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}'); }
    catch { return {}; }
  };
  const todayStr = new Date().toLocaleDateString('en-CA');
  const [name, setName] = useState(() => readDraft().name || '');
  const [phone, setPhone] = useState(() => readDraft().phone || '');
  const [selectedProperty, setSelectedProperty] = useState(() => readDraft().selectedProperty || '');
  const [flatNo, setFlatNo] = useState(() => readDraft().flatNo || '');
  const [roomType, setRoomType] = useState(() => readDraft().roomType || '1 BHK');
  const [address, setAddress] = useState(() => readDraft().address || '');
  const [rent, setRent] = useState(() => readDraft().rent || '');
  const [deposit, setDeposit] = useState(() => readDraft().deposit || '');
  const [aadharNumber, setAadharNumber] = useState(() => readDraft().aadharNumber || '');
  const [aadharFile, setAadharFile] = useState(null);
  const [aadharPreview, setAadharPreview] = useState('');
  
  // Important Dates
  const [moveInDate, setMoveInDate] = useState(() => readDraft().moveInDate || todayStr);

  // Lease Type
  const [leaseType, setLeaseType] = useState(() => readDraft().leaseType || 'UNTIL_LEAVES'); // 'UNTIL_LEAVES' | 'FIXED_DEFINED'
  const [leaseStartDate, setLeaseStartDate] = useState(() => readDraft().leaseStartDate || todayStr);
  const [leasePeriodValue, setLeasePeriodValue] = useState(() => readDraft().leasePeriodValue || '1');
  const [leasePeriodUnit, setLeasePeriodUnit] = useState(() => readDraft().leasePeriodUnit || 'YEAR');

  // Fixed post-paid billing settings
  const rentCalculationMethod = 'FIXED';
  const rentCollectionMode = 'POST_PAID';
  const [dueDay, setDueDay] = useState(() => readDraft().dueDay || '10');

  const [properties, setProperties] = useState([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Live calculated lease expiry date e.g. "28 Oct, 27"
  const calculatedLeaseExpiry = React.useMemo(() => {
    if (!leaseStartDate) return '';
    const d = new Date(`${leaseStartDate}T12:00:00`);
    const val = Number(leasePeriodValue) || 1;
    if (leasePeriodUnit === 'YEAR') {
      d.setFullYear(d.getFullYear() + val);
    } else {
      d.setMonth(d.getMonth() + val);
    }
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  }, [leaseStartDate, leasePeriodValue, leasePeriodUnit]);

  const isoLeaseExpiryDate = React.useMemo(() => {
    if (!leaseStartDate) return null;
    const d = new Date(`${leaseStartDate}T12:00:00`);
    const val = Number(leasePeriodValue) || 1;
    if (leasePeriodUnit === 'YEAR') {
      d.setFullYear(d.getFullYear() + val);
    } else {
      d.setMonth(d.getMonth() + val);
    }
    return d.toLocaleDateString('en-CA');
  }, [leaseStartDate, leasePeriodValue, leasePeriodUnit]);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        name, phone, selectedProperty, flatNo, address, rent, deposit,
        moveInDate, leaseType, leaseStartDate, leasePeriodValue, leasePeriodUnit,
        dueDay,
      }));
    } catch (storageError) {
      console.warn('Could not preserve Add Tenant draft:', storageError);
    }
  }, [name, phone, selectedProperty, flatNo, address, rent, deposit,
      moveInDate, leaseType, leaseStartDate, leasePeriodValue, leasePeriodUnit,
      dueDay]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadProperties() {
      setIsLoadingProperties(true);
      setError('');

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;

        const user = authData?.user;

        if (!user) {
          throw new Error('Please sign in before adding a tenant.');
        }

        const { data, error: propertiesError } = await supabase
          .from('properties')
          .select('id, name, base_monthly_rent, rent_collection_mode, rent_calculation_method, due_day')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false });

        if (propertiesError) throw propertiesError;

        if (cancelled) return;

        const loadedProperties = data || [];
        setProperties(loadedProperties);

        setSelectedProperty((current) => {
          const stillExists = loadedProperties.some(
            (property) => property.id === current
          );

          const chosen = stillExists
            ? current
            : loadedProperties[0]?.id || '';

          // If default selected, inherit its dueDay
          const chosenProp = loadedProperties.find(p => p.id === chosen);
          if (chosenProp && chosenProp.due_day) {
            setDueDay(String(chosenProp.due_day));
          }

          return chosen;
        });

        setRent((current) => {
          if (current !== '') return current;

          return loadedProperties.length > 0
            ? String(loadedProperties[0].base_monthly_rent ?? '')
            : '';
        });
      } catch (err) {
        console.error('Error loading properties:', err);

        if (!cancelled) {
          setError(err.message || 'Could not load your properties.');
        }
      } finally {
        if (!cancelled) setIsLoadingProperties(false);
      }
    }

    loadProperties();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePropertyChange = (propertyId) => {
    setSelectedProperty(propertyId);

    const selected = properties.find(
      (property) => property.id === propertyId
    );

    setRent(
      selected?.base_monthly_rent != null
        ? String(selected.base_monthly_rent)
        : ''
    );

    // Inherit due day from property
    if (selected && selected.due_day) {
      setDueDay(String(selected.due_day));
    }
  };

  const handleAadharFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAadharFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setAadharPreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setSelectedProperty('');
    setFlatNo('');
    setRoomType('1 BHK');
    setAddress('');
    setRent('');
    setDeposit('');
    setAadharNumber('');
    setAadharFile(null);
    setAadharPreview('');
    setMoveInDate(todayStr);
    setLeaseType('UNTIL_LEAVES');
    setLeaseStartDate(todayStr);
    setLeasePeriodValue('1');
    setLeasePeriodUnit('YEAR');
    setDueDay('10');
    setError('');
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* storage may be unavailable */ }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSaving) return;

    if (!selectedProperty) {
      setError('Please select a property first.');
      return;
    }

    if (!name.trim() || !phone.trim()) {
      setError('Please enter the tenant name and phone number.');
      return;
    }

    const monthlyRent = Number(rent);
    const securityDeposit = Number(deposit || 0);

    if (!Number.isFinite(monthlyRent) || monthlyRent < 0) {
      setError('Please enter a valid monthly rent.');
      return;
    }

    if (!Number.isFinite(securityDeposit) || securityDeposit < 0) {
      setError('Please enter a valid security deposit.');
      return;
    }

    const rentDueDay = Number(dueDay);
    if (!Number.isInteger(rentDueDay) || rentDueDay < 1 || rentDueDay > 28) {
      setError('Rent due day must be between 1 and 28.');
      return;
    }

    if (!moveInDate) {
      setError('Please select a move-in date.');
      return;
    }

    setIsSaving(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const user = authData?.user;

      if (!user) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const selected = properties.find(
        (property) => property.id === selectedProperty
      );

      if (!selected) {
        throw new Error('The selected property is unavailable. Reload the form and try again.');
      }

      const combinedUnitLabel = flatNo.trim()
        ? `${flatNo.trim()} (${roomType})`
        : roomType;

      const tenantNotesObj = {
        room_type: roomType,
        aadhar_number: aadharNumber.trim() || undefined,
      };

      const { data: newTenant, error: insertError } = await supabase
        .from('tenants')
        .insert({
          owner_id: user.id,
          property_id: selected.id,
          full_name: name.trim(),
          phone: phone.trim(),
          permanent_address: address.trim() || null,
          unit_label: combinedUnitLabel,
          monthly_rent: monthlyRent,
          security_deposit: securityDeposit,
          move_in_date: moveInDate,
          rent_start_date: moveInDate,
          rent_collection_mode: 'POST_PAID',
          rent_calculation_method: 'FIXED',
          due_day: rentDueDay,
          lease_type: leaseType || 'UNTIL_LEAVES',
          lease_start_date: leaseType === 'FIXED_DEFINED' ? (leaseStartDate || moveInDate) : null,
          lease_period_value: leaseType === 'FIXED_DEFINED' ? (Number(leasePeriodValue) || 1) : null,
          lease_period_unit: leaseType === 'FIXED_DEFINED' ? leasePeriodUnit : null,
          lease_expires_on: leaseType === 'FIXED_DEFINED' ? isoLeaseExpiryDate : null,
          notes: JSON.stringify(tenantNotesObj),
          status: 'active',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // If an ID proof photo was uploaded, insert it into tenant_documents
      if (aadharPreview && newTenant?.id) {
        try {
          await supabase.from('tenant_documents').insert({
            owner_id: user.id,
            tenant_id: newTenant.id,
            document_type: 'aadhaar',
            file_path: aadharPreview,
            file_name: aadharFile?.name || 'aadhaar_card.jpg',
            mime_type: aadharFile?.type || 'image/jpeg',
            file_size_bytes: aadharFile?.size || 0,
          });
        } catch (docErr) {
          console.warn('Could not save document record:', docErr);
        }
      }

      await onTenantAdded({
        ...newTenant,
        rentCollectionMode: 'POST_PAID',
        rentCalculationMethod: 'FIXED',
        dueDay: rentDueDay,
        rentStartDate: moveInDate,
        moveInDate,
        leaseType: newTenant.lease_type || leaseType,
        leaseExpiresOn: calculatedLeaseExpiry,
      });
      resetForm();
    } catch (err) {
      console.error('Error saving tenant:', err);
      setError(err.message || 'Could not save the tenant. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-[28px] p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1e3a5f]/10 text-[#1e3a5f] flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <h2 className="text-base font-black text-slate-900">
              Add New Tenant
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-full disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs font-semibold">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-slate-600 mb-1">
              Tenant Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1">
              Phone Number (WhatsApp) *
            </label>
            <input
              type="tel"
              required
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 mb-1">
                Select Property *
              </label>

              {isLoadingProperties ? (
                <p className="text-[11px] text-slate-500 py-2">
                  Loading properties...
                </p>
              ) : properties.length === 0 ? (
                <p className="text-[11px] text-rose-500">
                  No properties found. Add a property first.
                </p>
              ) : (
                <select
                  required
                  value={selectedProperty}
                  onChange={(e) => handlePropertyChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                >
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-slate-600 mb-1">
                Room / Property Type *
              </label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
              >
                <option value="Single Room">Single Room</option>
                <option value="1 RK">1 RK</option>
                <option value="1 BHK">1 BHK</option>
                <option value="2 BHK">2 BHK</option>
                <option value="3 BHK">3 BHK</option>
                <option value="4 BHK">4 BHK</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-600 mb-1">
              Flat / Room No. (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 101 or Unit A"
              value={flatNo}
              onChange={(e) => setFlatNo(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#1e3a5f]" />
              <span>Permanent Address</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. 123 Main Street, Pune - 411001"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f] resize-none"
            />
          </div>

          {/* ── KYC & Document Records (Aadhaar) ────────────────────── */}
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#1e3a5f]" />
              <span className="text-xs font-bold text-slate-800">KYC &amp; ID Records (Optional)</span>
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">
                Aadhaar / ID Card Number
              </label>
              <input
                type="text"
                placeholder="e.g. 1234 5678 9012"
                value={aadharNumber}
                onChange={(e) => setAadharNumber(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">
                Upload Aadhaar / ID Card Photo
              </label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-dashed border-slate-300 hover:border-[#1e3a5f] rounded-xl text-xs font-semibold text-slate-600 transition">
                  <Upload className="w-3.5 h-3.5 text-[#1e3a5f]" />
                  <span className="truncate">{aadharFile ? aadharFile.name : 'Choose ID Photo'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleAadharFileChange}
                    className="hidden"
                  />
                </label>
                {aadharPreview && (
                  <img
                    src={aadharPreview}
                    alt="ID Preview"
                    className="w-9 h-9 object-cover rounded-lg border border-slate-200 shadow-xs shrink-0"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 mb-1">
                Monthly Rent (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
              />
            </div>

            <div>
              <label className="block text-slate-600 mb-1">
                Security Deposit (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
              />
            </div>
          </div>

          {/* ── Important Dates ───────────────────────────────────────── */}
          <div className="space-y-1.5 p-3 rounded-2xl border border-slate-200 bg-slate-50/80">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                Move In Date *
              </label>
              <span className="text-[10px] text-slate-500 font-medium">
                Controls rent accrual start
              </span>
            </div>
            <input
              type="date"
              required
              value={moveInDate}
              onChange={(e) => {
                setMoveInDate(e.target.value);
                if (leaseType === 'FIXED_DEFINED' && (!leaseStartDate || leaseStartDate === moveInDate)) {
                  setLeaseStartDate(e.target.value);
                }
              }}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
            />
          </div>

          {/* ── Rent Due Day ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/80">
            <div>
              <label className="block text-xs font-bold text-slate-800">
                Rent Due Day
              </label>
              <p className="text-[10px] text-slate-500 font-medium">
                Due on this day in the following month (1–28)
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                max="28"
                required
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="10"
                className="w-16 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-center outline-none focus:border-[#1e3a5f]"
              />
              <span className="text-xs text-slate-500 font-bold">th</span>
            </div>
          </div>

          {/* ── Lease Type ────────────────────────────────────────────── */}
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <label className="block text-xs font-bold text-slate-800">
              Lease Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex cursor-pointer items-center gap-2 p-2 rounded-xl border transition ${
                  leaseType === 'UNTIL_LEAVES'
                    ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="leaseType"
                  value="UNTIL_LEAVES"
                  checked={leaseType === 'UNTIL_LEAVES'}
                  onChange={() => setLeaseType('UNTIL_LEAVES')}
                  className="accent-[#1e3a5f]"
                />
                <span className="text-[11px] font-bold text-slate-900">
                  Until Tenant Leaves
                </span>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-2 p-2 rounded-xl border transition ${
                  leaseType === 'FIXED_DEFINED'
                    ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="leaseType"
                  value="FIXED_DEFINED"
                  checked={leaseType === 'FIXED_DEFINED'}
                  onChange={() => setLeaseType('FIXED_DEFINED')}
                  className="accent-[#1e3a5f]"
                />
                <span className="text-[11px] font-bold text-slate-900">
                  Fixed and Defined
                </span>
              </label>
            </div>

            {leaseType === 'FIXED_DEFINED' && (
              <div className="pt-2 space-y-2 border-t border-slate-200/80">
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-0.5">
                    Lease Start Date
                  </label>
                  <input
                    type="date"
                    value={leaseStartDate}
                    onChange={(e) => setLeaseStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 items-center">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-0.5">
                      Lease Period
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={leasePeriodValue}
                      onChange={(e) => setLeasePeriodValue(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-0.5">
                      Unit
                    </label>
                    <select
                      value={leasePeriodUnit}
                      onChange={(e) => setLeasePeriodUnit(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e3a5f]"
                    >
                      <option value="YEAR">YEAR</option>
                      <option value="MONTH">MONTH</option>
                    </select>
                  </div>
                </div>

                <p className="text-xs font-bold text-rose-600 italic">
                  Lease Expires on : <span className="font-extrabold">{calculatedLeaseExpiry}</span>
                </p>
              </div>
            )}
          </div>

          {/* Explanatory Policy Note */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-xs space-y-2.5">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#1e3a5f] shrink-0" />
              <p className="font-bold text-slate-900 text-xs">
                Billing Model Information
              </p>
            </div>

            <div className="space-y-1 pl-6 border-l-2 border-[#1e3a5f]/30">
              <p className="font-extrabold text-[#1e3a5f] text-[11px] uppercase tracking-wider">
                Post-Paid
              </p>
              <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                Choose If you take rent <strong>AFTER</strong> a Month is Completed.<br />
                <span className="text-slate-500 italic">Eg : Let &apos;Month&apos; is May and you want to receive rent of April</span>
              </p>
            </div>

            <div className="space-y-1 pl-6 border-l-2 border-[#1e3a5f]/30">
              <p className="font-extrabold text-[#1e3a5f] text-[11px] uppercase tracking-wider">
                Fixed
              </p>
              <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                First Month Partial Rent Will Be Calculated from <strong>{'{15, Mar to 31, Mar}'}</strong>. After that for Next Month <strong>{'{1, Apr to 30, Apr}'}</strong>. Similarly For Each Consecutive Months.
              </p>
            </div>
          </div>

          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                isSaving ||
                isLoadingProperties ||
                properties.length === 0
              }
              className="w-1/2 py-3 bg-[#1e3a5f] hover:bg-[#162b47] text-white rounded-xl font-bold transition shadow-md shadow-[#1e3a5f]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
