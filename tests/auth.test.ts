import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { generateTokens, verifyAccessToken, verifyRefreshToken } from '@/lib/auth/jwt';
import { generateMfaSecret, generateRecoveryCodes, verifyRecoveryCode } from '@/lib/auth/mfa';
import { hasPermission, hasWorkspacePermission } from '@/lib/auth/rbac';

describe('Password hashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('TestPassword123');
    expect(hash).not.toBe('TestPassword123');
    expect(await verifyPassword('TestPassword123', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('JWT tokens', () => {
  it('generates and verifies access tokens', async () => {
    const tokens = await generateTokens({ userId: 'u1', email: 'a@b.com', sessionId: 's1' });
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(tokens.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const payload = await verifyAccessToken(tokens.accessToken);
    expect(payload.userId).toBe('u1');
    expect(payload.email).toBe('a@b.com');
  });

  it('generates and verifies refresh tokens', async () => {
    const tokens = await generateTokens({ userId: 'u2', email: 'b@c.com', sessionId: 's2' });
    const payload = await verifyRefreshToken(tokens.refreshToken);
    expect(payload.userId).toBe('u2');
  });

  it('rejects tampered tokens', async () => {
    const tokens = await generateTokens({ userId: 'u3', email: 'c@d.com' });
    await expect(verifyAccessToken(tokens.accessToken + 'x')).rejects.toThrow();
  });
});

describe('MFA', () => {
  it('generates a secret and URI', () => {
    const { secret, uri } = generateMfaSecret('test@atlas.dev');
    expect(secret).toBeTruthy();
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('Atlas');
  });

  it('generates 10 recovery codes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    codes.forEach((c) => expect(c).toMatch(/^[0-9a-f]{8}$/));
  });

  it('verifies and consumes a recovery code', () => {
    const codes = generateRecoveryCodes();
    const { valid, remaining } = verifyRecoveryCode(codes, codes[3]);
    expect(valid).toBe(true);
    expect(remaining).toHaveLength(9);
    expect(remaining).not.toContain(codes[3]);
  });

  it('rejects invalid recovery code', () => {
    const codes = generateRecoveryCodes();
    const { valid, remaining } = verifyRecoveryCode(codes, 'invalid123');
    expect(valid).toBe(false);
    expect(remaining).toHaveLength(10);
  });
});

describe('RBAC', () => {
  it('owner has all permissions', () => {
    expect(hasPermission('owner', 'org:delete')).toBe(true);
    expect(hasPermission('owner', 'admin:all')).toBe(true);
    expect(hasPermission('owner', 'audit:export')).toBe(true);
  });

  it('viewer has limited permissions', () => {
    expect(hasPermission('viewer', 'org:read')).toBe(true);
    expect(hasPermission('viewer', 'org:update')).toBe(false);
    expect(hasPermission('viewer', 'ws:create')).toBe(false);
  });

  it('billing role only has billing permissions', () => {
    expect(hasPermission('billing', 'org:manage_billing')).toBe(true);
    expect(hasPermission('billing', 'org:read')).toBe(true);
    expect(hasPermission('billing', 'ws:create')).toBe(false);
  });

  it('workspace editor can update but not delete', () => {
    expect(hasWorkspacePermission('editor', 'ws:update')).toBe(true);
    expect(hasWorkspacePermission('editor', 'ws:delete')).toBe(false);
  });

  it('workspace viewer can only read', () => {
    expect(hasWorkspacePermission('viewer', 'ws:read')).toBe(true);
    expect(hasWorkspacePermission('viewer', 'portfolio:create')).toBe(false);
  });
});
