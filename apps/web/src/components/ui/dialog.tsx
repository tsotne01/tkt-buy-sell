import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

export function Dialog({ open, onOpenChange, children, className, maxWidth = 'max-w-lg' }: DialogProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    if (open) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        onClick={() => onOpenChange(false)}
      />

      {/* Content Card */}
      <div
        className={cn(
          'relative z-50 w-full rounded-3xl border border-slate-800 bg-slate-900/95 p-6 sm:p-8 text-slate-100 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200',
          maxWidth,
          className
        )}
      >
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
          title="Close"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-6', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-xl font-bold tracking-tight text-white', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-slate-400 mt-1', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-2 mt-6 pt-4 border-t border-slate-800', className)}
      {...props}
    />
  );
}
