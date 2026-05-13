import type { GraphMessageDetail } from "./types";

const NEWSLETTER_DOMAINS = [
  "substack.com",
  "mailchimp.com",
  "list-manage.com",
  "convertkit.com",
  "beehiiv.com",
  "ghost.io",
  "campaignmonitor.com",
  "sendgrid.net",
  "sendinblue.com",
  "mailerlite.com",
  "hubspotemail.net",
  "constantcontact.com",
];

const NEWSLETTER_SUBJECT_HINTS = [
  "newsletter",
  "digest",
  "weekly",
  "roundup",
  "briefing",
  "update",
];

export function isNewsletter(message: GraphMessageDetail): boolean {
  const headers = getHeaderMap(message);
  if (headers.has("list-unsubscribe")) return true;
  if (headers.has("list-id")) return true;

  const sender = message.from?.emailAddress?.address?.toLowerCase() ?? "";
  const subject = message.subject?.toLowerCase() ?? "";
  const body = `${message.bodyPreview ?? ""} ${message.body?.content ?? ""}`.toLowerCase();

  if (NEWSLETTER_DOMAINS.some((domain) => sender.includes(domain))) return true;
  if (sender.startsWith("newsletter@") || sender.startsWith("news@") || sender.startsWith("digest@")) return true;

  const subjectScore = NEWSLETTER_SUBJECT_HINTS.filter((hint) => subject.includes(hint)).length;
  const unsubscribeScore = body.includes("unsubscribe") || body.includes("manage preferences") ? 1 : 0;
  const htmlScore = message.body?.contentType?.toLowerCase() === "html" && body.length > 2500 ? 1 : 0;

  return subjectScore + unsubscribeScore + htmlScore >= 2;
}

export function getHeaderMap(message: GraphMessageDetail): Map<string, string> {
  const headers = new Map<string, string>();
  for (const header of message.internetMessageHeaders ?? []) {
    if (!header.name) continue;
    headers.set(header.name.toLowerCase(), header.value ?? "");
  }
  return headers;
}
