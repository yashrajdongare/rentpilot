import React, { useState } from 'react';
import { X, LogOut, CheckCircle2 } from 'lucide-react';

export default function VacateModal({ isOpen, onClose, property, onVacateConfirm }) {
  if (!isOpen || !property) return null;

  const [deductions, setDeductions] = useState(0);
  const [reason, setReason] = useState('');
  const deposit = 5000; // उदाहरणार्थ डिपॉझिट
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <LogOut className="w-5 h-5 text-rose-600" />
            <h3 className="text-base font-bold text-slate-900">Vacate Property & Settle</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl mb-4 space-y-1.5 text-xs text-slate-600">
          <p><span className="font-bold text-slate-800">Property:</span> {property.name}</p>
          <p><span className="font-bold text-slate-800">Tenant:</span> {property.tenant?.name || property.tenant}</p>
          <p><span className="font-bold text-slate-800">Total Deposit:</span> ₹{deposit}</p>
        </div>

        <div className="space-y-3 text-xs font-semibold">
          <div>
            <label className="block text-slate-700 mb-1">Deduction (डॅमेज/लाईट बिल कपात ₹)</label>
            <input
              type="number"
              placeholder="0"
              value={deductions}
              onChange={(e) => setDeductions(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1">Reason for Deduction (ऐच्छिक)</label>
            <input
              type="text"
              placeholder="उदा. रंगकाम / शेवटचे लाईट बिल"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex justify-between items-center">
            <span className="text-emerald-900 font-bold">परत करावयाचे डिपॉझिट (Refund):</span>
            <span className="text-base font-black text-emerald-700">₹{refundAmount}</span>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow transition"
            >
              Vacate & Free Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}