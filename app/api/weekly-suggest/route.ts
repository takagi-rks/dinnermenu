import { NextResponse } from "next/server";
import { generateWeeklyMealPlan, AiResponseError } from "@/lib/ai/provider";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { listRecentDishNames } from "@/lib/supabase/meals";
import { suggestionRequestSchema } from "@/lib/validation";
import type { ApiError, WeeklyMealPlan } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 週間提案は出力が大きいため関数の最大実行時間を延長(Vercel) */
export const maxDuration = 120;

const RECENT_DISHES_COUNT = 10;

async function fetchRecentDishesSafely(): Promise<string[]> {
  try {
    return await listRecentDishNames(RECENT_DISHES_COUNT);
  } catch (err) {
    console.warn("直近献立の取得に失敗したため、重複回避なしで提案します:", err);
    return [];
  }
}

export async function POST(
  request: Request
): Promise<NextResponse<WeeklyMealPlan | ApiError>> {
  // 単日提案と同じIPカウンタを共有(AIコストの大きい操作ほど保護が必要なため)
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

  const parsed = suggestionRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "入力内容を確認してください";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const recentDishes = await fetchRecentDishesSafely();
    const plan = await generateWeeklyMealPlan(parsed.data, recentDishes);
    return NextResponse.json(plan);
  } catch (err) {
    console.error("POST /api/weekly-suggest failed:", err);
    const message =
      err instanceof AiResponseError
        ? err.message
        : "週間献立の生成に失敗しました。時間をおいて再度お試しください";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
