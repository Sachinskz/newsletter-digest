# Newsletter Digest

Newsletter Digest is a Busibox app that connects a user's Microsoft 365 mailbox, detects newsletter-style emails, generates structured AI summaries, and produces business content (LinkedIn posts, client emails, thought leadership) from the ingested articles. It also supports direct publishing of stored LinkedIn drafts to a connected personal LinkedIn profile.

## What This App Does

1. **Ingest** -- Connect Microsoft 365, sync newsletters, detect and normalize content.
2. **Analyze** -- Score articles by importance/novelty/urgency, categorize by topic, extract companies.
3. **Summarize** -- Generate structured AI summaries (bullet points, executive summary, key insights, or full digest).
4. **Match** -- Score article relevance against client profiles using deterministic matching.
5. **Generate** -- Create LinkedIn posts, client emails, thought leadership, newsletter paragraphs, talking points, and investor blurbs from any article.

## App Shape

- App id: `newsletter-digest`
- Default path: `/newsletter-digest`
- Default dev port: `3002`
- Icon: `Newspaper`
- UI: Dark AI analyst workspace with glass-panel work surfaces

## Navigation

| Page | Purpose |
|---|---|
| Dashboard | Executive brief, top stories, quick actions |
| Ingest Newsletter | Microsoft 365 connection, sync, inbox metrics |
| Article Library | Searchable/filterable scored article workspace |
| Client Relevance | Client profiles + article matching |
| Content Generator | Multi-format AI content generation from articles |
| Settings | Microsoft connection, LinkedIn connection, summary format preference |

## Runtime Configuration

```bash
# Optional direct env path
MS_CLIENT_ID=<azure-app-client-id>
MS_CLIENT_SECRET=<from Azure app registration>
MS_TENANT_ID=<azure-tenant-id>
MS_SHARED_MAILBOX=<shared-mailbox@example.com>
MS_REDIRECT_URI=http://localhost:3002/api/oauth/callback

# Optional LinkedIn direct env path
LINKEDIN_CLIENT_ID=<linkedin-app-client-id>
LINKEDIN_CLIENT_SECRET=<from LinkedIn app configuration>
LINKEDIN_REDIRECT_URI=http://localhost:3002/api/linkedin/callback
```

For production deployment behind the Busibox app path:

```bash
MS_REDIRECT_URI=https://<busibox-domain>/newsletter-digest/api/oauth/callback
LINKEDIN_REDIRECT_URI=https://<busibox-domain>/newsletter-digest/api/linkedin/callback
```

The app can now run in two modes:

1. Direct env vars: the Microsoft shared mailbox values are injected as process env vars.
2. Config API: the shared mailbox values are saved from the Settings page and loaded at runtime for the whole app.

For the Config API path, the app resolves `config-api` from `CONFIG_API_URL` when present, otherwise it derives the host from the existing Busibox service URLs such as `AUTHZ_BASE_URL`, `DATA_API_URL`, or `AGENT_API_URL`.

The app also uses the standard Busibox template environment for SSO, data-api, agent-api, and AuthZ token exchange.

## Data Documents (9)

| Document | Purpose |
|---|---|
| `newsletter-digest-connections` | Microsoft account metadata, encrypted token reference, sync status |
| `newsletter-digest-linkedin-connections` | LinkedIn member metadata, encrypted token reference, publish status |
| `newsletter-digest-subscriptions` | Discovered sender metadata |
| `newsletter-digest-emails` | Synced newsletter content (sender, subject, plain text body, dates) |
| `newsletter-digest-summaries` | Structured AI summaries (title, tldr, keyPoints, actionItems, topics) |
| `newsletter-digest-preferences` | User's preferred summary format |
| `newsletter-digest-generated-content` | AI-generated drafts (LinkedIn, email, thought piece, etc.) |
| `newsletter-digest-clients` | Client profiles for relevance matching (sector, topics, priorities, account metadata) |
| `newsletter-digest-client-matches` | Persisted article-to-client relevance records used by `/clients` and `/library` |

All documents are personal visibility by default.

## API Routes

### OAuth
| Route | Method | Purpose |
|---|---|---|
| `/api/oauth/authorize` | GET | Build Microsoft auth URL (PKCE + state), redirect |
| `/api/oauth/callback` | GET | Exchange code for tokens, encrypt via keystore, store |
| `/api/oauth/status` | GET | Return connection status |
| `/api/oauth/disconnect` | POST | Delete tokens + connection record |

### LinkedIn OAuth
| Route | Method | Purpose |
|---|---|---|
| `/api/linkedin/authorize` | GET | Start LinkedIn OIDC + posting consent flow |
| `/api/linkedin/callback` | GET | Exchange code for tokens, encrypt via keystore, store |
| `/api/linkedin/status` | GET | Return LinkedIn connection status |
| `/api/linkedin/disconnect` | POST | Delete LinkedIn tokens + connection record |

### Newsletters
| Route | Method | Purpose |
|---|---|---|
| `/api/newsletters/sync` | POST | Fetch newsletters from Graph API, detect, store |
| `/api/newsletters` | GET | List stored newsletters |
| `/api/newsletters/[id]` | GET | Single newsletter + summary |
| `/api/newsletters/[id]/summarize` | POST | Generate AI summary |

### Content
| Route | Method | Purpose |
|---|---|---|
| `/api/content` | GET | List generated drafts |
| `/api/content/generate` | POST | Generate content from article (LinkedIn, email, etc.) |
| `/api/content/[id]/publish-linkedin` | POST | Publish a stored LinkedIn draft directly to the connected profile |

### Clients
| Route | Method | Purpose |
|---|---|---|
| `/api/client-relevance` | GET | Refresh and return stored article-to-client relevance matches |
| `/api/clients` | GET | List stored client profiles |
| `/api/clients` | POST | Create a client profile |
| `/api/clients/[id]` | PUT | Update a client profile |
| `/api/clients/[id]` | DELETE | Delete a client profile |

### Preferences
| Route | Method | Purpose |
|---|---|---|
| `/api/preferences` | GET | Get summary format preference |
| `/api/preferences` | PUT | Set summary format preference |

### Standard BusiBox
- `/api/auth/*`, `/api/sso`, `/api/session`, `/api/setup`, `/api/health`, `/api/agent/[...path]`, `/api/settings/*`, `/api/team`, `/api/users/search`, `/api/version`, `/api/logout`

## Content Generation

Supported output types: LinkedIn post, client email, thought leadership, newsletter paragraph, talking points, investor blurb.

Supported tones: Analytical, Executive, Conversational, Punchy, Sober, Visionary.

The generator calls `agent-api` with a strict JSON response schema and persists validated output to data-api.

LinkedIn publishing uses the official LinkedIn OAuth + Posts API path. V1 is intentionally limited to personal profile publishing only: no inbox, comment sync, post-history import, or tone-memory from historical posts.

## Core Flow

1. Open Settings and either connect Microsoft 365 personally or save shared mailbox credentials for team-wide sync.
2. OAuth callback exchanges delegated user tokens and encrypts them via AuthZ keystore when personal Microsoft login is used.
3. Shared mailbox credentials can be stored in Config API so the app can sync without per-user Microsoft login.
4. Click Sync from Dashboard or Ingest page.
5. Sync fetches latest 50 inbox messages, detects newsletters, normalizes HTML, dedupes, stores.
6. Article Library shows scored articles with search, filter, and sort.
7. Generate a summary from any article using your preferred format.
8. Open Content Generator from an article to create LinkedIn posts, emails, etc.
9. Connect LinkedIn from Settings if you want direct publishing instead of copy/paste.
10. Generated drafts are persisted, shown in Recent Drafts, and LinkedIn drafts can be published directly from the stored draft record.

## Development

```bash
npm install
npm run dev              # Standard Next.js dev (port 3002)
npm run dev:busibox      # Dev server with remote BusiBox proxy
npm run dev:busibox:init # Initialize .busibox-dev.json config
npm test                 # Run the full Vitest suite
npm run build            # Production build
```

## Deployment

From the BusiBox admin workstation:

```bash
cd /path/to/busibox
make install SERVICE=newsletter-digest
```

Environment variables for production are set via Ansible vault, not `.env.local`.

## Verification

```bash
npm test       # Full test suite
npm run build  # Clean production build
```

Manual end-to-end testing requires: registered Azure redirect URI, `MS_CLIENT_SECRET`, and reachable BusiBox services.
