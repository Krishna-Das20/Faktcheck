const BASE_URL = process.env.NVIDIA_API_BASE_URL || "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";

function extractJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
  }
  throw new Error("Model returned invalid JSON");
}

export async function callNvidiaForJson(
  messages: { role: "system" | "user"; content: string }[],
  maxTokens = 1800
) {
  if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not configured");

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      top_p: 0.9,
    }),
  });

  if (!response.ok) throw new Error(`NVIDIA API error (${response.status}): ${await response.text()}`);
  const data = await response.json();
  return extractJson(data?.choices?.[0]?.message?.content || "");
}

export const MCQ_SYSTEM_PROMPT = `You are an expert assessment designer. Return only valid JSON with shape {"mcqs":[{"question":"string","options":[{"text":"string","isCorrect":boolean}],"correctAnswers":[number],"category":"GENERAL|APTITUDE|TECHNICAL|REASONING|ENTREPRENEURSHIP","difficulty":"EASY|MEDIUM|HARD","marks":number,"negativeMarks":number,"explanation":"string","tags":["string"]}]}. Give at least four options and keep correctAnswers consistent with isCorrect.`;

export const CODING_SYSTEM_PROMPT = `You are an expert competitive programming setter. Return only valid JSON with shape {"problem":{"title":"string","description":"string","inputFormat":"string","outputFormat":"string","constraints":["string"],"examples":[{"input":"string","output":"string","explanation":"string"}],"testcases":[{"input":"string","output":"string","hidden":boolean,"points":number}],"category":"GENERAL|DSA|ALGORITHMS|DATABASE|SYSTEM_DESIGN","difficulty":"EASY|MEDIUM|HARD","score":number,"timeLimit":number,"memoryLimit":number,"tags":["string"]}}. Include at least two examples and five testcases.`;
