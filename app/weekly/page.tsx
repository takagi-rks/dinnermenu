"use client";

import { useState } from "react";
import SuggestForm from "@/components/SuggestForm";
import WeeklyMealPlanView from "@/components/WeeklyMealPlan";
import { postWeeklySuggestion } from "@/lib/api-client";
import type { SuggestionRequest, WeeklyMealPlan } from "@/lib/types";

export default function WeeklyPage() {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<WeeklyMealPlan | null>(null);
  const [lastRequest, setLastRequest] = useState<SuggestionRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (request: SuggestionRequest) => {
    setLoading(true);
    setError(null);
    setLastRequest(request);
    try {
      const result = await postWeeklySuggestion(request);
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提案の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastRequest) void handleSubmit(lastRequest);
  };

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">1週間まとめて決める</h1>
        <p className="mt-1 text-sm text-muted">
          7日分の主菜・副菜と買い物リストをAIがまとめて提案します。
          予算・調理時間は<span className="font-semibold">1日あたり</span>の目安です。
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

      {!loading && plan && <WeeklyMealPlanView plan={plan} onRetry={handleRetry} />}
    </div>
  );
}
