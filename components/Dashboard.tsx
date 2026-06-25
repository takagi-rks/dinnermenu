"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchMeals } from "@/lib/api-client";
import { loadPlan, type PlanStorage } from "@/lib/plan-storage";
import { loadWeeklyFavoriteEntries } from "@/lib/weekly-favorites";
import type { MealRecord } from "@/lib/types";

const MAIN_MEMO_MARKER = "週間プラン(主菜)";
const SIDE_MEMO_MARKER = "週間プラン(副菜)";
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

type MealKind = "main" | "side" | "unknown";

interface FavoriteSummary {
  total: number;
  main: number;
  side: number;
}

function todayString(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

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

function formatDate(dateString: string): string {
  const parts = dateString.split("-").map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  if (!y || !m || d === undefined) return dateString;
  const weekday = WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()] ?? "";
  return `${m}/${d}(${weekday})`;
}

function mealKind(meal: MealRecord): MealKind {
  if (meal.memo.includes(MAIN_MEMO_MARKER)) return "main";
  if (meal.memo.includes(SIDE_MEMO_MARKER)) return "side";
  return "unknown";
}

function DashboardCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-pine">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MealList({
  label,
  meals,
}: {
  label: string;
  meals: MealRecord[];
}) {
  if (meals.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-muted">{label}</p>
      <ul className="space-y-1.5">
        {meals.map((meal) => (
          <li
            key={meal.id}
            className="rounded-xl bg-paper px-3 py-2 text-sm font-semibold leading-snug"
          >
            <span className="break-words">{meal.dishName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const [todayMeals, setTodayMeals] = useState<MealRecord[]>([]);
  const [plan, setPlan] = useState<PlanStorage | null>(null);
  const [favorites, setFavorites] = useState<FavoriteSummary>({
    total: 0,
    main: 0,
    side: 0,
  });
  const [loadingMeals, setLoadingMeals] = useState(true);
  const [mealError, setMealError] = useState<string | null>(null);

  const today = useMemo(() => todayString(), []);

  useEffect(() => {
    setPlan(loadPlan());
    const entries = loadWeeklyFavoriteEntries();
    setFavorites({
      total: entries.length,
      main: entries.filter((item) => item.kind === "main").length,
      side: entries.filter((item) => item.kind === "side").length,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingMeals(true);
    setMealError(null);
    fetchMeals({ from: today, to: today, limit: 100 })
      .then((meals) => {
        if (!cancelled) setTodayMeals(meals);
      })
      .catch((err) => {
        if (!cancelled) {
          setMealError(
            err instanceof Error ? err.message : "今日の履歴を取得できませんでした"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMeals(false);
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const groupedMeals = useMemo(() => {
    const main: MealRecord[] = [];
    const side: MealRecord[] = [];
    const unknown: MealRecord[] = [];
    for (const meal of todayMeals) {
      const kind = mealKind(meal);
      if (kind === "main") main.push(meal);
      if (kind === "side") side.push(meal);
      if (kind === "unknown") unknown.push(meal);
    }
    return { main, side, unknown };
  }, [todayMeals]);

  const todayCost = todayMeals.reduce(
    (total, meal) => total + (meal.costYen ?? 0),
    0
  );

  const openShoppingItems =
    plan?.plan.shoppingList.filter((_, index) => !(plan.checkedItems[index] ?? false)) ??
    [];

  const weekDays =
    plan?.plan.days.map((day) => {
      const date = addDays(plan.startDate, day.dayIndex - 1);
      return { ...day, date, isToday: date === today };
    }) ?? [];

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-muted">{formatDate(today)}</p>
        <h1 className="text-xl font-bold">今日のダッシュボード</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DashboardCard
          title="今日の献立"
          action={
            <Link href="/history" className="text-xs font-semibold text-pine">
              履歴
            </Link>
          }
        >
          {loadingMeals ? (
            <p className="rounded-xl bg-paper px-3 py-4 text-sm text-muted">
              今日の献立を読み込んでいます…
            </p>
          ) : mealError ? (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-3 text-sm text-red-700">
              {mealError}
            </p>
          ) : todayMeals.length === 0 ? (
            <p className="rounded-xl bg-paper px-3 py-4 text-sm text-muted">
              今日の献立はまだありません
            </p>
          ) : (
            <div className="space-y-3">
              <MealList label="主菜" meals={groupedMeals.main} />
              <MealList label="副菜" meals={groupedMeals.side} />
              <MealList label="種別不明" meals={groupedMeals.unknown} />
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="今日の食費">
          {loadingMeals ? (
            <p className="rounded-xl bg-paper px-3 py-4 text-sm text-muted">
              食費を集計しています…
            </p>
          ) : (
            <div className="rounded-xl bg-pine/5 px-4 py-4">
              <p className="text-2xl font-bold text-pine">
                {todayCost.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-muted">円</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                今日の履歴 {todayMeals.length}件から集計
              </p>
            </div>
          )}
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DashboardCard
          title="今日の買い物"
          action={
            <Link href="/weekly" className="text-xs font-semibold text-pine">
              週間
            </Link>
          }
        >
          {!plan ? (
            <p className="rounded-xl bg-paper px-3 py-4 text-sm text-muted">
              買い物リストはありません
            </p>
          ) : openShoppingItems.length === 0 ? (
            <p className="rounded-xl bg-paper px-3 py-4 text-sm text-muted">
              未チェックの買い物はありません
            </p>
          ) : (
            <ul className="space-y-2">
              {openShoppingItems.slice(0, 8).map((item, index) => (
                <li
                  key={`${index}-${item}`}
                  className="rounded-xl bg-paper px-3 py-2 text-sm font-semibold leading-snug"
                >
                  <span className="break-words">{item}</span>
                </li>
              ))}
              {openShoppingItems.length > 8 && (
                <li className="px-1 text-xs font-semibold text-muted">
                  ほか {openShoppingItems.length - 8}件
                </li>
              )}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard
          title="お気に入り"
          action={
            <Link href="/favorites" className="text-xs font-semibold text-pine">
              一覧
            </Link>
          }
        >
          <div className="rounded-xl bg-paper px-4 py-4">
            <p className="text-2xl font-bold text-pine">
              {favorites.total}
              <span className="ml-1 text-sm font-normal text-muted">件</span>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-card px-3 py-2">
                <p className="text-xs text-muted">主菜</p>
                <p className="font-bold">{favorites.main}件</p>
              </div>
              <div className="rounded-lg bg-card px-3 py-2">
                <p className="text-xs text-muted">副菜</p>
                <p className="font-bold">{favorites.side}件</p>
              </div>
            </div>
          </div>
        </DashboardCard>
      </div>

      <DashboardCard
        title="今週の予定"
        action={
          <Link href="/weekly" className="text-xs font-semibold text-pine">
            週間献立
          </Link>
        }
      >
        {!plan ? (
          <div className="space-y-3 rounded-xl bg-paper px-4 py-4">
            <p className="text-sm text-muted">週間プランがありません</p>
            <Link
              href="/weekly"
              className="inline-flex min-h-11 items-center rounded-xl bg-pine px-4 py-2 text-sm font-bold text-white"
            >
              週間献立を作る
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {weekDays.map((day) => (
              <li
                key={day.dayIndex}
                className={`rounded-xl border px-3 py-3 ${
                  day.isToday
                    ? "border-pine bg-pine/5"
                    : "border-line bg-paper"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-muted">
                    {formatDate(day.date)}
                  </p>
                  {day.isToday && (
                    <span className="rounded-full bg-pine px-2 py-0.5 text-xs font-bold text-white">
                      今日
                    </span>
                  )}
                </div>
                <p className="break-words text-sm font-semibold leading-snug">
                  主: {day.main.dishName}
                </p>
                <p className="mt-1 break-words text-sm font-semibold leading-snug">
                  副: {day.side.dishName}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </section>
  );
}
