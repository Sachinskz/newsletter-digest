import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@/lib/auth-middleware";

const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:8000";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const CONTENT_AGENT_NAME = process.env.CONTENT_GENERATOR_AGENT_NAME || "content-generator";
const CONTENT_AGENT_TIER = process.env.CONTENT_GENERATOR_AGENT_TIER || "complex";

export interface ClientEnrichmentResult {
  name: string;
  sector: string;
  topics: string[];
  notes: string;
}

const SYSTEM_PROMPT = `You are a business analyst. Given a company name, website URL, or description, infer a client profile for a consulting relationship. Return ONLY a JSON object — no markdown fences, no extra text:
{"name":"official company name","sector":"industry sector","topics":["topic1","topic2","topic3","topic4"],"notes":"one short sentence of account context"}

Topics should be 3-6 specific business areas they likely track (e.g. AI adoption, regulatory compliance, M&A, digital transformation). Sector should be a concise industry label (e.g. Financial services, Healthcare, Technology).`;

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, "agent-api");
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const source: unknown = body?.source;

  if (typeof source !== "string" || !source.trim()) {
    return NextResponse.json({ error: "Provide a company name, website URL, or description" }, { status: 400 });
  }

  const userPrompt = `Company: ${source.trim()}\n\nReturn the JSON profile.`;

  try {
    const result = await runEnrichment(auth.apiToken, userPrompt);
    return NextResponse.json({ client: result });
  } catch (error) {
    console.error("[ClientEnrich] All strategies failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        error: "Could not enrich client profile",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}

async function runEnrichment(token: string, userPrompt: string): Promise<ClientEnrichmentResult> {
  const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

  // Agent first
  try {
    const raw = await invokeAgent(token, fullPrompt);
    return parseOutput(raw);
  } catch (e) {
    console.warn("[ClientEnrich] Agent failed:", e instanceof Error ? e.message : String(e));
  }

  // Direct LLM (OpenRouter or local)
  try {
    const raw = await directLLM(token, userPrompt);
    return parseOutput(raw);
  } catch (e) {
    console.warn("[ClientEnrich] Direct LLM failed:", e instanceof Error ? e.message : String(e));
  }

  // Local model fallback
  const raw = await localModel(token, userPrompt);
  return parseOutput(raw);
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
        body: JSON.stringify({ model: OPENROUTER_MODEL, messages, temperature: 0.1, max_tokens: 400 }),
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
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  // Strip <think>...</think>
  const noThink = cleaned.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(noThink);
  } catch {
    const start = noThink.indexOf("{");
    const end = noThink.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error(`No JSON object found in: ${noThink.slice(0, 200)}`);
    parsed = JSON.parse(noThink.slice(start, end + 1));
  }

  if (!parsed || typeof parsed !== "object") throw new Error("Enrichment response is not an object");
  const r = parsed as Record<string, unknown>;

  return {
    name: typeof r.name === "string" ? r.name.trim() : "",
    sector: typeof r.sector === "string" ? r.sector.trim() : "",
    topics: Array.isArray(r.topics) ? r.topics.filter((t): t is string => typeof t === "string") : [],
    notes: typeof r.notes === "string" ? r.notes.trim() : "",
  };
}
