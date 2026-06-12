"use client";

import { useCallback, useEffect, useState } from "react";
import SuggestForm from "@/components/SuggestForm";
import WeeklyMealPlanView from "@/components/WeeklyMealPlan";
import { postWeeklySuggestion } from "@/lib/api-client";
import { loadPlan, savePlan, clearPlan } from "@/lib/plan-storage";
import type { DayMealPlan, SuggestionRequest, WeeklyMealPlan } from "@/lib/types";

/** ローカルタイムの今日をYYYY-MM-DD で返す */
function todayString(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function WeeklyPage() {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<WeeklyMealPlan | null>(null);
  const [request, setRequest] = useState<SuggestionRequest | null>(null);
  const [startDate, setStartDate] = useState<string>(todayString());
  const [checkedItems, setCheckedItems] = useState<boolean[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // マウント後にlocalStorageを復元(SSRとの不一致を避けるため useEffect 内で実行)
  useEffect(() => {
    const stored = loadPlan();
    if (stored) {
      setPlan(stored.plan);
      setRequest(stored.request);
      setStartDate(stored.startDate);
      setCheckedItems(stored.checkedItems);
      setSaved(stored.saved);
    }
    setHydrated(true);
  }, []);

  // plan / checked / saved が変わるたびに localStorage へ永続化
  useEffect(() => {
    if (!hydrated || !plan || !request) return;
    savePlan({ plan, request, startDate, checkedItems, saved });
  }, [hydrated, plan, request, startDate, checkedItems, saved]);

  const handleSubmit = async (req: SuggestionRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await postWeeklySuggestion(req);
      setPlan(result);
      setRequest(req);
      setStartDate(todayString());
      setCheckedItems(new Array<boolean>(result.shoppingList.length).fill(false));
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提案の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleStartDateChange = useCallback((date: string) => {
    setStartDate(date);
  }, []);

  const handleCheckedChange = useCallback((index: number) => {
    setCheckedItems((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const handleDayReplace = useCallback(
    (dayIndex: number, updated: DayMealPlan) => {
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) => (d.dayIndex === dayIndex ? updated : d)),
        };
      });
    },
    []
  );

  const handleSaved = useCallback(() => {
    setSaved(true);
  }, []);

  const handleClear = useCallback(() => {
    if (!window.confirm("週間プランをクリアしますか?")) return;
    clearPlan();
    setPlan(null);
    setRequest(null);
    setStartDate(todayString());
    setCheckedItems([]);
    setSaved(false);
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">1週間まとめて決める</h1>
        <p className="mt-1 text-sm text-muted">
          7日分の主菜・副菜と買い物リストをAIがまとめて提案します。
          予算・調理時間は
          <span className="font-semibold">1日あたり</span>
          の目安です。
        </p>
      </section>

      <SuggestForm loading={loading} onSubmit={handleSubmit} />

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}

      {loading && (
        <div className="rounded-2xl border border-line bg-card px-5 py-8 text-center text-sm text-muted">
          1週間分の献立を考えています…(30秒ほどかかることがあります)
        </div>
      )}

      {!loading && hydrated && plan && request && (
        <WeeklyMealPlanView
          plan={plan}
          request={request}
          startDate={startDate}
          checkedItems={checkedItems}
          saved={saved}
          onStartDateChange={handleStartDateChange}
          onCheckedChange={handleCheckedChange}
          onDayReplace={handleDayReplace}
          onSaved={handleSaved}
          onClear={handleClear}
        />
      )}
    </div>
  );
}
