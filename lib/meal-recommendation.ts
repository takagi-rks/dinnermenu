import type { MealRecord, WeeklyDish } from "@/lib/types";
import type { WeeklyDishKind, WeeklyFavorite } from "@/lib/weekly-favorites";

export type RecommendationReason =
  | "favorite"
  | "high-rating"
  | "frequent"
  | "not-recent"
  | "ai";

export type RecommendationSource = "favorite" | "history" | "ai";

export interface RecommendedMealCandidate {
  kind: WeeklyDishKind;
  dish: WeeklyDish;
  costYen: number | null;
  score: number;
  reasons: RecommendationReason[];
  source: RecommendationSource;
  cookedCount: number;
  lastCookedOn: string | null;
  averageRating: number | null;
}

interface CandidateAggregate {
  kind: WeeklyDishKind;
  dishName: string;
  ingredients: string[];
  costYen: number | null;
  favorite: boolean;
  cookedCount: number;
  lastCookedOn: string | null;
  ratingTotal: number;
  ratingCount: number;
}

const MAIN_MEMO_MARKER = "週間プラン(主菜)";
const SIDE_MEMO_MARKER = "週間プラン(副菜)";
const RECENT_DAYS_PENALTY = 10;
const STALE_DAYS_BONUS = 21;

export const RECOMMENDATION_REASON_LABELS: Record<RecommendationReason, string> = {
  favorite: "お気に入り",
  "high-rating": "高評価",
  frequent: "よく作る",
  "not-recent": "最近作っていない",
  ai: "AI補完",
};

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

function candidateKey(kind: WeeklyDishKind, dishName: string): string {
  return `${kind}:${normalize(dishName)}`;
}

function mealKind(meal: MealRecord): WeeklyDishKind | null {
  if (meal.memo.includes(MAIN_MEMO_MARKER)) return "main";
  if (meal.memo.includes(SIDE_MEMO_MARKER)) return "side";
  return null;
}

function daysSince(dateString: string, today: Date): number {
  const parts = dateString.split("-").map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  if (!y || !m || d === undefined) return 0;
  const date = new Date(y, m - 1, d);
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  return Math.floor((todayStart.getTime() - date.getTime()) / 86400000);
}

function scoreAggregate(
  aggregate: CandidateAggregate,
  today: Date
): Pick<RecommendedMealCandidate, "score" | "reasons" | "averageRating"> {
  const reasons: RecommendationReason[] = [];
  let score = 0;

  if (aggregate.favorite) {
    score += 50;
    reasons.push("favorite");
  }

  const averageRating =
    aggregate.ratingCount > 0 ? aggregate.ratingTotal / aggregate.ratingCount : null;
  if (averageRating !== null) {
    score += averageRating * 8;
    if (averageRating >= 4) reasons.push("high-rating");
  }

  score += Math.min(aggregate.cookedCount, 6) * 4;
  if (aggregate.cookedCount >= 2) reasons.push("frequent");

  if (aggregate.lastCookedOn) {
    const elapsed = daysSince(aggregate.lastCookedOn, today);
    if (elapsed <= RECENT_DAYS_PENALTY) {
      score -= 35 - elapsed * 2;
    } else if (elapsed >= STALE_DAYS_BONUS) {
      score += 12;
      reasons.push("not-recent");
    }
  }

  return {
    score,
    reasons,
    averageRating,
  };
}

export function buildRecommendedMealCandidates(
  meals: MealRecord[],
  favorites: WeeklyFavorite[],
  today: Date = new Date()
): RecommendedMealCandidate[] {
  const aggregates = new Map<string, CandidateAggregate>();

  for (const favorite of favorites) {
    if (favorite.keyIngredients.length === 0) continue;
    const key = candidateKey(favorite.kind, favorite.dishName);
    aggregates.set(key, {
      kind: favorite.kind,
      dishName: favorite.dishName,
      ingredients: favorite.keyIngredients,
      costYen: null,
      favorite: true,
      cookedCount: 0,
      lastCookedOn: null,
      ratingTotal: 0,
      ratingCount: 0,
    });
  }

  for (const meal of meals) {
    const kind = mealKind(meal);
    if (!kind || meal.ingredients.length === 0) continue;

    const key = candidateKey(kind, meal.dishName);
    const current = aggregates.get(key) ?? {
      kind,
      dishName: meal.dishName,
      ingredients: meal.ingredients,
      costYen: null,
      favorite: false,
      cookedCount: 0,
      lastCookedOn: null,
      ratingTotal: 0,
      ratingCount: 0,
    };

    current.cookedCount += 1;
    if (!current.lastCookedOn || meal.cookedOn > current.lastCookedOn) {
      current.lastCookedOn = meal.cookedOn;
      current.costYen = meal.costYen;
      if (!current.favorite) {
        current.dishName = meal.dishName;
        current.ingredients = meal.ingredients;
      }
    }
    if (meal.rating !== null) {
      current.ratingTotal += meal.rating;
      current.ratingCount += 1;
    }
    aggregates.set(key, current);
  }

  return [...aggregates.values()]
    .map((aggregate) => {
      const scored = scoreAggregate(aggregate, today);
      const source: RecommendationSource = aggregate.favorite
        ? "favorite"
        : "history";
      return {
        kind: aggregate.kind,
        dish: {
          dishName: aggregate.dishName,
          keyIngredients: aggregate.ingredients,
        },
        costYen: aggregate.costYen,
        score: scored.score,
        reasons: scored.reasons,
        source,
        cookedCount: aggregate.cookedCount,
        lastCookedOn: aggregate.lastCookedOn,
        averageRating: scored.averageRating,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.lastCookedOn ?? "").localeCompare(b.lastCookedOn ?? "") ||
        a.dish.dishName.localeCompare(b.dish.dishName, "ja")
    );
}

export function createAiCandidate(
  kind: WeeklyDishKind,
  dish: WeeklyDish
): RecommendedMealCandidate {
  return {
    kind,
    dish,
    costYen: null,
    score: 0,
    reasons: ["ai"],
    source: "ai",
    cookedCount: 0,
    lastCookedOn: null,
    averageRating: null,
  };
}
