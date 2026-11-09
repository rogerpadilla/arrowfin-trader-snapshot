'use client';

import { useMutation } from '@tanstack/react-query';
import { type AccountSnapshotView, SIDES, type Side } from 'contracts';
import { type FormEvent, useState } from 'react';
import { simulateFill } from '@/lib/api';
import { formatPrice, maskedAccount } from '@/lib/format';
import { buttonClass, Field, inputClass } from './form';
import { pageWidth } from './layout';

/** Dataset marks, only to prefill a plausible price. */
const MARKS: Readonly<Record<string, string>> = {
  ES: '5642.25',
  MES: '5642.25',
  NQ: '19845.50',
  MNQ: '19845.50',
  CL: '74.18',
  MCL: '74.18',
  GC: '2488.30',
  '6E': '1.10425',
};

/** Dev-only stand-in for the exchange feed. The fill comes back through the WebSocket like a real one would. */
export function FillSimulator({
  accounts: [firstAccount, ...otherAccounts],
}: {
  accounts: [AccountSnapshotView, ...AccountSnapshotView[]];
}) {
  const [accountId, setAccountId] = useState(firstAccount.accountId);
  const [symbol, setSymbol] = useState('MES');
  const [side, setSide] = useState<Side>('BUY');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(MARKS.MES ?? '');
  const mutation = useMutation({ mutationFn: simulateFill });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({ account_id: accountId, instrument_symbol: symbol, side, quantity, price });
  };

  return (
    <form
      onSubmit={submit}
      aria-label="Simulate a fill"
      className="border-t border-rule bg-panel/95 backdrop-blur md:sticky md:bottom-0 md:z-10"
    >
      <div className={`${pageWidth} flex flex-wrap items-end gap-3 py-3`}>
        <span className="caption w-full text-faint">Dev only · simulate an exchange fill</span>
        <Field label="Account">
          <select
            className={inputClass}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {[firstAccount, ...otherAccounts].map((account) => (
              <option key={account.accountId} value={account.accountId}>
                {maskedAccount(account.accountNumberLast4)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contract">
          <select
            className={inputClass}
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value);
              setPrice(MARKS[e.target.value] ?? '');
            }}
          >
            {Object.keys(MARKS).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Side">
          <select
            className={inputClass}
            value={side}
            onChange={(e) => setSide(SIDES.find((s) => s === e.target.value) ?? 'BUY')}
          >
            {SIDES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Qty">
          <input
            className={`${inputClass} figure w-20`}
            type="number"
            min={1}
            max={1000}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </Field>
        <Field label="Price">
          <input
            className={`${inputClass} figure w-32`}
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <button type="submit" disabled={mutation.isPending} className={buttonClass}>
          Send fill
        </button>
        <output className="self-center text-sm" aria-live="polite">
          {mutation.isError && (
            <span className="text-down">Not sent: {mutation.error.message}</span>
          )}
          {mutation.isSuccess && (
            <span className="text-muted">
              Sent {mutation.data.side} {mutation.data.quantity} {mutation.data.symbol} @{' '}
              {formatPrice(mutation.data.price)}
            </span>
          )}
        </output>
      </div>
    </form>
  );
}
