import "server-only";

import { AiResponseError } from "./errors";

interface GeminiCallParams {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

const TIMEOUT_MS = 90_000;
const DEFAULT_MAX_TOKENS = 2000;
const RETRY_DELAYS_MS = [1_000, 3_000] as const;
const RETRYABLE_STATUSES = new Set([429, 503]);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callGemini(params: GeminiCallParams): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: {
      parts: [{ text: params.system }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: params.user }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
      maxOutputTokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    },
  });

  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // APIキーはクエリ文字列ではなくヘッダーで送る(アクセスログ等への漏えい防止)
        "x-goog-api-key": params.apiKey,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // 原因特定のためエラー詳細はサーバーログにのみ出力する(キーは含まれない)
      console.error(
        `Gemini API error: status=${response.status} model=${params.model}`,
        await response.text().catch(() => "")
      );

      const retryDelay = RETRY_DELAYS_MS[attempt];
      if (RETRYABLE_STATUSES.has(response.status) && retryDelay !== undefined) {
        await wait(retryDelay);
        continue;
      }

      if (response.status === 429) {
        throw new AiResponseError(
          "本日のAI無料利用枠に達しました。時間をおいて再試行するか、別のAIプロバイダに切り替えてください。"
        );
      }
      if (response.status === 503) {
        throw new AiResponseError(
          "AIが混雑しています。少し時間をおいて再試行してください。"
        );
      }

      throw new Error(`Gemini APIの呼び出しに失敗しました (${response.status})`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Gemini APIから空の応答が返されました");
    }
    return text;
  }
}
