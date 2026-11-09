import { errors, SignJWT } from 'jose';
import { ZodError } from 'zod';
import { issueSessionToken, SESSION_TTL_SECONDS, verifySessionToken } from './session-token.js';
import { forgeUnsignedToken, TEST_SECRET, withValidClaims } from './test-fixtures.js';

const principal = { traderId: 'T-005', brokerId: 'BRK-SMPT' };

describe('session tokens', () => {
  it('round-trips the principal and expiry', async () => {
    const now = new Date();
    const token = await issueSessionToken(principal, TEST_SECRET, now);

    const session = await verifySessionToken(token, TEST_SECRET);

    expect(session.principal).toEqual(principal);
    expect(session.expiresAt.getTime()).toBe(
      Math.floor(now.getTime() / 1000) * 1000 + SESSION_TTL_SECONDS * 1000,
    );
  });

  it('rejects an unsigned alg:none token carrying another tenant', async () => {
    const token = forgeUnsignedToken({ traderId: 'T-001', brokerId: 'BRK-ARWP' });

    await expect(verifySessionToken(token, TEST_SECRET)).rejects.toThrow(errors.JOSEAlgNotAllowed);
  });

  it('rejects a token signed with another key', async () => {
    const otherKey = new TextEncoder().encode('another-secret-that-is-at-least-32-chars');
    const token = await issueSessionToken(principal, otherKey, new Date());

    await expect(verifySessionToken(token, TEST_SECRET)).rejects.toThrow(
      errors.JWSSignatureVerificationFailed,
    );
  });

  it('rejects an expired token', async () => {
    const token = await issueSessionToken(
      principal,
      TEST_SECRET,
      new Date(Date.now() - 60 * 60 * 1000),
    );

    await expect(verifySessionToken(token, TEST_SECRET)).rejects.toThrow(errors.JWTExpired);
  });

  it('rejects a token minted for another audience', async () => {
    const token = await withValidClaims(
      new SignJWT({ brk: 'BRK-SMPT' }).setProtectedHeader({ alg: 'HS256' }),
      'T-005',
      'some-other-service',
    ).sign(TEST_SECRET);

    await expect(verifySessionToken(token, TEST_SECRET)).rejects.toThrow(
      errors.JWTClaimValidationFailed,
    );
  });

  it('rejects a token without the tenant claim', async () => {
    const token = await withValidClaims(
      new SignJWT({}).setProtectedHeader({ alg: 'HS256' }),
      'T-005',
    ).sign(TEST_SECRET);

    await expect(verifySessionToken(token, TEST_SECRET)).rejects.toThrow(ZodError);
  });
});
