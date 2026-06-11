import "server-only";

interface AnthropicCallParams {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
}

const API_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 60_000;

export async function callAnthropic(
  params: AnthropicCallParams
): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 2000,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    // APIキー等の機密を含み得るためレスポンス本文はログのみに留める
    console.error(
      `Anthropic API error: status=${response.status}`,
      await response.text().catch(() => "")
    );
    throw new Error(`Anthropic APIの呼び出しに失敗しました (${response.status})`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const text = data.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");

  if (!text) {
    throw new Error("Anthropic APIから空の応答が返されました");
  }
  return text;
}
