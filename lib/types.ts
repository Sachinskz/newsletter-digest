export interface ApiError {
  error: string;
  message?: string;
  details?: string;
  code?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  status: number;
}

export type ConnectionStatus = "active" | "expired" | "revoked";

export type SummaryFormat = "bullet_points" | "executive_summary" | "key_insights" | "full_digest";
export type ContentKind = "linkedin" | "email" | "thought" | "newsletter" | "talking" | "investor";
export type ContentTone = "Analytical" | "Executive" | "Conversational" | "Punchy" | "Sober" | "Visionary";
export type LinkedInConnectionStatus = "active" | "expired" | "revoked";
export type PublishStatus = "draft" | "publishing" | "published" | "failed";
export type PublishTarget = "personal_profile";
export type RankingPriority =
  | "Revenue opportunities"
  | "Client relevance"
  | "Competitive moves"
  | "Risk and regulation"
  | "Tools we can deploy quickly";

export interface NewsletterPreferences {
  id: string;
  summaryFormat: SummaryFormat;
  roleTitle?: string;
  primaryFocus?: string;
  interests: string[];
  wantsToKnow?: string;
  rankingPriorities: RankingPriority[];
  createdAt: string;
  updatedAt: string;
}

export interface NewsletterConnection {
  id: string;
  accountEmail: string;
  accountName?: string;
  tokenFileId: string;
  encryptedTokens: string;
  accessTokenExpiresAt: string;
  connectedAt: string;
  lastSyncAt?: string;
  status: ConnectionStatus;
}

export interface LinkedInConnection {
  id: string;
  memberId: string;
  memberName?: string;
  memberEmail?: string;
  tokenFileId: string;
  encryptedTokens: string;
  accessTokenExpiresAt: string;
  connectedAt: string;
  lastUsedAt?: string;
  status: LinkedInConnectionStatus;
}

export interface NewsletterSubscription {
  id: string;
  senderEmail: string;
  senderName?: string;
  isActive: boolean;
  autoSummarize: boolean;
  category?: string;
  firstSeenAt: string;
  lastEmailAt: string;
  emailCount: number;
}

export interface NewsletterEmail {
  id: string;
  messageId: string;
  senderEmail: string;
  senderName?: string;
  subject: string;
  receivedAt: string;
  bodyPlainText: string;
  bodyLengthChars: number;
  hasBeenSummarized: boolean;
  summaryId?: string;
  fetchedAt: string;
}

export interface NewsletterSummary {
  id: string;
  emailId: string;
  format?: SummaryFormat;
  title: string;
  tldr: string;
  keyPoints: string;
  actionItems: string;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  topics: string;
  readTimeMinutes: number;
  generatedAt: string;
}

export interface NewsletterClientProfile {
  id: string;
  name: string;
  sector: string;
  topics: string[];
  priorities: string;
  accountOwner?: string;
  relationshipStage?: string;
  notes?: string;
  matchThreshold?: number;
  createdAt: string;
  updatedAt: string;
}

export interface NewsletterClientMatch {
  id: string;
  clientId: string;
  clientName: string;
  clientSector: string;
  articleId: string;
  articleTitle: string;
  articleSource: string;
  articleCategory: string;
  articleSummary: string;
  articleWhy: string;
  articleReceivedAt: string;
  articleImportance: number;
  articleNovelty: number;
  articleUrgency: number;
  articleCompanies: string[];
  articleTopics: string[];
  score: number;
  reason: string;
  matchedAt: string;
}

export interface GeneratedContent {
  id: string;
  articleId: string;
  articleTitle: string;
  articleSource: string;
  kind: ContentKind;
  tone: ContentTone;
  channel?: "linkedin";
  clientName?: string;
  clientSector?: string;
  title: string;
  subject?: string;
  body: string;
  notes: string;
  publishStatus?: PublishStatus;
  publishTarget?: PublishTarget;
  publishError?: string;
  publishedAt?: string;
  externalPostId?: string;
  publishedByUserId?: string;
  createdAt: string;
}

export interface GeneratedContentOutput {
  title: string;
  subject?: string;
  body: string;
  notes: string;
}

export interface MicrosoftTokenSet {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  ext_expires_in?: number;
  token_type?: string;
  scope?: string;
  expires_at: string;
}

export interface LinkedInTokenSet {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  id_token?: string;
  token_type?: string;
  expires_at: string;
}

export interface LinkedInProfile {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
  locale?: string;
  email_verified?: boolean;
}

export interface MicrosoftProfile {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
}

export interface GraphMessageListItem {
  id: string;
  subject?: string;
  receivedDateTime?: string;
  bodyPreview?: string;
  from?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
}

export interface GraphMessageDetail extends GraphMessageListItem {
  internetMessageHeaders?: Array<{ name?: string; value?: string }>;
  body?: {
    contentType?: "text" | "html";
    content?: string;
  };
}

export interface SummaryOutput {
  title: string;
  tldr: string;
  keyPoints: Array<{ point: string; importance: "high" | "medium" | "low" }>;
  actionItems: Array<{ action: string; urgency: "high" | "medium" | "low" | "none" }>;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  topics: string[];
  readTimeMinutes: number;
}

/** Output of step-1 topic classification */
export interface TopicSegment {
  topic: string;
  headline: string;
  /** The slice of newsletter body text that belongs to this topic */
  textSlice: string;
}

/** Per-topic summary produced by step-2 */
export interface TopicSummary {
  topic: string;
  headline: string;
  tldr: string;
  keyPoints: Array<{ point: string; importance: "high" | "medium" | "low" }>;
  actionItems: Array<{ action: string; urgency: "high" | "medium" | "low" | "none" }>;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
}
