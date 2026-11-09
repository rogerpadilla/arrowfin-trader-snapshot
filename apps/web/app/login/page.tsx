'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { buttonClass, Field, inputClass } from '@/components/form';
import { devLogin } from '@/lib/api';

/** Dataset identities (ids only, no PII). In production each white-label portal signs in through its own identity provider. */
const DEV_PORTALS = [
  {
    brokerId: 'BRK-ARWP',
    name: 'EdgeClear X (retail)',
    traders: ['T-001', 'T-002', 'T-003', 'T-004', 'T-014'],
  },
  {
    brokerId: 'BRK-SMPT',
    name: 'Summit Trader Portal',
    traders: ['T-005', 'T-006', 'T-007', 'T-008', 'T-013'],
  },
  { brokerId: 'BRK-MRDN', name: 'Meridian Desk', traders: ['T-009', 'T-010', 'T-011', 'T-012'] },
];

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [brokerId, setBrokerId] = useState('BRK-SMPT');
  const [traderId, setTraderId] = useState('T-005');
  const login = useMutation({
    mutationFn: devLogin,
    onSuccess: () => {
      queryClient.clear();
      router.replace('/');
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ brokerId, traderId });
  };

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-rule bg-panel p-6"
      >
        <div>
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="mt-1 text-xs text-muted">
            Development login. Pick a portal and a trader from the seed data.
          </p>
        </div>
        <Field label="Portal">
          <select
            className={inputClass}
            value={brokerId}
            onChange={(e) => setBrokerId(e.target.value)}
          >
            {DEV_PORTALS.map((portal) => (
              <option key={portal.brokerId} value={portal.brokerId}>
                {portal.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trader">
          <select
            className={inputClass}
            value={traderId}
            onChange={(e) => setTraderId(e.target.value)}
          >
            {DEV_PORTALS.flatMap((portal) =>
              portal.traders.map((id) => (
                <option key={id} value={id}>
                  {id} ({portal.brokerId})
                </option>
              )),
            )}
          </select>
        </Field>
        {login.isError && (
          <p role="alert" className="text-sm text-down">
            Sign-in failed. A trader can only sign in through their own portal.
          </p>
        )}
        <button type="submit" disabled={login.isPending} className={`${buttonClass} w-full`}>
          Sign in
        </button>
      </form>
    </main>
  );
}
