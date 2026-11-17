import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
const sessions = new Map<string, number>();
const attempts = new Map<string, { count: number; until: number }>();
const ttl = Number(process.env.SESSION_TTL_SECONDS || 3600) * 1000;
if (!Number.isFinite(ttl) || ttl < 1000 || ttl > 86400000)
  throw new Error('SESSION_TTL_SECONDS must be 1..86400');
const tokenFrom = (req: Request): string =>
  /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1] || '';
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = tokenFrom(req);
  const expires = sessions.get(token);
  if (!expires || expires <= Date.now()) {
    sessions.delete(token);
    res.status(401).json({ message: 'Сесія відсутня або завершилася. Увійдіть знову.' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  next();
}
function matches(password: string, expected: string): boolean {
  if (expected.startsWith('scrypt:')) {
    const [, salt, hash] = expected.split(':');
    if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hash || '')) return false;
    return crypto.timingSafeEqual(crypto.scryptSync(password, salt, 64), Buffer.from(hash, 'hex'));
  }
  // Compatibility with the existing local .env. New installations use salted scrypt.
  if (!/^[a-f0-9]{64}$/i.test(expected)) return false;
  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(password).digest(),
    Buffer.from(expected, 'hex'),
  );
}
export function login(req: Request, res: Response): void {
  const expected = process.env.ADMIN_PASSWORD_HASH;
  if (!expected) {
    res.status(503).json({ message: 'Пароль адміністратора не налаштовано.' });
    return;
  }
  const key = req.ip || 'unknown';
  const previous = attempts.get(key);
  const attempt =
    previous && previous.until > Date.now() ? previous : { count: 0, until: Date.now() + 900000 };
  if (attempt.count >= 10) {
    res.status(429).json({ message: 'Забагато спроб. Повторіть через 15 хвилин.' });
    return;
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || password.length > 1024 || !matches(password, expected)) {
    attempt.count++;
    attempts.set(key, attempt);
    res.status(401).json({ message: 'Невірний пароль.' });
    return;
  }
  attempts.delete(key);
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + ttl;
  sessions.set(token, expiresAt);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ token, expiresAt });
}
export function logout(req: Request, res: Response): void {
  sessions.delete(tokenFrom(req));
  res.status(204).end();
}
setInterval(() => {
  for (const [key, expires] of sessions) if (expires <= Date.now()) sessions.delete(key);
  for (const [key, attempt] of attempts) if (attempt.until <= Date.now()) attempts.delete(key);
}, 60000).unref();
