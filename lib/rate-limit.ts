import "server-only";

/**
 * AI課金を伴うエンドポイント(/api/suggest, /api/weekly-suggest)を保護する
 * IP単位のメモリ内レート制限(固定ウィンドウ・1時間20回・両エンドポイントで共有)。
 * サーバーレス環境ではインスタンス単位・再起動でリセットされる点に注意。
 */

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 20;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/** 期限切れエントリの定期掃除(メモリの無制限な増加を防ぐ) */
function sweepIfNeeded(now: number): void {
  if (rateLimitStore.size <= 1000) return;
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

/** trueなら許可。falseなら呼び出し側で429を返す */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  sweepIfNeeded(now);
  const current = rateLimitStore.get(ip);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return false;
  }

  current.count += 1;
  return true;
}
