import "server-only";

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

export async function callGemini(params: GeminiCallParams): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // APIキーはクエリ文字列ではなくヘッダーで送る(アクセスログ等への漏えい防止)
      "x-goog-api-key": params.apiKey,
    },
    body: JSON.stringify({
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
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    // 原因特定のためエラー詳細はサーバーログにのみ出力する(キーは含まれない)
    console.error(
      `Gemini API error: status=${response.status} model=${params.model}`,
      await response.text().catch(() => "")
    );
    throw new Error(`Gemini APIの呼び出しに失敗しました (${response.status})`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini APIから空の応答が返されました");
  }
  return text;
}
