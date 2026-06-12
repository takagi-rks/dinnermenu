import { z } from "zod";

/** カンマ・空白を除去した食材名の配列 */
const ingredientList = z
  .array(z.string().trim().min(1).max(50))
  .max(30, "食材は30個までです");

/** 夕食提案フォーム入力の検証 */
export const suggestionRequestSchema = z.object({
  servings: z.number().int().min(1, "1人以上を指定してください").max(20),
  budgetYen: z.number().int().min(100, "予算は100円以上で指定してください").max(100000),
  cookingTimeMinutes: z.number().int().min(5, "5分以上を指定してください").max(300),
  availableIngredients: ingredientList,
  avoidIngredients: ingredientList,
  mood: z.string().trim().max(200, "気分は200文字以内で入力してください"),
});

/** AIレスポンス(JSON)の検証 — モデル出力は信用せず必ず検証する */
export const mealSuggestionSchema = z.object({
  dishName: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(1).max(1000),
  ingredients: z.array(z.string().trim().min(1).max(100)).min(1).max(40),
  missingIngredients: z.array(z.string().trim().min(1).max(100)).max(40),
  steps: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
  estimatedBudgetYen: z.number().int().min(0).max(100000),
  cookingTimeMinutes: z.number().int().min(1).max(600),
});

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日付はYYYY-MM-DD形式で指定してください");

const costYen = z.number().int().min(0).max(100000).nullable().optional();

/** 履歴保存の検証 */
export const createMealSchema = z.object({
  cookedOn: dateString,
  dishName: z.string().trim().min(1, "料理名は必須です").max(100),
  ingredients: z.array(z.string().trim().min(1).max(100)).max(40).default([]),
  steps: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  memo: z.string().trim().max(2000).optional().default(""),
  isFavorite: z.boolean().optional().default(false),
  costYen,
});

/** 履歴部分更新の検証 */
export const updateMealSchema = z
  .object({
    dishName: z.string().trim().min(1, "料理名は必須です").max(100).optional(),
    cookedOn: dateString.optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    memo: z.string().trim().max(2000).optional(),
    isFavorite: z.boolean().optional(),
    costYen,
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "更新する項目を1つ以上指定してください",
  });

/** 履歴一覧クエリの検証 */
export const listMealsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  favorite: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** 週間献立の1品の検証 */
const weeklyDishSchema = z.object({
  dishName: z.string().trim().min(1).max(100),
  keyIngredients: z.array(z.string().trim().min(1).max(100)).min(1).max(15),
});

/** AIが生成する週間献立プランの検証 — モデル出力は信用せず必ず検証する */
export const weeklyMealPlanSchema = z.object({
  days: z
    .array(
      z.object({
        dayIndex: z.number().int().min(1).max(7),
        main: weeklyDishSchema,
        side: weeklyDishSchema,
      })
    )
    .length(7, "7日分の献立が必要です"),
  shoppingList: z.array(z.string().trim().min(1).max(100)).max(80),
  estimatedBudgetYen: z.number().int().min(0).max(200000),
});

/** AIが生成する1日分の再提案の検証 */
export const dayMealSuggestionSchema = z.object({
  main: weeklyDishSchema,
  side: weeklyDishSchema,
});

/** 週間献立の一括保存リクエストの検証 */
export const bulkCreateMealsSchema = z.object({
  meals: z
    .array(createMealSchema)
    .min(1, "保存する献立がありません")
    .max(20, "一括保存は20件までです"),
});

/** 1日再提案リクエストの検証 */
export const dayResuggestSchema = z.object({
  request: suggestionRequestSchema,
  /** 週内の他の料理名(重複回避用) */
  otherDishes: z.array(z.string().trim().min(1).max(100)).max(14),
});
