import RecipeList from "@/components/RecipeList";

export const metadata = { title: "レシピ | 今夜のごはん" };

export default function RecipesPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">レシピ</h1>
        <p className="mt-1 text-sm text-muted">
          よく作る料理を登録して、週間献立の候補に使えます。
        </p>
      </section>
      <RecipeList />
    </div>
  );
}
