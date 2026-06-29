"use client";

import { useEffect, useMemo, useState } from "react";
import { postMealsBulk, postDayResuggest } from "@/lib/api-client";
import {
  loadWeeklyFavorites,
  saveWeeklyFavorites,
  weeklyFavoriteKey,
  type WeeklyDishKind,
} from "@/lib/weekly-favorites";
import { categorizeShoppingList } from "@/lib/weekly-shopping";
import {
  findRecommendedDaySuggestion,
  weeklyCandidateKey,
  weeklyCandidateSelectionKey,
  type WeeklyCandidateSummary,
  type WeeklyCandidate,
} from "@/lib/weekly-plan-builder";
import { RECOMMENDATION_REASON_LABELS } from "@/lib/meal-recommendation";

import type {
  CreateMealInput,
  DayMealPlan,
  SuggestionRequest,
  WeeklyDish,
  WeeklyMealPlan,
} from "@/lib/types";

interface Props {
  plan: WeeklyMealPlan;
  request: SuggestionRequest;
  startDate: string;
  checkedItems: boolean[];
  saved: boolean;
  candidates: WeeklyCandidate[];
  dishDetails: WeeklyCandidate[];
  generationStatus: "AI未使用" | "一部AI補完" | null;
  candidateSummary: WeeklyCandidateSummary | null;
  completeLocalPlan: boolean;
  onStartDateChange: (date: string) => void;
  onCheckedChange: (index: number) => void;
  onDayReplace: (dayIndex: number, updated: DayMealPlan) => void;
  onPlanEditApply: (days: DayMealPlan[]) => void;
  onSaved: () => void;
  onClear: () => void;
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/** YYYY-MM-DD に日数を加算(ローカルタイム基準) */
function addDays(dateString: string, days: number): string {
  const parts = dateString.split("-").map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  if (!y || !m || d === undefined) return dateString;
  const date = new Date(y, m - 1, d + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatShort(dateString: string): string {
  const parts = dateString.split("-");
  const m = parts[1], d = parts[2];
  if (!m || !d) return dateString;
  return `${Number(m)}/${Number(d)}`;
}

function formatWeekday(dateString: string): string {
  const parts = dateString.split("-").map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  if (!y || !m || d === undefined) return "";
  return WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()] ?? "";
}

function youtubeSearchUrl(dishName: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${dishName} レシピ`
  )}`;
}

function FavoriteButton({
  active,
  dishName,
  onToggle,
}: {
  active: boolean;
  dishName: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? `${dishName}のお気に入りを解除` : `${dishName}をお気に入りに追加`}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl leading-none transition-transform active:scale-90 ${
        active ? "text-amber" : "text-line hover:text-amber"
      }`}
    >
      ★
    </button>
  );
}

function ReasonBadges({ candidate }: { candidate: WeeklyCandidate | undefined }) {
  if (!candidate || candidate.reasons.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {candidate.reasons.map((reason) => (
        <span
          key={reason}
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            reason === "ai"
              ? "bg-amber/10 text-amber"
              : "bg-pine/10 text-pine"
          }`}
        >
          {RECOMMENDATION_REASON_LABELS[reason]}
        </span>
      ))}
    </div>
  );
}

function DishRow({
  label,
  kind,
  dish,
  candidate,
  favoriteKeys,
  onFavoriteToggle,
}: {
  label: string;
  kind: WeeklyDishKind;
  dish: WeeklyDish;
  candidate?: WeeklyCandidate;
  favoriteKeys: Set<string>;
  onFavoriteToggle: (kind: WeeklyDishKind, dish: WeeklyDish) => void;
}) {
  const favorite = favoriteKeys.has(weeklyFavoriteKey(kind, dish));

  return (
    <div className="flex items-start gap-2.5 sm:gap-3">
      <span className="mt-0.5 shrink-0 rounded-md bg-pine/10 px-2 py-0.5 text-xs font-bold text-pine">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="min-w-0 flex-1 basis-full break-words text-sm font-bold leading-snug min-[380px]:basis-0">
            {dish.dishName}
          </p>
          <FavoriteButton
            active={favorite}
            dishName={dish.dishName}
            onToggle={() => onFavoriteToggle(kind, dish)}
          />
          <a
            href={youtubeSearchUrl(dish.dishName)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${dish.dishName}のレシピ動画をYouTubeで検索`}
            className="flex min-h-10 shrink-0 items-center rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
          >
            ▶ 動画
          </a>
        </div>
        <p className="mt-1 break-words text-xs leading-relaxed text-muted">
          {dish.keyIngredients.join("、")}
        </p>
        <ReasonBadges candidate={candidate} />
      </div>
    </div>
  );
}

function CalendarView({
  days,
  startDate,
  dishDetails,
  favoriteKeys,
  onFavoriteToggle,
}: {
  days: DayMealPlan[];
  startDate: string;
  dishDetails: Map<string, WeeklyCandidate>;
  favoriteKeys: Set<string>;
  onFavoriteToggle: (kind: WeeklyDishKind, dish: WeeklyDish) => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted">カレンダー表示</p>
          <h3 className="text-base font-bold text-pine">
            {formatShort(startDate)} 〜 {formatShort(addDays(startDate, 6))}
          </h3>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {days.map((day) => {
          const date = addDays(startDate, day.dayIndex - 1);
          return (
            <div
              key={day.dayIndex}
              className="rounded-xl border border-line bg-paper p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink">
                  {formatShort(date)}
                  <span className="ml-1 text-xs text-muted">
                    ({formatWeekday(date)})
                  </span>
                </p>
                <span className="rounded-full bg-pine/10 px-2 py-0.5 text-xs font-bold text-pine">
                  {day.dayIndex}日目
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-bold text-pine">主菜</p>
                    <FavoriteButton
                      active={favoriteKeys.has(weeklyFavoriteKey("main", day.main))}
                      dishName={day.main.dishName}
                      onToggle={() => onFavoriteToggle("main", day.main)}
                    />
                  </div>
                  <p className="mt-0.5 break-words text-sm font-semibold leading-snug">
                    {day.main.dishName}
                  </p>
                  <ReasonBadges
                    candidate={dishDetails.get(
                      weeklyCandidateKey("main", day.main.dishName)
                    )}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-bold text-amber">副菜</p>
                    <FavoriteButton
                      active={favoriteKeys.has(weeklyFavoriteKey("side", day.side))}
                      dishName={day.side.dishName}
                      onToggle={() => onFavoriteToggle("side", day.side)}
                    />
                  </div>
                  <p className="mt-0.5 break-words text-sm font-semibold leading-snug">
                    {day.side.dishName}
                  </p>
                  <ReasonBadges
                    candidate={dishDetails.get(
                      weeklyCandidateKey("side", day.side.dishName)
                    )}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ShoppingMode({
  shoppingList,
  checkedItems,
  onCheckedChange,
}: {
  shoppingList: string[];
  checkedItems: boolean[];
  onCheckedChange: (index: number) => void;
}) {
  const categories = useMemo(
    () => categorizeShoppingList(shoppingList),
    [shoppingList]
  );
  const checkedCount = shoppingList.filter(
    (_, index) => checkedItems[index] ?? false
  ).length;

  if (shoppingList.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <div className="bg-pine px-4 py-4 text-white sm:px-5">
        <p className="text-xs opacity-80">スーパー買い物モード</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h3 className="text-base font-bold sm:text-lg">カテゴリ別チェックリスト</h3>
          <p className="shrink-0 text-sm font-bold">
            {checkedCount}/{shoppingList.length}
          </p>
        </div>
      </div>

      <div className="divide-y divide-line">
        {categories.map((category) => {
          const categoryCheckedCount = category.items.filter(
            ({ originalIndex }) => checkedItems[originalIndex] ?? false
          ).length;

          return (
            <section key={category.id} className="px-3 py-4 sm:px-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-bold text-pine">{category.label}</h4>
                <p className="text-xs font-semibold text-muted">
                  {categoryCheckedCount}/{category.items.length}
                </p>
              </div>
              <ul className="space-y-2">
                {category.items.map(({ item, originalIndex }) => {
                  const checked = checkedItems[originalIndex] ?? false;
                  return (
                    <li key={`${originalIndex}-${item}`}>
                      <label
                        htmlFor={`shop-mode-${originalIndex}`}
                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                          checked
                            ? "border-line bg-paper text-muted"
                            : "border-line bg-card text-ink hover:border-pine/40"
                        }`}
                      >
                        <input
                          id={`shop-mode-${originalIndex}`}
                          type="checkbox"
                          checked={checked}
                          onChange={() => onCheckedChange(originalIndex)}
                          className="h-5 w-5 shrink-0 accent-pine"
                        />
                        <span
                          className={`min-w-0 break-words text-base font-semibold leading-snug ${
                            checked ? "line-through" : ""
                          }`}
                        >
                          {item}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}

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

function candidateOptionLabel(candidate: WeeklyCandidate): string {
  const ingredients = candidate.dish.keyIngredients.slice(0, 3).join("、");
  return ingredients
    ? `${candidate.dish.dishName} (${sourceLabel(candidate)} / ${ingredients})`
    : `${candidate.dish.dishName} (${sourceLabel(candidate)})`;
}

function uniqueCandidateOptions(
  candidates: WeeklyCandidate[],
  kind: WeeklyDishKind
): WeeklyCandidate[] {
  const map = new Map<string, WeeklyCandidate>();
  for (const candidate of candidates) {
    if (candidate.kind !== kind || candidate.source === "ai") continue;
    const key = weeklyCandidateSelectionKey(candidate);
    if (!map.has(key)) map.set(key, candidate);
  }
  return [...map.values()];
}

interface PlanEditDraft {
  dayIndex: number;
  mainKey: string;
  sideKey: string;
}

function createPlanEditDraft(days: DayMealPlan[]): PlanEditDraft[] {
  return days.map((day) => ({
    dayIndex: day.dayIndex,
    mainKey: "",
    sideKey: "",
  }));
}

function WeeklyPlanBulkEditor({
  days,
  candidates,
  onApply,
}: {
  days: DayMealPlan[];
  candidates: WeeklyCandidate[];
  onApply: (days: DayMealPlan[]) => void;
}) {
  const [drafts, setDrafts] = useState<PlanEditDraft[]>(() =>
    createPlanEditDraft(days)
  );
  const mainOptions = useMemo(
    () => uniqueCandidateOptions(candidates, "main"),
    [candidates]
  );
  const sideOptions = useMemo(
    () => uniqueCandidateOptions(candidates, "side"),
    [candidates]
  );
  const candidateByKey = useMemo(
    () =>
      new Map(
        candidates.map((candidate) => [
          weeklyCandidateSelectionKey(candidate),
          candidate,
        ])
      ),
    [candidates]
  );

  useEffect(() => {
    setDrafts(createPlanEditDraft(days));
  }, [days]);

  const updateDraft = (
    dayIndex: number,
    field: "mainKey" | "sideKey",
    value: string
  ) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.dayIndex === dayIndex ? { ...draft, [field]: value } : draft
      )
    );
  };

  const handleApply = () => {
    const draftByDay = new Map(drafts.map((draft) => [draft.dayIndex, draft]));
    const nextDays = days.map((day) => {
      const draft = draftByDay.get(day.dayIndex);
      const mainCandidate = draft?.mainKey
        ? candidateByKey.get(draft.mainKey)
        : undefined;
      const sideCandidate = draft?.sideKey
        ? candidateByKey.get(draft.sideKey)
        : undefined;
      return {
        ...day,
        main:
          mainCandidate?.kind === "main" ? mainCandidate.dish : day.main,
        side:
          sideCandidate?.kind === "side" ? sideCandidate.dish : day.side,
      };
    });
    onApply(nextDays);
    setDrafts(createPlanEditDraft(nextDays));
  };

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
      <div>
        <h3 className="text-base font-bold">週間献立を一括編集</h3>
        <p className="mt-1 text-sm text-muted">
          現在の料理を維持するか、候補から変更できます。AIは使いません。
        </p>
      </div>

      <div className="space-y-3">
        {days.map((day) => {
          const draft = drafts.find((item) => item.dayIndex === day.dayIndex);
          return (
            <section
              key={day.dayIndex}
              className="rounded-xl border border-line bg-paper p-3"
            >
              <h4 className="mb-2 text-sm font-bold text-pine">
                {day.dayIndex}日目
              </h4>
              <div className="grid grid-cols-1 gap-2 min-[440px]:grid-cols-2">
                <label className="min-w-0 space-y-1">
                  <span className="block text-xs font-bold text-ink">
                    主菜
                  </span>
                  <select
                    value={draft?.mainKey ?? ""}
                    onChange={(event) =>
                      updateDraft(day.dayIndex, "mainKey", event.target.value)
                    }
                    className="w-full min-w-0 rounded-xl border border-line bg-card px-3 py-3 text-sm focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
                  >
                    <option value="">現在の料理を維持: {day.main.dishName}</option>
                    {mainOptions.map((candidate) => {
                      const key = weeklyCandidateSelectionKey(candidate);
                      return (
                        <option key={key} value={key}>
                          {candidateOptionLabel(candidate)}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <label className="min-w-0 space-y-1">
                  <span className="block text-xs font-bold text-ink">
                    副菜
                  </span>
                  <select
                    value={draft?.sideKey ?? ""}
                    onChange={(event) =>
                      updateDraft(day.dayIndex, "sideKey", event.target.value)
                    }
                    className="w-full min-w-0 rounded-xl border border-line bg-card px-3 py-3 text-sm focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
                  >
                    <option value="">現在の料理を維持: {day.side.dishName}</option>
                    {sideOptions.map((candidate) => {
                      const key = weeklyCandidateSelectionKey(candidate);
                      return (
                        <option key={key} value={key}>
                          {candidateOptionLabel(candidate)}
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

      <button
        type="button"
        onClick={handleApply}
        className="min-h-12 w-full rounded-xl bg-pine px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-pine-dark"
      >
        変更を反映
      </button>
    </section>
  );
}

function DayCard({
  day,
  date,
  request,
  allDays,
  favoriteKeys,
  candidates,
  dishDetails,
  onReplace,
  onFavoriteToggle,
}: {
  day: DayMealPlan;
  date: string;
  request: SuggestionRequest;
  allDays: DayMealPlan[];
  favoriteKeys: Set<string>;
  candidates: WeeklyCandidate[];
  dishDetails: Map<string, WeeklyCandidate>;
  onReplace: (updated: DayMealPlan) => void;
  onFavoriteToggle: (kind: WeeklyDishKind, dish: WeeklyDish) => void;
}) {
  const [resuggesting, setResuggesting] = useState(false);
  const [resuggestError, setResuggestError] = useState<string | null>(null);

  const otherDishes = allDays
    .filter((item) => item.dayIndex !== day.dayIndex)
    .flatMap((item) => [item.main.dishName, item.side.dishName]);

  const handleLocalResuggest = () => {
    setResuggestError(null);
    const result = findRecommendedDaySuggestion(candidates, request, [
      ...otherDishes,
      day.main.dishName,
      day.side.dishName,
    ]);
    if (!result) {
      setResuggestError(
        "変更に使える主菜・副菜の候補がありません。AIでの再提案をお試しください。"
      );
      return;
    }
    onReplace({ ...day, main: result.main.dish, side: result.side.dish });
  };

  const handleAiResuggest = async () => {
    setResuggesting(true);
    setResuggestError(null);
    try {
      const result = await postDayResuggest(request, otherDishes);
      onReplace({ ...day, main: result.main, side: result.side });
    } catch (err) {
      setResuggestError(
        err instanceof Error ? err.message : "再提案に失敗しました"
      );
    } finally {
      setResuggesting(false);
    }
  };

  return (
    <li className="space-y-3 px-4 py-4 sm:px-5">
      <div className="space-y-2 min-[420px]:flex min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-3 min-[420px]:space-y-0">
        <p className="text-xs font-bold text-muted">
          {day.dayIndex}日目({formatShort(date)})
        </p>
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 min-[420px]:flex min-[420px]:flex-wrap min-[420px]:justify-end">
          <button
            type="button"
            onClick={handleLocalResuggest}
            disabled={resuggesting}
            className="min-h-11 rounded-lg border border-line px-3 py-2 text-xs font-semibold leading-snug text-ink transition-colors hover:border-pine/50 disabled:opacity-40"
          >
            レシピ・お気に入り・履歴から変更
          </button>
          <button
            type="button"
            onClick={handleAiResuggest}
            disabled={resuggesting}
            className="min-h-11 rounded-lg border border-pine px-3 py-2 text-xs font-semibold leading-snug text-pine transition-colors hover:bg-pine/5 disabled:opacity-40"
          >
            {resuggesting ? "AI考案中…" : "AIで再提案"}
          </button>
        </div>
      </div>
      {resuggestError && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {resuggestError}
        </p>
      )}
      <DishRow
        label="主菜"
        kind="main"
        dish={day.main}
        candidate={dishDetails.get(weeklyCandidateKey("main", day.main.dishName))}
        favoriteKeys={favoriteKeys}
        onFavoriteToggle={onFavoriteToggle}
      />
      <DishRow
        label="副菜"
        kind="side"
        dish={day.side}
        candidate={dishDetails.get(weeklyCandidateKey("side", day.side.dishName))}
        favoriteKeys={favoriteKeys}
        onFavoriteToggle={onFavoriteToggle}
      />
    </li>
  );
}

export default function WeeklyMealPlanView({
  plan,
  request,
  startDate,
  checkedItems,
  saved,
  candidates,
  dishDetails,
  generationStatus,
  candidateSummary,
  completeLocalPlan,
  onStartDateChange,
  onCheckedChange,
  onDayReplace,
  onPlanEditApply,
  onSaved,
  onClear,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [planView, setPlanView] = useState<"calendar" | "list">("calendar");
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(() => new Set());

  const dishDetailMap = useMemo(() => {
    const map = new Map<string, WeeklyCandidate>();
    for (const candidate of candidates) {
      map.set(weeklyCandidateKey(candidate.kind, candidate.dish.dishName), candidate);
    }
    for (const candidate of dishDetails) {
      map.set(weeklyCandidateKey(candidate.kind, candidate.dish.dishName), candidate);
    }
    return map;
  }, [candidates, dishDetails]);

  useEffect(() => {
    setFavoriteKeys(new Set(loadWeeklyFavorites()));
  }, []);

  const handleFavoriteToggle = (kind: WeeklyDishKind, dish: WeeklyDish) => {
    setFavoriteKeys((prev) => {
      const key = weeklyFavoriteKey(kind, dish);
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      saveWeeklyFavorites([...next]);
      return next;
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const meals: CreateMealInput[] = plan.days.flatMap((day) => {
        const cookedOn = addDays(startDate, day.dayIndex - 1);
        return [
          {
            cookedOn,
            dishName: day.main.dishName,
            ingredients: day.main.keyIngredients,
            steps: [],
            memo: "週間プラン(主菜)",
          },
          {
            cookedOn,
            dishName: day.side.dishName,
            ingredients: day.side.keyIngredients,
            steps: [],
            memo: "週間プラン(副菜)",
          },
        ];
      });
      await postMealsBulk(meals);
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-card p-2 shadow-sm sm:p-3">
        {generationStatus && (
          <div className="mb-2 space-y-1 rounded-xl bg-pine/5 px-3 py-2 text-sm text-pine">
            <p className="font-bold">
              {completeLocalPlan ? "完全AIなし献立" : generationStatus}
            </p>
            {candidateSummary && (
              <p className="text-xs font-semibold text-pine/80">
                使用した候補数: レシピ {candidateSummary.manual}件 / お気に入り{" "}
                {candidateSummary.favorite}件 / 履歴 {candidateSummary.history}件
              </p>
            )}
          </div>
        )}
        <div className="flex items-center rounded-xl bg-paper p-1">
          <button
            type="button"
            onClick={() => setPlanView("calendar")}
            className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              planView === "calendar"
                ? "bg-pine text-white"
                : "text-muted hover:bg-line/60"
            }`}
          >
            カレンダー
          </button>
          <button
            type="button"
            onClick={() => setPlanView("list")}
            className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              planView === "list"
                ? "bg-pine text-white"
                : "text-muted hover:bg-line/60"
            }`}
          >
            カード
          </button>
        </div>
      </section>

      {planView === "calendar" && (
        <CalendarView
          days={plan.days}
          startDate={startDate}
          dishDetails={dishDetailMap}
          favoriteKeys={favoriteKeys}
          onFavoriteToggle={handleFavoriteToggle}
        />
      )}

      {planView === "list" && (
        <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          <div className="bg-pine px-4 py-4 text-white sm:px-5">
            <p className="text-xs opacity-80">1週間の献立プラン</p>
            <h2 className="text-lg font-bold">
              {formatShort(startDate)} 〜 {formatShort(addDays(startDate, 6))}
            </h2>
            <p className="mt-1 text-xs opacity-90">
              週合計の目安 {plan.estimatedBudgetYen.toLocaleString()}円
            </p>
          </div>

          <ul className="divide-y divide-line">
            {plan.days.map((day) => (
              <DayCard
                key={day.dayIndex}
                day={day}
                date={addDays(startDate, day.dayIndex - 1)}
                request={request}
                allDays={plan.days}
                favoriteKeys={favoriteKeys}
                candidates={candidates}
                dishDetails={dishDetailMap}
                onReplace={(updated) => onDayReplace(day.dayIndex, updated)}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </ul>
        </article>
      )}

      <ShoppingMode
        shoppingList={plan.shoppingList}
        checkedItems={checkedItems}
        onCheckedChange={onCheckedChange}
      />

      <WeeklyPlanBulkEditor
        days={plan.days}
        candidates={candidates}
        onApply={onPlanEditApply}
      />

      {/* 保存・操作パネル */}
      <section className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
        <div className="space-y-1.5 min-[380px]:flex min-[380px]:items-center min-[380px]:gap-3 min-[380px]:space-y-0">
          <label
            htmlFor="week-start"
            className="shrink-0 text-sm font-semibold text-ink"
          >
            開始日
          </label>
          <input
            id="week-start"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            disabled={saved}
            className="w-full rounded-xl border border-line bg-paper px-3 py-3 text-base focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
          />
        </div>

        {saveError && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {saveError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-[1fr_auto] min-[380px]:gap-3">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || saved || !startDate}
            className="min-h-12 rounded-xl bg-pine px-3 py-3 text-sm font-bold leading-snug text-white transition-colors hover:bg-pine-dark disabled:opacity-50"
          >
            {saved
              ? "14品を履歴に保存しました"
              : saving
                ? "保存中…"
                : "この1週間プランを一括保存"}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="min-h-12 rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:border-red-200 hover:bg-red-50"
          >
            クリア
          </button>
        </div>
      </section>
    </div>
  );
}
