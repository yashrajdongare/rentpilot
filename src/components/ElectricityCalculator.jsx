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
    <div className="rounded-tile p-3.5 glass-panel border border-white/80 dark:border-white/10 mb-2 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold text-ink dark:text-white flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber fill-amber" />
          Sub-meter Calculator
        </span>
        <span className="text-[10px] text-muted dark:text-[#98a3c4] font-bold">
          Units: <strong className="text-ink dark:text-white">{unitsConsumed}</strong>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] text-muted font-bold mb-0.5">Prev</label>
          <input
            type="number"
            placeholder="0"
            value={prevReading}
            onChange={(e) => setPrevReading(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-btn glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted font-bold mb-0.5">Current</label>
          <input
            type="number"
            placeholder="0"
            value={currReading}
            onChange={(e) => setCurrReading(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-btn glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted font-bold mb-0.5">Rate/Unit</label>
          <input
            type="number"
            value={unitRate}
            onChange={(e) => setUnitRate(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-btn glass-panel-strong border border-white/90 dark:border-white/10 text-xs font-bold text-ink dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-bold text-ink dark:text-white">
          Bill: <strong className="text-primary dark:text-[#8d99ff] font-extrabold">₹{totalBill.toLocaleString('en-IN')}</strong>
        </span>
        <button
          type="button"
          onClick={handleApply}
          className="px-2.5 py-1 rounded-btn bg-primary/10 hover:bg-primary/20 text-primary dark:text-[#8d99ff] text-xs font-extrabold active:scale-95 transition"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
