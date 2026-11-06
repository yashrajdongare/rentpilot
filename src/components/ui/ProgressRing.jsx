import React from 'react';

export default function ProgressRing({
  percentage = 0,
  size = 110,
  strokeWidth = 10,
  label = 'collected',
  className = '',
}) {
  const cleanPercent = Math.max(0, Math.min(100, Math.round(percentage) || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (cleanPercent / 100) * circumference;

  const gradientId = 'progressGradientRing';

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 transform"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00d2d3" />
            <stop offset="50%" stopColor="#0ea5a0" />
            <stop offset="100%" stopColor="#7058f4" />
          </linearGradient>
        </defs>

        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-slate-200/60 dark:stroke-white/10"
          fill="none"
        />

        {/* Animated Progress Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={`url(#${gradientId})`}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out motion-reduce:transition-none drop-shadow-[0_2px_8px_rgba(14,165,160,0.35)]"
        />
      </svg>

      {/* Percentage and Label in Center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl sm:text-2xl font-black text-ink dark:text-white tracking-tight leading-none">
          {cleanPercent}%
        </span>
        {label && (
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted dark:text-[#a5b4fc] mt-0.5">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

