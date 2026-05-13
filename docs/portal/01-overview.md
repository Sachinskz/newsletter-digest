---
title: "Newsletter Digest Overview"
category: "apps"
order: 1
description: "Connect Microsoft 365 newsletters to Busibox AI summaries"
published: true
app_id: "newsletter-digest"
app_name: "Newsletter Digest"
---

# Newsletter Digest

Newsletter Digest connects a user's Microsoft 365 mailbox, finds recent newsletter-style emails, stores normalized newsletter text in Busibox data-api, and generates structured AI summaries on demand.

## Key Features

- **Microsoft 365 connection**: Uses OAuth with PKCE and offline access for refreshable mailbox sync.
- **Token safety**: Encrypts Microsoft tokens through AuthZ keystore instead of storing plaintext secrets.
- **Newsletter sync**: Scans the latest inbox messages and keeps only detected newsletter content.
- **AI summaries**: Uses agent-api to produce title, TLDR, key points, action items, topics, and read-time metadata.

## Getting Started

1. Open Newsletter Digest from the Busibox Portal.
2. Connect Microsoft 365 from Settings.
3. Sync recent newsletters from the Digest or Newsletters page.
4. Open a newsletter and generate a summary.

## How It Works

Newsletter Digest integrates with the Busibox platform to provide:

- **Data Storage**: Uses the data-api for persistent storage
- **AI Agents**: Leverages agent-api for structured newsletter summaries
- **Authentication**: Uses Busibox SSO for secure access

## Related Documentation

- [Busibox Platform Overview](../../users/10-platform-overview.md)
- [Building Apps on Busibox](../../users/16-app-development.md)
