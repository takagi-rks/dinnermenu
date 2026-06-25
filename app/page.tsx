"use client";

import { useState } from "react";
import Dashboard from "@/components/Dashboard";
import SuggestForm from "@/components/SuggestForm";
import SuggestionResult from "@/components/SuggestionResult";
import { postSuggestion } from "@/lib/api-client";
import type { MealSuggestion, SuggestionRequest } from "@/lib/types";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<MealSuggestion | null>(null);
  const [lastRequest, setLastRequest] = useState<SuggestionRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (request: SuggestionRequest) => {
    setLoading(true);
    setError(null);
    setLastRequest(request);
    try {
      const result = await postSuggestion(request);
      setSuggestion(result);
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
    <div className="space-y-8">
      <Dashboard />

      <section className="space-y-6 border-t border-line pt-6">
        <div>
          <h2 className="text-xl font-bold">今夜、何にする?</h2>
          <p className="mt-1 text-sm text-muted">
            条件を入れると、AIが冷蔵庫の中身に合わせて一皿を提案します。
          </p>
        </div>

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
            献立を考えています…
          </div>
        )}

        {!loading && suggestion && (
          <SuggestionResult suggestion={suggestion} onRetry={handleRetry} />
        )}
      </section>
    </div>
  );
}
