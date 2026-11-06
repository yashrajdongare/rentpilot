import React, { useState } from 'react';
import { LogOut, CheckCircle2 } from 'lucide-react';
import BottomSheet from './ui/BottomSheet';

export default function VacateModal({ isOpen, onClose, property, onVacateConfirm }) {
  if (!isOpen || !property) return null;

  const [deductions, setDeductions] = useState(0);
  const [reason, setReason] = useState('');
  const deposit = 5000;
  const refundAmount = deposit - Number(deductions || 0);

  const handleConfirm = () => {
    onVacateConfirm({
      propertyId: property.id,
      tenantName: property.tenant,
      deductions: Number(deductions),
      refundAmount,
      reason,
      vacateDate: new Date().toISOString().split('T')[0],
    });
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Vacate Property & Settle"
      subtitle={`${property.name} • ${property.tenant?.name || property.tenant || 'Tenant'}`}
    >
      <div className="space-y-4">
        {/* Deposit Summary Card */}
        <div className="rounded-tile p-3.5 glass-panel-strong border border-white/90 dark:border-white/10 space-y-1.5 text-xs text-muted dark:text-[#98a3c4]">
          <p><span className="font-extrabold text-ink dark:text-white">Property:</span> {property.name}</p>
          <p><span className="font-extrabold text-ink dark:text-white">Tenant:</span> {property.tenant?.name || property.tenant}</p>
          <p><span className="font-extrabold text-ink dark:text-white">Total Deposit:</span> ₹{deposit.toLocaleString('en-IN')}</p>
        </div>

        <div className="space-y-3 text-xs font-semibold">
          <div>
            <label className="block text-ink dark:text-white font-bold mb-1">
              Deductions (Damages / Electricity ₹)
            </label>
            <input
              type="number"
              placeholder="0"
              value={deductions}
              onChange={(e) => setDeductions(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-rose/40 transition"
            />
          </div>

          <div>
            <label className="block text-ink dark:text-white font-bold mb-1">
              Reason for Deduction (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Painting work / Last electricity bill"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-[16px] glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-rose/40 transition"
            />
          </div>

          <div className="p-3.5 rounded-tile bg-teal/15 border border-teal/25 flex justify-between items-center">
            <span className="text-teal font-extrabold text-xs">Refundable Deposit:</span>
            <span className="text-base font-black text-teal">₹{refundAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-3 rounded-btn glass-panel text-muted hover:text-ink dark:hover:text-white font-bold text-xs active:scale-95 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="py-3 px-3 rounded-btn bg-rose text-white font-extrabold text-xs shadow-md shadow-rose/25 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-4 h-4 stroke-[2.5]" />
            <span>Confirm Vacate</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
