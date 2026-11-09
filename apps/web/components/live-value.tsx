'use client';

import { type ReactNode, useState } from 'react';

/** How to read a change: P&L up is good, commissions or risk up is bad, everything else is just "it changed". */
export type ChangeMeaning = 'up-is-good' | 'up-is-bad' | 'neutral';

const flashFor = (meaning: ChangeMeaning, rose: boolean) => {
  if (meaning === 'neutral') return 'flash-neutral';
  return rose === (meaning === 'up-is-good') ? 'flash-up' : 'flash-down';
};

/** Plays a one-shot flash whenever `value` changes. Re-keying the span restarts the CSS animation; the first render does not flash. */
export function LiveValue({
  value,
  meaning = 'neutral',
  className = '',
  children,
}: {
  value: number;
  meaning?: ChangeMeaning;
  className?: string;
  children: ReactNode;
}) {
  const [previous, setPrevious] = useState(value);
  const [change, setChange] = useState<{ flash: string; count: number }>();
  if (value !== previous) {
    setPrevious(value);
    setChange({ flash: flashFor(meaning, value > previous), count: (change?.count ?? 0) + 1 });
  }
  return (
    <span
      key={change?.count}
      className={`${className} ${change ? `motion-safe:animate-flash ${change.flash}` : ''}`}
    >
      {children}
    </span>
  );
}
