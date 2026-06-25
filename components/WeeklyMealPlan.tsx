"use client";

import { useEffect, useMemo, useState } from "react";
import { postMealsBulk, postDayResuggest } from "@/lib/api-client";
import {
  loadWeeklyFavorites,
  saveWeeklyFavorites,
  weeklyFavoriteKey,
  type WeeklyDishKind,
} from "@/lib/weekly-favorites";
import { categorizeShoppingList } from "@/lib/weekly-shopping";
import {
  findLocalDaySuggestion,
  type WeeklyCandidate,
} from "@/lib/weekly-plan-builder";

import type {
  CreateMealInput,
  DayMealPlan,
  SuggestionRequest,
  WeeklyDish,
  WeeklyMealPlan,
} from "@/lib/types";

interface Props {
  plan: WeeklyMealPlan;
  request: SuggestionRequest;
  startDate: string;
  checkedItems: boolean[];
  saved: boolean;
  candidates: WeeklyCandidate[];
  onStartDateChange: (date: string) => void;
  onCheckedChange: (index: number) => void;
  onDayReplace: (dayIndex: number, updated: DayMealPlan) => void;
  onSaved: () => void;
  onClear: () => void;
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

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

function formatWeekday(dateString: string): string {
  const parts = dateString.split("-").map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  if (!y || !m || d === undefined) return "";
  return WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()] ?? "";
}

function youtubeSearchUrl(dishName: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${dishName} レシピ`
  )}`;
}

function FavoriteButton({
  active,
  dishName,
  onToggle,
}: {
  active: boolean;
  dishName: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? `${dishName}のお気に入りを解除` : `${dishName}をお気に入りに追加`}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl leading-none transition-transform active:scale-90 ${
        active ? "text-amber" : "text-line hover:text-amber"
      }`}
    >
      ★
    </button>
  );
}

function DishRow({
  label,
  kind,
  dish,
  favoriteKeys,
  onFavoriteToggle,
}: {
  label: string;
  kind: WeeklyDishKind;
  dish: WeeklyDish;
  favoriteKeys: Set<string>;
  onFavoriteToggle: (kind: WeeklyDishKind, dish: WeeklyDish) => void;
}) {
  const favorite = favoriteKeys.has(weeklyFavoriteKey(kind, dish));

  return (
    <div className="flex items-start gap-2.5 sm:gap-3">
      <span className="mt-0.5 shrink-0 rounded-md bg-pine/10 px-2 py-0.5 text-xs font-bold text-pine">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="min-w-0 flex-1 basis-full break-words text-sm font-bold leading-snug min-[380px]:basis-0">
            {dish.dishName}
          </p>
          <FavoriteButton
            active={favorite}
            dishName={dish.dishName}
            onToggle={() => onFavoriteToggle(kind, dish)}
          />
          <a
            href={youtubeSearchUrl(dish.dishName)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${dish.dishName}のレシピ動画をYouTubeで検索`}
            className="flex min-h-10 shrink-0 items-center rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
          >
            ▶ 動画
          </a>
        </div>
        <p className="mt-1 break-words text-xs leading-relaxed text-muted">
          {dish.keyIngredients.join("、")}
        </p>
      </div>
    </div>
  );
}

function CalendarView({
  days,
  startDate,
  favoriteKeys,
  onFavoriteToggle,
}: {
  days: DayMealPlan[];
  startDate: string;
  favoriteKeys: Set<string>;
  onFavoriteToggle: (kind: WeeklyDishKind, dish: WeeklyDish) => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted">カレンダー表示</p>
          <h3 className="text-base font-bold text-pine">
            {formatShort(startDate)} 〜 {formatShort(addDays(startDate, 6))}
          </h3>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {days.map((day) => {
          const date = addDays(startDate, day.dayIndex - 1);
          return (
            <div
              key={day.dayIndex}
              className="rounded-xl border border-line bg-paper p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink">
                  {formatShort(date)}
                  <span className="ml-1 text-xs text-muted">
                    ({formatWeekday(date)})
                  </span>
                </p>
                <span className="rounded-full bg-pine/10 px-2 py-0.5 text-xs font-bold text-pine">
                  {day.dayIndex}日目
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-bold text-pine">主菜</p>
                    <FavoriteButton
                      active={favoriteKeys.has(weeklyFavoriteKey("main", day.main))}
                      dishName={day.main.dishName}
                      onToggle={() => onFavoriteToggle("main", day.main)}
                    />
                  </div>
                  <p className="mt-0.5 break-words text-sm font-semibold leading-snug">
                    {day.main.dishName}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-bold text-amber">副菜</p>
                    <FavoriteButton
                      active={favoriteKeys.has(weeklyFavoriteKey("side", day.side))}
                      dishName={day.side.dishName}
                      onToggle={() => onFavoriteToggle("side", day.side)}
                    />
                  </div>
                  <p className="mt-0.5 break-words text-sm font-semibold leading-snug">
                    {day.side.dishName}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ShoppingMode({
  shoppingList,
  checkedItems,
  onCheckedChange,
}: {
  shoppingList: string[];
  checkedItems: boolean[];
  onCheckedChange: (index: number) => void;
}) {
  const categories = useMemo(
    () => categorizeShoppingList(shoppingList),
    [shoppingList]
  );
  const checkedCount = shoppingList.filter(
    (_, index) => checkedItems[index] ?? false
  ).length;

  if (shoppingList.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <div className="bg-pine px-4 py-4 text-white sm:px-5">
        <p className="text-xs opacity-80">スーパー買い物モード</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h3 className="text-base font-bold sm:text-lg">カテゴリ別チェックリスト</h3>
          <p className="shrink-0 text-sm font-bold">
            {checkedCount}/{shoppingList.length}
          </p>
        </div>
      </div>

      <div className="divide-y divide-line">
        {categories.map((category) => {
          const categoryCheckedCount = category.items.filter(
            ({ originalIndex }) => checkedItems[originalIndex] ?? false
          ).length;

          return (
            <section key={category.id} className="px-3 py-4 sm:px-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-bold text-pine">{category.label}</h4>
                <p className="text-xs font-semibold text-muted">
                  {categoryCheckedCount}/{category.items.length}
                </p>
              </div>
              <ul className="space-y-2">
                {category.items.map(({ item, originalIndex }) => {
                  const checked = checkedItems[originalIndex] ?? false;
                  return (
                    <li key={`${originalIndex}-${item}`}>
                      <label
                        htmlFor={`shop-mode-${originalIndex}`}
                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                          checked
                            ? "border-line bg-paper text-muted"
                            : "border-line bg-card text-ink hover:border-pine/40"
                        }`}
                      >
                        <input
                          id={`shop-mode-${originalIndex}`}
                          type="checkbox"
                          checked={checked}
                          onChange={() => onCheckedChange(originalIndex)}
                          className="h-5 w-5 shrink-0 accent-pine"
                        />
                        <span
                          className={`min-w-0 break-words text-base font-semibold leading-snug ${
                            checked ? "line-through" : ""
                          }`}
                        >
                          {item}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function DayCard({
  day,
  date,
  request,
  allDays,
  favoriteKeys,
  candidates,
  onReplace,
  onFavoriteToggle,
}: {
  day: DayMealPlan;
  date: string;
  request: SuggestionRequest;
  allDays: DayMealPlan[];
  favoriteKeys: Set<string>;
  candidates: WeeklyCandidate[];
  onReplace: (updated: DayMealPlan) => void;
  onFavoriteToggle: (kind: WeeklyDishKind, dish: WeeklyDish) => void;
}) {
  const [resuggesting, setResuggesting] = useState(false);
  const [resuggestError, setResuggestError] = useState<string | null>(null);

  const otherDishes = allDays
    .filter((item) => item.dayIndex !== day.dayIndex)
    .flatMap((item) => [item.main.dishName, item.side.dishName]);

  const handleLocalResuggest = () => {
    setResuggestError(null);
    const result = findLocalDaySuggestion(candidates, request, [
      ...otherDishes,
      day.main.dishName,
      day.side.dishName,
    ]);
    if (!result) {
      setResuggestError(
        "変更に使える主菜・副菜の候補がありません。AIでの再提案をお試しください。"
      );
      return;
    }
    onReplace({ ...day, main: result.main, side: result.side });
  };

  const handleAiResuggest = async () => {
    setResuggesting(true);
    setResuggestError(null);
    try {
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
    <li className="space-y-3 px-4 py-4 sm:px-5">
      <div className="space-y-2 min-[420px]:flex min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-3 min-[420px]:space-y-0">
        <p className="text-xs font-bold text-muted">
          {day.dayIndex}日目({formatShort(date)})
        </p>
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 min-[420px]:flex min-[420px]:flex-wrap min-[420px]:justify-end">
          <button
            type="button"
            onClick={handleLocalResuggest}
            disabled={resuggesting}
            className="min-h-11 rounded-lg border border-line px-3 py-2 text-xs font-semibold leading-snug text-ink transition-colors hover:border-pine/50 disabled:opacity-40"
          >
            お気に入り・履歴から変更
          </button>
          <button
            type="button"
            onClick={handleAiResuggest}
            disabled={resuggesting}
            className="min-h-11 rounded-lg border border-pine px-3 py-2 text-xs font-semibold leading-snug text-pine transition-colors hover:bg-pine/5 disabled:opacity-40"
          >
            {resuggesting ? "AI考案中…" : "AIで再提案"}
          </button>
        </div>
      </div>
      {resuggestError && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {resuggestError}
        </p>
      )}
      <DishRow
        label="主菜"
        kind="main"
        dish={day.main}
        favoriteKeys={favoriteKeys}
        onFavoriteToggle={onFavoriteToggle}
      />
      <DishRow
        label="副菜"
        kind="side"
        dish={day.side}
        favoriteKeys={favoriteKeys}
        onFavoriteToggle={onFavoriteToggle}
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
  candidates,
  onStartDateChange,
  onCheckedChange,
  onDayReplace,
  onSaved,
  onClear,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [planView, setPlanView] = useState<"calendar" | "list">("calendar");
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setFavoriteKeys(new Set(loadWeeklyFavorites()));
  }, []);

  const handleFavoriteToggle = (kind: WeeklyDishKind, dish: WeeklyDish) => {
    setFavoriteKeys((prev) => {
      const key = weeklyFavoriteKey(kind, dish);
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      saveWeeklyFavorites([...next]);
      return next;
    });
  };

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
      <section className="rounded-2xl border border-line bg-card p-2 shadow-sm sm:p-3">
        <div className="flex items-center rounded-xl bg-paper p-1">
          <button
            type="button"
            onClick={() => setPlanView("calendar")}
            className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              planView === "calendar"
                ? "bg-pine text-white"
                : "text-muted hover:bg-line/60"
            }`}
          >
            カレンダー
          </button>
          <button
            type="button"
            onClick={() => setPlanView("list")}
            className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              planView === "list"
                ? "bg-pine text-white"
                : "text-muted hover:bg-line/60"
            }`}
          >
            カード
          </button>
        </div>
      </section>

      {planView === "calendar" && (
        <CalendarView
          days={plan.days}
          startDate={startDate}
          favoriteKeys={favoriteKeys}
          onFavoriteToggle={handleFavoriteToggle}
        />
      )}

      {planView === "list" && (
        <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          <div className="bg-pine px-4 py-4 text-white sm:px-5">
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
                favoriteKeys={favoriteKeys}
                candidates={candidates}
                onReplace={(updated) => onDayReplace(day.dayIndex, updated)}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </ul>
        </article>
      )}

      <ShoppingMode
        shoppingList={plan.shoppingList}
        checkedItems={checkedItems}
        onCheckedChange={onCheckedChange}
      />

      {/* 保存・操作パネル */}
      <section className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
        <div className="space-y-1.5 min-[380px]:flex min-[380px]:items-center min-[380px]:gap-3 min-[380px]:space-y-0">
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
            className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-base focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
          />
        </div>

        {saveError && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {saveError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-[1fr_auto] min-[380px]:gap-3">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || saved || !startDate}
            className="min-h-12 rounded-xl bg-pine px-3 py-3 text-sm font-bold leading-snug text-white transition-colors hover:bg-pine-dark disabled:opacity-50"
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
            className="min-h-12 rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:border-red-200 hover:bg-red-50"
          >
            クリア
          </button>
        </div>
      </section>
    </div>
  );
}
