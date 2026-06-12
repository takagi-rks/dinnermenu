/**
 * 週間献立プランのブラウザlocalStorage永続化。
 * クライアントコンポーネント専用 — サーバーからはimportしないこと。
 * 読み込み時はzodで構造検証し、不正データはサイレントに破棄する。
 */

import { z } from "zod";
import type { SuggestionRequest, WeeklyMealPlan } from "@/lib/types";
import { weeklyMealPlanSchema, suggestionRequestSchema } from "@/lib/validation";

const STORAGE_KEY = "dinnermenu:weekly-plan:v1";
/** 14日を超えた保存データは古いとみなして破棄 */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const storedPlanSchema = z.object({
  savedAt: z.number(),
  plan: weeklyMealPlanSchema,
  request: suggestionRequestSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** インデックスはshoppingListの各要素に対応 */
  checkedItems: z.array(z.boolean()),
  saved: z.boolean(),
});

export type StoredPlan = z.infer<typeof storedPlanSchema>;

export type PlanStorage = {
  plan: WeeklyMealPlan;
  request: SuggestionRequest;
  startDate: string;
  checkedItems: boolean[];
  saved: boolean;
};

export function loadPlan(): PlanStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = storedPlanSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const { savedAt, ...rest } = parsed.data;
    if (Date.now() - savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return rest;
  } catch {
    return null;
  }
}

export function savePlan(data: PlanStorage): void {
  if (typeof window === "undefined") return;
  try {
    const record: StoredPlan = { savedAt: Date.now(), ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage容量超過等は握り潰す
  }
}

export function clearPlan(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
