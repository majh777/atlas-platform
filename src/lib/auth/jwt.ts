import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export interface TokenPayload {
  userId: string;
  email: string;
  orgId?: string;
  sessionId?: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in seconds
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'atlas-dev-jwt-secret-do-not-use-in-production'
);

const REFRESH_SECRET = new TextEncoder().encode(
  process.env.REFRESH_SECRET || 'atlas-dev-refresh-secret-do-not-use-in-production'
);

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Generates a JWT access token and refresh token pair for the given payload.
 * 
 * Access tokens are short-lived (15 minutes) for security.
 * Refresh tokens are long-lived (7 days) and should be stored securely.
 * 
 * @param payload - User identification data to encode in tokens
 * @returns Promise resolving to access token, refresh token, and expiration timestamp
 * 
 * @example
 * ```typescript
 * const tokens = await generateTokens({
 *   userId: 'user-123',
 *   email: 'user@example.com',
 *   sessionId: 'session-456'
 * });
 * // Returns: { accessToken, refreshToken, expiresAt }
 * ```
 */
export async function generateTokens(payload: TokenPayload): Promise<TokenSet> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 15 * 60; // 15 minutes

  const accessToken = await new SignJWT({ ...payload } as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuer('atlas')
    .setSubject(payload.userId)
    .sign(JWT_SECRET);

  const refreshToken = await new SignJWT({ userId: payload.userId, sessionId: payload.sessionId } as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setIssuer('atlas')
    .setSubject(payload.userId)
    .sign(REFRESH_SECRET);

  return { accessToken, refreshToken, expiresAt };
}

/**
 * Verifies and decodes a JWT access token.
 * 
 * Validates the token signature, expiration, and issuer claim.
 * Throws an error if the token is invalid, expired, or tampered with.
 * 
 * @param token - The JWT access token string to verify
 * @returns Promise resolving to the decoded token payload
 * @throws Error if token is invalid, expired, or has wrong issuer
 * 
 * @example
 * ```typescript
 * try {
 *   const payload = await verifyAccessToken(token);
 *   console.log(payload.userId, payload.email);
 * } catch (error) {
 *   // Token is invalid or expired
 * }
 * ```
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload & TokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    issuer: 'atlas',
  });
  return payload as JWTPayload & TokenPayload;
}

/**
 * Verifies and decodes a refresh token. Throws on invalid/expired tokens.
 */
export async function verifyRefreshToken(token: string): Promise<JWTPayload & TokenPayload> {
  const { payload } = await jwtVerify(token, REFRESH_SECRET, {
    issuer: 'atlas',
  });
  return payload as JWTPayload & TokenPayload;
}
