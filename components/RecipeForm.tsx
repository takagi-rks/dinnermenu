"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { CreateRecipeInput, DishKind, RecipeRecord } from "@/lib/types";

interface Props {
  initialRecipe?: RecipeRecord;
  busy?: boolean;
  submitLabel?: string;
  onSubmit: (input: CreateRecipeInput) => Promise<void>;
  onCancel?: () => void;
}

function joinIngredients(ingredients: string[]): string {
  return ingredients.join("、");
}

function splitIngredients(value: string): string[] {
  return value
    .split(/[,\n、]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isValidRecipeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function RecipeForm({
  initialRecipe,
  busy = false,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [recipeName, setRecipeName] = useState(initialRecipe?.recipeName ?? "");
  const [kind, setKind] = useState<DishKind>(initialRecipe?.kind ?? "main");
  const [ingredientsText, setIngredientsText] = useState(
    initialRecipe ? joinIngredients(initialRecipe.ingredients) : ""
  );
  const [memo, setMemo] = useState(initialRecipe?.memo ?? "");
  const [recipeUrl, setRecipeUrl] = useState(initialRecipe?.recipeUrl ?? "");
  const [rating, setRating] = useState<number | null>(initialRecipe?.rating ?? null);
  const [isFavorite, setIsFavorite] = useState(initialRecipe?.isFavorite ?? false);
  const [error, setError] = useState<string | null>(null);

  const ingredients = useMemo(
    () => splitIngredients(ingredientsText),
    [ingredientsText]
  );
  const nameValid = recipeName.trim().length > 0;
  const urlValid = isValidRecipeUrl(recipeUrl);
  const canSubmit = nameValid && urlValid && !busy;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!nameValid) {
      setError("レシピ名を入力してください");
      return;
    }
    if (!urlValid) {
      setError("URLはhttpまたはhttpsで始まる形式で入力してください");
      return;
    }

    try {
      await onSubmit({
        recipeName: recipeName.trim(),
        kind,
        ingredients,
        memo: memo.trim(),
        recipeUrl: recipeUrl.trim(),
        rating,
        isFavorite,
      });
      if (!initialRecipe) {
        setRecipeName("");
        setKind("main");
        setIngredientsText("");
        setMemo("");
        setRecipeUrl("");
        setRating(null);
        setIsFavorite(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={initialRecipe ? `recipe-name-${initialRecipe.id}` : "recipe-name"} className="text-sm font-bold">
          レシピ名
        </label>
        <input
          id={initialRecipe ? `recipe-name-${initialRecipe.id}` : "recipe-name"}
          type="text"
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
          maxLength={100}
          placeholder="例: 鶏むね肉の照り焼き"
          className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-base focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">種別</legend>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-paper p-1">
          {(["main", "side"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              aria-pressed={kind === value}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                kind === value
                  ? "bg-pine text-white"
                  : "text-muted hover:bg-line/60"
              }`}
            >
              {value === "main" ? "主菜" : "副菜"}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor={initialRecipe ? `recipe-ingredients-${initialRecipe.id}` : "recipe-ingredients"} className="text-sm font-bold">
          食材
        </label>
        <textarea
          id={initialRecipe ? `recipe-ingredients-${initialRecipe.id}` : "recipe-ingredients"}
          value={ingredientsText}
          onChange={(e) => setIngredientsText(e.target.value)}
          rows={3}
          placeholder="鶏むね肉、しょうゆ、みりん"
          className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-base focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
        />
        <p className="text-xs text-muted">読点・カンマ・改行で分けて登録します。</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={initialRecipe ? `recipe-memo-${initialRecipe.id}` : "recipe-memo"} className="text-sm font-bold">
          メモ
        </label>
        <textarea
          id={initialRecipe ? `recipe-memo-${initialRecipe.id}` : "recipe-memo"}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="味付け、家族の反応、下ごしらえなど"
          className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-base focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={initialRecipe ? `recipe-url-${initialRecipe.id}` : "recipe-url"} className="text-sm font-bold">
          レシピURL / YouTube検索URL
        </label>
        <input
          id={initialRecipe ? `recipe-url-${initialRecipe.id}` : "recipe-url"}
          type="url"
          value={recipeUrl}
          onChange={(e) => setRecipeUrl(e.target.value)}
          maxLength={2000}
          placeholder="https://www.youtube.com/results?search_query=..."
          className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-base focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
        />
        {!urlValid && (
          <p className="text-xs font-medium text-red-600">
            URLはhttpまたはhttpsで始まる形式で入力してください
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-[1fr_auto] min-[380px]:items-end">
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold">評価</legend>
          <div className="flex items-center gap-1" role="group" aria-label="評価">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating((current) => current === value ? null : value)}
                aria-label={`評価 ${value}`}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-lg leading-none ${
                  rating !== null && value <= rating ? "text-pine" : "text-line"
                }`}
              >
                ●
              </button>
            ))}
            {rating !== null && (
              <span className="ml-1 text-xs text-muted">{rating}/5</span>
            )}
          </div>
        </fieldset>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={isFavorite}
            onChange={(e) => setIsFavorite(e.target.checked)}
            className="h-5 w-5 accent-amber"
          />
          お気に入り
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-[1fr_auto]">
        <button
          type="submit"
          disabled={!canSubmit}
          className="min-h-12 rounded-xl bg-pine px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-pine-dark disabled:opacity-50"
        >
          {busy ? "保存中…" : submitLabel ?? "登録する"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-12 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink hover:border-pine/40 disabled:opacity-50"
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
