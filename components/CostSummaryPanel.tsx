"use client";

import { useEffect, useState } from "react";
import { fetchCostSummary } from "@/lib/api-client";
import type { MonthlyCostSummary } from "@/lib/types";

const COLLAPSED_COUNT = 3;

export default function CostSummaryPanel() {
  const [summaries, setSummaries] = useState<MonthlyCostSummary[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCostSummary()
      .then((data) => {
        if (!cancelled) setSummaries(data);
      })
      .catch((err) => {
        // 補助情報のためエラーはパネルを非表示にして吸収
        console.warn("食費集計の取得に失敗しました:", err);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || summaries.length === 0) return null;

  // 現在月のデータを先頭から取得
  const current = summaries[0];
  const visible = expanded ? summaries : summaries.slice(0, COLLAPSED_COUNT);

  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-pine">食費の記録</h2>

      {/* 今月のハイライト */}
      {current && (
        <div className="mb-3 rounded-xl bg-pine/5 px-4 py-3">
          <p className="text-xs text-muted">
            {current.yearMonth.replace("-", "年")}月
          </p>
          <p className="text-xl font-bold text-pine">
            {current.totalCostYen.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-muted">円</span>
          </p>
          <p className="text-xs text-muted">{current.recordCount}件の記録</p>
        </div>
      )}

      {/* 月別一覧 */}
      <ul className="space-y-1.5">
        {visible.map((s) => (
          <li
            key={s.yearMonth}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted">
              {s.yearMonth.replace("-", "年")}月
            </span>
            <span className="font-semibold">
              {s.totalCostYen.toLocaleString()}円
              <span className="ml-1.5 text-xs font-normal text-muted">
                ({s.recordCount}件)
              </span>
            </span>
          </li>
        ))}
      </ul>

      {summaries.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-semibold text-pine"
        >
          {expanded ? "閉じる" : `過去の月も見る(全${summaries.length}か月)`}
        </button>
      )}
    </section>
  );
}
