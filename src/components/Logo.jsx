import React from 'react';

export default function Logo({ size = 'md', showText = true, className = '' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <img
        src="/logo.png"
        alt="RentPilot Logo"
        className={`${sizeClasses[size] || sizeClasses.md} rounded-xl object-contain shadow-xs shrink-0`}
      />

      {showText && (
        <div className="leading-none">
          <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
            Rent<span className="text-[#1e3a5f]">Pilot</span>
          </h1>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
            Property Dashboard
          </p>
        </div>
      )}
    </div>
  );
}