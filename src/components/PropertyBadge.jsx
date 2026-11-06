import React from 'react';

/**
 * PropertyBadge - High-Resolution RentPilot Brand Logo for Dashboard Header
 */
export default function PropertyBadge({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-10 h-10 rounded-xl p-1',
    md: 'w-13 h-13 sm:w-14 sm:h-14 rounded-2xl p-1.5',
    lg: 'w-16 h-16 rounded-2xl p-2',
  };

  return (
    <div className={`relative group shrink-0 ${className}`}>
      {/* Crisp Crystal Glass Frame with no tint overlay so logo colors are 100% pure */}
      <div
        className={`${sizeClasses[size] || sizeClasses.md} bg-white/90 dark:bg-[#121a36]/85 backdrop-blur-[24px] flex items-center justify-center border border-white dark:border-white/20 shadow-glass-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-glass select-none overflow-hidden relative`}
      >
        {/* Official High-Resolution RentPilot Logo */}
        <img
          src="/logo.png"
          alt="RentPilot Logo"
          loading="eager"
          decoding="sync"
          className="w-full h-full object-contain rounded-xl relative z-10 transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    </div>
  );
}
