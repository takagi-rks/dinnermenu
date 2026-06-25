"use client";

import { useState } from "react";
import type { SuggestionRequest } from "@/lib/types";

interface Props {
  loading: boolean;
  onSubmit: (request: SuggestionRequest) => void;
  submitLabel?: string;
  loadingLabel?: string;
  secondarySubmitLabel?: string;
  onSecondarySubmit?: (request: SuggestionRequest) => void;
}

const MOOD_PRESETS = [
  "さっぱり",
  "がっつり",
  "あったまる",
  "ヘルシー",
  "時短で楽したい",
] as const;

/** カンマ・読点・改行区切りの文字列を食材配列に変換 */
function parseIngredients(raw: string): string[] {
  return raw
    .split(/[、,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export default function SuggestForm({
  loading,
  onSubmit,
  submitLabel = "今夜の献立を提案してもらう",
  loadingLabel = "考え中…",
  secondarySubmitLabel,
  onSecondarySubmit,
}: Props) {
  const [servings, setServings] = useState(2);
  const [budgetYen, setBudgetYen] = useState(1500);
  const [cookingTime, setCookingTime] = useState(30);
  const [available, setAvailable] = useState("");
  const [avoid, setAvoid] = useState("");
  const [mood, setMood] = useState("");

  const createRequest = (): SuggestionRequest => ({
      servings,
      budgetYen,
      cookingTimeMinutes: cookingTime,
      availableIngredients: parseIngredients(available),
      avoidIngredients: parseIngredients(avoid),
      mood: mood.trim(),
  });

  const inputClass =
    "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";
  const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="servings" className={labelClass}>
            人数
          </label>
          <select
            id="servings"
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
            className={inputClass}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}人
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="budget" className={labelClass}>
            予算
          </label>
          <select
            id="budget"
            value={budgetYen}
            onChange={(e) => setBudgetYen(Number(e.target.value))}
            className={inputClass}
          >
            {[500, 1000, 1500, 2000, 3000, 5000].map((n) => (
              <option key={n} value={n}>
                〜{n.toLocaleString()}円
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="time" className={labelClass}>
            調理時間
          </label>
          <select
            id="time"
            value={cookingTime}
            onChange={(e) => setCookingTime(Number(e.target.value))}
            className={inputClass}
          >
            {[15, 30, 45, 60, 90].map((n) => (
              <option key={n} value={n}>
                〜{n}分
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="available" className={labelClass}>
          冷蔵庫にある食材
          <span className="ml-2 font-normal text-muted">読点・カンマ区切り</span>
        </label>
        <textarea
          id="available"
          value={available}
          onChange={(e) => setAvailable(e.target.value)}
          rows={2}
          placeholder="例: 鶏もも肉、キャベツ、卵"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="avoid" className={labelClass}>
          避けたい食材
        </label>
        <input
          id="avoid"
          type="text"
          value={avoid}
          onChange={(e) => setAvoid(e.target.value)}
          placeholder="例: パクチー、貝類"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="mood" className={labelClass}>
          今日の気分
        </label>
        <div className="mb-2 flex flex-wrap gap-2">
          {MOOD_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setMood(preset)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                mood === preset
                  ? "border-pine bg-pine text-white"
                  : "border-line bg-card text-ink hover:border-pine/50"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <input
          id="mood"
          type="text"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          placeholder="自由入力もOK(例: 昨日は揚げ物だった)"
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onSubmit(createRequest())}
          disabled={loading}
          className="w-full rounded-xl bg-pine py-3.5 text-base font-bold text-white transition-colors hover:bg-pine-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? loadingLabel : submitLabel}
        </button>
        {onSecondarySubmit && secondarySubmitLabel && (
          <button
            type="button"
            onClick={() => onSecondarySubmit(createRequest())}
            disabled={loading}
            className="w-full rounded-xl border border-pine bg-card py-3 text-sm font-bold text-pine transition-colors hover:bg-pine/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {secondarySubmitLabel}
          </button>
        )}
      </div>
    </div>
  );
}
