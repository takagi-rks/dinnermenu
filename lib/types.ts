/**
 * アプリ全体で共有するドメイン型。
 * DB行・API入出力・UIの境界はすべてここで定義した型を経由する。
 */

/** 夕食提案フォームの入力 */
export interface SuggestionRequest {
  servings: number;
  budgetYen: number;
  cookingTimeMinutes: number;
  availableIngredients: string[];
  avoidIngredients: string[];
  mood: string;
}

/** AIが生成する献立提案 */
export interface MealSuggestion {
  dishName: string;
  reason: string;
  ingredients: string[];
  missingIngredients: string[];
  steps: string[];
  estimatedBudgetYen: number;
  cookingTimeMinutes: number;
}

/** 献立履歴(DB行に対応) */
export interface MealRecord {
  id: string;
  cookedOn: string; // YYYY-MM-DD
  dishName: string;
  ingredients: string[];
  steps: string[];
  rating: number | null; // 1-5
  memo: string;
  isFavorite: boolean;
  createdAt: string; // ISO 8601
}

/** 履歴保存リクエスト */
export interface CreateMealInput {
  cookedOn: string;
  dishName: string;
  ingredients: string[];
  steps: string[];
  rating?: number | null;
  memo?: string;
  isFavorite?: boolean;
}

/** 履歴更新リクエスト(部分更新) */
export interface UpdateMealInput {
  dishName?: string;
  cookedOn?: string;
  rating?: number | null;
  memo?: string;
  isFavorite?: boolean;
}

/** APIエラーレスポンスの共通形 */
export interface ApiError {
  error: string;
}
