import { NextResponse } from "next/server";
import { generateMealSuggestion, AiResponseError } from "@/lib/ai/provider";
import { listRecentDishNames } from "@/lib/supabase/meals";
import { suggestionRequestSchema } from "@/lib/validation";
import type { ApiError, MealSuggestion } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT_DISHES_COUNT = 10;

/** 直近献立は提案の補助情報。取得に失敗しても提案自体は止めない */
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
): Promise<NextResponse<MealSuggestion | ApiError>> {
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
    const suggestion = await generateMealSuggestion(parsed.data, recentDishes);
    return NextResponse.json(suggestion);
  } catch (err) {
    console.error("POST /api/suggest failed:", err);
    const message =
      err instanceof AiResponseError
        ? err.message
        : "献立の生成に失敗しました。時間をおいて再度お試しください";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
