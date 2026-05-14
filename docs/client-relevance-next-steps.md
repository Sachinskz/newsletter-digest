# Client Relevance: Current State And Remaining Work

This file is the restart point for the `newsletter-digest` client-relevance feature after the May 14, 2026 backend pass.

## What is completed now

- Client profiles are stored durably in `newsletter-digest-clients`.
- Client CRUD routes exist at `GET/POST /api/clients` and `PUT/DELETE /api/clients/[id]`.
- Article-to-client matches are now persisted in `newsletter-digest-client-matches`.
- `GET /api/client-relevance` refreshes match records from stored newsletters, summaries, and client profiles, then returns the stored match set.
- Deleting a client also deletes that client’s stored relevance matches.
- The `/clients` page now reads stored matches instead of computing them only in the browser.
- The `/library` page now shows real backend-driven `Relevant for` chips instead of placeholder client data.
- Topic cleanup now filters obvious filler labels such as `the`, `and`, `you`, `for`, `get`, `com`, `email`, and bare numbers.

## What still needs to be completed

### 1. Move match refresh off the read path

Right now `GET /api/client-relevance` recomputes and rewrites all client matches on every request.

That works, but it is a pragmatic first version, not the final architecture.

We should move refresh to one of these:

- refresh matches during newsletter sync
- refresh only the affected client after client create/update
- run background refresh jobs and let the UI read precomputed results

### 2. Add review and approval state before any outreach workflow

We still do not have a durable review model for client-safe outreach.

Missing backend pieces:

- draft status fields such as `draft`, `approved`, `rejected`, `sent`
- owner / reviewer assignment
- approval timestamps and audit trail
- a queue for content waiting on review
- a queue for approved content ready to send

### 3. Decide the source of truth for client data

Client profiles are app-native right now.

We still need a product and backend decision on whether clients should remain local to the app or sync from a CRM such as HubSpot or Salesforce.

If CRM sync is added later, we will need:

- external CRM IDs on client profiles
- sync direction rules
- conflict handling between local edits and CRM updates
- field mapping for topics, priorities, owners, and relationship stage

### 4. Make scoring tunable instead of hardcoded

The current scoring is deterministic and working, but the weights are still code-level constants.

If we want this feature to mature, we should add:

- configurable scoring weights
- manual include / exclude controls per client
- optional category boosts per client
- recency decay controls
- saved explanations for why an article was matched or rejected

### 5. Add stronger route coverage

The current pass added helper tests and a route test for `/api/client-relevance`, and the full app build passes.

Still worth adding later:

- route tests for `/api/clients` create/update/delete validation paths
- tests for deleting a client and confirming match cleanup end-to-end
- tests for empty-state refreshes when there are no clients or no newsletters
- browser-level verification for `/clients` and `/library`
