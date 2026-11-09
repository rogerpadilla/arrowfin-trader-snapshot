import { EXCHANGE_TIME_ZONE } from 'contracts';

const SESSION_OPEN_HOUR = 17;
const DAY_MS = 86_400_000;
const FRIDAY = 5;
const SATURDAY = 6;

const wallClockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: EXCHANGE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** Chicago wall-clock time of an instant, encoded as if it were UTC so plain Date arithmetic works on it. */
const chicagoWallClock = (instant: Date): Date => {
  const parts = Object.fromEntries(
    wallClockFormat.formatToParts(instant).map(({ type, value }) => [type, Number(value)]),
  );
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  );
};

const chicagoToInstant = (wallClock: Date): Date => {
  const offsetMs = chicagoWallClock(wallClock).getTime() - wallClock.getTime();
  return new Date(wallClock.getTime() - offsetMs);
};

/**
 * Start of the CME Globex session that `now` belongs to (or, while the market is closed, the last one).
 * Sessions open at 17:00 Chicago time Sunday to Thursday, so one session spans two UTC dates. Exchange holidays are ignored.
 */
export const tradingSessionStart = (now: Date): Date => {
  const wallClock = chicagoWallClock(now);
  let open = new Date(
    Date.UTC(
      wallClock.getUTCFullYear(),
      wallClock.getUTCMonth(),
      wallClock.getUTCDate(),
      SESSION_OPEN_HOUR,
    ),
  );
  if (wallClock < open) open = new Date(open.getTime() - DAY_MS);
  while (open.getUTCDay() === FRIDAY || open.getUTCDay() === SATURDAY) {
    open = new Date(open.getTime() - DAY_MS);
  }
  return chicagoToInstant(open);
};
