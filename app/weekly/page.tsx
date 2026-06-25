"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SuggestForm from "@/components/SuggestForm";
import WeeklyMealPlanView from "@/components/WeeklyMealPlan";
import {
  ApiRequestError,
  fetchMeals,
  postWeeklySuggestion,
} from "@/lib/api-client";
import { loadPlan, savePlan, clearPlan } from "@/lib/plan-storage";
import { loadWeeklyFavoriteEntries } from "@/lib/weekly-favorites";
import {
  buildWeeklyPlan,
  favoritesToCandidates,
  hasFullWeekCandidates,
  mealsToCandidates,
  uniqueCandidates,
  type WeeklyCandidate,
} from "@/lib/weekly-plan-builder";
import { carryCheckedItems, rebuildShoppingList } from "@/lib/weekly-shopping";
import type { DayMealPlan, SuggestionRequest, WeeklyMealPlan } from "@/lib/types";

const RECOVERABLE_GENERATION_STATUSES = new Set([429, 502, 503]);
const RESTORED_PLAN_MESSAGE =
  "AI生成に失敗したため、前回成功した週間献立を表示しました";
const FAVORITES_MODE_MESSAGE =
  "お気に入りを最優先し、不足分は週間保存済みの履歴から補完します。足りない場合だけAI補完ボタンを使えます。";

/** ローカルタイムの今日をYYYY-MM-DD で返す */
function todayString(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function WeeklyPageContent() {
  const searchParams = useSearchParams();
  const favoritesMode = searchParams.get("favorites") === "1";
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<WeeklyMealPlan | null>(null);
  const [request, setRequest] = useState<SuggestionRequest | null>(null);
  const [startDate, setStartDate] = useState<string>(todayString());
  const [checkedItems, setCheckedItems] = useState<boolean[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [candidates, setCandidates] = useState<WeeklyCandidate[]>([]);

  const loadCandidates = useCallback(async (): Promise<WeeklyCandidate[]> => {
    const favorites = favoritesToCandidates(loadWeeklyFavoriteEntries());
    try {
      const meals = await fetchMeals({ limit: 100 });
      return [...favorites, ...mealsToCandidates(meals)];
    } catch {
      return favorites;
    }
  }, []);

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

    if (stored || favoritesMode) {
      void loadCandidates().then(setCandidates);
    }
  }, [favoritesMode, loadCandidates]);

  // plan / checked / saved が変わるたびに localStorage へ永続化
  useEffect(() => {
    if (!hydrated || !plan || !request) return;
    savePlan({ plan, request, startDate, checkedItems, saved });
  }, [hydrated, plan, request, startDate, checkedItems, saved]);

  const showPlan = (
    result: WeeklyMealPlan,
    req: SuggestionRequest,
    availableCandidates: WeeklyCandidate[]
  ) => {
    setPlan(result);
    setRequest(req);
    setCandidates(availableCandidates);
    setStartDate(todayString());
    setCheckedItems(new Array<boolean>(result.shoppingList.length).fill(false));
    setSaved(false);
  };

  const handleLocalSubmit = async (req: SuggestionRequest) => {
    setLoading(true);
    setError(null);
    try {
      const availableCandidates = await loadCandidates();
      const result = buildWeeklyPlan(availableCandidates, req);
      if (!result) {
        setError(
          "AIなしで作成するには、食材情報のある主菜と副菜をそれぞれ1品以上お気に入りまたは週間保存済みの履歴に登録してください。"
        );
        return;
      }
      showPlan(result, req, availableCandidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "履歴の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleAiAssistedSubmit = async (req: SuggestionRequest) => {
    setLoading(true);
    setError(null);
    try {
      const availableCandidates = await loadCandidates();
      setCandidates(availableCandidates);
      const filtered = uniqueCandidates(availableCandidates, req);
      const generated = hasFullWeekCandidates(filtered)
        ? undefined
        : await postWeeklySuggestion(req);
      const result = buildWeeklyPlan(availableCandidates, req, generated);
      if (!result) {
        throw new Error("週間献立の作成に必要な候補を用意できませんでした");
      }
      showPlan(result, req, availableCandidates);
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        RECOVERABLE_GENERATION_STATUSES.has(err.status)
      ) {
        const stored = loadPlan();
        if (stored) {
          setPlan(stored.plan);
          setRequest(stored.request);
          setStartDate(stored.startDate);
          setCheckedItems(stored.checkedItems);
          setSaved(stored.saved);
          setError(RESTORED_PLAN_MESSAGE);
          return;
        }
      }
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
        const nextDays = prev.days.map((d) =>
          d.dayIndex === dayIndex ? updated : d
        );
        const nextShoppingList = rebuildShoppingList(
          nextDays,
          request?.availableIngredients ?? []
        );
        setCheckedItems((currentCheckedItems) =>
          carryCheckedItems(
            prev.shoppingList,
            currentCheckedItems,
            nextShoppingList
          )
        );
        return {
          ...prev,
          days: nextDays,
          shoppingList: nextShoppingList,
        };
      });
    },
    [request]
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
    setCandidates([]);
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">1週間まとめて決める</h1>
        <p className="mt-1 text-sm text-muted">
          お気に入りと履歴を優先して、7日分の主菜・副菜を組み立てます。
          通常履歴は種別不明のため、候補には週間保存済みの履歴だけを使います。
          AIは明示ボタンを押した場合だけ不足分の補完に使います。
          予算・調理時間は
          <span className="font-semibold">1日あたり</span>
          の目安です。
        </p>
      </section>

      {favoritesMode && (
        <section className="rounded-2xl border border-pine/30 bg-pine/5 px-4 py-3 text-sm text-pine">
          <p className="font-bold">お気に入り優先モード</p>
          <p className="mt-1 text-pine/80">{FAVORITES_MODE_MESSAGE}</p>
          <p className="mt-1 text-xs text-pine/70">
            現在の候補: {candidates.length}件
          </p>
        </section>
      )}

      <SuggestForm
        loading={loading}
        onSubmit={handleLocalSubmit}
        submitLabel="お気に入り・履歴だけで作る（AIなし）"
        loadingLabel="週間献立を作成中…"
        secondarySubmitLabel="候補不足分だけAIで補って作る"
        onSecondarySubmit={handleAiAssistedSubmit}
      />

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
          candidates={candidates}
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

export default function WeeklyPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-line bg-card px-5 py-8 text-center text-sm text-muted">
          週間献立を読み込んでいます…
        </div>
      }
    >
      <WeeklyPageContent />
    </Suspense>
  );
}
