-- 献立履歴テーブル
create table if not exists public.meals (
  id          uuid primary key default gen_random_uuid(),
  cooked_on   date not null,
  dish_name   text not null check (char_length(dish_name) <= 100),
  ingredients text[] not null default '{}',
  steps       text[] not null default '{}',
  rating      smallint check (rating between 1 and 5),
  memo        text not null default '' check (char_length(memo) <= 2000),
  is_favorite boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 一覧表示(日付降順)・お気に入り絞り込み用インデックス
create index if not exists meals_cooked_on_idx on public.meals (cooked_on desc, created_at desc);
create index if not exists meals_favorite_idx on public.meals (is_favorite) where is_favorite = true;

-- Service Role Key 経由のサーバーアクセスのみを想定し、
-- anon キーからの直接アクセスを遮断するため RLS を有効化(ポリシーは作らない)
alter table public.meals enable row level security;
