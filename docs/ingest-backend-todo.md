# Ingest Backend TODO

This file tracks the backend work still missing behind the UI-only `Ingest Newsletter` page.

## Microsoft connection + sender model

- Add a real sender/source document for connected newsletter senders, frequency, last received, and sync status.
- Expose a route to list connected senders and derived sender metrics for the right rail.
- Decide whether sender rules live inside the connection document or a separate `newsletter-digest-rules` document.

## Inbox queue + processing

- Add an ingestion queue document for raw newsletter messages waiting to be extracted.
- Expose a route to list queued newsletter messages with processed state and counts.
- Add `POST /api/ingest/process-all` and `POST /api/ingest/process-one` routes.
- Implement extraction flow: fetch email body, detect newsletter, normalize content, create/update stored newsletter records, mark queue item processed.
- Return real queue totals for `articles queued`, `processed today`, and related metrics.

## Manual paste fallback

- Decide whether manual paste remains part of product scope.
- If yes, add `POST /api/ingest/parse` to parse raw pasted newsletter text into previewable extracted items.
- Decide whether manual paste creates durable newsletter records immediately or only preview records before confirmation.

## Filters and rules

- Add persistence and API routes for sender/domain/subject include-exclude rules.
- Wire `Add filter rule` and `Filters & rules` buttons to real CRUD.
- Define how rules affect Microsoft sync: pre-filter messages vs post-filter detected newsletters.

## Connection actions

- Wire `Sync now` to the real sync endpoint and return actionable queue refresh state.
- Wire `Disconnect` to a confirmed revoke/disconnect flow with refreshed UI state.
- Decide whether the ingest page should show a dedicated ingestion mailbox alias or only the connected Microsoft account.

## Article library

- Add a durable saved/bookmarked article state per user instead of the current local-only toggle.
- Expose article metadata enrichment for category, importance, novelty, urgency, companies, and topics so the library does not rely on frontend-derived heuristics.
- Decide whether the library drawer should read from the stored newsletter detail route or a dedicated article abstraction.

## Client relevance

- Client profile document plus CRUD API now exists for sectors, priorities, topics, and account metadata.
- Article-to-client match persistence now exists via `newsletter-digest-client-matches`.
- `GET /api/client-relevance` now refreshes and returns stored client relevance records for the UI.
- Decide whether client data is app-native or synced from CRM systems like HubSpot or Salesforce.
- Move client match refresh off the read path so it is not recomputed on every `GET /api/client-relevance` request.
- Decide how approval, send queues, and client-safe review should work before outreach content is actually delivered.

## Content generator

- Persisted LLM draft generation is wired through `POST /api/content/generate` and stored in `newsletter-digest-generated-content`.
- Add editable draft revisions, approval status, and owner metadata before enabling any send workflow.
- Add optional CRM or contact-book lookup for email recipients instead of the current local sample client profiles.
- Add provider-specific send actions only after the approval model is agreed.
