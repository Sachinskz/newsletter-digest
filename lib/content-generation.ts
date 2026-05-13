import type { ClientProfile, LibraryArticle } from "./editorial-intelligence";
import type { ContentKind, ContentTone, GeneratedContentOutput } from "./types";

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

Return JSON with:
- title: an internal label for the draft
- subject: email subject when output type is Client email; otherwise an empty string
- body: the final usable draft
- notes: short review guidance for the human operator`;
}

export function parseGeneratedContentOutput(value: unknown): GeneratedContentOutput {
  if (!value || typeof value !== "object") {
    throw new Error("Generated content output must be an object");
  }

  const output = value as Partial<GeneratedContentOutput>;
  if (typeof output.title !== "string" || typeof output.body !== "string" || typeof output.notes !== "string") {
    throw new Error("Generated content output is missing required fields");
  }

  return {
    title: output.title,
    subject: typeof output.subject === "string" ? output.subject : "",
    body: output.body,
    notes: output.notes,
  };
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
