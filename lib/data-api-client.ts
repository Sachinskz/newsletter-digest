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
  LinkedInConnection,
  LinkedInConnectionStatus,
  NewsletterClientMatch,
  NewsletterClientProfile,
  NewsletterConnection,
  NewsletterEmail,
  NewsletterPreferences,
  RankingPriority,
  NewsletterSubscription,
  NewsletterSummary,
  SummaryFormat,
  SummaryOutput,
} from "./types";

export const APP_ID = "newsletter-digest";

export const DOCUMENTS = {
  CONNECTIONS: "newsletter-digest-connections",
  LINKEDIN_CONNECTIONS: "newsletter-digest-linkedin-connections",
  SUBSCRIPTIONS: "newsletter-digest-feed-subscriptions",
  EMAILS: "newsletter-digest-feed-emails",
  SUMMARIES: "newsletter-digest-feed-summaries",
  PREFERENCES: "newsletter-digest-preferences",
  GENERATED_CONTENT: "newsletter-digest-generated-content",
  CLIENTS: "newsletter-digest-clients",
  CLIENT_MATCHES: "newsletter-digest-client-matches",
} as const;

export const DEFAULT_CONNECTION_ID = "microsoft-primary";
export const DEFAULT_LINKEDIN_CONNECTION_ID = "linkedin-primary";
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
  visibility: "authenticated",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

export const linkedinConnectionSchema: AppDataSchema = {
  fields: {
    ...baseFields,
    memberId: { type: "string", required: true, label: "Member ID", hidden: true },
    memberName: { type: "string", label: "Member Name", order: 1 },
    memberEmail: { type: "string", label: "Member Email", order: 2 },
    tokenFileId: { type: "string", required: true, hidden: true },
    encryptedTokens: { type: "string", required: true, hidden: true, multiline: true },
    accessTokenExpiresAt: { type: "string", required: true, label: "Access Token Expires", order: 3 },
    connectedAt: { type: "string", required: true, readonly: true, order: 4 },
    lastUsedAt: { type: "string", readonly: true, order: 5 },
    status: { type: "string", required: true, label: "Status", order: 6 },
  },
  displayName: "LinkedIn Connections",
  itemLabel: "LinkedIn Connection",
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
  visibility: "authenticated",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

export const summarySchema: AppDataSchema = {
  fields: {
    ...baseFields,
    emailId: { type: "string", required: true, label: "Email ID", hidden: true },
    format: { type: "string", label: "Summary Format", order: 1 },
    generationSource: { type: "string", label: "Generation Source", order: 2 },
    generationModel: { type: "string", label: "Generation Model", order: 3 },
    generationError: { type: "string", label: "Generation Error", multiline: true, hidden: true },
    title: { type: "string", required: true, label: "Title", order: 4 },
    tldr: { type: "string", required: true, label: "TLDR", multiline: true, order: 5 },
    keyPoints: { type: "string", required: true, label: "Key Points JSON", hidden: true },
    actionItems: { type: "string", required: true, label: "Action Items JSON", hidden: true },
    sentiment: { type: "string", required: true, label: "Sentiment", order: 6 },
    topics: { type: "string", required: true, label: "Topics JSON", hidden: true },
    readTimeMinutes: { type: "number", required: true, label: "Read Time", order: 7 },
    generatedAt: { type: "string", required: true, readonly: true, order: 8 },
  },
  displayName: "Newsletter Summaries",
  itemLabel: "Summary",
  sourceApp: APP_ID,
  visibility: "authenticated",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

export const preferencesSchema: AppDataSchema = {
  fields: {
    ...baseFields,
    summaryFormat: { type: "string", required: true, label: "Summary Format", order: 1 },
    roleTitle: { type: "string", label: "Role or title", order: 2 },
    primaryFocus: { type: "string", label: "Primary focus", order: 3 },
    interests: { type: "string", required: true, label: "Interests JSON", hidden: true },
    wantsToKnow: { type: "string", label: "Wants to know", multiline: true, order: 4 },
    rankingPriorities: { type: "string", required: true, label: "Ranking Priorities JSON", hidden: true },
    createdAt: { type: "string", required: true, readonly: true, order: 5 },
    updatedAt: { type: "string", required: true, readonly: true, order: 6 },
  },
  displayName: "Newsletter Preferences",
  itemLabel: "Preferences",
  sourceApp: APP_ID,
  visibility: "personal",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

type StoredNewsletterPreferences = Omit<NewsletterPreferences, "interests" | "rankingPriorities"> & {
  interests: string;
  rankingPriorities: string;
};

export const generatedContentSchema: AppDataSchema = {
  fields: {
    ...baseFields,
    articleId: { type: "string", required: true, label: "Article ID", order: 1 },
    articleTitle: { type: "string", required: true, label: "Article Title", order: 2 },
    articleSource: { type: "string", required: true, label: "Article Source", order: 3 },
    kind: { type: "string", required: true, label: "Content Type", order: 4 },
    tone: { type: "string", required: true, label: "Tone", order: 5 },
    channel: { type: "string", label: "Channel", order: 6 },
    clientName: { type: "string", label: "Client Name", order: 6 },
    clientSector: { type: "string", label: "Client Sector", order: 7 },
    title: { type: "string", required: true, label: "Draft Title", order: 8 },
    subject: { type: "string", label: "Subject", order: 9 },
    body: { type: "string", required: true, label: "Body", multiline: true, order: 10 },
    notes: { type: "string", required: true, label: "Review Notes", multiline: true, order: 11 },
    publishStatus: { type: "string", label: "Publish Status", order: 12 },
    publishTarget: { type: "string", label: "Publish Target", order: 13 },
    publishError: { type: "string", label: "Publish Error", multiline: true, order: 14 },
    publishedAt: { type: "string", label: "Published At", readonly: true, order: 15 },
    externalPostId: { type: "string", label: "External Post ID", order: 16 },
    publishedByUserId: { type: "string", label: "Published By User ID", hidden: true },
    createdAt: { type: "string", required: true, readonly: true, order: 17 },
  },
  displayName: "Newsletter Generated Content",
  itemLabel: "Generated Content",
  sourceApp: APP_ID,
  visibility: "personal",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

export const clientProfileSchema: AppDataSchema = {
  fields: {
    ...baseFields,
    name: { type: "string", required: true, label: "Client Name", order: 1 },
    sector: { type: "string", required: true, label: "Sector", order: 2 },
    topics: { type: "string", required: true, label: "Topics JSON", hidden: true },
    priorities: { type: "string", required: true, label: "Priorities", multiline: true, order: 3 },
    accountOwner: { type: "string", label: "Account Owner", order: 4 },
    relationshipStage: { type: "string", label: "Relationship Stage", order: 5 },
    notes: { type: "string", label: "Notes", multiline: true, order: 6 },
    matchThreshold: { type: "number", label: "Match Threshold", order: 7 },
    createdAt: { type: "string", required: true, readonly: true, order: 8 },
    updatedAt: { type: "string", required: true, readonly: true, order: 9 },
  },
  displayName: "Newsletter Client Profiles",
  itemLabel: "Client Profile",
  sourceApp: APP_ID,
  visibility: "personal",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

export const clientMatchSchema: AppDataSchema = {
  fields: {
    ...baseFields,
    clientId: { type: "string", required: true, label: "Client ID", hidden: true },
    clientName: { type: "string", required: true, label: "Client Name", order: 1 },
    clientSector: { type: "string", required: true, label: "Client Sector", order: 2 },
    articleId: { type: "string", required: true, label: "Article ID", hidden: true },
    articleTitle: { type: "string", required: true, label: "Article Title", order: 3 },
    articleSource: { type: "string", required: true, label: "Article Source", order: 4 },
    articleCategory: { type: "string", required: true, label: "Article Category", order: 5 },
    articleSummary: { type: "string", required: true, label: "Article Summary", multiline: true, order: 6 },
    articleWhy: { type: "string", required: true, label: "Article Why", multiline: true, order: 7 },
    articleReceivedAt: { type: "string", required: true, label: "Article Received", order: 8 },
    articleImportance: { type: "number", required: true, label: "Article Importance", order: 9 },
    articleNovelty: { type: "number", required: true, label: "Article Novelty", order: 10 },
    articleUrgency: { type: "number", required: true, label: "Article Urgency", order: 11 },
    articleCompanies: { type: "string", required: true, label: "Article Companies JSON", hidden: true },
    articleTopics: { type: "string", required: true, label: "Article Topics JSON", hidden: true },
    score: { type: "number", required: true, label: "Match Score", order: 12 },
    reason: { type: "string", required: true, label: "Match Reason", multiline: true, order: 13 },
    matchedAt: { type: "string", required: true, readonly: true, order: 14 },
  },
  displayName: "Newsletter Client Matches",
  itemLabel: "Client Match",
  sourceApp: APP_ID,
  visibility: "personal",
  allowSharing: false,
  graphNode: "",
  graphRelationships: [],
};

export async function ensureDataDocuments(token: string): Promise<{
  connections: string;
  linkedinConnections: string;
  subscriptions: string;
  emails: string;
  summaries: string;
  preferences: string;
  generatedContent: string;
  clients: string;
  clientMatches: string;
}> {
  const ids = await ensureDocuments(
    token,
    {
      connections: { name: DOCUMENTS.CONNECTIONS, schema: connectionSchema, visibility: "personal" },
      linkedinConnections: { name: DOCUMENTS.LINKEDIN_CONNECTIONS, schema: linkedinConnectionSchema, visibility: "personal" },
      subscriptions: { name: DOCUMENTS.SUBSCRIPTIONS, schema: subscriptionSchema, visibility: "authenticated" },
      emails: { name: DOCUMENTS.EMAILS, schema: emailSchema, visibility: "authenticated" },
      summaries: { name: DOCUMENTS.SUMMARIES, schema: summarySchema, visibility: "authenticated" },
      preferences: { name: DOCUMENTS.PREFERENCES, schema: preferencesSchema, visibility: "personal" },
      generatedContent: { name: DOCUMENTS.GENERATED_CONTENT, schema: generatedContentSchema, visibility: "personal" },
      clients: { name: DOCUMENTS.CLIENTS, schema: clientProfileSchema, visibility: "personal" },
      clientMatches: { name: DOCUMENTS.CLIENT_MATCHES, schema: clientMatchSchema, visibility: "personal" },
    },
    APP_ID,
  );
  return ids as {
    connections: string;
    linkedinConnections: string;
    subscriptions: string;
    emails: string;
    summaries: string;
    preferences: string;
    generatedContent: string;
    clients: string;
    clientMatches: string;
  };
}

function parseClientTopics(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function inflateClientProfile(record: Omit<NewsletterClientProfile, "topics"> & { topics: string }): NewsletterClientProfile {
  return {
    ...record,
    topics: parseClientTopics(record.topics),
  };
}

function serializeClientProfile(input: NewsletterClientProfile): Record<string, unknown> {
  return asRecord({
    ...input,
    topics: JSON.stringify(input.topics),
  });
}

type StoredClientMatch = Omit<NewsletterClientMatch, "articleCompanies" | "articleTopics"> & {
  articleCompanies: string;
  articleTopics: string;
};

function parseStoredStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function inflateClientMatch(record: StoredClientMatch): NewsletterClientMatch {
  return {
    ...record,
    articleCompanies: parseStoredStringArray(record.articleCompanies),
    articleTopics: parseStoredStringArray(record.articleTopics),
  };
}

function serializeClientMatch(input: NewsletterClientMatch): Record<string, unknown> {
  return asRecord({
    ...input,
    articleCompanies: JSON.stringify(input.articleCompanies),
    articleTopics: JSON.stringify(input.articleTopics),
  });
}

export async function listClientProfiles(
  token: string,
  documentId: string,
): Promise<NewsletterClientProfile[]> {
  const result = await queryRecords<Omit<NewsletterClientProfile, "topics"> & { topics: string }>(token, documentId, {
    orderBy: [{ field: "updatedAt", direction: "desc" }],
    limit: 100,
  });
  return result.records.map(inflateClientProfile);
}

export async function getClientProfileById(
  token: string,
  documentId: string,
  id: string,
): Promise<NewsletterClientProfile | null> {
  const result = await queryRecords<Omit<NewsletterClientProfile, "topics"> & { topics: string }>(token, documentId, {
    where: { field: "id", op: "eq", value: id },
    limit: 1,
  });
  const record = result.records[0];
  return record ? inflateClientProfile(record) : null;
}

export async function createClientProfile(
  token: string,
  documentId: string,
  input: Omit<NewsletterClientProfile, "id" | "createdAt" | "updatedAt">,
): Promise<NewsletterClientProfile> {
  const now = getNow();
  const profile: NewsletterClientProfile = {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  await insertRecords(token, documentId, [serializeClientProfile(profile)]);
  return profile;
}

export async function updateClientProfile(
  token: string,
  documentId: string,
  id: string,
  updates: Partial<Omit<NewsletterClientProfile, "id" | "createdAt" | "updatedAt">>,
): Promise<NewsletterClientProfile | null> {
  const existing = await getClientProfileById(token, documentId, id);
  if (!existing) return null;

  const profile: NewsletterClientProfile = {
    ...existing,
    ...updates,
    updatedAt: getNow(),
  };
  await updateRecords(token, documentId, serializeClientProfile(profile), { field: "id", op: "eq", value: id });
  return profile;
}

export async function deleteClientProfile(
  token: string,
  documentId: string,
  id: string,
): Promise<void> {
  await deleteRecords(token, documentId, { field: "id", op: "eq", value: id });
}

export async function listClientMatches(
  token: string,
  documentId: string,
  filters?: { clientId?: string; articleId?: string },
): Promise<NewsletterClientMatch[]> {
  const and: Array<{ field: string; op: "eq"; value: string }> = [];
  if (filters?.clientId) and.push({ field: "clientId", op: "eq", value: filters.clientId });
  if (filters?.articleId) and.push({ field: "articleId", op: "eq", value: filters.articleId });
  const where = and.length === 0 ? undefined : and.length === 1 ? and[0] : { and };

  const result = await queryRecords<StoredClientMatch>(token, documentId, {
    ...(where ? { where } : {}),
    orderBy: [
      { field: "score", direction: "desc" },
      { field: "matchedAt", direction: "desc" },
    ],
    limit: 500,
  });
  return result.records.map(inflateClientMatch);
}

export async function replaceClientMatchesForClient(
  token: string,
  documentId: string,
  clientId: string,
  matches: Array<Omit<NewsletterClientMatch, "id">>,
): Promise<void> {
  await deleteRecords(token, documentId, { field: "clientId", op: "eq", value: clientId });
  if (matches.length === 0) return;

  await insertRecords(
    token,
    documentId,
    matches.map((match) =>
      serializeClientMatch({
        id: generateId(),
        ...match,
      }),
    ),
  );
}

export async function deleteClientMatchesForClient(
  token: string,
  documentId: string,
  clientId: string,
): Promise<void> {
  await deleteRecords(token, documentId, { field: "clientId", op: "eq", value: clientId });
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

export async function getLinkedInConnection(
  token: string,
  documentId: string,
): Promise<LinkedInConnection | null> {
  const result = await queryRecords<LinkedInConnection>(token, documentId, {
    where: { field: "id", op: "eq", value: DEFAULT_LINKEDIN_CONNECTION_ID },
    limit: 1,
  });
  return result.records[0] || null;
}

export async function upsertLinkedInConnection(
  token: string,
  documentId: string,
  input: Omit<LinkedInConnection, "id" | "connectedAt"> & { connectedAt?: string },
): Promise<LinkedInConnection> {
  const existing = await getLinkedInConnection(token, documentId);
  const connection: LinkedInConnection = {
    id: DEFAULT_LINKEDIN_CONNECTION_ID,
    connectedAt: input.connectedAt || existing?.connectedAt || getNow(),
    ...input,
  };

  if (existing) {
    await updateRecords(token, documentId, asRecord(connection), { field: "id", op: "eq", value: DEFAULT_LINKEDIN_CONNECTION_ID });
  } else {
    await insertRecords(token, documentId, [asRecord(connection)]);
  }
  return connection;
}

export async function updateLinkedInConnection(
  token: string,
  documentId: string,
  updates: Partial<Omit<LinkedInConnection, "id" | "connectedAt">>,
): Promise<LinkedInConnection | null> {
  const existing = await getLinkedInConnection(token, documentId);
  if (!existing) return null;

  const nextConnection: LinkedInConnection = {
    ...existing,
    ...updates,
  };
  await updateRecords(token, documentId, asRecord(nextConnection), {
    field: "id",
    op: "eq",
    value: DEFAULT_LINKEDIN_CONNECTION_ID,
  });
  return nextConnection;
}

export async function updateLinkedInConnectionStatus(
  token: string,
  documentId: string,
  status: LinkedInConnectionStatus,
): Promise<void> {
  await updateRecords(token, documentId, asRecord({ status }), {
    field: "id",
    op: "eq",
    value: DEFAULT_LINKEDIN_CONNECTION_ID,
  });
}

export async function deleteLinkedInConnection(token: string, documentId: string): Promise<void> {
  await deleteRecords(token, documentId, { field: "id", op: "eq", value: DEFAULT_LINKEDIN_CONNECTION_ID });
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
  const result = await queryRecords<StoredNewsletterPreferences>(token, documentId, {
    where: { field: "id", op: "eq", value: DEFAULT_PREFERENCES_ID },
    limit: 1,
  });
  const record = result.records[0];
  return record ? inflatePreferences(record) : null;
}

export async function upsertPreferences(
  token: string,
  documentId: string,
  input: {
    summaryFormat: SummaryFormat;
    roleTitle?: string;
    primaryFocus?: string;
    interests?: string[];
    wantsToKnow?: string;
    rankingPriorities?: RankingPriority[];
  },
): Promise<NewsletterPreferences> {
  const existing = await getPreferences(token, documentId);
  const now = getNow();
  const preferences: NewsletterPreferences = {
    id: DEFAULT_PREFERENCES_ID,
    summaryFormat: input.summaryFormat,
    roleTitle: input.roleTitle ?? existing?.roleTitle,
    primaryFocus: input.primaryFocus ?? existing?.primaryFocus,
    interests: input.interests ?? existing?.interests ?? [],
    wantsToKnow: input.wantsToKnow ?? existing?.wantsToKnow,
    rankingPriorities: input.rankingPriorities ?? existing?.rankingPriorities ?? [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (existing) {
    await updateRecords(token, documentId, serializePreferences(preferences), { field: "id", op: "eq", value: DEFAULT_PREFERENCES_ID });
  } else {
    await insertRecords(token, documentId, [serializePreferences(preferences)]);
  }
  return preferences;
}

function inflatePreferences(record: StoredNewsletterPreferences): NewsletterPreferences {
  return {
    ...record,
    interests: parseStoredStringArray(record.interests),
    rankingPriorities: parseStoredStringArray(record.rankingPriorities) as RankingPriority[],
  };
}

function serializePreferences(preferences: NewsletterPreferences): Record<string, unknown> {
  return asRecord({
    ...preferences,
    interests: JSON.stringify(preferences.interests || []),
    rankingPriorities: JSON.stringify(preferences.rankingPriorities || []),
  });
}

export async function createSummary(
  token: string,
  documentId: string,
  emailId: string,
  output: SummaryOutput,
  format?: SummaryFormat,
  metadata: Pick<NewsletterSummary, "generationSource" | "generationModel" | "generationError"> = {},
): Promise<NewsletterSummary> {
  const summary: NewsletterSummary = {
    id: generateId(),
    emailId,
    ...(format ? { format } : {}),
    ...(metadata.generationSource ? { generationSource: metadata.generationSource } : {}),
    ...(metadata.generationModel ? { generationModel: metadata.generationModel } : {}),
    ...(metadata.generationError ? { generationError: metadata.generationError } : {}),
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

export async function deleteSummaryForEmail(
  token: string,
  documentId: string,
  emailId: string,
): Promise<void> {
  await deleteRecords(token, documentId, { field: "emailId", op: "eq", value: emailId });
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
    channel?: GeneratedContent["channel"];
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
    ...(input.channel ? { channel: input.channel } : {}),
    ...(input.clientName ? { clientName: input.clientName } : {}),
    ...(input.clientSector ? { clientSector: input.clientSector } : {}),
    title: input.output.title,
    subject: input.output.subject,
    body: input.output.body,
    notes: input.output.notes,
    ...(input.kind === "linkedin" ? { publishStatus: "draft" as const, publishTarget: "personal_profile" as const } : {}),
    createdAt: getNow(),
  };
  await insertRecords(token, documentId, [asRecord(content)]);
  return content;
}

export async function getGeneratedContentById(
  token: string,
  documentId: string,
  id: string,
): Promise<GeneratedContent | null> {
  const result = await queryRecords<GeneratedContent>(token, documentId, {
    where: { field: "id", op: "eq", value: id },
    limit: 1,
  });
  return result.records[0] || null;
}

export async function updateGeneratedContent(
  token: string,
  documentId: string,
  id: string,
  updates: Partial<GeneratedContent>,
): Promise<GeneratedContent | null> {
  const existing = await getGeneratedContentById(token, documentId, id);
  if (!existing) return null;

  const nextContent: GeneratedContent = {
    ...existing,
    ...updates,
  };
  await updateRecords(token, documentId, asRecord(nextContent), {
    field: "id",
    op: "eq",
    value: id,
  });
  return nextContent;
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
