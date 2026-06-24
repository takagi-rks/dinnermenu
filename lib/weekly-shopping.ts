import type { DayMealPlan } from "@/lib/types";

export type ShoppingCategoryId =
  | "meat"
  | "fish"
  | "vegetables"
  | "eggsDairy"
  | "seasoning"
  | "other";

export interface ShoppingCategory {
  id: ShoppingCategoryId;
  label: string;
  items: ShoppingCategoryItem[];
}

export interface ShoppingCategoryItem {
  item: string;
  originalIndex: number;
}

const CATEGORY_ORDER: Array<{ id: ShoppingCategoryId; label: string }> = [
  { id: "meat", label: "肉" },
  { id: "fish", label: "魚" },
  { id: "vegetables", label: "野菜" },
  { id: "eggsDairy", label: "卵・乳製品" },
  { id: "seasoning", label: "調味料" },
  { id: "other", label: "その他" },
];

const CATEGORY_KEYWORDS: Record<ShoppingCategoryId, string[]> = {
  meat: [
    "肉",
    "牛",
    "豚",
    "鶏",
    "とり",
    "ひき肉",
    "挽肉",
    "ベーコン",
    "ハム",
    "ソーセージ",
    "ウインナー",
  ],
  fish: [
    "魚",
    "鮭",
    "さけ",
    "サーモン",
    "鯖",
    "さば",
    "鰯",
    "いわし",
    "鱈",
    "たら",
    "ぶり",
    "海老",
    "えび",
    "エビ",
    "イカ",
    "いか",
    "タコ",
    "たこ",
    "貝",
    "ツナ",
  ],
  vegetables: [
    "野菜",
    "玉ねぎ",
    "玉葱",
    "たまねぎ",
    "にんじん",
    "人参",
    "じゃがいも",
    "キャベツ",
    "白菜",
    "レタス",
    "トマト",
    "きゅうり",
    "ほうれん草",
    "小松菜",
    "ねぎ",
    "長ねぎ",
    "青ねぎ",
    "大根",
    "なす",
    "茄子",
    "ピーマン",
    "パプリカ",
    "もやし",
    "きのこ",
    "しめじ",
    "えのき",
    "舞茸",
    "しいたけ",
    "椎茸",
    "ブロッコリー",
    "ごぼう",
    "れんこん",
    "蓮根",
    "かぼちゃ",
    "南瓜",
    "水菜",
    "ニラ",
  ],
  eggsDairy: [
    "卵",
    "たまご",
    "玉子",
    "牛乳",
    "チーズ",
    "バター",
    "ヨーグルト",
    "生クリーム",
    "乳",
  ],
  seasoning: [
    "塩",
    "砂糖",
    "醤油",
    "しょうゆ",
    "味噌",
    "みそ",
    "酢",
    "みりん",
    "酒",
    "料理酒",
    "油",
    "ごま油",
    "オリーブオイル",
    "ソース",
    "ケチャップ",
    "マヨネーズ",
    "だし",
    "出汁",
    "コンソメ",
    "鶏ガラ",
    "こしょう",
    "胡椒",
    "にんにく",
    "生姜",
    "しょうが",
    "唐辛子",
    "カレー粉",
    "片栗粉",
    "小麦粉",
    "パン粉",
    "ごま",
    "胡麻",
  ],
  other: [],
};

function normalizeItemName(item: string): string {
  return item
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ 　]/g, "")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/\d+(?:\.\d+)?(?:g|kg|ml|l|個|本|枚|束|袋|パック|缶|丁|玉|大さじ|小さじ|少々|適量)/g, "")
    .replace(/[、,].*$/g, "")
    .trim();
}

function normalizeForMatch(item: string): string {
  return normalizeItemName(item).replace(/^(冷凍|生|乾燥|刻み|すりおろし)/g, "");
}

function isAvailableIngredient(item: string, availableIngredients: string[]): boolean {
  const normalizedItem = normalizeForMatch(item);
  if (!normalizedItem) return false;

  return availableIngredients.some((ingredient) => {
    const normalizedIngredient = normalizeForMatch(ingredient);
    return (
      normalizedIngredient.length > 0 &&
      (normalizedItem === normalizedIngredient ||
        normalizedItem.includes(normalizedIngredient) ||
        normalizedIngredient.includes(normalizedItem))
    );
  });
}

export function rebuildShoppingList(
  days: DayMealPlan[],
  availableIngredients: string[]
): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const day of days) {
    const ingredients = [...day.main.keyIngredients, ...day.side.keyIngredients];
    for (const ingredient of ingredients) {
      const item = ingredient.trim();
      if (!item || isAvailableIngredient(item, availableIngredients)) continue;

      const key = normalizeForMatch(item);
      if (!key || seen.has(key)) continue;

      seen.add(key);
      items.push(item);
    }
  }

  return items;
}

export function carryCheckedItems(
  previousItems: string[],
  previousChecked: boolean[],
  nextItems: string[]
): boolean[] {
  const checkedByKey = new Map<string, boolean>();

  previousItems.forEach((item, index) => {
    const key = normalizeForMatch(item);
    if (key && (previousChecked[index] ?? false)) {
      checkedByKey.set(key, true);
    }
  });

  return nextItems.map((item) => checkedByKey.get(normalizeForMatch(item)) ?? false);
}

function detectCategory(item: string): ShoppingCategoryId {
  const normalized = normalizeForMatch(item);
  const categories: ShoppingCategoryId[] = [
    "eggsDairy",
    "seasoning",
    "meat",
    "fish",
    "vegetables",
  ];

  for (const category of categories) {
    if (CATEGORY_KEYWORDS[category].some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }

  return "other";
}

export function categorizeShoppingList(items: string[]): ShoppingCategory[] {
  const categories = CATEGORY_ORDER.map<ShoppingCategory>(({ id, label }) => ({
    id,
    label,
    items: [],
  }));

  const categoryById = new Map(categories.map((category) => [category.id, category]));

  items.forEach((item, originalIndex) => {
    const category = categoryById.get(detectCategory(item));
    category?.items.push({ item, originalIndex });
  });

  return categories.filter((category) => category.items.length > 0);
}
