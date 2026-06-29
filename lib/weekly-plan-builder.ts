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
  candidateSummary: WeeklyCandidateSummary;
  isCompleteLocalPlan: boolean;
}

export interface WeeklyCandidateSummary {
  manual: number;
  favorite: number;
  history: number;
  ai: number;
}

export interface WeeklyCandidateShortage {
  main: number;
  side: number;
}

export interface WeeklyFixedDaySelection {
  dayIndex: number;
  main?: WeeklyCandidate;
  side?: WeeklyCandidate;
}

export interface WeeklyPlanBuildOptions {
  allowRepeat?: boolean;
  fixedSelections?: WeeklyFixedDaySelection[];
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

export function weeklyCandidateSelectionKey(candidate: WeeklyCandidate): string {
  const ingredients = candidate.dish.keyIngredients.map(normalize).sort().join(",");
  return [
    candidate.source,
    candidate.kind,
    normalize(candidate.dish.dishName),
    ingredients,
  ].join(":");
}

function sourcePriority(candidate: WeeklyCandidate): number {
  switch (candidate.source) {
    case "manual":
      return 4;
    case "favorite":
      return 3;
    case "history":
      return 2;
    case "ai":
      return 1;
  }
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
      sourcePriority(b) - sourcePriority(a) ||
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

export function getWeeklyCandidateShortage(
  candidates: WeeklyCandidate[],
  request: SuggestionRequest,
  fixedSelections: WeeklyFixedDaySelection[] = []
): WeeklyCandidateShortage {
  const filtered = uniqueCandidates(candidates, request);
  const fixedMainKeys = new Set(
    fixedSelections
      .map((selection) => selection.main)
      .filter((candidate): candidate is WeeklyCandidate => Boolean(candidate))
      .map(candidateKey)
  );
  const fixedSideKeys = new Set(
    fixedSelections
      .map((selection) => selection.side)
      .filter((candidate): candidate is WeeklyCandidate => Boolean(candidate))
      .map(candidateKey)
  );
  const fixedMainCount = fixedSelections.filter((selection) => selection.main).length;
  const fixedSideCount = fixedSelections.filter((selection) => selection.side).length;
  const availableMains = filtered.filter(
    (candidate) => candidate.kind === "main" && !fixedMainKeys.has(candidateKey(candidate))
  ).length;
  const availableSides = filtered.filter(
    (candidate) => candidate.kind === "side" && !fixedSideKeys.has(candidateKey(candidate))
  ).length;
  return {
    main: Math.max(0, 7 - fixedMainCount - availableMains),
    side: Math.max(0, 7 - fixedSideCount - availableSides),
  };
}

function generatedToCandidates(
  generated: WeeklyDish[],
  kind: WeeklyDishKind
): WeeklyCandidate[] {
  return generated.map((dish) => createAiCandidate(kind, dish));
}

function candidatesForKind(
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

  return [...unique.values()];
}

function fixedSelectionMap(
  fixedSelections: WeeklyFixedDaySelection[]
): Map<number, WeeklyFixedDaySelection> {
  const map = new Map<number, WeeklyFixedDaySelection>();
  for (const selection of fixedSelections) {
    if (selection.dayIndex < 1 || selection.dayIndex > 7) continue;
    map.set(selection.dayIndex, selection);
  }
  return map;
}

function fillDishesForWeek(
  preferred: WeeklyCandidate[],
  generated: WeeklyDish[],
  kind: WeeklyDishKind,
  _allowRepeat: boolean,
  fixedSelections: WeeklyFixedDaySelection[]
): WeeklyCandidate[] {
  const options = candidatesForKind(preferred, generated, kind);
  const fixedByDay = fixedSelectionMap(fixedSelections);
  const used = new Set<string>();
  const autoUsed = new Set<string>();
  const slots: Array<WeeklyCandidate | undefined> = Array.from({ length: 7 });

  for (let dayIndex = 1; dayIndex <= 7; dayIndex += 1) {
    const fixed = fixedByDay.get(dayIndex);
    const fixedCandidate = kind === "main" ? fixed?.main : fixed?.side;
    if (fixedCandidate) {
      slots[dayIndex - 1] = fixedCandidate;
      used.add(candidateKey(fixedCandidate));
    }
  }

  for (let dayIndex = 1; dayIndex <= 7; dayIndex += 1) {
    const fixed = fixedByDay.get(dayIndex);
    const fixedCandidate = kind === "main" ? fixed?.main : fixed?.side;
    if (fixedCandidate) continue;

    const candidate = options.find((option) => {
      const key = candidateKey(option);
      return !used.has(key) && !autoUsed.has(key);
    });

    if (candidate) {
      slots[dayIndex - 1] = candidate;
      autoUsed.add(candidateKey(candidate));
      continue;
    }

    break;
  }

  return slots.filter((candidate): candidate is WeeklyCandidate => Boolean(candidate));
}

function summarizeUsedCandidates(
  candidates: WeeklyCandidate[]
): WeeklyCandidateSummary {
  const seen = new Set<string>();
  const summary: WeeklyCandidateSummary = {
    manual: 0,
    favorite: 0,
    history: 0,
    ai: 0,
  };

  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    summary[candidate.source] += 1;
  }

  return summary;
}

export function buildWeeklyPlanWithMeta(
  candidates: WeeklyCandidate[],
  request: SuggestionRequest,
  generatedPlan?: WeeklyMealPlan,
  options: WeeklyPlanBuildOptions = {}
): WeeklyPlanBuildResult | null {
  const allowRepeat = options.allowRepeat ?? Boolean(generatedPlan);
  const fixedSelections = options.fixedSelections ?? [];
  const filtered = uniqueCandidates(candidates, request);
  const mains = fillDishesForWeek(
    filtered,
    generatedPlan?.days.map((day) => day.main) ?? [],
    "main",
    allowRepeat,
    fixedSelections
  );
  const sides = fillDishesForWeek(
    filtered,
    generatedPlan?.days.map((day) => day.side) ?? [],
    "side",
    allowRepeat,
    fixedSelections
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
    candidateSummary: summarizeUsedCandidates(usedCandidates),
    isCompleteLocalPlan: !usedCandidates.some((candidate) => candidate.source === "ai"),
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
