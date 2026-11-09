import { type DecimalString, EXCHANGE_TIME_ZONE } from 'contracts';

const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const signedUsdFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  signDisplay: 'exceptZero',
});

/** Index and metal prices read in hundredths; sub-100 prices (crude, FX) need the extra places. */
const largePriceFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const smallPriceFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 5,
});

const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const sessionFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: EXCHANGE_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'short',
});

// Display only: all arithmetic happens on the server in exact decimals.
export const formatUsd = (value: DecimalString) => usdFormat.format(Number(value));

export const formatSignedUsd = (value: DecimalString) => signedUsdFormat.format(Number(value));

export const formatPrice = (value: DecimalString) => {
  const price = Number(value);
  return (Math.abs(price) >= 100 ? largePriceFormat : smallPriceFormat).format(price);
};

export const formatUtcTime = (iso: string) => `${timeFormat.format(new Date(iso))} UTC`;

export const formatSessionOpen = (iso: string) => sessionFormat.format(new Date(iso));

/** Initials of a portal name ("Summit Trader Portal" gives "ST"): the stand-in for a broker logo from white-label config. */
export const monogram = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');

export const maskedAccount = (last4: string) => `••${last4}`;

export const pnlTone = (value: DecimalString) => {
  const amount = Number(value);
  if (amount > 0) return 'text-up';
  if (amount < 0) return 'text-down';
  return 'text-muted';
};
