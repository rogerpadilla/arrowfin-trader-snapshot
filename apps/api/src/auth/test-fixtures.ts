import { UnsecuredJWT } from 'jose';
import type { Principal } from './principal.js';
import { AUDIENCE, ISSUER } from './session-token.js';

export const TEST_SECRET_TEXT = 'a-test-secret-that-is-at-least-32-chars';
export const TEST_SECRET = new TextEncoder().encode(TEST_SECRET_TEXT);

/** The part of jose's SignJWT and UnsecuredJWT builders the helpers use. */
interface ClaimsBuilder {
  setSubject(subject: string): this;
  setIssuer(issuer: string): this;
  setAudience(audience: string): this;
  setExpirationTime(expiration: string): this;
}

/** Our issuer and audience and an unexpired lifetime, so each test changes only the one thing it is about. */
export const withValidClaims = <T extends ClaimsBuilder>(
  jwt: T,
  traderId: string,
  audience = AUDIENCE,
): T => jwt.setSubject(traderId).setIssuer(ISSUER).setAudience(audience).setExpirationTime('5m');

/** An `alg: none` token that is otherwise well formed: what an attacker would try first. */
export const forgeUnsignedToken = ({ traderId, brokerId }: Principal): string =>
  withValidClaims(new UnsecuredJWT({ brk: brokerId }), traderId).encode();
