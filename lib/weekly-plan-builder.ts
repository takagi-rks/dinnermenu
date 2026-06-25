import {
  createAiCandidate,
  type RecommendedMealCandidate,
} from "@/lib/meal-recommendation";
import type {
  SuggestionRequest,
  WeeklyDish,
  WeeklyMealPlan,
} from "@/lib/types";
import type { WeeklyDishKind } from "@/lib/weekly-favorites";
import { rebuildShoppingList } from "@/lib/weekly-shopping";

export type WeeklyCandidate = RecommendedMealCandidate;

export interface WeeklyPlanBuildResult {
  plan: WeeklyMealPlan;
  usedCandidates: WeeklyCandidate[];
  aiUsed: boolean;
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

export function weeklyCandidateKey(
  kind: WeeklyDishKind,
  dishName: string
): string {
  return `${kind}:${normalize(dishName)}`;
}

function candidateKey(candidate: WeeklyCandidate): string {
  return weeklyCandidateKey(candidate.kind, candidate.dish.dishName);
}

function isAllowed(candidate: WeeklyCandidate, avoidIngredients: string[]): boolean {
  const searchable = normalize(
    [candidate.dish.dishName, ...candidate.dish.keyIngredients].join(" ")
  );
  return !avoidIngredients.some((item) => searchable.includes(normalize(item)));
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
  return [...unique.values()].sort(
    (a, b) =>
      b.score - a.score ||
      (a.lastCookedOn ?? "").localeCompare(b.lastCookedOn ?? "") ||
      a.dish.dishName.localeCompare(b.dish.dishName, "ja")
  );
}

export function hasFullWeekCandidates(candidates: WeeklyCandidate[]): boolean {
  return (
    candidates.filter((candidate) => candidate.kind === "main").length >= 7 &&
    candidates.filter((candidate) => candidate.kind === "side").length >= 7
  );
}

function generatedToCandidates(
  generated: WeeklyDish[],
  kind: WeeklyDishKind
): WeeklyCandidate[] {
  return generated.map((dish) => createAiCandidate(kind, dish));
}

function fillDishes(
  preferred: WeeklyCandidate[],
  generated: WeeklyDish[],
  kind: WeeklyDishKind
): WeeklyCandidate[] {
  const combined = [
    ...preferred.filter((candidate) => candidate.kind === kind),
    ...generatedToCandidates(generated, kind),
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

export function buildWeeklyPlanWithMeta(
  candidates: WeeklyCandidate[],
  request: SuggestionRequest,
  generatedPlan?: WeeklyMealPlan
): WeeklyPlanBuildResult | null {
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
  const usedCandidates = [...mains, ...sides];
  const knownCost = usedCandidates.reduce(
    (total, candidate) => total + (candidate.costYen ?? 0),
    0
  );

  return {
    plan: {
      days,
      shoppingList: rebuildShoppingList(days, request.availableIngredients),
      estimatedBudgetYen: knownCost || generatedPlan?.estimatedBudgetYen || 0,
    },
    usedCandidates,
    aiUsed: usedCandidates.some((candidate) => candidate.source === "ai"),
  };
}

export function buildWeeklyPlan(
  candidates: WeeklyCandidate[],
  request: SuggestionRequest,
  generatedPlan?: WeeklyMealPlan
): WeeklyMealPlan | null {
  return buildWeeklyPlanWithMeta(candidates, request, generatedPlan)?.plan ?? null;
}

export function findRecommendedDaySuggestion(
  candidates: WeeklyCandidate[],
  request: SuggestionRequest,
  excludedDishNames: string[]
): { main: WeeklyCandidate; side: WeeklyCandidate } | null {
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
  return main && side ? { main, side } : null;
}

export function findLocalDaySuggestion(
  candidates: WeeklyCandidate[],
  request: SuggestionRequest,
  excludedDishNames: string[]
): { main: WeeklyDish; side: WeeklyDish } | null {
  const result = findRecommendedDaySuggestion(candidates, request, excludedDishNames);
  return result ? { main: result.main.dish, side: result.side.dish } : null;
}
