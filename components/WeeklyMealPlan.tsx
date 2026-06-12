"use client";

import { useState } from "react";
import { postMealsBulk } from "@/lib/api-client";
import type { CreateMealInput, WeeklyMealPlan } from "@/lib/types";

interface Props {
  plan: WeeklyMealPlan;
  onRetry: () => void;
}

/** ローカルタイムの今日をYYYY-MM-DDで返す */
function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD に日数を加算(ローカルタイム基準) */
function addDays(dateString: string, days: number): string {
  const [y, m, d] = dateString.split("-").map(Number);
  if (!y || !m || d === undefined) return dateString;
  const date = new Date(y, m - 1, d + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatShort(dateString: string): string {
  const [, m, d] = dateString.split("-");
  if (!m || !d) return dateString;
  return `${Number(m)}/${Number(d)}`;
}

/** 料理名から決定的にYouTube検索URLを生成(AI出力のURLは使わない) */
function youtubeSearchUrl(dishName: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${dishName} レシピ`
  )}`;
}

function DishRow({ label, dishName, ingredients }: {
  label: string;
  dishName: string;
  ingredients: string[];
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 rounded-md bg-pine/10 px-2 py-0.5 text-xs font-bold text-pine">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold">{dishName}</p>
          <a
            href={youtubeSearchUrl(dishName)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${dishName}のレシピ動画をYouTubeで検索`}
            className="shrink-0 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-100"
          >
            ▶ 動画
          </a>
        </div>
        <p className="mt-0.5 text-xs text-muted">{ingredients.join("、")}</p>
      </div>
    </div>
  );
}

export default function WeeklyMealPlanView({ plan, onRetry }: Props) {
  const [startDate, setStartDate] = useState(todayString);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      const meals: CreateMealInput[] = plan.days.flatMap((day) => {
        const cookedOn = addDays(startDate, day.dayIndex - 1);
        return [
          {
            cookedOn,
            dishName: day.main.dishName,
            ingredients: day.main.keyIngredients,
            steps: [],
            memo: "週間プラン(主菜)",
          },
          {
            cookedOn,
            dishName: day.side.dishName,
            ingredients: day.side.keyIngredients,
            steps: [],
            memo: "週間プラン(副菜)",
          },
        ];
      });
      await postMealsBulk(meals);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <div className="bg-pine px-5 py-4 text-white">
          <p className="text-xs opacity-80">1週間の献立プラン</p>
          <h2 className="text-lg font-bold">
            {formatShort(startDate)} 〜 {formatShort(addDays(startDate, 6))}
          </h2>
          <p className="mt-1 text-xs opacity-90">
            週合計の目安 {plan.estimatedBudgetYen.toLocaleString()}円
          </p>
        </div>

        <ul className="divide-y divide-line">
          {plan.days.map((day) => (
            <li key={day.dayIndex} className="space-y-2.5 px-5 py-4">
              <p className="text-xs font-bold text-muted">
                {day.dayIndex}日目({formatShort(addDays(startDate, day.dayIndex - 1))})
              </p>
              <DishRow
                label="主菜"
                dishName={day.main.dishName}
                ingredients={day.main.keyIngredients}
              />
              <DishRow
                label="副菜"
                dishName={day.side.dishName}
                ingredients={day.side.keyIngredients}
              />
            </li>
          ))}
        </ul>
      </article>

      {plan.shoppingList.length > 0 && (
        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-bold text-pine">
            1週間分の買い物リスト
          </h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {plan.shoppingList.map((item) => (
              <li key={item} className="flex gap-1.5">
                <span aria-hidden className="text-pine">
                  ・
                </span>
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-line bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <label
            htmlFor="week-start"
            className="shrink-0 text-sm font-semibold text-ink"
          >
            開始日
          </label>
          <input
            id="week-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={saved}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-base focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || saved || !startDate}
            className="flex-1 rounded-xl bg-pine py-3 text-sm font-bold text-white transition-colors hover:bg-pine-dark disabled:opacity-50"
          >
            {saved
              ? "14品を履歴に保存しました"
              : saving
                ? "保存中…"
                : "この1週間プランを一括保存"}
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-pine/50"
          >
            別の提案
          </button>
        </div>
      </section>
    </div>
  );
}
