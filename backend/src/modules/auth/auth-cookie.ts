import type { CookieOptions, Request, Response } from 'express';

// JWT nằm trong cookie httpOnly: JS phía frontend không đọc được, trình duyệt tự gửi kèm
export const ACCESS_TOKEN_COOKIE = 'access_token';

const REMEMBER_ME_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày – khớp hạn JWT khi rememberMe

const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

/** rememberMe = false → cookie phiên (mất khi đóng trình duyệt) */
export function setAuthCookie(res: Response, token: string, rememberMe?: boolean) {
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    ...baseOptions(),
    ...(rememberMe ? { maxAge: REMEMBER_ME_MS } : {}),
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseOptions());
}

export function readAuthCookie(req: Request): string | null {
  return (req.cookies as Record<string, string> | undefined)?.[ACCESS_TOKEN_COOKIE] ?? null;
}
