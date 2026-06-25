"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MealCard from "@/components/MealCard";
import { fetchMeals } from "@/lib/api-client";
import type { MealRecord } from "@/lib/types";

export default function HistoryList() {
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [query, setQuery] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, favOnly: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMeals({ q: q || undefined, favoriteOnly: favOnly });
      setMeals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "履歴の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  // 初回ロード + 絞り込み変更時は即時、検索語は300msデバウンス
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void load(query.trim(), favoriteOnly);
    }, query ? 300 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, favoriteOnly, load]);

  const handleChange = (updated: MealRecord) => {
    setMeals((prev) =>
      prev
        .map((m) => (m.id === updated.id ? updated : m))
        // 日付編集後も一覧の日付降順を維持する
        .sort(
          (a, b) =>
            b.cookedOn.localeCompare(a.cookedOn) ||
            b.createdAt.localeCompare(a.createdAt)
        )
    );
  };

  const handleDelete = (id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-[1fr_auto]">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="料理名・メモで検索"
          aria-label="履歴を検索"
          className="w-full rounded-xl border border-line bg-card px-3 py-3 text-base focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
        />
        <button
          type="button"
          onClick={() => setFavoriteOnly((v) => !v)}
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

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      {loading ? (
        <div className="rounded-2xl border border-line bg-card px-5 py-8 text-center text-sm text-muted">
          読み込み中…
        </div>
      ) : meals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
          {query || favoriteOnly
            ? "条件に合う献立が見つかりませんでした"
            : "まだ履歴がありません。提案ページから献立を保存してみましょう"}
        </div>
      ) : (
        <ul className="space-y-3">
          {meals.map((meal) => (
            <li key={meal.id}>
              <MealCard meal={meal} onChange={handleChange} onDelete={handleDelete} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
