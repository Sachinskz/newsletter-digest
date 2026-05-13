const MAX_TEXT_CHARS = 12_000;

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function htmlToText(input: string, maxChars = MAX_TEXT_CHARS): string {
  const withoutScripts = input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const withBreaks = withoutScripts
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "- ");

  const text = withBreaks
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, decodeEntity)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return text.length > maxChars ? `${text.slice(0, maxChars).trim()}\n\n[Truncated]` : text;
}

export function normalizeEmailText(content: string, contentType?: string): string {
  if (!content) return "";
  return contentType?.toLowerCase() === "html" ? htmlToText(content) : content.trim().slice(0, MAX_TEXT_CHARS);
}

function decodeEntity(match: string, entity: string): string {
  const lower = entity.toLowerCase();
  if (lower.startsWith("#x")) {
    return fromCodePoint(parseInt(lower.slice(2), 16), match);
  }
  if (lower.startsWith("#")) {
    return fromCodePoint(parseInt(lower.slice(1), 10), match);
  }
  return ENTITY_MAP[lower] ?? match;
}

function fromCodePoint(value: number, fallback: string): string {
  if (!Number.isFinite(value)) return fallback;
  try {
    return String.fromCodePoint(value);
  } catch {
    return fallback;
  }
}
