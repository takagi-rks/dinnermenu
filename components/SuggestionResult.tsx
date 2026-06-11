"use client";

import { useState } from "react";
import { postMeal } from "@/lib/api-client";
import type { MealSuggestion } from "@/lib/types";

interface Props {
  suggestion: MealSuggestion;
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

export default function SuggestionResult({ suggestion, onRetry }: Props) {
  const [cookedOn, setCookedOn] = useState(todayString);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await postMeal({
        cookedOn,
        dishName: suggestion.dishName,
        ingredients: suggestion.ingredients,
        steps: suggestion.steps,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const sectionTitle = "mb-2 text-sm font-bold text-pine";

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <div className="bg-pine px-5 py-4 text-white">
        <p className="text-xs opacity-80">今夜の一皿</p>
        <h2 className="text-xl font-bold">{suggestion.dishName}</h2>
        <p className="mt-1 text-xs opacity-90">
          目安 {suggestion.estimatedBudgetYen.toLocaleString()}円 ・ 約
          {suggestion.cookingTimeMinutes}分
        </p>
      </div>

      <div className="space-y-5 px-5 py-5">
        <section>
          <h3 className={sectionTitle}>選んだ理由</h3>
          <p className="text-sm leading-relaxed">{suggestion.reason}</p>
        </section>

        <section>
          <h3 className={sectionTitle}>必要な食材</h3>
          <ul className="space-y-1 text-sm">
            {suggestion.ingredients.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="text-pine">
                  ・
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {suggestion.missingIngredients.length > 0 && (
          <section className="rounded-xl bg-amber/10 px-4 py-3">
            <h3 className="mb-1 text-sm font-bold text-amber">買い足しが必要</h3>
            <p className="text-sm">{suggestion.missingIngredients.join("、")}</p>
          </section>
        )}

        <section>
          <h3 className={sectionTitle}>調理手順</h3>
          <ol className="space-y-2 text-sm">
            {suggestion.steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pine text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 border-t border-line pt-4">
          <label
            htmlFor="cooked-on"
            className="shrink-0 text-sm font-semibold text-ink"
          >
            作る日
          </label>
          <input
            id="cooked-on"
            type="date"
            value={cookedOn}
            onChange={(e) => setCookedOn(e.target.value)}
            disabled={saved}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-base focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved || !cookedOn}
            className="flex-1 rounded-xl bg-pine py-3 text-sm font-bold text-white transition-colors hover:bg-pine-dark disabled:opacity-50"
          >
            {saved ? "履歴に保存しました" : saving ? "保存中…" : "この献立に決定して保存"}
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-pine/50"
          >
            別の提案
          </button>
        </div>
      </div>
    </article>
  );
}
