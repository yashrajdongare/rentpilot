import React from 'react';

export default function Logo({ size = 'md', showText = true, className = '', lightText = false }) {
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-9 h-9 rounded-xl',
    lg: 'w-11 h-11 rounded-2xl',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className={`${sizeClasses[size] || sizeClasses.md} p-1 glass-panel flex items-center justify-center shrink-0 shadow-glass-sm`}>
        <img
          src="/logo.png"
          alt="RentPilot"
          className="w-full h-full object-contain rounded-lg"
        />
      </div>

      {showText && (
        <div className="leading-none">
          <h1 className={`text-base font-extrabold tracking-tight leading-none ${lightText ? 'text-white' : 'text-ink dark:text-white'}`}>
            Rent<span className="bg-gradient-to-r from-primary to-primary2 bg-clip-text text-transparent">Pilot</span>
          </h1>
          <p className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${lightText ? 'text-slate-300' : 'text-muted dark:text-[#98a3c4]'}`}>
            Property Dashboard
          </p>
        </div>
      )}
    </div>
  );
}
