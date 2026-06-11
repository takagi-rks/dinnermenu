import "server-only";

interface OpenAICallParams {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}

interface OpenAIResponse {
  choices: { message?: { content?: string | null } }[];
}

const API_URL = "https://api.openai.com/v1/chat/completions";
const TIMEOUT_MS = 60_000;

export async function callOpenAI(params: OpenAICallParams): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    console.error(
      `OpenAI API error: status=${response.status}`,
      await response.text().catch(() => "")
    );
    throw new Error(`OpenAI APIの呼び出しに失敗しました (${response.status})`);
  }

  const data = (await response.json()) as OpenAIResponse;
  const text = data.choices[0]?.message?.content;

  if (!text) {
    throw new Error("OpenAI APIから空の応答が返されました");
  }
  return text;
}
