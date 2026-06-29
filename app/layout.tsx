import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "今夜のごはん",
  description: "AIが今夜の夕食を提案し、献立履歴を管理できる個人用アプリ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex max-w-xl flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <Link href="/" className="text-base font-bold tracking-wide text-pine sm:text-lg">
              今夜のごはん
            </Link>
            <nav className="grid grid-cols-3 gap-1 text-center text-[11px] min-[360px]:grid-cols-6 min-[360px]:text-xs sm:flex sm:text-sm">
              <Link
                href="/"
                className="rounded-full px-0.5 py-2 font-medium text-ink hover:bg-line/60 sm:px-3"
              >
                1日
              </Link>
              <Link
                href="/weekly"
                className="rounded-full px-0.5 py-2 font-medium text-ink hover:bg-line/60 sm:px-3"
              >
                週間
              </Link>
              <Link
                href="/history"
                className="rounded-full px-0.5 py-2 font-medium text-ink hover:bg-line/60 sm:px-3"
              >
                履歴
              </Link>
              <Link
                href="/recipes"
                className="rounded-full px-0.5 py-2 font-medium text-ink hover:bg-line/60 sm:px-3"
              >
                レシピ
              </Link>
              <Link
                href="/calendar"
                className="rounded-full px-0.5 py-2 font-medium text-ink hover:bg-line/60 sm:px-3"
              >
                カレンダー
              </Link>
              <Link
                href="/favorites"
                className="rounded-full px-0.5 py-2 font-medium text-ink hover:bg-line/60 sm:px-3"
              >
                お気に入り
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-xl px-3 pb-16 pt-5 sm:px-4 sm:pt-6">{children}</main>
      </body>
    </html>
  );
}
