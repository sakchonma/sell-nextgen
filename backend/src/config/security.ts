import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_DEV_JWT_SECRET = 'dev_secret_key';

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET || '';
  if (isProduction && (!secret || secret === DEFAULT_DEV_JWT_SECRET || secret.length < 32)) {
    throw new Error('JWT_SECRET must be set to a strong value of at least 32 characters in production.');
  }
  return secret || DEFAULT_DEV_JWT_SECRET;
}

function resolveSameSite(): 'lax' | 'strict' | 'none' {
  const value = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  if (value === 'strict' || value === 'none') return value;
  return 'lax';
}

export const JWT_SECRET = resolveJwtSecret();
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_EXPIRES_IN = '7d';

export function getAuthCookieOptions(maxAge = SESSION_MAX_AGE_MS) {
  const sameSite = resolveSameSite();
  const secure = process.env.COOKIE_SECURE === undefined
    ? isProduction || sameSite === 'none'
    : process.env.COOKIE_SECURE === 'true';

  return {
    httpOnly: true,
    sameSite,
    secure,
    maxAge
  };
}

export function getClearAuthCookieOptions() {
  const { maxAge, ...options } = getAuthCookieOptions();
  return options;
}

export function createCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function getCsrfCookieOptions(maxAge = SESSION_MAX_AGE_MS) {
  const { httpOnly, ...options } = getAuthCookieOptions(maxAge);
  return {
    ...options,
    httpOnly: false
  };
}
