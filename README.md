# 今夜のごはん — AI夕食決定アプリ

毎日の夕食をAIが提案し、過去の献立を履歴として保存・管理できる個人用アプリ。

## 技術構成

- Next.js 15 (App Router) / TypeScript (strict)
- Tailwind CSS v4
- Supabase PostgreSQL
- AI API: 環境変数 `AI_PROVIDER` で Anthropic / OpenAI を切り替え

## セットアップ

1. 依存関係をインストール

   ```bash
   npm install
   ```

2. Supabase プロジェクトを作成し、SQL Editor で
   `supabase/migrations/0001_create_meals.sql` を実行

3. 環境変数を設定

   ```bash
   cp .env.example .env.local
   # SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / AI_PROVIDER / 各APIキーを設定
   ```

4. 起動

   ```bash
   npm run dev
   ```

## AIプロバイダの切り替え

| 環境変数 | 値 |
| --- | --- |
| `AI_PROVIDER` | `anthropic`(既定)または `openai` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Anthropic使用時 |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAI使用時 |

プロバイダ実装は `lib/ai/` 配下。`AiProvider` インターフェースを満たす実装を追加し、
`createAiProvider()` に分岐を足すだけで他社APIにも拡張できます。

## セキュリティ上の注意

- `SUPABASE_SERVICE_ROLE_KEY` と各AIキーはサーバー(API Route)のみで使用。
  `NEXT_PUBLIC_` を付けないこと。
- meals テーブルは RLS 有効・ポリシーなしのため、anon キーから直接アクセス不可。
- 個人利用前提のため認証は未実装。公開URLにデプロイする場合は
  Basic認証やVercelのProtectionなどを必ず併用してください。

## API

| メソッド | パス | 説明 |
| --- | --- | --- |
| POST | `/api/suggest` | AI献立提案 |
| GET | `/api/meals?q=&favorite=true` | 履歴一覧(日付降順・検索・絞り込み) |
| POST | `/api/meals` | 履歴保存 |
| PATCH | `/api/meals/:id` | 評価・メモ・お気に入り更新 |
| DELETE | `/api/meals/:id` | 履歴削除 |
