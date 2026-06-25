"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadWeeklyFavoriteEntries,
  loadWeeklyFavorites,
  saveWeeklyFavorites,
  type WeeklyFavorite,
} from "@/lib/weekly-favorites";

function youtubeSearchUrl(dishName: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${dishName} レシピ`
  )}`;
}

export default function FavoriteRecipesList() {
  const [favorites, setFavorites] = useState<WeeklyFavorite[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFavorites(loadWeeklyFavoriteEntries());
    setHydrated(true);
  }, []);

  const handleRemove = (key: string) => {
    // 解析不能な既存データには触れず、指定されたお気に入りだけを削除する。
    saveWeeklyFavorites(
      loadWeeklyFavorites().filter((storedKey) => storedKey !== key)
    );
    setFavorites((current) =>
      current.filter((favorite) => favorite.key !== key)
    );
  };

  if (!hydrated) {
    return (
      <div className="rounded-2xl border border-line bg-card px-5 py-8 text-center text-sm text-muted">
        お気に入りを読み込んでいます…
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-card px-5 py-8 text-center shadow-sm">
          <p className="font-bold text-ink">お気に入りはまだありません</p>
          <p className="mt-1 text-sm text-muted">
            週間献立の料理にある星を押すと、ここに表示されます。
          </p>
        </div>
        <Link
          href="/weekly?favorites=1"
          className="block min-h-12 rounded-xl bg-pine px-4 py-3 text-center text-sm font-bold leading-snug text-white hover:bg-pine-dark"
        >
          履歴から週間献立を作る
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/weekly?favorites=1"
        className="block min-h-12 rounded-xl bg-pine px-4 py-3 text-center text-sm font-bold leading-snug text-white hover:bg-pine-dark"
      >
        お気に入り・履歴から週間献立を作る
      </Link>
      <ul className="space-y-3">
        {favorites.map((favorite) => (
        <li
          key={favorite.key}
          className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5"
        >
          <div className="space-y-3 min-[380px]:flex min-[380px]:items-start min-[380px]:justify-between min-[380px]:gap-3 min-[380px]:space-y-0">
            <div className="min-w-0">
              <span
                className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                  favorite.kind === "main"
                    ? "bg-pine/10 text-pine"
                    : "bg-amber/10 text-amber"
                }`}
              >
                {favorite.kind === "main" ? "主菜" : "副菜"}
              </span>
              <h2 className="mt-2 break-words text-base font-bold leading-snug text-ink">
                {favorite.dishName}
              </h2>
              {favorite.keyIngredients.length > 0 && (
                <p className="mt-1 break-words text-sm leading-relaxed text-muted">
                  {favorite.keyIngredients.join("、")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleRemove(favorite.key)}
              aria-label={`${favorite.dishName}のお気に入りを解除`}
              className="min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:border-red-200 hover:bg-red-50 min-[380px]:shrink-0"
            >
              解除
            </button>
          </div>
          <a
            href={youtubeSearchUrl(favorite.dishName)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${favorite.dishName}のレシピ動画をYouTubeで検索`}
            className="mt-4 inline-flex min-h-11 max-w-full items-center rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold leading-snug text-red-600 hover:bg-red-100"
          >
            ▶ YouTubeでレシピを検索
          </a>
        </li>
        ))}
      </ul>
    </div>
  );
}
