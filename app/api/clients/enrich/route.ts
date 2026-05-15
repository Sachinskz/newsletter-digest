import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";

const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:8000";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const CONTENT_AGENT_NAME = process.env.CONTENT_GENERATOR_AGENT_NAME || "content-generator";
const CONTENT_AGENT_TIER = process.env.CONTENT_GENERATOR_AGENT_TIER || "complex";

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

const SYSTEM_PROMPT = `You are a business analyst. Given a company name, website URL, or description, infer a client profile for a consulting relationship. Return ONLY a JSON object — no markdown fences, no extra text:
{"name":"official company name","sector":"industry sector","topics":["topic1","topic2","topic3","topic4"],"priorities":"one concise sentence on what this client is likely trying to achieve","accountOwner":"Unassigned","relationshipStage":"Prospect","matchThreshold":42,"notes":"one short sentence of account context"}

Topics should be 3-6 specific business areas they likely track (e.g. AI adoption, regulatory compliance, M&A, digital transformation). Sector should be a concise industry label (e.g. Financial services, Healthcare, Technology).`;

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
    return NextResponse.json({
      client: buildFallbackProfile(normalizedSource),
      fallback: true,
      details,
    });
  }
}

async function runEnrichment(token: string, source: string, userPrompt: string): Promise<ClientEnrichmentResult> {
  const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

  // OpenRouter/direct LLM first tends to behave better than the generic agent on this task.
  try {
    const raw = await directLLM(token, userPrompt);
    return validateResult(parseOutput(raw), source);
  } catch (e) {
    console.warn("[ClientEnrich] Direct LLM failed:", e instanceof Error ? e.message : String(e));
  }

  // Agent fallback
  try {
    const raw = await invokeAgent(token, fullPrompt);
    return validateResult(parseOutput(raw), source);
  } catch (e) {
    console.warn("[ClientEnrich] Agent failed:", e instanceof Error ? e.message : String(e));
  }

  // Local model fallback
  const raw = await localModel(token, userPrompt);
  return validateResult(parseOutput(raw), source);
}

async function invokeAgent(token: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${AGENT_API_URL}/runs/invoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ agent_name: CONTENT_AGENT_NAME, agent_tier: CONTENT_AGENT_TIER, input: { prompt } }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Agent ${res.status}`);
    const data = await res.json();
    if (data.status === "failed" || !data.output) throw new Error(data.error || "No output");
    return typeof data.output === "string" ? data.output : JSON.stringify(data.output);
  } finally {
    clearTimeout(timeout);
  }
}

async function directLLM(token: string, userPrompt: string): Promise<string> {
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: userPrompt },
  ];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    if (OPENROUTER_API_KEY) {
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
          temperature: 0.1,
          max_tokens: 400,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }
    const res = await fetch(`${AGENT_API_URL}/llm/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.NEWSLETTER_LLM_MODEL || "fast", messages, temperature: 0.1, max_tokens: 400 }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    return data.content || "";
  } finally {
    clearTimeout(timeout);
  }
}

async function localModel(token: string, userPrompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${AGENT_API_URL}/llm/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.NEWSLETTER_LLM_MODEL || "fast",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 400,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Local model ${res.status}`);
    const data = await res.json();
    return data.content || "";
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

function buildFallbackProfile(source: string): ClientEnrichmentResult {
  const normalized = source.trim();
  const lowered = normalized.toLowerCase();
  const domainHost = extractHostname(lowered);
  const companyName = prettifyCompanyName(normalized, domainHost);

  const profiles = [
    {
      keywords: ["goldman", "morgan", "capital", "bank", "asset", "wealth", "finance", "fintech"],
      sector: "Financial services",
      topics: ["capital markets", "risk and compliance", "wealth management", "AI operations"],
      priorities: "Improve client-facing productivity, strengthen governance, and modernize high-value workflows without increasing risk.",
      threshold: 58,
      notes: "Financial institution likely balancing AI adoption with regulatory and operational controls.",
    },
    {
      keywords: ["clinic", "health", "hospital", "pharma", "biotech", "medical", "med"],
      sector: "Healthcare",
      topics: ["clinical operations", "compliance and privacy", "care workflow automation", "AI decision support"],
      priorities: "Improve operational efficiency, support regulated AI adoption, and reduce friction in high-volume care workflows.",
      threshold: 56,
      notes: "Healthcare organization likely focused on operational resilience, safety, and compliant automation.",
    },
    {
      keywords: ["openai", "anthropic", "ai", "software", "cloud", "developer", "platform", "tech"],
      sector: "Technology",
      topics: ["AI product strategy", "enterprise adoption", "developer platforms", "go-to-market execution"],
      priorities: "Accelerate product adoption, sharpen enterprise positioning, and convert fast-moving AI shifts into revenue opportunities.",
      threshold: 52,
      notes: "Technology company likely sensitive to model launches, enterprise demand, and competitive platform moves.",
    },
    {
      keywords: ["retail", "commerce", "consumer", "brand", "shop"],
      sector: "Retail and consumer",
      topics: ["customer experience", "pricing and margin", "marketing operations", "supply chain visibility"],
      priorities: "Protect margin, improve customer experience, and automate repetitive commercial and operational workflows.",
      threshold: 48,
      notes: "Consumer business likely focused on demand signals, operational efficiency, and competitive positioning.",
    },
    {
      keywords: ["logistics", "shipping", "freight", "supply", "warehouse", "transport"],
      sector: "Logistics and supply chain",
      topics: ["route optimization", "supply chain resilience", "workflow automation", "vendor risk"],
      priorities: "Increase operating efficiency, improve network visibility, and reduce disruption across supply chain workflows.",
      threshold: 50,
      notes: "Operations-heavy business likely prioritizing efficiency, resilience, and coordination across distributed teams.",
    },
  ];

  const matched = profiles.find((profile) => profile.keywords.some((keyword) => lowered.includes(keyword) || domainHost.includes(keyword)));

  const fallback = matched ?? {
    sector: "Enterprise services",
    topics: ["AI adoption", "workflow automation", "governance", "competitive monitoring"],
    priorities: "Track material AI, operational, and market developments that could affect this account.",
    threshold: 42,
    notes: "General enterprise profile generated from company name because live enrichment providers were unavailable.",
  };

  return {
    name: companyName,
    sector: fallback.sector,
    topics: fallback.topics,
    priorities: fallback.priorities,
    accountOwner: "Unassigned",
    relationshipStage: "Prospect",
    matchThreshold: fallback.threshold,
    notes: fallback.notes,
  };
}

function extractHostname(value: string): string {
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return new URL(value).hostname.toLowerCase();
    }
  } catch {
    return "";
  }
  return value;
}

function prettifyCompanyName(source: string, domainHost: string): string {
  if (!domainHost || domainHost === source.toLowerCase()) {
    return source.trim();
  }

  const stripped = domainHost
    .replace(/^www\./, "")
    .split(".")[0]
    .replace(/[-_]+/g, " ")
    .trim();

  if (!stripped) return source.trim();
  return stripped.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeRelationshipStage(value: unknown): string {
  if (typeof value !== "string") return "Prospect";
  const trimmed = value.trim();
  return trimmed || "Prospect";
}

function normalizePriorities(value: unknown): string {
  if (typeof value !== "string") {
    return "Track material AI, operational, and market developments that could affect this account.";
  }
  const trimmed = value.trim();
  return trimmed || "Track material AI, operational, and market developments that could affect this account.";
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
