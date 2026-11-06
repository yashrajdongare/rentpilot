import React, { useState } from 'react';
import { MapPin, Info, Plus } from 'lucide-react';
import BottomSheet from './ui/BottomSheet';

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
        rent: 0,
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
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add Property"
      subtitle="Enter your property details"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Property Name */}
        <div>
          <label className="block text-xs font-bold text-ink dark:text-white mb-1">
            Property Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Shree Apartment / Galaxy Flats"
            required
            className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
          />
        </div>

        {/* Address */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold text-ink dark:text-white mb-1">
            <MapPin className="w-3.5 h-3.5 text-primary stroke-[2]" />
            Property Address
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter street, area, city, or address..."
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition resize-y"
          />
        </div>

        {/* Property Type */}
        <div>
          <label className="block text-xs font-bold text-ink dark:text-white mb-1">
            Property Type *
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
          >
            <option value="Residential Flat / Apartment">Residential Flat / Apartment</option>
            <option value="Independent House / Villa">Independent House / Villa</option>
            <option value="Commercial Shop / Office">Commercial Shop / Office</option>
            <option value="Hostel / PG Building">Hostel / PG Building</option>
          </select>
        </div>

        {/* Due Day */}
        <div className="flex items-center justify-between p-3.5 rounded-tile glass-panel border border-white/80 dark:border-white/10">
          <div>
            <label className="block text-xs font-bold text-ink dark:text-white">
              Default Rent Due Day
            </label>
            <p className="text-[10px] text-muted dark:text-[#98a3c4] font-medium mt-0.5">
              Rent due date in following month (1–28)
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
              className="w-16 px-2.5 py-1.5 rounded-btn glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-extrabold text-ink dark:text-white text-center focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-xs text-muted font-bold">th</span>
          </div>
        </div>

        {/* Policy note */}
        <div className="p-3.5 rounded-tile glass-panel bg-primary/5 border border-primary/15 text-xs space-y-2">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-primary shrink-0 stroke-[2]" />
            <span className="font-extrabold text-ink dark:text-white text-xs">
              Billing Model (Fixed Post-Paid)
            </span>
          </div>
          <p className="text-[11px] text-muted dark:text-[#98a3c4] leading-relaxed">
            Rent is tracked after the rental month completes. First month is prorated from move-in date, then full calendar months.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-btn bg-rose/15 border border-rose/30 text-rose text-xs font-bold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="py-3 px-3 rounded-btn glass-panel text-muted hover:text-ink dark:hover:text-white font-bold text-xs active:scale-95 transition disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="py-3 px-3 rounded-btn bg-gradient-to-br from-[#3d4fe0] to-[#6a5cf0] text-white font-extrabold text-xs shadow-md shadow-[#3d4fe0]/25 active:scale-95 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{isSaving ? 'Saving...' : 'Save Property'}</span>
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
