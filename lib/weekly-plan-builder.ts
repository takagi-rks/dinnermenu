import type {
  MealRecord,
  SuggestionRequest,
  WeeklyDish,
  WeeklyMealPlan,
} from "@/lib/types";
import type { WeeklyFavorite, WeeklyDishKind } from "@/lib/weekly-favorites";
import { rebuildShoppingList } from "@/lib/weekly-shopping";

export interface WeeklyCandidate {
  kind: WeeklyDishKind;
  dish: WeeklyDish;
  costYen: number | null;
}

const MAIN_MEMO_MARKER = "週間プラン(主菜)";
const SIDE_MEMO_MARKER = "週間プラン(副菜)";

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

function candidateKey(candidate: WeeklyCandidate): string {
  return `${candidate.kind}:${normalize(candidate.dish.dishName)}`;
}

function isAllowed(candidate: WeeklyCandidate, avoidIngredients: string[]): boolean {
  const searchable = normalize(
    [candidate.dish.dishName, ...candidate.dish.keyIngredients].join(" ")
  );
  return !avoidIngredients.some((item) => searchable.includes(normalize(item)));
}

export function favoritesToCandidates(
  favorites: WeeklyFavorite[]
): WeeklyCandidate[] {
  return favorites
    .filter((favorite) => favorite.keyIngredients.length > 0)
    .map((favorite) => ({
      kind: favorite.kind,
      dish: {
        dishName: favorite.dishName,
        keyIngredients: favorite.keyIngredients,
      },
      costYen: null,
    }));
}

export function mealsToCandidates(meals: MealRecord[]): WeeklyCandidate[] {
  const candidates: WeeklyCandidate[] = [];
  for (const meal of meals) {
    if (meal.ingredients.length === 0) continue;

    let kind: WeeklyDishKind | null = null;
    if (meal.memo.includes(MAIN_MEMO_MARKER)) kind = "main";
    if (meal.memo.includes(SIDE_MEMO_MARKER)) kind = "side";
    if (!kind) continue;

    candidates.push({
      kind,
      dish: { dishName: meal.dishName, keyIngredients: meal.ingredients },
      costYen: meal.costYen,
    });
  }
  return candidates;
}

export function uniqueCandidates(
  candidates: WeeklyCandidate[],
  request: SuggestionRequest
): WeeklyCandidate[] {
  const unique = new Map<string, WeeklyCandidate>();
  for (const candidate of candidates) {
    if (!isAllowed(candidate, request.avoidIngredients)) continue;
    const key = candidateKey(candidate);
    if (!unique.has(key)) unique.set(key, candidate);
  }
  return [...unique.values()];
}

export function hasFullWeekCandidates(candidates: WeeklyCandidate[]): boolean {
  return (
    candidates.filter((candidate) => candidate.kind === "main").length >= 7 &&
    candidates.filter((candidate) => candidate.kind === "side").length >= 7
  );
}

function fillDishes(
  preferred: WeeklyCandidate[],
  generated: WeeklyDish[],
  kind: WeeklyDishKind
): WeeklyCandidate[] {
  const combined: WeeklyCandidate[] = [
    ...preferred.filter((candidate) => candidate.kind === kind),
    ...generated.map((dish) => ({ kind, dish, costYen: null })),
  ];
  const unique = new Map<string, WeeklyCandidate>();
  for (const candidate of combined) {
    const key = candidateKey(candidate);
    if (!unique.has(key)) unique.set(key, candidate);
  }
  const options = [...unique.values()];
  if (options.length === 0) return [];
  return Array.from({ length: 7 }, (_, index) => options[index % options.length]!);
}

export function buildWeeklyPlan(
  candidates: WeeklyCandidate[],
  request: SuggestionRequest,
  generatedPlan?: WeeklyMealPlan
): WeeklyMealPlan | null {
  const filtered = uniqueCandidates(candidates, request);
  const mains = fillDishes(
    filtered,
    generatedPlan?.days.map((day) => day.main) ?? [],
    "main"
  );
  const sides = fillDishes(
    filtered,
    generatedPlan?.days.map((day) => day.side) ?? [],
    "side"
  );
  if (mains.length < 7 || sides.length < 7) return null;

  const days = Array.from({ length: 7 }, (_, index) => ({
    dayIndex: index + 1,
    main: mains[index]!.dish,
    side: sides[index]!.dish,
  }));
  const knownCost = [...mains, ...sides].reduce(
    (total, candidate) => total + (candidate.costYen ?? 0),
    0
  );

  return {
    days,
    shoppingList: rebuildShoppingList(days, request.availableIngredients),
    estimatedBudgetYen: knownCost || generatedPlan?.estimatedBudgetYen || 0,
  };
}

export function findLocalDaySuggestion(
  candidates: WeeklyCandidate[],
  request: SuggestionRequest,
  excludedDishNames: string[]
): { main: WeeklyDish; side: WeeklyDish } | null {
  const normalizedExcluded = excludedDishNames.map(normalize);
  const currentDishes = new Set(normalizedExcluded.slice(-2));
  const otherDishes = new Set(normalizedExcluded.slice(0, -2));
  const candidatesForChange = uniqueCandidates(candidates, request).filter(
    (candidate) => !currentDishes.has(normalize(candidate.dish.dishName))
  );

  const nonDuplicate = candidatesForChange.filter(
    (candidate) => !otherDishes.has(normalize(candidate.dish.dishName))
  );
  const main =
    nonDuplicate.find((candidate) => candidate.kind === "main") ??
    candidatesForChange.find((candidate) => candidate.kind === "main");
  const side =
    nonDuplicate.find((candidate) => candidate.kind === "side") ??
    candidatesForChange.find((candidate) => candidate.kind === "side");
  return main && side ? { main: main.dish, side: side.dish } : null;
}
