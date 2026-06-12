import { NextResponse } from "next/server";
import { getMonthlyCostSummary } from "@/lib/supabase/meals";
import type { ApiError, MonthlyCostSummary } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/meals/cost-summary  月別食費集計 */
export async function GET(): Promise<
  NextResponse<MonthlyCostSummary[] | ApiError>
> {
  try {
    const summary = await getMonthlyCostSummary();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("GET /api/meals/cost-summary failed:", err);
    return NextResponse.json(
      { error: "食費集計の取得に失敗しました" },
      { status: 500 }
    );
  }
}
