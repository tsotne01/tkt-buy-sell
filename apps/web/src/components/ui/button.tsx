import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'purple' | 'emerald';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]';
    
    const variants = {
      default: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold shadow-md shadow-emerald-500/20',
      emerald: 'bg-emerald-600 text-white hover:bg-emerald-500 font-semibold shadow-md shadow-emerald-600/20',
      destructive: 'bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-600/20',
      outline: 'border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:text-slate-100 text-slate-300',
      secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-700/80 hover:text-white',
      ghost: 'hover:bg-slate-800/80 hover:text-slate-100 text-slate-400',
      link: 'text-emerald-400 underline-offset-4 hover:underline',
      purple: 'bg-purple-600 text-white hover:bg-purple-500 font-semibold shadow-md shadow-purple-600/20',
    };

    const sizes = {
      default: 'h-10 px-4 py-2',
      sm: 'h-8 rounded-lg px-3 text-xs',
      lg: 'h-12 rounded-xl px-6 text-base',
      icon: 'h-9 w-9 p-0',
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
