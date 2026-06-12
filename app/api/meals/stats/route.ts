import { NextResponse } from "next/server";
import { getDishStats } from "@/lib/supabase/meals";
import type { ApiError, DishStat } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOP_N = 20;

/** GET /api/meals/stats 料理名ごとの作成回数(回数降順・上位20件) */
export async function GET(): Promise<NextResponse<DishStat[] | ApiError>> {
  try {
    const stats = await getDishStats(TOP_N);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("GET /api/meals/stats failed:", err);
    return NextResponse.json(
      { error: "統計の取得に失敗しました" },
      { status: 500 }
    );
  }
}
