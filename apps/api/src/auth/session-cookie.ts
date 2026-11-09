import { parseCookie, stringifySetCookie } from 'cookie';
import { SESSION_COOKIE } from 'contracts';
import { SESSION_TTL_SECONDS, type VerifiedSession, verifySessionToken } from './session-token.js';

/** HttpOnly so page scripts (and any XSS) cannot read it; SameSite=Strict so cross-site pages cannot ride it. */
const sessionCookieWith = (value: string, maxAge: number, production: boolean): string =>
  stringifySetCookie({
    name: SESSION_COOKIE,
    value,
    maxAge,
    httpOnly: true,
    sameSite: 'strict',
    secure: production,
    path: '/',
  });

export const sessionCookie = (token: string, production: boolean): string =>
  sessionCookieWith(token, SESSION_TTL_SECONDS, production);

export const clearedSessionCookie = (production: boolean): string =>
  sessionCookieWith('', 0, production);

/** The one authentication decision, shared by every transport: a verified session from a Cookie header, or nothing. */
export const authenticate = async (
  cookieHeader: string | undefined,
  secret: Uint8Array,
): Promise<VerifiedSession | undefined> => {
  const token = cookieHeader ? parseCookie(cookieHeader)[SESSION_COOKIE] : undefined;
  return token ? verifySessionToken(token, secret).catch(() => undefined) : undefined;
};
