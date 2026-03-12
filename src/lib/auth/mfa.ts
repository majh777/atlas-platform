import { TOTP, Secret } from 'otpauth';
import { randomBytes } from 'node:crypto';

/**
 * Generates a new MFA secret and OTP Auth URI for the given email.
 */
export function generateMfaSecret(email: string): { secret: string; uri: string } {
  const secret = new Secret({ size: 20 });

  const totp = new TOTP({
    issuer: 'Atlas',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });

  return {
    secret: secret.base32,
    uri: totp.toString(),
  };
}

/**
 * Verifies a 6-digit TOTP token against a base32-encoded secret.
 * Allows a window of 1 period in either direction.
 */
export function verifyMfaToken(secret: string, token: string): boolean {
  const totp = new TOTP({
    issuer: 'Atlas',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });

  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

/**
 * Generates 10 random 8-character hex recovery codes.
 */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push(randomBytes(4).toString('hex'));
  }
  return codes;
}

/**
 * Validates a recovery code against the list and returns
 * the remaining codes with the used one removed.
 */
export function verifyRecoveryCode(
  codes: string[],
  code: string
): { valid: boolean; remaining: string[] } {
  const normalizedCode = code.toLowerCase().trim();
  const index = codes.findIndex((c) => c.toLowerCase() === normalizedCode);

  if (index === -1) {
    return { valid: false, remaining: codes };
  }

  const remaining = [...codes];
  remaining.splice(index, 1);
  return { valid: true, remaining };
}
