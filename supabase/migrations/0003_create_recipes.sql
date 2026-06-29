-- 手動登録レシピテーブル
create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  recipe_name text not null check (char_length(recipe_name) <= 100),
  kind        text not null check (kind in ('main', 'side')),
  ingredients text[] not null default '{}',
  memo        text not null default '' check (char_length(memo) <= 2000),
  recipe_url  text not null default '' check (char_length(recipe_url) <= 2000),
  rating      smallint check (rating between 1 and 5),
  is_favorite boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 一覧表示・週間献立候補取得用インデックス
create index if not exists recipes_kind_idx on public.recipes (kind, created_at desc);
create index if not exists recipes_favorite_idx on public.recipes (is_favorite) where is_favorite = true;

-- Service Role Key 経由のサーバーアクセスのみを想定し、
-- anon キーからの直接アクセスを遮断するため RLS を有効化(ポリシーは作らない)
alter table public.recipes enable row level security;
