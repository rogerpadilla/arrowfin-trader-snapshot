/** Wire contract between the API and the web app. Money and prices are decimal strings so no float rounding happens in transit. */
export type DecimalString = string;

export const SIDES = ['BUY', 'SELL'] as const;
export type Side = (typeof SIDES)[number];

export type AccountType = 'funded' | 'eval' | 'demo' | 'pro' | 'pro_plus';

export type AccountStatus = 'active' | 'restricted' | 'closed';

/** Decided by the API; the web app only maps a level to a look. */
export type RiskLevel = 'normal' | 'elevated' | 'high';

/** Risk above this is `elevated`. */
export const RISK_WARN_THRESHOLD = 50;
/** Risk above this is `high`. */
export const RISK_ALERT_THRESHOLD = 75;

/** CME Globex sessions open at 17:00 in this zone. */
export const EXCHANGE_TIME_ZONE = 'America/Chicago';

export interface PositionView {
  symbol: string;
  description: string;
  netQuantity: number;
  averagePrice: DecimalString;
  markPrice: DecimalString;
  notionalUsd: DecimalString;
  unrealizedPnlUsd: DecimalString;
}

export interface AccountSnapshotView {
  accountId: string;
  accountNumberLast4: string;
  type: AccountType;
  status: AccountStatus;
  balanceUsd: DecimalString;
  positions: PositionView[];
  realizedPnlUsd: DecimalString;
  commissionsUsd: DecimalString;
  unrealizedPnlUsd: DecimalString;
  dayPnlUsd: DecimalString;
  notionalUsd: DecimalString;
  /** 0-100. Saturates at 100 when the account has exposure but no balance. */
  riskScore: number;
  riskLevel: RiskLevel;
  fillsToday: number;
  ordersToday: number;
}

export interface TraderSnapshotView {
  portalName: string;
  traderId: string;
  sessionStart: string;
  asOf: string;
  marksAsOf: string | null;
  accounts: AccountSnapshotView[];
}

/** Pushed over the socket. Deliberately carries no balances or P&L: the client refetches the snapshot for those. */
export interface FillEvent {
  fillId: string;
  accountId: string;
  symbol: string;
  side: Side;
  quantity: number;
  price: DecimalString;
  filledAt: string;
}

export const FILL_EVENT = 'fill';

/** The error message a rejected socket handshake carries. */
export const SOCKET_UNAUTHORIZED = 'unauthorized';

export const SESSION_COOKIE = 'af_session';

/** Dev-only: `POST /dev/login`. */
export interface DevLoginRequest {
  brokerId: string;
  traderId: string;
}

/** Dev-only: `POST /dev/fills`, in the shape of dataset/simulate-fills.md. Commission is priced by the server. */
export interface DevFillRequest {
  account_id: string;
  instrument_symbol: string;
  side: Side;
  quantity: number;
  price: DecimalString | number;
}
