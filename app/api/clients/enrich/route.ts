import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";

const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:8000";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export interface ClientEnrichmentResult {
  name: string;
  sector: string;
  topics: string[];
  priorities: string;
  accountOwner?: string;
  relationshipStage: string;
  matchThreshold: number;
  notes: string;
}

const SYSTEM_PROMPT = `You are a business analyst. Given a company name, website URL, or description, infer a likely client profile for a consulting relationship.

Return ONLY a JSON object with these exact keys:
- name: official company name
- sector: concise industry label
- topics: array of 3-6 specific business areas they likely track
- priorities: one concise sentence on what this client is likely trying to achieve
- accountOwner: use "Unassigned" unless the input explicitly provides an owner
- relationshipStage: choose one concise stage label, usually "Prospect"
- matchThreshold: integer from 0 to 100 for how selective relevance matching should be
- notes: one short sentence of account context

Do not return markdown fences. Do not repeat instructions or schema examples.`;

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "agent-api");
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const source: unknown = body?.source;

  if (typeof source !== "string" || !source.trim()) {
    return NextResponse.json({ error: "Provide a company name, website URL, or description" }, { status: 400 });
  }

  const normalizedSource = source.trim();
  const userPrompt = `Company: ${normalizedSource}\n\nReturn the JSON profile for this exact company. Do not repeat the schema example.`;

  try {
    const result = await runEnrichment(auth.apiToken, normalizedSource, userPrompt);
    return NextResponse.json({ client: result });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error("[ClientEnrich] All strategies failed:", details);
    return NextResponse.json(
      {
        error: "Could not enrich client profile with LLM derivation",
        details,
      },
      { status: 502 },
    );
  }
}

async function runEnrichment(token: string, source: string, userPrompt: string): Promise<ClientEnrichmentResult> {
  const errors: string[] = [];

  if (ANTHROPIC_API_KEY) {
    try {
      const raw = await anthropicLLM(userPrompt);
      return validateResult(parseOutput(raw), source);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`anthropic: ${msg}`);
      console.warn("[ClientEnrich] Anthropic failed:", msg);
    }
  }

  // BusiBox agent-api LLM completions (try "default" model for better quality)
  try {
    const raw = await agentApiLLM(token, userPrompt, "default");
    return validateResult(parseOutput(raw), source);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`agent-llm-default: ${msg}`);
    console.warn("[ClientEnrich] Agent-api LLM (default) failed:", msg);
  }

  // Retry with "fast" model
  try {
    const raw = await agentApiLLM(token, userPrompt, "fast");
    return validateResult(parseOutput(raw), source);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`agent-llm-fast: ${msg}`);
    console.warn("[ClientEnrich] Agent-api LLM (fast) failed:", msg);
  }

  // OpenRouter as last resort (if configured and has credits)
  if (OPENROUTER_API_KEY) {
    try {
      const raw = await openRouterLLM(userPrompt);
      return validateResult(parseOutput(raw), source);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`openrouter: ${msg}`);
      console.warn("[ClientEnrich] OpenRouter failed:", msg);
    }
  }

  throw new Error(`All enrichment strategies failed: ${errors.join(" | ")}`);
}

async function anthropicLLM(userPrompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 400,
        temperature: 0.1,
        system: `${SYSTEM_PROMPT}\n\nReturn only valid JSON.`,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = await res.json();
    const text = Array.isArray(data.content)
      ? data.content
          .filter((part: { type?: string; text?: string }) => part?.type === "text" && typeof part.text === "string")
          .map((part: { text: string }) => part.text)
          .join("\n")
      : "";
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function agentApiLLM(token: string, userPrompt: string, model = "default"): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${AGENT_API_URL}/llm/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 400,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Agent-api LLM ${res.status}`);
    const data = await res.json();
    return data.content || "";
  } finally {
    clearTimeout(timeout);
  }
}

async function openRouterLLM(userPrompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
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
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timeout);
  }
}

function parseOutput(raw: string): ClientEnrichmentResult {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // Strip both <think>...</think> and <thinking>...</thinking>
  const noThink = cleaned
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "")
    .trim();

  // Try the whole string first
  let parsed: unknown;
  try { parsed = JSON.parse(noThink); }
  catch {
    // Walk char-by-char to find all properly-bounded JSON objects,
    // then try from LAST to FIRST (thinking preambles always come before the real JSON).
    const candidates = findJsonObjects(noThink);
    for (let i = candidates.length - 1; i >= 0; i--) {
      try { parsed = JSON.parse(candidates[i]); break; } catch { /* continue */ }
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`No valid JSON object found in enrichment response: ${raw.slice(0, 200)}`);
  }
  const r = parsed as Record<string, unknown>;

  return {
    name: typeof r.name === "string" ? r.name.trim() : "",
    sector: typeof r.sector === "string" ? r.sector.trim() : "",
    topics: Array.isArray(r.topics)
      ? r.topics.map((t) => (typeof t === "string" ? t.trim() : "")).filter((t): t is string => Boolean(t))
      : [],
    priorities: normalizePriorities(r.priorities),
    accountOwner: normalizeAccountOwner(r.accountOwner),
    relationshipStage: normalizeRelationshipStage(r.relationshipStage),
    matchThreshold: normalizeMatchThreshold(r.matchThreshold),
    notes: typeof r.notes === "string" ? r.notes.trim() : "",
  };
}

function validateResult(result: ClientEnrichmentResult, source: string): ClientEnrichmentResult {
  const normalizedSource = source.trim().toLowerCase();
  const name = result.name.trim().toLowerCase();
  const sector = result.sector.trim().toLowerCase();
  const topics = result.topics.map((topic) => topic.trim().toLowerCase());
  const priorities = result.priorities.trim().toLowerCase();
  const notes = result.notes.trim().toLowerCase();

  const looksLikeSchemaTemplate =
    name === "official company name" ||
    sector === "industry sector" ||
    topics.some((topic) => /^topic\d+$/.test(topic)) ||
    priorities.includes("one concise sentence") ||
    notes.includes("one short sentence");

  const looksMeaningless =
    !result.name.trim() ||
    !result.sector.trim() ||
    result.topics.length < 2 ||
    !result.priorities.trim();

  const sourceLooksIgnored =
    normalizedSource.length > 2 &&
    !name.includes(normalizedSource) &&
    !normalizedSource.includes(name) &&
    name.length < 4;

  if (looksLikeSchemaTemplate || looksMeaningless || sourceLooksIgnored) {
    throw new Error(`Model returned a non-meaningful client profile for "${source}"`);
  }

  return result;
}

function normalizeRelationshipStage(value: unknown): string {
  if (typeof value !== "string") return "Prospect";
  const trimmed = value.trim();
  return trimmed || "Prospect";
}

function normalizePriorities(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeAccountOwner(value: unknown): string {
  if (typeof value !== "string") return "Unassigned";
  const trimmed = value.trim();
  return trimmed || "Unassigned";
}

function normalizeMatchThreshold(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 42;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function findJsonObjects(text: string): string[] {
  const results: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "{") { i++; continue; }
    let depth = 0, inStr = false, esc = false, j = i, closed = false;
    while (j < text.length) {
      const ch = text[j];
      if (esc) { esc = false; }
      else if (ch === "\\" && inStr) { esc = true; }
      else if (ch === '"') { inStr = !inStr; }
      else if (!inStr) {
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) { closed = true; break; } }
      }
      j++;
    }
    if (closed) { results.push(text.slice(i, j + 1)); i = j + 1; }
    else { i++; }
  }
  return results;
}
