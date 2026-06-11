import "server-only";

import type { MealSuggestion, SuggestionRequest } from "@/lib/types";
import { mealSuggestionSchema } from "@/lib/validation";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { callAnthropic } from "./anthropic";
import { callOpenAI } from "./openai";

export type AiProviderName = "anthropic" | "openai";

/** プロバイダ実装が満たすべき契約: prompt を受け取り生テキストを返す */
export interface AiProvider {
  readonly name: AiProviderName;
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}

class AiConfigError extends Error {}
export class AiResponseError extends Error {}

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new AiConfigError(`環境変数 ${key} が設定されていません`);
  }
  return value;
}

/** 環境変数 AI_PROVIDER に基づきプロバイダを生成(遅延初期化・ビルド時には評価されない) */
export function createAiProvider(): AiProvider {
  const provider = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();

  switch (provider) {
    case "anthropic":
      return {
        name: "anthropic",
        complete: (system, user) =>
          callAnthropic({
            apiKey: getEnv("ANTHROPIC_API_KEY"),
            model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
            system,
            user,
          }),
      };
    case "openai":
      return {
        name: "openai",
        complete: (system, user) =>
          callOpenAI({
            apiKey: getEnv("OPENAI_API_KEY"),
            model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
            system,
            user,
          }),
      };
    default:
      throw new AiConfigError(
        `AI_PROVIDER の値が不正です: "${provider}" (anthropic | openai)`
      );
  }
}

/** Markdownコードフェンスを除去してJSONを取り出す */
function extractJson(raw: string): unknown {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new AiResponseError("AIの応答をJSONとして解析できませんでした");
  }
}

/**
 * 献立提案のユースケース本体。
 * プロバイダの生成・プロンプト構築・出力検証をここで束ねる。
 * recentDishes は呼び出し側(API Route)が取得して渡す — AI層をDB非依存に保ちテスト容易性を維持。
 */
export async function generateMealSuggestion(
  request: SuggestionRequest,
  recentDishes: string[] = []
): Promise<MealSuggestion> {
  const provider = createAiProvider();
  const raw = await provider.complete(
    buildSystemPrompt(),
    buildUserPrompt(request, recentDishes)
  );

  const parsed = mealSuggestionSchema.safeParse(extractJson(raw));
  if (!parsed.success) {
    throw new AiResponseError(
      "AIの応答が期待する形式ではありませんでした。再度お試しください"
    );
  }
  return parsed.data;
}
