import React, { useState } from 'react';
import { Zap } from 'lucide-react';

export default function ElectricityCalculator({ onCalculate }) {
  const [prevReading, setPrevReading] = useState('');
  const [currReading, setCurrReading] = useState('');
  const [unitRate, setUnitRate] = useState('10');

  const prev = Number(prevReading) || 0;
  const curr = Number(currReading) || 0;
  const rate = Number(unitRate) || 0;

  const unitsConsumed = curr > prev ? curr - prev : 0;
  const totalBill = unitsConsumed * rate;

  const handleApply = () => {
    if (onCalculate) {
      onCalculate(totalBill);
    }
  };

  return (
    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 mb-2 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          Sub-meter Calculator
        </span>
        <span className="text-[10px] text-slate-500 font-bold">
          Units: <strong className="text-slate-900">{unitsConsumed}</strong>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">Prev</label>
          <input
            type="number"
            placeholder="0"
            value={prevReading}
            onChange={(e) => setPrevReading(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">Current</label>
          <input
            type="number"
            placeholder="0"
            value={currReading}
            onChange={(e) => setCurrReading(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">Rate/Unit</label>
          <input
            type="number"
            value={unitRate}
            onChange={(e) => setUnitRate(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-bold text-slate-800">
          Bill: <strong className="text-blue-600">₹{totalBill}</strong>
        </span>
        <button
          type="button"
          onClick={handleApply}
          className="px-3 py-1 bg-[#0f172a] hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold transition active:scale-95"
        >
          Apply Amount
        </button>
      </div>
    </div>
  );
}