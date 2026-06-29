import type {
  CreateMealInput,
  DayMealSuggestion,
  DishStat,
  MealRecord,
  MealSuggestion,
  MonthlyCostSummary,
  CreateRecipeInput,
  RecipeRecord,
  SuggestionRequest,
  UpdateRecipeInput,
  UpdateMealInput,
  WeeklyMealPlan,
} from "@/lib/types";

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** fetchの薄いラッパー。エラー時はAPIのerrorメッセージを投げる */
async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : "通信に失敗しました";
    throw new ApiRequestError(message, res.status);
  }
  return data as T;
}

export function postSuggestion(body: SuggestionRequest): Promise<MealSuggestion> {
  return request<MealSuggestion>("/api/suggest", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchMeals(params: {
  q?: string;
  favoriteOnly?: boolean;
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
}): Promise<MealRecord[]> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.favoriteOnly) search.set("favorite", "true");
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const qs = search.toString();
  return request<MealRecord[]>(`/api/meals${qs ? `?${qs}` : ""}`);
}

export function postMeal(body: CreateMealInput): Promise<MealRecord> {
  return request<MealRecord>("/api/meals", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchMeal(id: string, body: UpdateMealInput): Promise<MealRecord> {
  return request<MealRecord>(`/api/meals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function removeMeal(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/meals/${id}`, { method: "DELETE" });
}

export function postWeeklySuggestion(
  body: SuggestionRequest
): Promise<WeeklyMealPlan> {
  return request<WeeklyMealPlan>("/api/weekly-suggest", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postMealsBulk(meals: CreateMealInput[]): Promise<MealRecord[]> {
  return request<MealRecord[]>("/api/meals/bulk", {
    method: "POST",
    body: JSON.stringify({ meals }),
  });
}

export function fetchDishStats(): Promise<DishStat[]> {
  return request<DishStat[]>("/api/meals/stats");
}

export function postDayResuggest(
  req: SuggestionRequest,
  otherDishes: string[]
): Promise<DayMealSuggestion> {
  return request<DayMealSuggestion>("/api/weekly-suggest/day", {
    method: "POST",
    body: JSON.stringify({ request: req, otherDishes }),
  });
}

export function fetchCostSummary(): Promise<MonthlyCostSummary[]> {
  return request<MonthlyCostSummary[]>("/api/meals/cost-summary");
}

export function fetchRecipes(params: {
  q?: string;
  kind?: "main" | "side";
  favoriteOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<RecipeRecord[]> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.kind) search.set("kind", params.kind);
  if (params.favoriteOnly) search.set("favorite", "true");
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  const qs = search.toString();
  return request<RecipeRecord[]>(`/api/recipes${qs ? `?${qs}` : ""}`);
}

export function postRecipe(body: CreateRecipeInput): Promise<RecipeRecord> {
  return request<RecipeRecord>("/api/recipes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchRecipe(
  id: string,
  body: UpdateRecipeInput
): Promise<RecipeRecord> {
  return request<RecipeRecord>(`/api/recipes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function removeRecipe(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/recipes/${id}`, { method: "DELETE" });
}
