import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'purple' | 'sky';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'border-transparent bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium',
    secondary: 'border-transparent bg-slate-800 text-slate-300 font-medium',
    destructive: 'border-transparent bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium',
    outline: 'text-slate-300 border border-slate-700 font-medium',
    success: 'border-transparent bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium',
    warning: 'border-transparent bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium',
    purple: 'border-transparent bg-purple-500/15 text-purple-300 border border-purple-500/30 font-medium',
    sky: 'border-transparent bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
