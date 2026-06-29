"use client";

import {
  weeklyCandidateSelectionKey,
  type WeeklyCandidate,
} from "@/lib/weekly-plan-builder";
import type { DishKind } from "@/lib/types";
import type { ManualWeeklySelection } from "@/lib/weekly-manual-selection-storage";

export type { ManualWeeklySelection } from "@/lib/weekly-manual-selection-storage";

interface Props {
  candidates: WeeklyCandidate[];
  selections: ManualWeeklySelection[];
  savedAt: number | null;
  onChange: (selections: ManualWeeklySelection[]) => void;
  onReset: () => void;
}

const DAY_LABELS = ["1日目", "2日目", "3日目", "4日目", "5日目", "6日目", "7日目"];

function sourceLabel(candidate: WeeklyCandidate): string {
  switch (candidate.source) {
    case "manual":
      return "レシピ";
    case "favorite":
      return "お気に入り";
    case "history":
      return "履歴";
    case "ai":
      return "AI";
  }
}

function optionLabel(candidate: WeeklyCandidate): string {
  const ingredients = candidate.dish.keyIngredients.slice(0, 3).join("、");
  return ingredients
    ? `${candidate.dish.dishName} (${sourceLabel(candidate)} / ${ingredients})`
    : `${candidate.dish.dishName} (${sourceLabel(candidate)})`;
}

function candidateOptions(
  candidates: WeeklyCandidate[],
  kind: DishKind
): WeeklyCandidate[] {
  const map = new Map<string, WeeklyCandidate>();
  for (const candidate of candidates) {
    if (candidate.kind !== kind) continue;
    const key = weeklyCandidateSelectionKey(candidate);
    if (!map.has(key)) map.set(key, candidate);
  }
  return [...map.values()];
}

export function createEmptyManualSelections(): ManualWeeklySelection[] {
  return Array.from({ length: 7 }, (_, index) => ({
    dayIndex: index + 1,
    mainKey: "",
    sideKey: "",
  }));
}

export default function ManualWeeklySelector({
  candidates,
  selections,
  savedAt,
  onChange,
  onReset,
}: Props) {
  const mainOptions = candidateOptions(candidates, "main");
  const sideOptions = candidateOptions(candidates, "side");
  const hasOptions = mainOptions.length > 0 || sideOptions.length > 0;

  const updateSelection = (
    dayIndex: number,
    field: "mainKey" | "sideKey",
    value: string
  ) => {
    onChange(
      selections.map((selection) =>
        selection.dayIndex === dayIndex
          ? { ...selection, [field]: value }
          : selection
      )
    );
  };

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-base font-bold">手動で献立を選ぶ</h2>
            {savedAt !== null && (
              <p className="text-xs font-semibold text-pine">自動保存済み</p>
            )}
          </div>
          <button
            type="button"
            onClick={onReset}
            className="min-h-10 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink hover:border-pine/40"
          >
            手動選択をリセット
          </button>
        </div>
        <p className="text-sm text-muted">
          選んだ料理は生成結果に固定され、未指定の枠だけ自動で補完されます。
        </p>
      </div>

      {!hasOptions ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          選択できる候補がありません
        </div>
      ) : (
        <div className="space-y-3">
          {selections.map((selection, index) => {
            const mainSelected = selection.mainKey.length > 0;
            const sideSelected = selection.sideKey.length > 0;
            return (
              <section
                key={selection.dayIndex}
                className="rounded-xl border border-line bg-paper p-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-pine">
                    {DAY_LABELS[index] ?? `${selection.dayIndex}日目`}
                  </h3>
                  {(mainSelected || sideSelected) && (
                    <span className="rounded-full bg-pine/10 px-2 py-0.5 text-xs font-bold text-pine">
                      手動選択
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 min-[440px]:grid-cols-2">
                  <label className="min-w-0 space-y-1">
                    <span className="block text-xs font-bold text-ink">主菜</span>
                    <select
                      value={selection.mainKey}
                      onChange={(event) =>
                        updateSelection(selection.dayIndex, "mainKey", event.target.value)
                      }
                      className="w-full min-w-0 rounded-xl border border-line bg-card px-3 py-3 text-sm focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
                    >
                      <option value="">未指定</option>
                      {mainOptions.map((candidate) => {
                        const key = weeklyCandidateSelectionKey(candidate);
                        return (
                          <option key={key} value={key}>
                            {optionLabel(candidate)}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <label className="min-w-0 space-y-1">
                    <span className="block text-xs font-bold text-ink">副菜</span>
                    <select
                      value={selection.sideKey}
                      onChange={(event) =>
                        updateSelection(selection.dayIndex, "sideKey", event.target.value)
                      }
                      className="w-full min-w-0 rounded-xl border border-line bg-card px-3 py-3 text-sm focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
                    >
                      <option value="">未指定</option>
                      {sideOptions.map((candidate) => {
                        const key = weeklyCandidateSelectionKey(candidate);
                        return (
                          <option key={key} value={key}>
                            {optionLabel(candidate)}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
