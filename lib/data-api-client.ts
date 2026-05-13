import {
  deleteRecords,
  ensureDocuments,
  generateId,
  getNow,
  insertRecords,
  queryRecords,
  updateRecords,
} from "@jazzmind/busibox-app";
import type { AppDataSchema } from "@jazzmind/busibox-app";
import type {
  ConnectionStatus,
  GeneratedContent,
  GeneratedContentOutput,
  NewsletterConnection,
  NewsletterEmail,
  NewsletterPreferences,
  NewsletterSubscription,
  NewsletterSummary,
  SummaryFormat,
  SummaryOutput,
} from "./types";

export const APP_ID = "newsletter-digest";

export const DOCUMENTS = {
  CONNECTIONS: "newsletter-digest-connections",
  SUBSCRIPTIONS: "newsletter-digest-subscriptions",
  EMAILS: "newsletter-digest-emails",
  SUMMARIES: "newsletter-digest-summaries",
  PREFERENCES: "newsletter-digest-preferences",
  GENERATED_CONTENT: "newsletter-digest-generated-content",
} as const;

export const DEFAULT_CONNECTION_ID = "microsoft-primary";
export const DEFAULT_PREFERENCES_ID = "summary-format";

const baseFields = {
  id: { type: "string", required: true, hidden: true },
} satisfies AppDataSchema["fields"];

function asRecord<T extends object>(value: T): Record<string, unknown> {
  return value as unknown as Record<string, unknown>;
}

export const connectionSchema: AppDataSchema = {
  fields: {
    ...baseFields,
    accountEmail: { type: "string", required: true, label: "Account Email", order: 1 },
    accountName: { type: "string", label: "Account Name", order: 2 },
    tokenFileId: { type: "string", required: true, hidden: true },
    encryptedTokens: { type: "string", required: true, hidden: true, multiline: true },
    accessTokenExpiresAt: { type: "string", required: true, label: "Access Token Expires", order: 3 },
    connectedAt: { type: "string", required: true, readonly: true, order: 4 },
    lastSyncAt: { type: "string", readonly: true, order: 5 },
    status: { type: "string", required: true, label: "Status", order: 6 },
  },
  displayName: "Newsletter Connections",
  itemLabel: "Connection",
  sourceApp: APP_ID,
  visibility: "personal",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

export const subscriptionSchema: AppDataSchema = {
  fields: {
    ...baseFields,
    senderEmail: { type: "string", required: true, label: "Sender Email", order: 1 },
    senderName: { type: "string", label: "Sender Name", order: 2 },
    isActive: { type: "boolean", required: true, label: "Active", order: 3 },
    autoSummarize: { type: "boolean", required: true, label: "Auto Summarize", order: 4 },
    category: { type: "string", label: "Category", order: 5 },
    firstSeenAt: { type: "string", required: true, readonly: true, order: 6 },
    lastEmailAt: { type: "string", required: true, readonly: true, order: 7 },
    emailCount: { type: "number", required: true, label: "Email Count", order: 8 },
  },
  displayName: "Newsletter Subscriptions",
  itemLabel: "Subscription",
  sourceApp: APP_ID,
  visibility: "personal",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

export const emailSchema: AppDataSchema = {
  fields: {
    ...baseFields,
    messageId: { type: "string", required: true, label: "Graph Message ID", hidden: true },
    senderEmail: { type: "string", required: true, label: "Sender Email", order: 1 },
    senderName: { type: "string", label: "Sender Name", order: 2 },
    subject: { type: "string", required: true, label: "Subject", order: 3 },
    receivedAt: { type: "string", required: true, label: "Received", order: 4 },
    bodyPlainText: { type: "string", required: true, label: "Body", multiline: true, order: 5 },
    bodyLengthChars: { type: "number", required: true, label: "Body Length", order: 6 },
    hasBeenSummarized: { type: "boolean", required: true, label: "Summarized", order: 7 },
    summaryId: { type: "string", label: "Summary ID", hidden: true },
    fetchedAt: { type: "string", required: true, readonly: true, order: 8 },
  },
  displayName: "Newsletter Emails",
  itemLabel: "Newsletter",
  sourceApp: APP_ID,
  visibility: "personal",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

export const summarySchema: AppDataSchema = {
  fields: {
    ...baseFields,
    emailId: { type: "string", required: true, label: "Email ID", hidden: true },
    format: { type: "string", label: "Summary Format", order: 1 },
    title: { type: "string", required: true, label: "Title", order: 2 },
    tldr: { type: "string", required: true, label: "TLDR", multiline: true, order: 3 },
    keyPoints: { type: "string", required: true, label: "Key Points JSON", hidden: true },
    actionItems: { type: "string", required: true, label: "Action Items JSON", hidden: true },
    sentiment: { type: "string", required: true, label: "Sentiment", order: 4 },
    topics: { type: "string", required: true, label: "Topics JSON", hidden: true },
    readTimeMinutes: { type: "number", required: true, label: "Read Time", order: 5 },
    generatedAt: { type: "string", required: true, readonly: true, order: 6 },
  },
  displayName: "Newsletter Summaries",
  itemLabel: "Summary",
  sourceApp: APP_ID,
  visibility: "personal",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

export const preferencesSchema: AppDataSchema = {
  fields: {
    ...baseFields,
    summaryFormat: { type: "string", required: true, label: "Summary Format", order: 1 },
    createdAt: { type: "string", required: true, readonly: true, order: 2 },
    updatedAt: { type: "string", required: true, readonly: true, order: 3 },
  },
  displayName: "Newsletter Preferences",
  itemLabel: "Preferences",
  sourceApp: APP_ID,
  visibility: "personal",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

export const generatedContentSchema: AppDataSchema = {
  fields: {
    ...baseFields,
    articleId: { type: "string", required: true, label: "Article ID", order: 1 },
    articleTitle: { type: "string", required: true, label: "Article Title", order: 2 },
    articleSource: { type: "string", required: true, label: "Article Source", order: 3 },
    kind: { type: "string", required: true, label: "Content Type", order: 4 },
    tone: { type: "string", required: true, label: "Tone", order: 5 },
    clientName: { type: "string", label: "Client Name", order: 6 },
    clientSector: { type: "string", label: "Client Sector", order: 7 },
    title: { type: "string", required: true, label: "Draft Title", order: 8 },
    subject: { type: "string", label: "Subject", order: 9 },
    body: { type: "string", required: true, label: "Body", multiline: true, order: 10 },
    notes: { type: "string", required: true, label: "Review Notes", multiline: true, order: 11 },
    createdAt: { type: "string", required: true, readonly: true, order: 12 },
  },
  displayName: "Newsletter Generated Content",
  itemLabel: "Generated Content",
  sourceApp: APP_ID,
  visibility: "personal",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

export async function ensureDataDocuments(token: string): Promise<{
  connections: string;
  subscriptions: string;
  emails: string;
  summaries: string;
  preferences: string;
  generatedContent: string;
}> {
  const ids = await ensureDocuments(
    token,
    {
      connections: { name: DOCUMENTS.CONNECTIONS, schema: connectionSchema, visibility: "personal" },
      subscriptions: { name: DOCUMENTS.SUBSCRIPTIONS, schema: subscriptionSchema, visibility: "personal" },
      emails: { name: DOCUMENTS.EMAILS, schema: emailSchema, visibility: "personal" },
      summaries: { name: DOCUMENTS.SUMMARIES, schema: summarySchema, visibility: "personal" },
      preferences: { name: DOCUMENTS.PREFERENCES, schema: preferencesSchema, visibility: "personal" },
      generatedContent: { name: DOCUMENTS.GENERATED_CONTENT, schema: generatedContentSchema, visibility: "personal" },
    },
    APP_ID,
  );
  return ids as { connections: string; subscriptions: string; emails: string; summaries: string; preferences: string; generatedContent: string };
}

export async function getConnection(
  token: string,
  documentId: string,
): Promise<NewsletterConnection | null> {
  const result = await queryRecords<NewsletterConnection>(token, documentId, {
    where: { field: "id", op: "eq", value: DEFAULT_CONNECTION_ID },
    limit: 1,
  });
  return result.records[0] || null;
}

export async function upsertConnection(
  token: string,
  documentId: string,
  input: Omit<NewsletterConnection, "id" | "connectedAt"> & { connectedAt?: string },
): Promise<NewsletterConnection> {
  const existing = await getConnection(token, documentId);
  const connection: NewsletterConnection = {
    id: DEFAULT_CONNECTION_ID,
    connectedAt: input.connectedAt || existing?.connectedAt || getNow(),
    ...input,
  };

  if (existing) {
    await updateRecords(token, documentId, asRecord(connection), { field: "id", op: "eq", value: DEFAULT_CONNECTION_ID });
  } else {
    await insertRecords(token, documentId, [asRecord(connection)]);
  }
  return connection;
}

export async function updateConnectionStatus(
  token: string,
  documentId: string,
  status: ConnectionStatus,
): Promise<void> {
  await updateRecords(token, documentId, asRecord({ status }), { field: "id", op: "eq", value: DEFAULT_CONNECTION_ID });
}

export async function deleteConnection(token: string, documentId: string): Promise<void> {
  await deleteRecords(token, documentId, { field: "id", op: "eq", value: DEFAULT_CONNECTION_ID });
}

export async function listEmails(
  token: string,
  documentId: string,
  filters?: { summaryStatus?: string | null; senderEmail?: string | null; from?: string | null; to?: string | null },
): Promise<NewsletterEmail[]> {
  const and: Array<{ field: string; op: "eq" | "gte" | "lte"; value: string | boolean }> = [];
  if (filters?.summaryStatus === "summarized") and.push({ field: "hasBeenSummarized", op: "eq", value: true });
  if (filters?.summaryStatus === "unsummarized") and.push({ field: "hasBeenSummarized", op: "eq", value: false });
  if (filters?.senderEmail) and.push({ field: "senderEmail", op: "eq", value: filters.senderEmail });
  if (filters?.from) and.push({ field: "receivedAt", op: "gte", value: filters.from });
  if (filters?.to) and.push({ field: "receivedAt", op: "lte", value: filters.to });

  const where = and.length === 0 ? undefined : and.length === 1 ? and[0] : { and };
  const result = await queryRecords<NewsletterEmail>(token, documentId, {
    ...(where ? { where } : {}),
    orderBy: [{ field: "receivedAt", direction: "desc" }],
    limit: 100,
  });
  return result.records;
}

export async function getEmailById(
  token: string,
  documentId: string,
  id: string,
): Promise<NewsletterEmail | null> {
  const result = await queryRecords<NewsletterEmail>(token, documentId, {
    where: { field: "id", op: "eq", value: id },
    limit: 1,
  });
  return result.records[0] || null;
}

export async function getEmailByMessageId(
  token: string,
  documentId: string,
  messageId: string,
): Promise<NewsletterEmail | null> {
  const result = await queryRecords<NewsletterEmail>(token, documentId, {
    where: { field: "messageId", op: "eq", value: messageId },
    limit: 1,
  });
  return result.records[0] || null;
}

export async function insertEmail(
  token: string,
  documentId: string,
  input: Omit<NewsletterEmail, "id" | "fetchedAt" | "hasBeenSummarized"> & Partial<Pick<NewsletterEmail, "hasBeenSummarized">>,
): Promise<NewsletterEmail> {
  const email: NewsletterEmail = {
    id: generateId(),
    fetchedAt: getNow(),
    hasBeenSummarized: false,
    ...input,
  };
  await insertRecords(token, documentId, [asRecord(email)]);
  return email;
}

export async function markEmailSummarized(
  token: string,
  documentId: string,
  emailId: string,
  summaryId: string,
): Promise<void> {
  await updateRecords(
    token,
    documentId,
    asRecord({ hasBeenSummarized: true, summaryId }),
    { field: "id", op: "eq", value: emailId },
  );
}

export async function upsertSubscriptionFromEmail(
  token: string,
  documentId: string,
  email: Pick<NewsletterEmail, "senderEmail" | "senderName" | "receivedAt">,
): Promise<void> {
  const existing = await queryRecords<NewsletterSubscription>(token, documentId, {
    where: { field: "senderEmail", op: "eq", value: email.senderEmail },
    limit: 1,
  });
  const current = existing.records[0];
  if (current) {
    await updateRecords(
      token,
      documentId,
      asRecord({
        senderName: email.senderName || current.senderName,
        lastEmailAt: email.receivedAt,
        emailCount: (current.emailCount || 0) + 1,
      }),
      { field: "id", op: "eq", value: current.id },
    );
    return;
  }

  await insertRecords(token, documentId, [
    asRecord({
      id: generateId(),
      senderEmail: email.senderEmail,
      senderName: email.senderName,
      isActive: true,
      autoSummarize: false,
      firstSeenAt: email.receivedAt,
      lastEmailAt: email.receivedAt,
      emailCount: 1,
    }),
  ]);
}

export async function listSubscriptions(
  token: string,
  documentId: string,
): Promise<NewsletterSubscription[]> {
  const result = await queryRecords<NewsletterSubscription>(token, documentId, {
    orderBy: [{ field: "lastEmailAt", direction: "desc" }],
    limit: 100,
  });
  return result.records;
}

export async function getPreferences(
  token: string,
  documentId: string,
): Promise<NewsletterPreferences | null> {
  const result = await queryRecords<NewsletterPreferences>(token, documentId, {
    where: { field: "id", op: "eq", value: DEFAULT_PREFERENCES_ID },
    limit: 1,
  });
  return result.records[0] || null;
}

export async function upsertPreferences(
  token: string,
  documentId: string,
  summaryFormat: SummaryFormat,
): Promise<NewsletterPreferences> {
  const existing = await getPreferences(token, documentId);
  const now = getNow();
  const preferences: NewsletterPreferences = {
    id: DEFAULT_PREFERENCES_ID,
    summaryFormat,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (existing) {
    await updateRecords(token, documentId, asRecord(preferences), { field: "id", op: "eq", value: DEFAULT_PREFERENCES_ID });
  } else {
    await insertRecords(token, documentId, [asRecord(preferences)]);
  }
  return preferences;
}

export async function createSummary(
  token: string,
  documentId: string,
  emailId: string,
  output: SummaryOutput,
  format?: SummaryFormat,
): Promise<NewsletterSummary> {
  const summary: NewsletterSummary = {
    id: generateId(),
    emailId,
    ...(format ? { format } : {}),
    title: output.title,
    tldr: output.tldr,
    keyPoints: JSON.stringify(output.keyPoints),
    actionItems: JSON.stringify(output.actionItems),
    sentiment: output.sentiment,
    topics: JSON.stringify(output.topics),
    readTimeMinutes: output.readTimeMinutes,
    generatedAt: getNow(),
  };
  await insertRecords(token, documentId, [asRecord(summary)]);
  return summary;
}

export async function getSummaryForEmail(
  token: string,
  documentId: string,
  emailId: string,
): Promise<NewsletterSummary | null> {
  const result = await queryRecords<NewsletterSummary>(token, documentId, {
    where: { field: "emailId", op: "eq", value: emailId },
    limit: 1,
  });
  return result.records[0] || null;
}

export async function listSummaries(
  token: string,
  documentId: string,
): Promise<NewsletterSummary[]> {
  const result = await queryRecords<NewsletterSummary>(token, documentId, {
    orderBy: [{ field: "generatedAt", direction: "desc" }],
    limit: 100,
  });
  return result.records;
}

export async function createGeneratedContent(
  token: string,
  documentId: string,
  input: {
    articleId: string;
    articleTitle: string;
    articleSource: string;
    kind: GeneratedContent["kind"];
    tone: GeneratedContent["tone"];
    clientName?: string;
    clientSector?: string;
    output: GeneratedContentOutput;
  },
): Promise<GeneratedContent> {
  const content: GeneratedContent = {
    id: generateId(),
    articleId: input.articleId,
    articleTitle: input.articleTitle,
    articleSource: input.articleSource,
    kind: input.kind,
    tone: input.tone,
    ...(input.clientName ? { clientName: input.clientName } : {}),
    ...(input.clientSector ? { clientSector: input.clientSector } : {}),
    title: input.output.title,
    subject: input.output.subject,
    body: input.output.body,
    notes: input.output.notes,
    createdAt: getNow(),
  };
  await insertRecords(token, documentId, [asRecord(content)]);
  return content;
}

export async function listGeneratedContent(
  token: string,
  documentId: string,
): Promise<GeneratedContent[]> {
  const result = await queryRecords<GeneratedContent>(token, documentId, {
    orderBy: [{ field: "createdAt", direction: "desc" }],
    limit: 50,
  });
  return result.records;
}
