import MealCalendar from "@/components/MealCalendar";

export const metadata = { title: "食事カレンダー | 今夜のごはん" };

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">食事カレンダー</h1>
        <p className="mt-1 text-sm text-muted">
          食べた料理と食費を月ごとに確認できます。
        </p>
      </section>
      <MealCalendar />
    </div>
  );
}
