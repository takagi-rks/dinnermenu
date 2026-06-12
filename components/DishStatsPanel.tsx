"use client";

import { useEffect, useState } from "react";
import { fetchDishStats } from "@/lib/api-client";
import type { DishStat } from "@/lib/types";

const COLLAPSED_COUNT = 6;

export default function DishStatsPanel() {
  const [stats, setStats] = useState<DishStat[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDishStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        // 統計は補助情報のため、失敗時はパネルごと非表示にする
        console.warn("統計の取得に失敗しました:", err);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || stats.length === 0) return null;

  const visible = expanded ? stats : stats.slice(0, COLLAPSED_COUNT);

  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-bold text-pine">よく作る料理</h2>
      <ul className="flex flex-wrap gap-2">
        {visible.map((stat) => (
          <li
            key={stat.dishName}
            className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-sm"
          >
            <span className="max-w-40 truncate">{stat.dishName}</span>
            <span className="shrink-0 rounded-full bg-pine px-1.5 py-0.5 text-xs font-bold text-white">
              ×{stat.count}
            </span>
          </li>
        ))}
      </ul>
      {stats.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-semibold text-pine"
        >
          {expanded ? "閉じる" : `すべて見る(${stats.length}件)`}
        </button>
      )}
    </section>
  );
}
