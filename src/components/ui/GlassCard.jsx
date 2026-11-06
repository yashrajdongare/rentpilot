import React from 'react';

export default function GlassCard({
  children,
  className = '',
  strong = false,
  onClick,
  ...props
}) {
  const baseClasses = strong
    ? 'glass-panel-strong'
    : 'glass-panel';

  return (
    <div
      onClick={onClick}
      className={`rounded-card p-5 sm:p-6 transition-all duration-200 ${baseClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

