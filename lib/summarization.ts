import type { NewsletterEmail, SummaryFormat, SummaryOutput, TopicSegment, TopicSummary } from "./types";

export const DEFAULT_SUMMARY_FORMAT: SummaryFormat = "bullet_points";

export const SUMMARY_FORMAT_OPTIONS: Array<{
  id: SummaryFormat;
  title: string;
  description: string;
  preview: string[];
}> = [
  {
    id: "bullet_points",
    title: "Bullet Points",
    description: "Concise, scan-friendly summaries",
    preview: ["Key news summarized in short points", "Easy to scan and digest", "Perfect for quick updates"],
  },
  {
    id: "executive_summary",
    title: "Executive Summary",
    description: "Brief paragraph format",
    preview: ["One crisp business paragraph", "Clear context and implication", "Written for senior operators"],
  },
  {
    id: "key_insights",
    title: "Key Insights",
    description: "Highlight main takeaways",
    preview: ["Top takeaways ranked by importance", "Why it matters for the business", "Signals worth watching next"],
  },
  {
    id: "full_digest",
    title: "Full Digest",
    description: "Comprehensive summary format",
    preview: ["Full narrative digest", "Key points plus action items", "Best for deep review sessions"],
  },
];

export function isSummaryFormat(value: unknown): value is SummaryFormat {
  return typeof value === "string" && SUMMARY_FORMAT_OPTIONS.some((option) => option.id === value);
}

export function getSummaryFormatOption(format: SummaryFormat = DEFAULT_SUMMARY_FORMAT) {
  return SUMMARY_FORMAT_OPTIONS.find((option) => option.id === format) || SUMMARY_FORMAT_OPTIONS[0];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Fallback to agent-api if no OpenRouter key
const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:8000";
const LLM_MODEL = process.env.NEWSLETTER_LLM_MODEL || "fast";
const LLM_CLASSIFY_MODEL = process.env.NEWSLETTER_LLM_CLASSIFY_MODEL || "fast";
const SUMMARY_TIMEOUT_MS = Number(process.env.NEWSLETTER_SUMMARY_TIMEOUT_MS || 120000);
const MAX_SUMMARY_INPUT_CHARS = Number(process.env.NEWSLETTER_SUMMARY_INPUT_CHARS || 3200);

// ---------------------------------------------------------------------------
// Direct LLM completions call (bypasses broken agent framework)
// ---------------------------------------------------------------------------

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMCompletionResponse {
  model: string;
  content: string;
  usage: { completion_tokens: number; prompt_tokens: number; total_tokens: number };
  finish_reason: string;
}

async function llmComplete(
  token: string,
  messages: LLMMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
): Promise<string> {
  // Use OpenRouter if key is available, otherwise fall back to agent-api
  if (OPENROUTER_API_KEY) {
    return llmCompleteOpenRouter(messages, opts);
  }
  return llmCompleteAgentApi(token, messages, opts);
}

async function llmCompleteOpenRouter(
  messages: LLMMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? SUMMARY_TIMEOUT_MS);

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
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 2000,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "no body");
      throw new Error(`OpenRouter failed (${res.status}): ${errorBody.slice(0, 300)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    return stripThinking(content);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`OpenRouter request timed out after ${opts.timeoutMs ?? SUMMARY_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function llmCompleteAgentApi(
  token: string,
  messages: LLMMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? SUMMARY_TIMEOUT_MS);

  try {
    const res = await fetch(`${AGENT_API_URL}/llm/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model ?? LLM_MODEL,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 2000,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "no body");
      throw new Error(`LLM completions failed (${res.status}): ${errorBody.slice(0, 300)}`);
    }

    const data: LLMCompletionResponse = await res.json();
    return stripThinking(data.content || "");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`LLM request timed out after ${opts.timeoutMs ?? SUMMARY_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Strip LLM thinking/reasoning from output — handles multiple formats */
function stripThinking(content: string): string {
  let result = content;

  // Format 1: <think>...</think> tags (Qwen-style)
  const thinkEnd = result.indexOf("</think>");
  if (thinkEnd !== -1) {
    result = result.slice(thinkEnd + 8).trim();
  }
  result = result.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // Format 2: "Thinking Process:" followed by content until JSON starts
  // Find the first JSON structure after any thinking text
  const jsonStart = findJsonStart(result);
  if (jsonStart > 0) {
    result = result.slice(jsonStart).trim();
  }

  return result;
}

/** Find the index where JSON data starts (first [ or {) */
function findJsonStart(content: string): number {
  // Look for the first { or [ that's likely JSON (not inside a sentence)
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "[" || content[i] === "{") {
      // Verify this looks like the start of JSON (next non-whitespace is " or { or [)
      const rest = content.slice(i);
      try {
        JSON.parse(rest);
        return i;
      } catch {
        // Try to find a complete JSON object/array ending
        if (content[i] === "[") {
          const lastBracket = content.lastIndexOf("]");
          if (lastBracket > i) {
            try {
              JSON.parse(content.slice(i, lastBracket + 1));
              return i;
            } catch { /* continue */ }
          }
        }
        if (content[i] === "{") {
          const lastBrace = content.lastIndexOf("}");
          if (lastBrace > i) {
            try {
              JSON.parse(content.slice(i, lastBrace + 1));
              return i;
            } catch { /* continue */ }
          }
        }
      }
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// JSON extraction from LLM output (robust)
// ---------------------------------------------------------------------------

function extractJsonFromLLM(raw: string): unknown {
  const cleaned = raw.trim();

  // Try direct parse
  try { return JSON.parse(cleaned); } catch { /* continue */ }

  // Strip markdown fences
  const withoutFence = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(withoutFence); } catch { /* continue */ }

  // Extract {…} block
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = withoutFence.slice(firstBrace, lastBrace + 1);
    try { return JSON.parse(slice); } catch { /* continue */ }
    // Repair unescaped newlines
    try { return JSON.parse(repairJsonString(slice)); } catch { /* continue */ }
  }

  // Extract [{…}] array block
  const firstBracket = withoutFence.indexOf("[");
  const lastBracket = withoutFence.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const slice = withoutFence.slice(firstBracket, lastBracket + 1);
    try { return JSON.parse(slice); } catch { /* continue */ }
    try { return JSON.parse(repairJsonString(slice)); } catch { /* continue */ }
  }

  // Try wrapping in braces (LLM omits outer {})
  if (withoutFence.includes('"') && !withoutFence.startsWith("{")) {
    const wrapped = `{${withoutFence}}`;
    try { return JSON.parse(wrapped); } catch { /* continue */ }
    try { return JSON.parse(repairJsonString(wrapped)); } catch { /* continue */ }
  }

  throw new Error(`Could not extract JSON from LLM output: ${raw.slice(0, 200)}`);
}

function repairJsonString(input: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (escaped) { result += char; escaped = false; continue; }
    if (char === "\\") { result += char; escaped = true; continue; }
    if (char === '"') { inString = !inString; result += char; continue; }
    if (inString && char === "\n") { result += "\\n"; continue; }
    if (inString && char === "\r") { result += "\\r"; continue; }
    if (inString && char === "\t") { result += "\\t"; continue; }
    result += char;
  }

  return result;
}

// ---------------------------------------------------------------------------
// STEP 1: Topic classification
// ---------------------------------------------------------------------------

async function classifyTopics(
  token: string,
  email: NewsletterEmail,
): Promise<TopicSegment[]> {
  const preparedText = prepareNewsletterTextForSummary(email.bodyPlainText);

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `You classify newsletter topics. Output ONLY a JSON array. No explanations.

Example input: "Apple released M5 chip. Google launched Gemini 3. Amazon cut AWS prices."
Example output: [{"topic":"Apple M5","headline":"Apple releases M5 chip","textSlice":"Apple released M5 chip."},{"topic":"Google Gemini","headline":"Google launched Gemini 3","textSlice":"Google launched Gemini 3."},{"topic":"AWS Pricing","headline":"Amazon cut AWS prices","textSlice":"Amazon cut AWS prices."}]

Rules: max 5 topics, use actual text from newsletter for textSlice, keep topic labels 2-4 words.`,
    },
    {
      role: "user",
      content: `Sender: ${email.senderName || email.senderEmail}
Subject: ${email.subject}

${preparedText}`,
    },
  ];

  const raw = await llmComplete(token, messages, { model: LLM_CLASSIFY_MODEL, maxTokens: 1500 });
  console.log("[Summarize:Step1] Topic classification raw length:", raw.length);

  try {
    const parsed = extractJsonFromLLM(raw);
    const topics = Array.isArray(parsed) ? parsed : [parsed];
    return topics.slice(0, 5).map((t: Record<string, unknown>) => ({
      topic: String(t.topic || "General"),
      headline: String(t.headline || email.subject),
      textSlice: String(t.textSlice || preparedText.slice(0, 500)),
    }));
  } catch (error) {
    console.error("[Summarize:Step1] Topic classification failed, using single topic:", error);
    // Fallback: treat entire newsletter as one topic
    return [{
      topic: "Newsletter Update",
      headline: email.subject,
      textSlice: preparedText,
    }];
  }
}

// ---------------------------------------------------------------------------
// STEP 2: Summarize a single topic segment
// ---------------------------------------------------------------------------

async function summarizeTopic(
  token: string,
  segment: TopicSegment,
  email: NewsletterEmail,
  format: SummaryFormat,
): Promise<TopicSummary> {
  const formatInstruction = getFormatInstruction(format);

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `You summarize newsletter topics for busy operators. Output ONLY a JSON object. No explanations.

Example output: {"topic":"AI Safety","headline":"US-China agree on AI safety protocol","tldr":"The US and China signed a formal AI safety agreement at the Beijing summit, establishing rules to prevent misuse of frontier AI models.","keyPoints":[{"point":"Bilateral safety protocol signed","importance":"high"},{"point":"Focuses on preventing non-state actor access","importance":"medium"}],"actionItems":[{"action":"Review protocol implications for AI compliance","urgency":"medium"}],"sentiment":"positive"}

Rules: ${formatInstruction} Max 4 keyPoints, 2 actionItems. Use concrete facts, not generic commentary.`,
    },
    {
      role: "user",
      content: `Topic: ${segment.topic}
Headline: ${segment.headline}
Source: ${email.senderName || email.senderEmail}

${segment.textSlice}`,
    },
  ];

  const raw = await llmComplete(token, messages, { model: LLM_MODEL, maxTokens: 1000 });
  console.log("[Summarize:Step2] Topic summary raw length:", raw.length, "for topic:", segment.topic);

  try {
    const parsed = extractJsonFromLLM(raw) as Record<string, unknown>;
    return {
      topic: String(parsed.topic || segment.topic),
      headline: String(parsed.headline || segment.headline),
      tldr: String(parsed.tldr || ""),
      keyPoints: Array.isArray(parsed.keyPoints)
        ? parsed.keyPoints.slice(0, 4).map((kp: Record<string, unknown>) => ({
            point: String(kp.point || ""),
            importance: validateImportance(kp.importance),
          }))
        : [{ point: segment.headline, importance: "medium" as const }],
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems.slice(0, 2).map((ai: Record<string, unknown>) => ({
            action: String(ai.action || ""),
            urgency: validateUrgency(ai.urgency),
          }))
        : [],
      sentiment: validateSentiment(parsed.sentiment),
    };
  } catch (error) {
    console.error("[Summarize:Step2] Topic summary parse failed, using text fallback:", error);
    return {
      topic: segment.topic,
      headline: segment.headline,
      tldr: segment.textSlice.slice(0, 300),
      keyPoints: [{ point: segment.headline, importance: "medium" }],
      actionItems: [],
      sentiment: "neutral",
    };
  }
}

function validateImportance(val: unknown): "high" | "medium" | "low" {
  if (val === "high" || val === "medium" || val === "low") return val;
  return "medium";
}

function validateUrgency(val: unknown): "high" | "medium" | "low" | "none" {
  if (val === "high" || val === "medium" || val === "low" || val === "none") return val;
  return "none";
}

function validateSentiment(val: unknown): "positive" | "neutral" | "negative" | "mixed" {
  if (val === "positive" || val === "neutral" || val === "negative" || val === "mixed") return val;
  return "neutral";
}

// ---------------------------------------------------------------------------
// Main 2-step pipeline
// ---------------------------------------------------------------------------

export async function requestNewsletterSummary(
  agentApiToken: string,
  email: NewsletterEmail,
  format: SummaryFormat = DEFAULT_SUMMARY_FORMAT,
): Promise<SummaryOutput> {
  console.log("[Summarize] Single-step summarization for:", email.subject);

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `You are a newsletter analyst for busy executives. Summarize newsletters into structured JSON. Output ONLY a valid JSON object — no markdown fences, no explanations.`,
    },
    {
      role: "user",
      content: buildSummaryPrompt(email, format),
    },
  ];

  const raw = await llmComplete(agentApiToken, messages, {
    model: LLM_MODEL,
    maxTokens: 2000,
    timeoutMs: 120000,
  });
  console.log("[Summarize] Raw output length:", raw.length);

  return parseSummaryOutput(raw);
}

function combineSummaries(
  topicSummaries: TopicSummary[],
  email: NewsletterEmail,
  _format: SummaryFormat,
): SummaryOutput {
  if (topicSummaries.length === 0) {
    return buildFallbackSummary(email, _format);
  }

  const lead = topicSummaries[0];

  // Title: use the lead headline
  const title = lead.headline || email.subject;

  // TLDR: combine first topic's tldr with a brief mention of other topics
  let tldr = lead.tldr;
  if (topicSummaries.length > 1) {
    const otherTopics = topicSummaries.slice(1).map((ts) => ts.topic).join(", ");
    tldr += ` Also covers: ${otherTopics}.`;
  }

  // Key points: gather from all topics, prioritize lead topic
  const keyPoints: SummaryOutput["keyPoints"] = [];
  for (const ts of topicSummaries) {
    for (const kp of ts.keyPoints) {
      keyPoints.push(kp);
    }
  }

  // Action items: gather from all topics
  const actionItems: SummaryOutput["actionItems"] = [];
  for (const ts of topicSummaries) {
    for (const ai of ts.actionItems) {
      actionItems.push(ai);
    }
  }

  // Topics: collect all topic labels
  const topics = topicSummaries.map((ts) => ts.topic);

  // Sentiment: majority vote, fallback to lead
  const sentimentCounts = new Map<string, number>();
  for (const ts of topicSummaries) {
    sentimentCounts.set(ts.sentiment, (sentimentCounts.get(ts.sentiment) || 0) + 1);
  }
  const sentiment = [...sentimentCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || lead.sentiment;

  return {
    title,
    tldr,
    keyPoints: keyPoints.slice(0, 6),
    actionItems: actionItems.slice(0, 5),
    sentiment: sentiment as SummaryOutput["sentiment"],
    topics,
    readTimeMinutes: Math.max(1, Math.min(12, Math.ceil(email.bodyLengthChars / 900))),
  };
}

// ---------------------------------------------------------------------------
// Format instructions
// ---------------------------------------------------------------------------

function getFormatInstruction(format: SummaryFormat): string {
  switch (format) {
    case "executive_summary":
      return "Write the TLDR as a polished executive paragraph. Keep key points to only the strategic support underneath it.";
    case "key_insights":
      return "Prioritize the strongest takeaways, business implications, and signals to watch. Key points should read like insights, not generic bullets.";
    case "full_digest":
      return "Produce a comprehensive digest with a richer TLDR, detailed key points, and any useful action items.";
    case "bullet_points":
    default:
      return "Make the output concise and highly scannable. Key points should be short, direct bullets.";
  }
}

// ---------------------------------------------------------------------------
// Legacy parsing (kept for backward compatibility)
// ---------------------------------------------------------------------------

export function parseSummaryOutput(value: unknown): SummaryOutput {
  const normalized = normalizeSummaryValue(value);

  if (!normalized || typeof normalized !== "object") {
    throw new Error("Summary output must be an object");
  }
  const output = normalized as Partial<SummaryOutput>;
  if (
    typeof output.title !== "string" ||
    typeof output.tldr !== "string" ||
    !Array.isArray(output.keyPoints) ||
    !Array.isArray(output.actionItems) ||
    !Array.isArray(output.topics) ||
    typeof output.readTimeMinutes !== "number"
  ) {
    throw new Error("Summary output is missing required fields");
  }
  const sentiment = output.sentiment;
  if (!sentiment || !["positive", "neutral", "negative", "mixed"].includes(sentiment)) {
    throw new Error("Summary output has invalid sentiment");
  }
  return output as SummaryOutput;
}

/** Recursively unwrap wrapper keys, arrays, and JSON strings */
function normalizeSummaryValue(value: unknown): unknown {
  if (Array.isArray(value) && value.length === 1) return normalizeSummaryValue(value[0]);

  if (typeof value === "string") {
    try { return extractJsonFromLLM(value); } catch { return value; }
  }

  if (!value || typeof value !== "object") return value;

  // Check if this object itself has the required fields
  const record = value as Record<string, unknown>;
  if (hasSummaryFields(record)) return record;

  // Unwrap known wrapper keys
  const wrapperKeys = ["output", "data", "result", "response", "summary", "newsletter_summary", "content"];
  for (const key of wrapperKeys) {
    if (key in record && record[key] !== value) {
      const candidate = normalizeSummaryValue(record[key]);
      if (candidate && typeof candidate === "object" && hasSummaryFields(candidate as Record<string, unknown>)) {
        return candidate;
      }
      if (candidate && typeof candidate === "object" && candidate !== record[key]) {
        return candidate;
      }
    }
  }

  return value;
}

function hasSummaryFields(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.title === "string" &&
    typeof obj.tldr === "string" &&
    Array.isArray(obj.keyPoints) &&
    Array.isArray(obj.actionItems) &&
    Array.isArray(obj.topics) &&
    typeof obj.readTimeMinutes === "number"
  );
}

// ---------------------------------------------------------------------------
// Fallback summary (no LLM required)
// ---------------------------------------------------------------------------

export function buildFallbackSummary(
  email: NewsletterEmail,
  format: SummaryFormat = DEFAULT_SUMMARY_FORMAT,
): SummaryOutput {
  const preparedText = prepareNewsletterTextForSummary(email.bodyPlainText);
  const sentences = extractSummarySentences(preparedText);
  const topics = extractTopics(`${email.subject} ${preparedText}`);
  const keyPoints = sentences.slice(0, 4).map((point, index) => ({
    point,
    importance: index === 0 ? "high" : index === 1 ? "medium" : "low",
  })) as SummaryOutput["keyPoints"];

  const defaultPoint = {
    point: "Review the newsletter directly for fuller nuance while the AI summary pipeline is being refined.",
    importance: "medium" as const,
  };

  const tldrSource = sentences.slice(0, format === "full_digest" ? 3 : 2).join(" ");
  const tldr = tldrSource || `This newsletter covers updates related to ${topics.slice(0, 3).join(", ") || "the subject line above"}.`;

  return {
    title: createFallbackTitle(email.subject),
    tldr,
    keyPoints: keyPoints.length > 0 ? keyPoints : [defaultPoint],
    actionItems: buildFallbackActionItems(email, topics),
    sentiment: "neutral",
    topics: topics.length > 0 ? topics : ["newsletter"],
    readTimeMinutes: Math.max(1, Math.min(12, Math.ceil(email.bodyLengthChars / 900))),
  };
}

// ---------------------------------------------------------------------------
// Text preparation & utilities
// ---------------------------------------------------------------------------

export function prepareNewsletterTextForSummary(body: string): string {
  const blockedPatterns = [
    /^presented by\b/i,
    /^sponsored by\b/i,
    /^advertise with us\b/i,
    /^privacy statement\b/i,
    /^terms of service\b/i,
    /^update your email preferences\b/i,
    /^unsubscribe\b/i,
    /^view online\b/i,
    /^read online\b/i,
    /^read in app\b/i,
    /^listen online\b/i,
    /^what did you think of/i,
    /^this email was sent from an unmonitored mailbox\b/i,
    /^©\s?\d{4}/i,
  ];

  const normalizedLines = body
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => line.length > 1)
    .filter((line) => !blockedPatterns.some((pattern) => pattern.test(line)))
    .filter((line) => !isMostlyTickerNoise(line))
    .filter((line) => !isMostlySpacerNoise(line));

  const selected: string[] = [];
  let totalChars = 0;
  for (const line of normalizedLines) {
    if (selected.length > 0 && totalChars + line.length + 1 > MAX_SUMMARY_INPUT_CHARS) break;
    selected.push(line);
    totalChars += line.length + 1;
  }

  return selected.join("\n");
}

function createFallbackTitle(subject: string): string {
  const clean = subject.trim();
  if (!clean) return "Newsletter Digest";
  return clean.length > 96 ? `${clean.slice(0, 93).trim()}...` : clean;
}

function extractSummarySentences(body: string): string[] {
  const normalized = body
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 40);

  const sentences: string[] = [];
  for (const line of normalized) {
    for (const fragment of line.split(/(?<=[.!?])\s+/)) {
      const sentence = fragment.trim();
      if (sentence.length >= 40) {
        sentences.push(sentence);
      }
      if (sentences.length >= 6) {
        return sentences;
      }
    }
  }
  return sentences;
}

function isMostlyTickerNoise(line: string): boolean {
  const compact = line.replace(/\s+/g, "");
  if (compact.length < 8) return false;
  const symbolMatches = compact.match(/[$%+\-0-9.,]/g) || [];
  return symbolMatches.length / compact.length > 0.6;
}

function isMostlySpacerNoise(line: string): boolean {
  const spacerMatches = line.match(/[͏­•|]/g) || [];
  return spacerMatches.length > 0 && spacerMatches.length / line.length > 0.3;
}

function buildFallbackActionItems(email: NewsletterEmail, topics: string[]): SummaryOutput["actionItems"] {
  const leadTopic = topics[0] || email.senderName || email.senderEmail || "this newsletter";
  return [
    {
      action: `Review the full newsletter for details on ${leadTopic}.`,
      urgency: "medium",
    },
    {
      action: "Share the most relevant takeaway with the team if it affects current priorities.",
      urgency: "low",
    },
  ];
}

function extractTopics(text: string): string[] {
  const stopwords = new Set([
    "about", "after", "again", "being", "below", "between", "could", "every",
    "from", "have", "into", "newsletter", "other", "their", "there", "these",
    "they", "this", "updates", "with", "your",
  ]);

  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []) {
    if (stopwords.has(raw)) continue;
    counts.set(raw, (counts.get(raw) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic]) => topic);
}

// ---------------------------------------------------------------------------
// Exported for tests / backward compatibility
// ---------------------------------------------------------------------------

export function buildSummaryPrompt(email: NewsletterEmail, format: SummaryFormat = DEFAULT_SUMMARY_FORMAT): string {
  const formatInstruction = getFormatInstruction(format);
  const preparedText = prepareNewsletterTextForSummary(email.bodyPlainText);
  return `Summarize this newsletter for a busy operator.

Return crisp, business-useful output. Prefer concrete facts over generic commentary.
Preferred format: ${getSummaryFormatOption(format).title}.
Format instruction: ${formatInstruction}

Sender: ${email.senderName || email.senderEmail} <${email.senderEmail}>
Subject: ${email.subject}
Received: ${email.receivedAt}

Newsletter text:
${preparedText}

Return your response as a single valid JSON object with exactly these fields (no markdown fences, no extra text):
{
  "title": "concise headline",
  "tldr": "one-paragraph summary",
  "keyPoints": [{"point": "key insight", "importance": "high|medium|low"}],
  "actionItems": [{"action": "recommended action", "urgency": "high|medium|low|none"}],
  "sentiment": "positive|neutral|negative|mixed",
  "topics": ["topic1", "topic2"],
  "readTimeMinutes": 2
}`;
}

// Re-export SUMMARY_SCHEMA for backward compatibility
export const SUMMARY_SCHEMA = {
  name: "newsletter_summary",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "tldr", "keyPoints", "actionItems", "sentiment", "topics", "readTimeMinutes"],
    properties: {
      title: { type: "string" },
      tldr: { type: "string" },
      keyPoints: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["point", "importance"],
          properties: {
            point: { type: "string" },
            importance: { type: "string", enum: ["high", "medium", "low"] },
          },
        },
      },
      actionItems: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["action", "urgency"],
          properties: {
            action: { type: "string" },
            urgency: { type: "string", enum: ["high", "medium", "low", "none"] },
          },
        },
      },
      sentiment: { type: "string", enum: ["positive", "neutral", "negative", "mixed"] },
      topics: { type: "array", maxItems: 8, items: { type: "string" } },
      readTimeMinutes: { type: "number" },
    },
  },
};
