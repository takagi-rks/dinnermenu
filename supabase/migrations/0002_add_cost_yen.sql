-- cost_yen: 実際にかかった食費(円)。null = 未記録
alter table public.meals
  add column if not exists cost_yen integer
    check (cost_yen between 0 and 100000);
