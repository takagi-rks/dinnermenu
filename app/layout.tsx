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
          <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-wide text-pine">
              今夜のごはん
            </Link>
            <nav className="flex gap-1 text-sm">
              <Link
                href="/"
                className="rounded-full px-3 py-1.5 font-medium text-ink hover:bg-line/60"
              >
                提案
              </Link>
              <Link
                href="/weekly"
                className="rounded-full px-3 py-1.5 font-medium text-ink hover:bg-line/60"
              >
                週間
              </Link>
              <Link
                href="/history"
                className="rounded-full px-3 py-1.5 font-medium text-ink hover:bg-line/60"
              >
                履歴
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-xl px-4 pb-16 pt-6">{children}</main>
      </body>
    </html>
  );
}
