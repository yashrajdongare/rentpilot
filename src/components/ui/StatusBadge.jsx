import React from 'react';
import { Check, Clock, AlertTriangle } from 'lucide-react';

export default function StatusBadge({ status, className = '' }) {
  const norm = String(status || '').toUpperCase();

  if (norm === 'PAID') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-teal/15 text-teal border border-teal/30 dark:bg-teal/20 dark:text-[#2dd4bf] dark:border-teal/40 shrink-0 ${className}`}>
        <Check className="w-3 h-3 stroke-[2.5]" />
        <span>Paid</span>
      </span>
    );
  }

  if (norm === 'DUE_TODAY' || norm === 'TODAY') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber/15 text-amber border border-amber/30 dark:bg-amber/20 dark:text-[#fbbf24] dark:border-amber/40 shrink-0 ${className}`}>
        <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
        <span>Due Today</span>
      </span>
    );
  }

  if (norm === 'PENDING' || norm === 'DUE' || norm === 'UNPAID') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-rose/15 text-rose border border-rose/30 dark:bg-rose/20 dark:text-[#fb7185] dark:border-rose/40 shrink-0 ${className}`}>
        <Clock className="w-3 h-3 stroke-[2.5]" />
        <span>Pending</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-muted/15 text-muted border border-muted/25 dark:bg-white/10 dark:text-[#cbd5e1] dark:border-white/15 shrink-0 ${className}`}>
      <span>{status || 'Inactive'}</span>
    </span>
  );
}

