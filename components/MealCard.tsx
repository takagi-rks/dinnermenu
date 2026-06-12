"use client";

import { useState } from "react";
import { patchMeal, removeMeal } from "@/lib/api-client";
import type { MealRecord } from "@/lib/types";

interface Props {
  meal: MealRecord;
  onChange: (updated: MealRecord) => void;
  onDelete: (id: string) => void;
}

function formatDate(dateString: string): string {
  const [y, m, d] = dateString.split("-");
  if (!y || !m || !d) return dateString;
  return `${y}年${Number(m)}月${Number(d)}日`;
}

export default function MealCard({ meal, onChange, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [memoDraft, setMemoDraft] = useState(meal.memo);
  const [nameDraft, setNameDraft] = useState(meal.dishName);
  const [dateDraft, setDateDraft] = useState(meal.cookedOn);
  const [costDraft, setCostDraft] = useState(
    meal.costYen !== null ? String(meal.costYen) : ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basicInfoDirty =
    nameDraft.trim() !== meal.dishName || dateDraft !== meal.cookedOn;
  const basicInfoValid = nameDraft.trim().length > 0 && dateDraft.length > 0;

  const parsedCost =
    costDraft.trim() === "" ? null : Number(costDraft.trim());
  const costValid =
    parsedCost === null ||
    (!Number.isNaN(parsedCost) && parsedCost >= 0 && parsedCost <= 100000);
  const costDirty = parsedCost !== meal.costYen;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = () =>
    run(async () => {
      const updated = await patchMeal(meal.id, { isFavorite: !meal.isFavorite });
      onChange(updated);
    });

  const setRating = (rating: number) =>
    run(async () => {
      const updated = await patchMeal(meal.id, {
        rating: meal.rating === rating ? null : rating,
      });
      onChange(updated);
    });

  const saveMemo = () =>
    run(async () => {
      const updated = await patchMeal(meal.id, { memo: memoDraft.trim() });
      onChange(updated);
    });

  const saveCost = () =>
    run(async () => {
      const updated = await patchMeal(meal.id, { costYen: parsedCost });
      onChange(updated);
    });

  const saveBasicInfo = () =>
    run(async () => {
      const updated = await patchMeal(meal.id, {
        dishName: nameDraft.trim(),
        cookedOn: dateDraft,
      });
      onChange(updated);
    });

  const handleDelete = () => {
    if (!window.confirm(`「${meal.dishName}」を履歴から削除しますか?`)) return;
    void run(async () => {
      await removeMeal(meal.id);
      onDelete(meal.id);
    });
  };

  return (
    <article className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{formatDate(meal.cookedOn)}</p>
          <h3 className="truncate text-base font-bold">{meal.dishName}</h3>
        </div>
        <button
          type="button"
          onClick={toggleFavorite}
          disabled={busy}
          aria-pressed={meal.isFavorite}
          aria-label={meal.isFavorite ? "お気に入りを解除" : "お気に入りに追加"}
          className={`shrink-0 text-2xl leading-none transition-transform active:scale-90 ${
            meal.isFavorite ? "text-amber" : "text-line"
          }`}
        >
          ★
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1" role="group" aria-label="評価">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            disabled={busy}
            aria-label={`評価 ${n}`}
            className={`text-lg leading-none ${
              meal.rating !== null && n <= meal.rating ? "text-pine" : "text-line"
            }`}
          >
            ●
          </button>
        ))}
        {meal.rating !== null && (
          <span className="ml-1 text-xs text-muted">{meal.rating}/5</span>
        )}
      </div>

      {meal.memo && !expanded && (
        <p className="mt-2 line-clamp-2 text-sm text-muted">{meal.memo}</p>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 text-sm font-semibold text-pine"
      >
        {expanded ? "閉じる" : "詳細・メモを開く"}
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 border-t border-line pt-4">
          <section>
            <h4 className="mb-1 text-xs font-bold text-pine">基本情報の編集</h4>
            <div className="space-y-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={100}
                aria-label="料理名"
                placeholder="料理名"
                className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm focus:border-pine focus:outline-none"
              />
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={dateDraft}
                  onChange={(e) => setDateDraft(e.target.value)}
                  aria-label="作った日"
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm focus:border-pine focus:outline-none"
                />
                <button
                  type="button"
                  onClick={saveBasicInfo}
                  disabled={busy || !basicInfoDirty || !basicInfoValid}
                  className="shrink-0 rounded-lg bg-pine px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  保存
                </button>
              </div>
            </div>
          </section>

          {meal.ingredients.length > 0 && (
            <section>
              <h4 className="mb-1 text-xs font-bold text-pine">食材</h4>
              <p className="text-sm">{meal.ingredients.join("、")}</p>
            </section>
          )}

          {meal.steps.length > 0 && (
            <section>
              <h4 className="mb-1 text-xs font-bold text-pine">手順</h4>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {meal.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          )}

          <section>
            <h4 className="mb-1 text-xs font-bold text-pine">実際の食費</h4>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={costDraft}
                onChange={(e) => setCostDraft(e.target.value)}
                min={0}
                max={100000}
                placeholder="例: 850"
                aria-label="実際の食費(円)"
                className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm focus:border-pine focus:outline-none"
              />
              <span className="shrink-0 text-sm text-muted">円</span>
              <button
                type="button"
                onClick={saveCost}
                disabled={busy || !costDirty || !costValid}
                className="shrink-0 rounded-lg bg-pine px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                保存
              </button>
            </div>
            {!costValid && (
              <p className="mt-1 text-xs text-red-600">0〜100,000円の値を入力してください</p>
            )}
            {meal.costYen !== null && (
              <p className="mt-1 text-xs text-muted">記録済み: {meal.costYen.toLocaleString()}円</p>
            )}
          </section>

          <section>
            <h4 className="mb-1 text-xs font-bold text-pine">メモ</h4>
            <textarea
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
              rows={3}
              placeholder="味の感想、次回の改善点など"
              className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm focus:border-pine focus:outline-none"
            />
            <div className="mt-2 flex justify-between">
              <button
                type="button"
                onClick={saveMemo}
                disabled={busy || memoDraft.trim() === meal.memo}
                className="rounded-lg bg-pine px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                メモを保存
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                削除
              </button>
            </div>
          </section>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </article>
  );
}
