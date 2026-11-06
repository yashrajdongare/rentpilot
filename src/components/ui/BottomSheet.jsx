import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-md',
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center p-0 md:p-4"
    >
      {/* Dark Scrim Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-scrim-in"
      />

      {/* Sheet Container: Bottom sheet on mobile, centered glass modal on desktop */}
      <div
        className={`relative z-10 w-full ${maxWidth} bg-white/90 dark:bg-[#101632]/92 backdrop-blur-[24px] backdrop-saturate-180 rounded-t-[32px] md:rounded-[28px] border-t md:border border-white/90 dark:border-white/20 shadow-2xl max-h-[92vh] md:max-h-[85vh] flex flex-col animate-sheet-up overflow-hidden my-0 md:my-auto`}
      >
        {/* Grab Handle (mobile only) */}
        <div className="pt-3 pb-1 flex justify-center md:hidden">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-6 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/10 shrink-0">
          <div>
            {title && (
              <h3 className="text-base font-extrabold text-ink dark:text-white leading-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-muted dark:text-[#98a3c4] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full glass-panel flex items-center justify-center text-muted hover:text-ink dark:hover:text-white active:scale-95 transition cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

