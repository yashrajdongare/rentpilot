import React from 'react';

export default function BarChart({
  data = [], // [{ month: 'Oct', percent: 85, isCurrent: true, label: '₹45,000' }, ...]
  className = '',
}) {
  if (!data || data.length === 0) return null;

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-end justify-between gap-2 h-36 pt-4 pb-1 px-1">
        {data.map((item, index) => {
          const heightPercent = Math.max(8, Math.min(100, Math.round(item.percent) || 0));
          const isCurrent = Boolean(item.isCurrent);

          return (
            <div
              key={item.month || index}
              className="flex-1 flex flex-col items-center justify-end h-full group relative"
            >
              {/* Tooltip on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-7 pointer-events-none z-10 bg-ink dark:bg-white text-white dark:text-ink text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md whitespace-nowrap">
                {item.percent}% {item.label ? `· ${item.label}` : ''}
              </div>

              {/* Bar container */}
              <div className="w-full max-w-[34px] bg-slate-200/60 dark:bg-white/10 rounded-xl h-full flex items-end p-1 overflow-hidden">
                <div
                  className={`w-full rounded-lg transition-all duration-700 ease-out animate-bar-grow motion-reduce:animate-none ${isCurrent
                      ? 'bg-gradient-to-t from-primary to-primary2 shadow-md shadow-primary/40'
                      : 'bg-muted/30 dark:bg-white/20 hover:bg-muted/50 dark:hover:bg-white/30'
                    }`}
                  style={{
                    height: `${heightPercent}%`,
                    animationDelay: `${index * 80}ms`,
                  }}
                />
              </div>

              {/* Month Label */}
              <span
                className={`text-[10px] font-bold mt-2 truncate ${isCurrent
                    ? 'text-primary dark:text-[#a5b4fc] font-black'
                    : 'text-muted dark:text-[#94a3b8]'
                  }`}
              >
                {item.month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

