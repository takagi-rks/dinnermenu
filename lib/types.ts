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
  /** 実食費(円)。null = 未記録 */
  costYen: number | null;
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
  costYen?: number | null;
}

/** 履歴更新リクエスト(部分更新) */
export interface UpdateMealInput {
  dishName?: string;
  cookedOn?: string;
  rating?: number | null;
  memo?: string;
  isFavorite?: boolean;
  costYen?: number | null;
}

/** 週間献立で扱う料理種別 */
export type DishKind = "main" | "side";

/** 手動登録レシピ(DB行に対応) */
export interface RecipeRecord {
  id: string;
  recipeName: string;
  kind: DishKind;
  ingredients: string[];
  memo: string;
  recipeUrl: string;
  rating: number | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 手動レシピ登録リクエスト */
export interface CreateRecipeInput {
  recipeName: string;
  kind: DishKind;
  ingredients: string[];
  memo?: string;
  recipeUrl?: string;
  rating?: number | null;
  isFavorite?: boolean;
}

/** 手動レシピ更新リクエスト(部分更新) */
export interface UpdateRecipeInput {
  recipeName?: string;
  kind?: DishKind;
  ingredients?: string[];
  memo?: string;
  recipeUrl?: string;
  rating?: number | null;
  isFavorite?: boolean;
}

/** APIエラーレスポンスの共通形 */
export interface ApiError {
  error: string;
}

/** 週間献立の1品(主菜または副菜) */
export interface WeeklyDish {
  dishName: string;
  keyIngredients: string[];
}

/** 週間献立の1日分 */
export interface DayMealPlan {
  dayIndex: number; // 1〜7
  main: WeeklyDish;
  side: WeeklyDish;
}

/** AIが生成する1週間分の献立プラン */
export interface WeeklyMealPlan {
  days: DayMealPlan[];
  /** 1週間分の買い足し食材リスト */
  shoppingList: string[];
  /** 1週間合計の目安予算 */
  estimatedBudgetYen: number;
}

/** 料理名ごとの作成回数統計 */
export interface DishStat {
  dishName: string;
  count: number;
}

/** 月別食費集計 */
export interface MonthlyCostSummary {
  /** YYYY-MM 形式 */
  yearMonth: string;
  totalCostYen: number;
  recordCount: number;
}

/** 1日再提案のレスポンス */
export interface DayMealSuggestion {
  main: WeeklyDish;
  side: WeeklyDish;
}
