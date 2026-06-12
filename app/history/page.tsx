import DishStatsPanel from "@/components/DishStatsPanel";
import HistoryList from "@/components/HistoryList";

export const metadata = { title: "献立履歴 | 今夜のごはん" };

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">献立履歴</h1>
        <p className="mt-1 text-sm text-muted">
          作った料理の記録。評価やメモはここから編集できます。
        </p>
      </section>
      <DishStatsPanel />
      <HistoryList />
    </div>
  );
}
