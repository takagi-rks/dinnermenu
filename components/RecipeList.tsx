"use client";

import { useCallback, useEffect, useState } from "react";
import RecipeForm from "@/components/RecipeForm";
import {
  fetchRecipes,
  patchRecipe,
  postRecipe,
  removeRecipe,
} from "@/lib/api-client";
import type {
  CreateRecipeInput,
  DishKind,
  RecipeRecord,
} from "@/lib/types";

type KindFilter = "all" | DishKind;

function kindLabel(kind: DishKind): string {
  return kind === "main" ? "主菜" : "副菜";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function RecipeCard({
  recipe,
  onReload,
}: {
  recipe: RecipeRecord;
  onReload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async (input: CreateRecipeInput) => {
    setBusy(true);
    setError(null);
    try {
      await patchRecipe(recipe.id, input);
      setEditing(false);
      await onReload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新に失敗しました";
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`「${recipe.recipeName}」を削除しますか?`)) return;
    setBusy(true);
    setError(null);
    try {
      await removeRecipe(recipe.id);
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
      {editing ? (
        <RecipeForm
          initialRecipe={recipe}
          busy={busy}
          submitLabel="変更を保存"
          onSubmit={handleUpdate}
          onCancel={() => {
            setError(null);
            setEditing(false);
          }}
        />
      ) : (
        <div className="space-y-3">
          <div className="space-y-3 min-[420px]:flex min-[420px]:items-start min-[420px]:justify-between min-[420px]:gap-3 min-[420px]:space-y-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                    recipe.kind === "main"
                      ? "bg-pine/10 text-pine"
                      : "bg-amber/10 text-amber"
                  }`}
                >
                  {kindLabel(recipe.kind)}
                </span>
                {recipe.isFavorite && (
                  <span className="rounded-md bg-amber/10 px-2 py-0.5 text-xs font-bold text-amber">
                    ★ お気に入り
                  </span>
                )}
              </div>
              <h2 className="mt-2 break-words text-base font-bold leading-snug">
                {recipe.recipeName}
              </h2>
              <p className="mt-1 text-xs text-muted">
                登録日 {formatDateTime(recipe.createdAt)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 min-[420px]:shrink-0">
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={busy}
                className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-pine/40 disabled:opacity-50"
              >
                編集
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
              >
                削除
              </button>
            </div>
          </div>

          <div className="space-y-2 text-sm leading-relaxed">
            {recipe.ingredients.length > 0 && (
              <section>
                <h3 className="text-xs font-bold text-pine">食材</h3>
                <p className="mt-0.5 break-words text-muted">
                  {recipe.ingredients.join("、")}
                </p>
              </section>
            )}

            {recipe.memo && (
              <section>
                <h3 className="text-xs font-bold text-pine">メモ</h3>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-muted">
                  {recipe.memo}
                </p>
              </section>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-pine">評価</span>
              <span className="text-sm text-muted">
                {recipe.rating !== null ? `${recipe.rating}/5` : "未評価"}
              </span>
            </div>

            {recipe.recipeUrl && (
              <a
                href={recipe.recipeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 max-w-full items-center rounded-lg bg-pine/10 px-3 py-2 text-sm font-semibold text-pine hover:bg-pine/15"
              >
                <span className="truncate">URLを開く</span>
              </a>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export default function RecipeList() {
  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecipes({
        q: query.trim() || undefined,
        kind: kindFilter === "all" ? undefined : kindFilter,
        favoriteOnly,
        limit: 500,
      });
      setRecipes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "レシピ一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [favoriteOnly, kindFilter, query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const handleCreate = async (input: CreateRecipeInput) => {
    setSaving(true);
    try {
      await postRecipe(input);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const emptyMessage =
    query || kindFilter !== "all" || favoriteOnly
      ? "条件に合うレシピが見つかりませんでした"
      : "まだレシピがありません。よく作る料理を登録すると、週間献立の候補に使われます。";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-base font-bold">レシピを登録</h2>
        <RecipeForm busy={saving} onSubmit={handleCreate} />
      </section>

      <section className="space-y-4">
        <div className="space-y-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="レシピ名・メモ・URLで検索"
            aria-label="レシピを検索"
            className="w-full rounded-xl border border-line bg-card px-3 py-3 text-base focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
          />
          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-[1fr_auto]">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-card p-1">
              {([
                ["all", "すべて"],
                ["main", "主菜"],
                ["side", "副菜"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKindFilter(value)}
                  aria-pressed={kindFilter === value}
                  className={`min-h-11 rounded-lg px-2 py-2 text-sm font-bold transition-colors ${
                    kindFilter === value
                      ? "bg-pine text-white"
                      : "text-muted hover:bg-line/60"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFavoriteOnly((value) => !value)}
              aria-pressed={favoriteOnly}
              className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                favoriteOnly
                  ? "border-amber bg-amber text-white"
                  : "border-line bg-card text-ink"
              }`}
            >
              ★ お気に入り
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="rounded-2xl border border-line bg-card px-5 py-8 text-center text-sm text-muted">
            読み込み中…
          </div>
        ) : recipes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            {emptyMessage}
          </div>
        ) : (
          <ul className="space-y-3">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <RecipeCard recipe={recipe} onReload={load} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
