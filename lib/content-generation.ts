import type { ClientProfile, LibraryArticle } from "./editorial-intelligence";
import type { ContentKind, ContentTone, GeneratedContentOutput } from "./types";

const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:8000";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const CONTENT_KINDS: Array<{
  id: ContentKind;
  label: string;
  description: string;
  needsClient?: boolean;
}> = [
  { id: "linkedin", label: "LinkedIn post", description: "A concise public post with a point of view." },
  { id: "email", label: "Client email", description: "A personalized outreach note.", needsClient: true },
  { id: "thought", label: "Thought leadership", description: "A sharper advisory paragraph." },
  { id: "newsletter", label: "Newsletter paragraph", description: "A polished digest-ready section." },
  { id: "talking", label: "Talking points", description: "A scannable prep list for a call." },
  { id: "investor", label: "Investor blurb", description: "A concise market signal for investors." },
];

export const CONTENT_TONES: ContentTone[] = ["Analytical", "Executive", "Conversational", "Punchy", "Sober", "Visionary"];

export const GENERATED_CONTENT_SCHEMA = {
  name: "generated_content",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "subject", "body", "notes"],
    properties: {
      title: { type: "string" },
      subject: { type: "string" },
      body: { type: "string" },
      notes: { type: "string" },
    },
  },
};

export function isContentKind(value: unknown): value is ContentKind {
  return typeof value === "string" && CONTENT_KINDS.some((kind) => kind.id === value);
}

export function isContentTone(value: unknown): value is ContentTone {
  return typeof value === "string" && CONTENT_TONES.includes(value as ContentTone);
}

export function getContentKindLabel(kind: ContentKind): string {
  return CONTENT_KINDS.find((item) => item.id === kind)?.label || "Generated content";
}

export function buildContentPrompt({
  article,
  kind,
  tone,
  client,
}: {
  article: LibraryArticle;
  kind: ContentKind;
  tone: ContentTone;
  client?: ClientProfile | null;
}): string {
  const kindInstruction = getKindInstruction(kind);
  const clientContext = client
    ? `\nClient context:\nName: ${client.name}\nSector: ${client.sector}\nPriorities: ${client.priorities}\nTopics: ${client.topics.join(", ")}`
    : "";

  return `Create production-ready business content from this AI newsletter article.

Use the requested output type and tone. Be specific, useful, and grounded in the source context. Do not invent facts, numbers, or claims not supported by the article context. Avoid hype.

Output type: ${getContentKindLabel(kind)}
Tone: ${tone}
Instruction: ${kindInstruction}

Article:
Title: ${article.title}
Source: ${article.source}
Category: ${article.category}
Summary: ${article.summary}
Why it matters: ${article.why}
Companies: ${article.companies.join(", ") || "None specified"}
Topics: ${article.topics.join(", ") || "None specified"}
Importance: ${article.importance}
Novelty: ${article.novelty}
Urgency: ${article.urgency}${clientContext}

Return your response as a single valid JSON object with exactly these four fields (no markdown fences, no extra text):
{
  "title": "an internal label for the draft",
  "subject": "email subject when output type is Client email; otherwise an empty string",
  "body": "the final usable draft",
  "notes": "short review guidance for the human operator"
}`;
}

export function parseGeneratedContentOutput(value: unknown): GeneratedContentOutput {
  let normalized: unknown = value;

  // If it's a string, extract JSON from it
  if (typeof value === "string") {
    normalized = extractJsonFromLLM(value);
  } else {
    normalized = normalizeContentOutput(value);
  }

  if (!normalized || typeof normalized !== "object") {
    throw new Error(`Generated content output must be an object, got ${typeof normalized}: ${JSON.stringify(value)?.slice(0, 300)}`);
  }

  const output = normalized as Partial<GeneratedContentOutput>;
  if (typeof output.title !== "string" || typeof output.body !== "string" || typeof output.notes !== "string") {
    throw new Error(`Generated content output is missing required fields. Keys: ${Object.keys(normalized as object).join(", ")}. Raw: ${JSON.stringify(normalized)?.slice(0, 300)}`);
  }

  return {
    title: output.title,
    subject: typeof output.subject === "string" ? output.subject : "",
    body: output.body,
    notes: output.notes,
  };
}

/** Robust JSON extraction — handles fences, embedded objects, missing braces, unescaped newlines */
function extractJsonFromLLM(raw: string): unknown {
  const cleaned = raw.trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }

  const withoutFence = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(withoutFence); } catch { /* continue */ }

  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = withoutFence.slice(firstBrace, lastBrace + 1);
    try { return JSON.parse(slice); } catch { /* continue */ }
    try { return JSON.parse(repairJsonString(slice)); } catch { /* continue */ }
  }

  if (withoutFence.includes('"') && !withoutFence.startsWith("{")) {
    const wrapped = `{${withoutFence}}`;
    try { return JSON.parse(wrapped); } catch { /* continue */ }
    try { return JSON.parse(repairJsonString(wrapped)); } catch { /* continue */ }
  }

  throw new Error(`Could not extract JSON from LLM output: ${raw.slice(0, 200)}`);
}

export async function requestContentGeneration(
  agentApiToken: string,
  params: { article: LibraryArticle; kind: ContentKind; tone: ContentTone; client?: ClientProfile | null },
): Promise<GeneratedContentOutput> {
  const TIMEOUT_MS = 120000;

  const messages = [
    {
      role: "system" as const,
      content: `You are a business content writer. Given an article summary, produce production-ready content. Return ONLY a JSON object (no markdown fences, no extra text):
{"title":"internal label","subject":"email subject or empty string","body":"the final draft","notes":"short review guidance"}`,
    },
    {
      role: "user" as const,
      content: buildContentPrompt(params),
    },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let raw: string;

    if (OPENROUTER_API_KEY) {
      // Use OpenRouter directly
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://newsletter-digest.busibox.app",
          "X-Title": "Newsletter Digest",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages,
          temperature: 0.3,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errorBody = await res.text().catch(() => "no body");
        throw new Error(`OpenRouter failed (${res.status}): ${errorBody.slice(0, 300)}`);
      }
      const data = await res.json();
      raw = stripThinking(data.choices?.[0]?.message?.content || "");
    } else {
      // Fallback to agent-api
      const res = await fetch(`${AGENT_API_URL}/llm/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${agentApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.NEWSLETTER_LLM_MODEL || "fast",
          messages,
          temperature: 0.3,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errorBody = await res.text().catch(() => "no body");
        throw new Error(`LLM completions failed (${res.status}): ${errorBody.slice(0, 300)}`);
      }
      const data = await res.json();
      raw = stripThinking(data.content || "");
    }

    console.log("[ContentGeneration] Raw output length:", raw.length);
    return parseGeneratedContentOutput(raw);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Content generation timed out after ${TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Strip Qwen-style <think>...</think> reasoning from output */
function stripThinking(content: string): string {
  const thinkEnd = content.indexOf("</think>");
  if (thinkEnd !== -1) {
    return content.slice(thinkEnd + 8).trim();
  }
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

// ---------------------------------------------------------------------------
// Output normalization (mirrors summarization.ts pattern)
// ---------------------------------------------------------------------------

function normalizeContentOutput(value: unknown): unknown {
  // Unwrap single-element arrays
  if (Array.isArray(value)) {
    if (value.length === 1) {
      return normalizeContentOutput(value[0]);
    }
    return value;
  }

  // Parse JSON strings (including code-fenced output from the LLM)
  if (typeof value === "string") {
    const trimmed = value.trim();
    const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

    // Try direct parse
    try {
      return normalizeContentOutput(JSON.parse(withoutFence));
    } catch {
      // Try extracting an embedded JSON object
      const embeddedJson = extractJSONObject(withoutFence);
      if (embeddedJson) {
        try {
          return normalizeContentOutput(JSON.parse(embeddedJson));
        } catch {
          // fall through
        }
      }

      // LLM sometimes returns JSON without outer braces: "key": "value", ...
      // Try wrapping in braces
      const cleaned = withoutFence.trim();
      console.log("[ContentGeneration] extractJSONObject returned:", embeddedJson ? "non-null" : "null");
      console.log("[ContentGeneration] cleaned startsWith quote:", cleaned.startsWith('"'), "startsWith brace:", cleaned.startsWith('{'));
      console.log("[ContentGeneration] cleaned first 80:", JSON.stringify(cleaned.slice(0, 80)));
      console.log("[ContentGeneration] cleaned last 80:", JSON.stringify(cleaned.slice(-80)));

      // Strategy 1: wrap in braces if it looks like key-value pairs
      if (cleaned.startsWith('"') && !cleaned.startsWith('{')) {
        const wrapped = `{${cleaned}}`;
        try {
          return normalizeContentOutput(JSON.parse(wrapped));
        } catch (wrapError) {
          console.log("[ContentGeneration] Brace-wrap failed:", (wrapError as Error).message);
          // Try to repair: escape unescaped newlines inside string values
          const repaired = repairJsonString(wrapped);
          console.log("[ContentGeneration] Repaired first 200:", JSON.stringify(repaired.slice(0, 200)));
          console.log("[ContentGeneration] Repaired last 200:", JSON.stringify(repaired.slice(-200)));
          try {
            return normalizeContentOutput(JSON.parse(repaired));
          } catch (repairError) {
            console.log("[ContentGeneration] Repair+parse also failed:", (repairError as Error).message);
          }
        }
      }

      // Strategy 2: even if it doesn't start with quote, try wrapping
      {
        const wrapped = cleaned.startsWith('{') ? cleaned : `{${cleaned}}`;
        const repaired = repairJsonString(wrapped);
        try {
          return normalizeContentOutput(JSON.parse(repaired));
        } catch (e) {
          console.log("[ContentGeneration] Final repair attempt failed:", (e as Error).message);
        }
      }

      // Return the string as-is — caller will handle validation error
      return value;
    }
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  // Unwrap known wrapper keys
  const record = value as Record<string, unknown>;
  const wrapperKeys = ["output", "data", "result", "response", "content", "generated_content"];
  for (const key of wrapperKeys) {
    if (key in record && record[key] !== value) {
      const candidate = normalizeContentOutput(record[key]);
      if (candidate && typeof candidate === "object" && hasRequiredContentFields(candidate)) {
        return candidate;
      }
      if (candidate && typeof candidate === "object" && candidate !== record[key]) {
        return candidate;
      }
    }
  }

  return value;
}

function extractJSONObject(value: string): string | null {
  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");

  // Normal case: found { and }
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return value.slice(firstBrace, lastBrace + 1);
  }

  // LLM sometimes omits the outer braces — try wrapping the string
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && (trimmed.endsWith('"') || trimmed.endsWith("}"))) {
    const candidate = `{${trimmed}}`;
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Not valid even with braces
    }
  }

  return null;
}

function hasRequiredContentFields(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const output = value as Partial<GeneratedContentOutput>;
  return (
    typeof output.title === "string" &&
    typeof output.body === "string" &&
    typeof output.notes === "string"
  );
}

/**
 * Attempt to repair JSON with unescaped newlines inside string values.
 * LLMs frequently produce JSON where newlines inside strings are not escaped.
 */
function repairJsonString(input: string): string {
  // Replace literal newlines that appear inside JSON string values with \n
  // Strategy: process character by character tracking whether we're inside a string
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString && char === "\n") {
      result += "\\n";
      continue;
    }

    if (inString && char === "\r") {
      result += "\\r";
      continue;
    }

    if (inString && char === "\t") {
      result += "\\t";
      continue;
    }

    result += char;
  }

  return result;
}

function getKindInstruction(kind: ContentKind): string {
  switch (kind) {
    case "email":
      return "Write a short client email with a relevant subject line, a clear reason for sharing, and one low-friction next step.";
    case "thought":
      return "Write one polished thought-leadership section with a clear thesis, business implication, and grounded closing line.";
    case "newsletter":
      return "Write a digest paragraph that can be dropped into an executive newsletter, with context and practical implication.";
    case "talking":
      return "Write concise talking points for a meeting. Use bullets and include the strongest client-facing angle.";
    case "investor":
      return "Write a compact investor-oriented market signal with why it matters and what to watch next.";
    case "linkedin":
    default:
      return "Write a LinkedIn post with a strong opening, useful analysis, and a restrained close. No hashtags unless genuinely useful.";
  }
}
