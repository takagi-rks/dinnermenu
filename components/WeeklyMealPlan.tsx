"use client";

import { useState } from "react";
import { postMealsBulk, postDayResuggest } from "@/lib/api-client";

import type {
  CreateMealInput,
  DayMealPlan,
  SuggestionRequest,
  WeeklyMealPlan,
} from "@/lib/types";

interface Props {
  plan: WeeklyMealPlan;
  request: SuggestionRequest;
  startDate: string;
  checkedItems: boolean[];
  saved: boolean;
  onStartDateChange: (date: string) => void;
  onCheckedChange: (index: number) => void;
  onDayReplace: (dayIndex: number, updated: DayMealPlan) => void;
  onSaved: () => void;
  onClear: () => void;
}

/** YYYY-MM-DD に日数を加算(ローカルタイム基準) */
function addDays(dateString: string, days: number): string {
  const parts = dateString.split("-").map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  if (!y || !m || d === undefined) return dateString;
  const date = new Date(y, m - 1, d + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatShort(dateString: string): string {
  const parts = dateString.split("-");
  const m = parts[1], d = parts[2];
  if (!m || !d) return dateString;
  return `${Number(m)}/${Number(d)}`;
}

function youtubeSearchUrl(dishName: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${dishName} レシピ`
  )}`;
}

function DishRow({
  label,
  dishName,
  ingredients,
}: {
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

function DayCard({
  day,
  date,
  request,
  allDays,
  onReplace,
}: {
  day: DayMealPlan;
  date: string;
  request: SuggestionRequest;
  allDays: DayMealPlan[];
  onReplace: (updated: DayMealPlan) => void;
}) {
  const [resuggesting, setResuggesting] = useState(false);
  const [resuggestError, setResuggestError] = useState<string | null>(null);

  const handleResuggest = async () => {
    setResuggesting(true);
    setResuggestError(null);
    try {
      const otherDishes = allDays
        .filter((d) => d.dayIndex !== day.dayIndex)
        .flatMap((d) => [d.main.dishName, d.side.dishName]);
      const result = await postDayResuggest(request, otherDishes);
      onReplace({ ...day, main: result.main, side: result.side });
    } catch (err) {
      setResuggestError(
        err instanceof Error ? err.message : "再提案に失敗しました"
      );
    } finally {
      setResuggesting(false);
    }
  };

  return (
    <li className="space-y-2.5 px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted">
          {day.dayIndex}日目({formatShort(date)})
        </p>
        <button
          type="button"
          onClick={handleResuggest}
          disabled={resuggesting}
          className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-pine/50 disabled:opacity-40"
        >
          {resuggesting ? "考え中…" : "この日だけ再提案"}
        </button>
      </div>
      {resuggestError && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {resuggestError}
        </p>
      )}
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
  );
}

export default function WeeklyMealPlanView({
  plan,
  request,
  startDate,
  checkedItems,
  saved,
  onStartDateChange,
  onCheckedChange,
  onDayReplace,
  onSaved,
  onClear,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveError(null);
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
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 週間カード */}
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
            <DayCard
              key={day.dayIndex}
              day={day}
              date={addDays(startDate, day.dayIndex - 1)}
              request={request}
              allDays={plan.days}
              onReplace={(updated) => onDayReplace(day.dayIndex, updated)}
            />
          ))}
        </ul>
      </article>

      {/* 買い物リスト(チェックリスト) */}
      {plan.shoppingList.length > 0 && (
        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-pine">
            1週間分の買い物リスト
          </h3>
          <ul className="space-y-2">
            {plan.shoppingList.map((item, index) => {
              const checked = checkedItems[index] ?? false;
              return (
                <li key={item} className="flex items-center gap-3">
                  <input
                    id={`shop-${index}`}
                    type="checkbox"
                    checked={checked}
                    onChange={() => onCheckedChange(index)}
                    className="h-4 w-4 shrink-0 accent-pine"
                  />
                  <label
                    htmlFor={`shop-${index}`}
                    className={`text-sm leading-snug ${
                      checked ? "text-muted line-through" : "text-ink"
                    }`}
                  >
                    {item}
                  </label>
                </li>
              );
            })}
          </ul>
          {checkedItems.some(Boolean) && (
            <p className="mt-2 text-xs text-muted">
              {checkedItems.filter(Boolean).length}/{plan.shoppingList.length} 完了
            </p>
          )}
        </section>
      )}

      {/* 保存・操作パネル */}
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
            onChange={(e) => onStartDateChange(e.target.value)}
            disabled={saved}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-base focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
          />
        </div>

        {saveError && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {saveError}
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
            onClick={onClear}
            className="rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:border-red-200 hover:bg-red-50"
          >
            クリア
          </button>
        </div>
      </section>
    </div>
  );
}
