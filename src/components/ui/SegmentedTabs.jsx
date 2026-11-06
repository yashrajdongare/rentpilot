import React from 'react';

export default function SegmentedTabs({
  tabs = [], // [{ id: 'DUE', label: 'Pending', count: 5, color: 'rose' }, ...]
  activeTab,
  onChange,
  className = '',
}) {
  return (
    <div
      role="tablist"
      className={`flex p-1 rounded-tile glass-panel-strong gap-1 overflow-x-auto no-scrollbar ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex-1 min-w-[72px] sm:min-w-[80px] py-1.5 px-2.5 rounded-btn text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95 ${
              isActive
                ? 'bg-white dark:bg-[#1a234a] text-ink dark:text-white shadow-glass-sm border border-white/90 dark:border-white/20 font-extrabold'
                : 'text-muted dark:text-[#94a3b8] hover:text-ink dark:hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  isActive
                    ? 'bg-primary/15 dark:bg-primary/30 text-primary dark:text-[#a5b4fc]'
                    : 'bg-muted/15 text-muted dark:text-[#94a3b8]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

