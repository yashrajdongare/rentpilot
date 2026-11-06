import React from 'react';

export default function Skeleton({
  className = '',
  rounded = 'rounded-tile',
  style,
  ...props
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden bg-slate-200/60 dark:bg-white/10 ${rounded} ${className}`}
      style={style}
      {...props}
    >
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  );
}

export function TenantRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-tile glass-panel">
      <Skeleton className="w-10 h-10 shrink-0" rounded="rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="w-32 h-3.5" rounded="rounded-md" />
        <Skeleton className="w-48 h-3" rounded="rounded-md" />
      </div>
      <Skeleton className="w-16 h-8 shrink-0" rounded="rounded-btn" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-fade-up">
      <Skeleton className="w-full h-56" rounded="rounded-card" />
      <div className="grid grid-cols-4 gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20" rounded="rounded-tile" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" rounded="rounded-tile" />
        ))}
      </div>
      <Skeleton className="w-full h-64" rounded="rounded-card" />
    </div>
  );
}

