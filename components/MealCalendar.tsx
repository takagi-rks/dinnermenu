"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMeals } from "@/lib/api-client";
import type { MealRecord } from "@/lib/types";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function dateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function mealKind(meal: MealRecord): "main" | "side" | null {
  if (meal.memo.includes("週間プラン(主菜)")) return "main";
  if (meal.memo.includes("週間プラン(副菜)")) return "side";
  return null;
}

export default function MealCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lastDay = new Date(year, month, 0).getDate();
      setMeals(
        await fetchMeals({
          from: dateString(year, month, 1),
          to: dateString(year, month, lastDay),
          limit: 500,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "履歴の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const mealsByDate = useMemo(() => {
    const grouped = new Map<string, MealRecord[]>();
    for (const meal of meals) {
      const current = grouped.get(meal.cookedOn) ?? [];
      current.push(meal);
      grouped.set(meal.cookedOn, current);
    }
    return grouped;
  }, [meals]);

  const monthTotal = meals.reduce(
    (total, meal) => total + (meal.costYen ?? 0),
    0
  );
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingDays = new Date(year, month - 1, 1).getDay();
  const cells = [
    ...Array.from({ length: leadingDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const moveMonth = (amount: number) => {
    const next = new Date(year, month - 1 + amount, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-card p-3 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            className="min-h-11 min-w-11 rounded-lg border border-line px-3 py-2 text-sm font-bold"
            aria-label="前の月"
          >
            ←
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold text-pine">
              {year}年{month}月
            </h2>
            <p className="text-sm text-muted">
              月の食費合計: {monthTotal.toLocaleString()}円
            </p>
          </div>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="min-h-11 min-w-11 rounded-lg border border-line px-3 py-2 text-sm font-bold"
            aria-label="次の月"
          >
            →
          </button>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <div className="grid grid-cols-7 border-b border-line bg-paper">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="px-0.5 py-2 text-center text-[11px] font-bold text-muted sm:px-1 sm:text-xs">
              {weekday}
            </div>
          ))}
        </div>
        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-muted">読み込み中…</div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="min-h-20 border-b border-r border-line bg-paper/50 sm:min-h-24" />;
              }
              const date = dateString(year, month, day);
              const dailyMeals = mealsByDate.get(date) ?? [];
              const dailyTotal = dailyMeals.reduce(
                (total, meal) => total + (meal.costYen ?? 0),
                0
              );
              return (
                <div key={date} className="min-h-20 min-w-0 border-b border-r border-line p-1 sm:min-h-24 sm:p-1.5">
                  <p className="text-[11px] font-bold sm:text-xs">{day}</p>
                  <ul className="mt-1 space-y-0.5 sm:space-y-1">
                    {dailyMeals.map((meal) => {
                      const kind = mealKind(meal);
                      return (
                        <li key={meal.id} className="min-w-0 overflow-hidden rounded bg-paper px-0.5 py-0.5 text-[9px] leading-tight sm:px-1 sm:text-[10px]">
                          {kind && (
                            <span className={kind === "main" ? "text-pine" : "text-amber"}>
                              {kind === "main" ? "主 " : "副 "}
                            </span>
                          )}
                          <span className="break-words">{meal.dishName}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {dailyTotal > 0 && (
                    <p className="mt-1 break-words text-[9px] font-bold leading-tight text-pine sm:text-[10px]">
                      計 {dailyTotal.toLocaleString()}円
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
