import type { ClientProfile, LibraryArticle } from "./editorial-intelligence";
import type { ContentKind, ContentTone, GeneratedContentOutput } from "./types";

const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:8000";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const CONTENT_AGENT_NAME = process.env.CONTENT_GENERATOR_AGENT_NAME || "content-generator";
const CONTENT_AGENT_TIER = process.env.CONTENT_GENERATOR_AGENT_TIER || "complex";

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
  articles,
  kind,
  tone,
  client,
}: {
  articles: LibraryArticle[];
  kind: ContentKind;
  tone: ContentTone;
  client?: ClientProfile | null;
}): string {
  const clientContext = client
    ? `\nFor client: ${client.name} (${client.sector})\nWhat they care about: ${client.priorities}\nTopics they track: ${client.topics.join(", ")}`
    : "";

  const kindInstruction = getKindInstruction(kind);

  if (articles.length === 1) {
    const article = articles[0];
    return `${kindInstruction} Tone: ${tone}.${clientContext}

Article: ${article.title}
Source: ${article.source}
Summary: ${article.summary}
Why it matters: ${article.why}
${article.companies.length ? `Companies mentioned: ${article.companies.join(", ")}` : ""}
${article.topics.length ? `Topics: ${article.topics.join(", ")}` : ""}`.trim();
  }

  const articleBlocks = articles
    .map(
      (article, i) => `Article ${i + 1}: ${article.title}
Source: ${article.source}
Summary: ${article.summary}
Why it matters: ${article.why}
${article.companies.length ? `Companies mentioned: ${article.companies.join(", ")}` : ""}
${article.topics.length ? `Topics: ${article.topics.join(", ")}` : ""}`,
    )
    .join("\n\n");

  return `Write a single ${getContentKindLabel(kind)} in a ${tone} tone that synthesizes the ${articles.length} articles below into one unified post.${clientContext}

Rules:
- Do NOT summarize each article separately — find the connective thread across all of them
- Weave their perspectives together: where they agree, where they differ, what the combined picture reveals
- The output is ONE piece of content, not a list

${articleBlocks}`;
}

export function parseGeneratedContentOutput(value: unknown): GeneratedContentOutput {
  let normalized: unknown = value;

  // If it's a string, normalize it through the same robust wrapper repair path
  // used for agent output objects.
  if (typeof value === "string") {
    normalized = normalizeContentOutput(value);
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
  if (!isUsefulGeneratedText(output.title) || !isUsefulGeneratedText(output.body) || !isUsefulGeneratedText(output.notes)) {
    throw new Error(`Generated content output contains placeholder or empty fields. Raw: ${JSON.stringify(normalized)?.slice(0, 300)}`);
  }

  return {
    title: output.title,
    subject: typeof output.subject === "string" ? output.subject : "",
    body: output.body,
    notes: output.notes,
  };
}

/**
 * Robust JSON extraction. Handles:
 * - <think>...</think> tags (Qwen/DeepSeek)
 * - Plain "Thinking Process:" preambles with arbitrary {/} in the thinking text
 * - Markdown code fences anywhere in the string
 * - Unescaped newlines inside string values
 * - JSON appearing anywhere in the output (before or after extra text)
 */
function extractJsonFromLLM(raw: string): unknown {
  // Strip all forms of thinking output
  const deThought = stripThinking(raw);

  // Strip a single outer code fence if the whole string is wrapped
  const withoutFence = deThought
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // Try the entire cleaned string first
  try { return JSON.parse(withoutFence); } catch { /* continue */ }
  try { return JSON.parse(repairJsonString(withoutFence)); } catch { /* continue */ }

  // Find every properly-bounded JSON object in the string using string-aware
  // brace matching. Try them from LAST to FIRST — thinking preambles always
  // appear before the final JSON output.
  const candidates = findAllJsonObjects(withoutFence);
  for (let i = candidates.length - 1; i >= 0; i--) {
    const c = candidates[i];
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch { /* continue */ }
    try {
      const parsed = JSON.parse(repairJsonString(c));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch { /* continue */ }
  }

  throw new Error(`Could not extract JSON from LLM output: ${raw.slice(0, 200)}`);
}

/**
 * Walk the string character-by-character, respecting string literals, and
 * return every complete top-level JSON object found.
 */
function findAllJsonObjects(text: string): string[] {
  const results: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "{") { i++; continue; }
    let depth = 0;
    let inStr = false;
    let esc = false;
    let j = i;
    let closed = false;
    while (j < text.length) {
      const ch = text[j];
      if (esc) { esc = false; }
      else if (ch === "\\" && inStr) { esc = true; }
      else if (ch === '"') { inStr = !inStr; }
      else if (!inStr) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) { closed = true; break; }
        }
      }
      j++;
    }
    if (closed) {
      results.push(text.slice(i, j + 1));
      i = j + 1;
    } else {
      i++;
    }
  }
  return results;
}

export async function requestContentGeneration(
  agentApiToken: string,
  params: { articles: LibraryArticle[]; kind: ContentKind; tone: ContentTone; client?: ClientProfile | null },
): Promise<GeneratedContentOutput> {
  const TIMEOUT_MS = 120000;
  const prompt = buildContentPrompt(params);

  // Prefer the registered BusiBox agent first. In production the model is
  // configured in the Busibox portal, while app-level LLM env vars may be empty.
  try {
    console.log("[ContentGeneration] Using BusiBox agent:", CONTENT_AGENT_NAME, "tier:", CONTENT_AGENT_TIER);
    const agentPrompt = `Return ONLY a JSON object with these four fields — no markdown, no extra text:
{"title":"short specific label","subject":"email subject or empty string","body":"full generated draft text","notes":"one useful editorial note"}

Do not return placeholders such as "...". The body must contain the complete generated content.

${prompt}`;
    return await invokeContentGeneratorAgent(agentApiToken, agentPrompt, TIMEOUT_MS);
  } catch (agentError) {
    console.warn("[ContentGeneration] Agent invocation failed, trying direct LLM fallback:",
      agentError instanceof Error ? agentError.message : String(agentError));
  }

  try {
    return await directLLMGenerate(agentApiToken, params, TIMEOUT_MS);
  } catch (llmError) {
    console.warn("[ContentGeneration] Direct LLM failed, trying local model fallback:",
      llmError instanceof Error ? llmError.message : String(llmError));
  }

  return await localModelFallback(agentApiToken, prompt, TIMEOUT_MS);
}

async function invokeContentGeneratorAgent(
  token: string,
  prompt: string,
  timeoutMs: number,
): Promise<GeneratedContentOutput> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${AGENT_API_URL}/runs/invoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_name: CONTENT_AGENT_NAME,
        agent_tier: CONTENT_AGENT_TIER,
        input: { prompt },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "no body");
      throw new Error(`Agent invocation failed (${res.status}): ${errorBody.slice(0, 300)}`);
    }

    const data = await res.json();
    console.log("[ContentGeneration] Agent response status:", data.status);

    if (data.status === "failed" || data.error) {
      throw new Error(`Agent run failed: ${data.error || "unknown error"}`);
    }
    if (!data.output) {
      throw new Error("Agent returned no output");
    }

    return parseGeneratedContentOutput(data.output);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Agent invocation timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function directLLMGenerate(
  agentApiToken: string,
  params: { articles: LibraryArticle[]; kind: ContentKind; tone: ContentTone; client?: ClientProfile | null },
  timeoutMs: number,
): Promise<GeneratedContentOutput> {
  const messages = [
    {
      role: "system" as const,
      content: `You write business content that sounds like a smart, well-read person wrote it — not an AI. Be specific, use the article's actual facts and figures, and skip hollow phrases.

IMPORTANT: Do NOT include any thinking, analysis, or step-by-step reasoning. Output ONLY the JSON object.

Return a JSON object with fields: title (short label), subject (email subject or empty string), body (the FULL written content — this is the main output), notes (one editorial note). No markdown fences.`,
    },
    {
      role: "user" as const,
      content: buildContentPrompt(params),
    },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let raw: string | null = null;

    if (ANTHROPIC_API_KEY) {
      try {
        raw = await anthropicGenerate(messages, controller.signal);
      } catch (e) {
        console.warn("[ContentGeneration] Anthropic failed, falling through:",
          e instanceof Error ? e.message : String(e));
      }
    }

    if (OPENROUTER_API_KEY) {
      try {
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
            max_tokens: 4096,
          }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          raw = stripThinking(data.choices?.[0]?.message?.content || "");
        } else {
          console.warn("[ContentGeneration] OpenRouter failed, falling through to agent-api:", res.status);
        }
      } catch (e) {
        console.warn("[ContentGeneration] OpenRouter error, falling through to agent-api:", e instanceof Error ? e.message : String(e));
      }
    }

    if (!raw) {
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
          max_tokens: 4096,
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

    console.log("[ContentGeneration] Direct LLM output length:", raw.length);
    return parseGeneratedContentOutput(raw);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Content generation timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function anthropicGenerate(
  messages: Array<{ role: "system" | "user"; content: string }>,
  signal: AbortSignal,
): Promise<string> {
  const systemPrompt = messages.find((message) => message.role === "system")?.content || "";
  const userPrompt = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n\n");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    signal,
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "no body");
    throw new Error(`Anthropic ${res.status}: ${errorBody.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = Array.isArray(data.content)
    ? data.content
        .filter((part: { type?: string; text?: string }) => part?.type === "text" && typeof part.text === "string")
        .map((part: { text: string }) => part.text)
        .join("\n")
    : "";

  return stripThinking(text);
}

async function localModelFallback(
  agentApiToken: string,
  prompt: string,
  timeoutMs: number,
): Promise<GeneratedContentOutput> {
  console.log("[ContentGeneration] Using local model fallback via agent-api");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${AGENT_API_URL}/llm/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agentApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.NEWSLETTER_LLM_MODEL || "fast",
        messages: [
          {
            role: "system",
            content: `You write business content. Do NOT include any thinking or reasoning — output ONLY a JSON object with fields: title (short label), subject (email subject or empty string), body (the FULL written content), notes (one editorial note). No markdown fences.`,
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "no body");
      throw new Error(`Local model fallback failed (${res.status}): ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const raw = stripThinking(data.content || "");
    return parseGeneratedContentOutput(raw);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Local model fallback timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function stripThinking(content: string): string {
  let text = content;

  // Strip <think>...</think> and <thinking>...</thinking> (Qwen/DeepSeek)
  const thinkEndTag = text.match(/<\/think(?:ing)?>/i);
  if (thinkEndTag && thinkEndTag.index !== undefined) {
    text = text.slice(thinkEndTag.index + thinkEndTag[0].length);
  } else {
    text = text.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "");
  }

  // Strip plain-text thinking preambles (no end marker — find first valid JSON `{`).
  // Matches: "Thinking Process:", "**Thinking", "Step 1:", numbered analysis, etc.
  const stripped = text.trim();
  if (/^(?:\*{0,2}thinking|step\s*\d[:.)]|#+\s|1\.\s|\*\*analyze)/i.test(stripped)) {
    const braceIdx = stripped.indexOf("{");
    if (braceIdx > 0) {
      text = stripped.slice(braceIdx);
    }
  }

  return text.trim();
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
      // Try extracting the last JSON object (thinking preambles come first)
      const candidates = findAllJsonObjects(withoutFence);
      for (let ci = candidates.length - 1; ci >= 0; ci--) {
        try { return normalizeContentOutput(JSON.parse(candidates[ci])); } catch { /* continue */ }
        try { return normalizeContentOutput(JSON.parse(repairJsonString(candidates[ci]))); } catch { /* continue */ }
      }

      // LLM sometimes returns prose/thinking followed by JSON-ish fields.
      const cleaned = withoutFence.trim();
      const jsonishStart = findJsonishObjectStart(cleaned);
      const jsonish = jsonishStart > 0 ? cleaned.slice(jsonishStart).trim() : cleaned;

      // Strategy 1: agent runner omitted only the opening brace.
      if (jsonish.startsWith('"') && !jsonish.startsWith("{") && jsonish.endsWith("}")) {
        const wrapped = `{${jsonish}`;
        try {
          return normalizeContentOutput(JSON.parse(wrapped));
        } catch {
          const repaired = repairJsonString(wrapped);
          try { return normalizeContentOutput(JSON.parse(repaired)); } catch { /* continue */ }
        }
      }

      // Strategy 2: agent runner omitted the opening brace and the first quote.
      // Example: title":"...","subject":"",...}
      if (/^[A-Za-z_][\w-]*":/.test(jsonish) && jsonish.endsWith("}")) {
        const wrapped = `{"${jsonish}`;
        try {
          return normalizeContentOutput(JSON.parse(wrapped));
        } catch {
          const repaired = repairJsonString(wrapped);
          try { return normalizeContentOutput(JSON.parse(repaired)); } catch { /* continue */ }
        }
      }

      // Strategy 3: agent runner omitted only the closing brace.
      if (jsonish.startsWith("{") && !jsonish.endsWith("}")) {
        const wrapped = `${jsonish}}`;
        try {
          return normalizeContentOutput(JSON.parse(wrapped));
        } catch {
          const repaired = repairJsonString(wrapped);
          try { return normalizeContentOutput(JSON.parse(repaired)); } catch { /* continue */ }
        }
      }

      // Strategy 4: wrap in braces if it looks like key-value pairs.
      if (jsonish.startsWith('"') && !jsonish.startsWith("{")) {
        const wrapped = `{${jsonish}}`;
        try {
          return normalizeContentOutput(JSON.parse(wrapped));
        } catch {
          const repaired = repairJsonString(wrapped);
          try { return normalizeContentOutput(JSON.parse(repaired)); } catch { /* continue */ }
        }
      }

      // Strategy 5: even if it doesn't start with quote, try wrapping.
      {
        const wrapped = jsonish.startsWith("{") ? jsonish : `{${jsonish}}`;
        try { return normalizeContentOutput(JSON.parse(repairJsonString(wrapped))); } catch { /* continue */ }
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

function findJsonishObjectStart(text: string): number {
  const patterns = [
    /{\s*"title"\s*:/i,
    /"title"\s*:/i,
    /\btitle"\s*:/i,
    /{\s*"subject"\s*:/i,
  ];

  let best = -1;
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.index !== undefined && (best === -1 || match.index < best)) {
      best = match.index;
    }
  }
  return best;
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

function isUsefulGeneratedText(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (/^[.\s_-]+$/.test(normalized)) return false;
  if (["...", "n/a", "none", "null", "undefined"].includes(normalized)) return false;
  return normalized.replace(/[^a-z0-9]/gi, "").length >= 3;
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
