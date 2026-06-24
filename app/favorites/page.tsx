import FavoriteRecipesList from "@/components/FavoriteRecipesList";

export const metadata = { title: "お気に入り | 今夜のごはん" };

export default function FavoritesPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">お気に入り</h1>
        <p className="mt-1 text-sm text-muted">
          週間献立で登録したお気に入りの料理です。
        </p>
      </section>
      <FavoriteRecipesList />
    </div>
  );
}
