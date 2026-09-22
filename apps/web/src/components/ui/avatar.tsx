import * as React from 'react';
import { cn } from '../../lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  fallback: string;
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ fallback, src, alt, size = 'md', className, ...props }: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);

  const sizes = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-9 w-9 text-xs',
    lg: 'h-14 w-14 text-lg',
  };

  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full ring-2 ring-slate-800 bg-slate-800 font-semibold items-center justify-center text-slate-200 select-none',
        sizes[size],
        className
      )}
      {...props}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt || fallback}
          onError={() => setImageError(true)}
          className="aspect-square h-full w-full object-cover"
        />
      ) : (
        <span className="bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-bold flex h-full w-full items-center justify-center">
          {fallback}
        </span>
      )}
    </div>
  );
}
