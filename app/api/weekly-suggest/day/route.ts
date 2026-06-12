import { NextResponse } from "next/server";
import { generateDayMealSuggestion, AiResponseError } from "@/lib/ai/provider";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { listRecentDishNames } from "@/lib/supabase/meals";
import { dayResuggestSchema } from "@/lib/validation";
import type { ApiError, DayMealSuggestion } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT_DISHES_COUNT = 10;

async function fetchRecentDishesSafely(): Promise<string[]> {
  try {
    return await listRecentDishNames(RECENT_DISHES_COUNT);
  } catch (err) {
    console.warn("直近献立の取得に失敗:", err);
    return [];
  }
}

/** POST /api/weekly-suggest/day  1日だけ再提案 */
export async function POST(
  request: Request
): Promise<NextResponse<DayMealSuggestion | ApiError>> {
  if (!checkRateLimit(getClientIp(request))) {
    return NextResponse.json(
      { error: "リクエスト回数が上限を超えました。1時間後に再試行してください。" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const parsed = dayResuggestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "入力内容を確認してください";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const recentDishes = await fetchRecentDishesSafely();
    const suggestion = await generateDayMealSuggestion(
      parsed.data.request,
      parsed.data.otherDishes,
      recentDishes
    );
    return NextResponse.json(suggestion);
  } catch (err) {
    console.error("POST /api/weekly-suggest/day failed:", err);
    const message =
      err instanceof AiResponseError
        ? err.message
        : "1日分の再提案に失敗しました。時間をおいて再度お試しください";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
