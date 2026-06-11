import type {
  CreateMealInput,
  MealRecord,
  MealSuggestion,
  SuggestionRequest,
  UpdateMealInput,
} from "@/lib/types";

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
    throw new Error(message);
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
}): Promise<MealRecord[]> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.favoriteOnly) search.set("favorite", "true");
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
