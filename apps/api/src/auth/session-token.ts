import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import type { Principal } from './principal.js';

const ALGORITHM = 'HS256';
export const ISSUER = 'arrowfin-api';
export const AUDIENCE = 'arrowfin-web';
export const SESSION_TTL_SECONDS = 15 * 60;

const claimsSchema = z.object({
  sub: z.string().min(1),
  brk: z.string().min(1),
  exp: z.number(),
});

export interface VerifiedSession {
  principal: Principal;
  expiresAt: Date;
}

export const issueSessionToken = (
  principal: Principal,
  secret: Uint8Array,
  now: Date,
): Promise<string> =>
  new SignJWT({ brk: principal.brokerId })
    .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
    .setSubject(principal.traderId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(Math.floor(now.getTime() / 1000) + SESSION_TTL_SECONDS)
    .sign(secret);

/** Throws on anything but a valid, unexpired HS256 token from us: `alg: none`, other algorithms, wrong issuer or audience. */
export const verifySessionToken = async (
  token: string,
  secret: Uint8Array,
): Promise<VerifiedSession> => {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: [ALGORITHM],
    issuer: ISSUER,
    audience: AUDIENCE,
    requiredClaims: ['sub', 'exp'],
  });
  const claims = claimsSchema.parse(payload);
  return {
    principal: { traderId: claims.sub, brokerId: claims.brk },
    expiresAt: new Date(claims.exp * 1000),
  };
};
