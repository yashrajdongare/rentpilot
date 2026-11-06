import React from 'react';

export default function Avatar({
  name = 'User',
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  className = '',
}) {
  const initial = String(name || 'U').trim().charAt(0).toUpperCase() || 'U';

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs rounded-xl',
    md: 'w-10 h-10 text-sm rounded-[14px]',
    lg: 'w-12 h-12 text-base rounded-2xl',
    xl: 'w-16 h-16 text-xl rounded-[22px]',
  };

  return (
    <div
      className={`bg-gradient-to-br from-primary to-primary2 text-white flex items-center justify-center font-extrabold shadow-md shadow-primary/25 border border-white/20 shrink-0 select-none ${sizeClasses[size] || sizeClasses.md
        } ${className}`}
    >
      {initial}
    </div>
  );
}

