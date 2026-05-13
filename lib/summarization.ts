import type { NewsletterEmail, SummaryFormat, SummaryOutput } from "./types";

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
      topics: {
        type: "array",
        maxItems: 8,
        items: { type: "string" },
      },
      readTimeMinutes: { type: "number" },
    },
  },
};

export function buildSummaryPrompt(email: NewsletterEmail, format: SummaryFormat = DEFAULT_SUMMARY_FORMAT): string {
  const formatInstruction = getFormatInstruction(format);
  return `Summarize this newsletter for a busy operator.

Return crisp, business-useful output. Prefer concrete facts over generic commentary.
Preferred format: ${getSummaryFormatOption(format).title}.
Format instruction: ${formatInstruction}

Sender: ${email.senderName || email.senderEmail} <${email.senderEmail}>
Subject: ${email.subject}
Received: ${email.receivedAt}

Newsletter text:
${email.bodyPlainText}`;
}

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

export function parseSummaryOutput(value: unknown): SummaryOutput {
  if (!value || typeof value !== "object") {
    throw new Error("Summary output must be an object");
  }
  const output = value as Partial<SummaryOutput>;
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
