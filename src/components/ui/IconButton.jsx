import React from 'react';

export default function IconButton({
  icon: Icon,
  onClick,
  label,
  variant = 'glass', // 'glass' | 'gradient' | 'danger' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  badge = false,
  badgeColor = 'rose',
  disabled = false,
  className = '',
  ...props
}) {
  const sizeClasses = {
    sm: 'w-8 h-8 p-1.5 rounded-xl',
    md: 'w-10 h-10 p-2 rounded-[14px]',
    lg: 'w-12 h-12 p-3 rounded-2xl',
  };

  const variantClasses = {
    glass: 'glass-panel text-ink dark:text-white hover:bg-white dark:hover:bg-[#1c244c] active:scale-95 border border-white/80 dark:border-white/15',
    gradient: 'bg-gradient-to-br from-primary to-primary2 text-white shadow-lg shadow-primary/30 hover:shadow-xl active:scale-95 border border-white/20',
    danger: 'bg-rose/15 text-rose border border-rose/30 hover:bg-rose/25 active:scale-95',
    ghost: 'bg-transparent text-muted dark:text-[#94a3b8] hover:text-ink dark:hover:text-white hover:bg-white/10 active:scale-95 border-transparent',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`relative inline-flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses[size] || sizeClasses.md
        } ${variantClasses[variant] || variantClasses.glass} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-5 h-5 stroke-[2]" />}
      {badge && (
        <span
          className={`absolute top-2 right-2 w-2 h-2 rounded-full ${badgeColor === 'rose' ? 'bg-rose ring-2 ring-white dark:ring-[#080c1d]' : 'bg-teal ring-2 ring-white dark:ring-[#080c1d]'
            }`}
        />
      )}
    </button>
  );
}

