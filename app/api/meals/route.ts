import { NextResponse } from "next/server";
import { createMeal, listMeals } from "@/lib/supabase/meals";
import { createMealSchema, listMealsQuerySchema } from "@/lib/validation";
import type { ApiError, MealRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/meals?q=&favorite=&limit=&offset= 履歴一覧(日付降順) */
export async function GET(
  request: Request
): Promise<NextResponse<MealRecord[] | ApiError>> {
  const { searchParams } = new URL(request.url);
  const parsed = listMealsQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "検索条件が不正です" }, { status: 400 });
  }

  try {
    const meals = await listMeals({
      q: parsed.data.q,
      favoriteOnly: parsed.data.favorite === "true",
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      from: parsed.data.from,
      to: parsed.data.to,
    });
    return NextResponse.json(meals);
  } catch (err) {
    console.error("GET /api/meals failed:", err);
    return NextResponse.json(
      { error: "献立履歴の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/** POST /api/meals 履歴保存 */
export async function POST(
  request: Request
): Promise<NextResponse<MealRecord | ApiError>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const parsed = createMealSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "入力内容を確認してください";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const meal = await createMeal(parsed.data);
    return NextResponse.json(meal, { status: 201 });
  } catch (err) {
    console.error("POST /api/meals failed:", err);
    return NextResponse.json(
      { error: "献立の保存に失敗しました" },
      { status: 500 }
    );
  }
}
