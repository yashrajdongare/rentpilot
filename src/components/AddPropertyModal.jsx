
import React, { useState } from 'react';
import { X, Building2, MapPin, Info } from 'lucide-react';

export default function AddPropertyModal({
  isOpen,
  onClose,
  onPropertyAdded,
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState('Residential Flat / Apartment');
  const [dueDay, setDueDay] = useState('10');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter a property name.');
      return;
    }

    const dayNum = Number(dueDay);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 28) {
      setError('Rent due day must be between 1 and 28.');
      return;
    }

    setIsSaving(true);

    try {
      await onPropertyAdded({
        name: name.trim(),
        address: address.trim(),
        type,
        rent: 0, // Rent is defined individually per tenant/room type
        rentCollectionMode: 'POST_PAID',
        rentCalculationMethod: 'FIXED',
        dueDay: dayNum,
        status: 'Vacant',
      });

      setName('');
      setAddress('');
      setType('Residential Flat / Apartment');
      setDueDay('10');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save property. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Add Property
              </h2>
              <p className="text-sm text-gray-500">
                Enter your property details
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Property Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shree Apartment"
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <MapPin size={16} />
              Property Address
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter street, area, city, or full address"
              rows={2}
              className="w-full resize-y rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Property Type *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                Post-paid rent is due on this day in the following month (1–28)
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                max="28"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="10"
                required
                className="w-16 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-slate-900 text-center outline-none focus:border-[#1e3a5f]"
              />
              <span className="text-xs text-slate-500 font-bold">th</span>
            </div>
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

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
