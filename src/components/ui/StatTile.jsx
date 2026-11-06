import React from 'react';

export default function StatTile({
  icon: Icon,
  label,
  value,
  sublabel,
  color = 'primary', // 'primary' | 'teal' | 'rose' | 'amber' | 'indigo'
  onClick,
  className = '',
}) {
  const colorStyles = {
    primary: {
      bg: 'bg-primary/15 dark:bg-primary/25 text-primary dark:text-[#a5b4fc]',
      border: 'border-primary/20 dark:border-primary/40',
    },
    teal: {
      bg: 'bg-teal/15 dark:bg-teal/25 text-teal dark:text-[#2dd4bf]',
      border: 'border-teal/20 dark:border-teal/40',
    },
    rose: {
      bg: 'bg-rose/15 dark:bg-rose/25 text-rose dark:text-[#fb7185]',
      border: 'border-rose/20 dark:border-rose/40',
    },
    amber: {
      bg: 'bg-amber/15 dark:bg-amber/25 text-amber dark:text-[#fbbf24]',
      border: 'border-amber/20 dark:border-amber/40',
    },
    indigo: {
      bg: 'bg-primary2/15 dark:bg-primary2/25 text-primary2 dark:text-[#c4b5fd]',
      border: 'border-primary2/20 dark:border-primary2/40',
    },
  };

  const style = colorStyles[color] || colorStyles.primary;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`rounded-tile p-3.5 sm:p-4 glass-panel text-center sm:text-left transition-all duration-200 ${onClick ? 'cursor-pointer active:scale-95 hover:border-primary/40' : ''
        } ${className}`}
    >
      {Icon && (
        <div className={`w-9 h-9 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center mx-auto sm:mx-0 mb-2 transition-transform duration-200`}>
          <Icon className="w-4 h-4 stroke-[2]" />
        </div>
      )}
      <p className="text-[10px] font-bold tracking-wider uppercase text-muted dark:text-[#98a3c4]">
        {label}
      </p>
      <p className="text-xl sm:text-2xl font-black text-ink dark:text-[#eef1ff] mt-0.5 tracking-tight">
        {value}
      </p>
      {sublabel && (
        <p className="text-[10px] font-medium text-muted dark:text-[#98a3c4] mt-0.5 truncate">
          {sublabel}
        </p>
      )}
    </div>
  );
}

