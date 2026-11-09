import type { ReactNode } from 'react';

export const inputClass =
  'h-9 rounded-md border border-rule bg-canvas px-2.5 text-sm text-ink hover:border-faint';

export const buttonClass =
  'h-9 rounded-md bg-ink px-4 text-sm font-medium text-canvas hover:bg-ink/85 disabled:opacity-50';

export const quietButtonClass =
  'h-9 rounded-md border border-rule px-4 text-sm hover:bg-raised disabled:opacity-50';

/** Compact status tag (account type, status, risk). */
export const pillClass = 'rounded px-1.5 py-0.5 text-[11px] font-medium tracking-wider uppercase';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}
