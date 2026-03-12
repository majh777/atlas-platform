import { createHash, randomUUID } from 'node:crypto';
import { run, get, all } from '@/lib/db';

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  refresh_token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
}

/**
 * Hashes a token string using SHA-256.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a new session record in the database.
 */
export function createSession(
  userId: string,
  token: string,
  refreshToken: string,
  ip?: string,
  userAgent?: string
): Session {
  const id = randomUUID();
  const tokenHash = hashToken(token);
  const refreshTokenHash = hashToken(refreshToken);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  run(
    `INSERT INTO sessions (id, user_id, token_hash, refresh_token_hash, ip_address, user_agent, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, userId, tokenHash, refreshTokenHash, ip ?? null, userAgent ?? null, expiresAt, now
  );

  return {
    id,
    user_id: userId,
    token_hash: tokenHash,
    refresh_token_hash: refreshTokenHash,
    ip_address: ip ?? null,
    user_agent: userAgent ?? null,
    expires_at: expiresAt,
    created_at: now,
    revoked_at: null,
  };
}

/**
 * Retrieves a session by its access token hash.
 * Returns null if not found, revoked, or expired.
 */
export function getSession(tokenHash: string): Session | null {
  const session = get<Session>(
    `SELECT * FROM sessions
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')`,
    tokenHash
  );
  return session ?? null;
}

/**
 * Returns all active sessions for a given user.
 */
export function getUserSessions(userId: string): Session[] {
  return all<Session>(
    `SELECT * FROM sessions
     WHERE user_id = ? AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    userId
  );
}

/**
 * Revokes a specific session by ID for a given user.
 */
export function revokeSession(sessionId: string, userId: string): void {
  run(
    `UPDATE sessions SET revoked_at = datetime('now') WHERE id = ? AND user_id = ?`,
    sessionId, userId
  );
}

/**
 * Revokes all sessions for a user, optionally keeping one active.
 */
export function revokeAllSessions(userId: string, exceptSessionId?: string): void {
  if (exceptSessionId) {
    run(
      `UPDATE sessions SET revoked_at = datetime('now')
       WHERE user_id = ? AND id != ? AND revoked_at IS NULL`,
      userId, exceptSessionId
    );
  } else {
    run(
      `UPDATE sessions SET revoked_at = datetime('now')
       WHERE user_id = ? AND revoked_at IS NULL`,
      userId
    );
  }
}

/**
 * Refreshes a session by revoking the old refresh token and issuing new tokens.
 * Returns the updated session or null if the refresh token was not found.
 */
export function refreshSession(
  refreshTokenHash: string,
  newToken: string,
  newRefreshToken: string
): Session | null {
  const session = get<Session>(
    `SELECT * FROM sessions
     WHERE refresh_token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')`,
    refreshTokenHash
  );

  if (!session) {
    return null;
  }

  const newTokenHash = hashToken(newToken);
  const newRefreshTokenHash = hashToken(newRefreshToken);
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  run(
    `UPDATE sessions
     SET token_hash = ?, refresh_token_hash = ?, expires_at = ?
     WHERE id = ?`,
    newTokenHash, newRefreshTokenHash, newExpiresAt, session.id
  );

  return {
    ...session,
    token_hash: newTokenHash,
    refresh_token_hash: newRefreshTokenHash,
    expires_at: newExpiresAt,
  };
}

/**
 * Removes all expired or revoked sessions from the database.
 */
export function cleanExpiredSessions(): void {
  run(
    `DELETE FROM sessions WHERE expires_at < datetime('now') OR revoked_at IS NOT NULL`
  );
}
