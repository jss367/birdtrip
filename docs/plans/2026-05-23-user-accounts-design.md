# User Accounts & Personalization — Design

Status: Implemented 2026-05-23 per `docs/plans/2026-05-23-user-accounts-plan.md`, behind a `?auth=1` feature flag pending end-to-end verification. Follow-ups listed at bottom remain open.

## Goal

Reduce friction for returning users by remembering their identity, life list, target species, eBird API token, and basic preferences across sessions and devices. Lay the groundwork for personalized ranking and future features (saved trips, lifer-aware scoring, seasonal awareness) that depend on knowing who the user is.

## Scope

In scope ("C-light"):

- Optional Google sign-in.
- Per-user storage of life list, target species, eBird API token, and preferences (default detour minutes, corridor radius, recent-days window, max stops, map provider).
- Merge behavior when an anonymous user signs in with data in localStorage.
- Browser-direct reads/writes to Supabase under Row-Level Security.

Out of scope, deferred to follow-ups:

- Saved trips (its own feature with real UX design needed).
- Account deletion UI.
- Data export.
- iNaturalist OAuth import (CSV upload covers both eBird and iNat for v1).
- Automated test harness.
- Privacy policy and Terms of Service.
- Sign in with Apple (web-only app does not require it; adds $99/year Apple Developer cost).

## Audience

Posture C: open to anyone, but not actively marketed. Build so it works correctly for strangers, expect mostly the author and friends in early usage.

## Non-Goals

- Replace localStorage as the primary store. localStorage remains the fast path and the anonymous-mode store; the account is the cross-device source of truth when signed in.
- Server-mediated persistence. The Node server stays stateless; all user-data traffic is browser ↔ Supabase direct.
- Real-time multi-device sync. Reads happen on session start and after sign-in. Mutations write through. No subscriptions.

## Stack

- **Hosting:** Render (unchanged) for the Node server and static assets.
- **Auth + Database:** Supabase (Google OAuth, Postgres).
- **Browser:** existing vanilla JS plus the Supabase JS client.

Render and Supabase are independent services. The Node server does not need Supabase credentials beyond exposing `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the browser. Both keys are safe to expose; security is enforced by Row-Level Security on the Postgres side.

A Supabase outage degrades the app to anonymous mode rather than breaking it.

## Data Model

Single table, one row per user.

```sql
create table profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  life_list      jsonb        not null default '{}'::jsonb,
  targets        text         not null default '',
  ebird_token    text,
  preferences    jsonb        not null default '{}'::jsonb,
  updated_at     timestamptz  not null default now()
);
```

Shapes:

- `life_list`: object `{source, fileName, importedAt, species: [...], displayNames: [...]}` — the app's existing importer output stored verbatim (YAGNI over a normalized array of `{common, scientific, code}`).
- `targets`: plain text matching the free-text textarea value, stored as-is rather than parsed into JSON (YAGNI).
- `preferences`: `{maxAddedMinutes, corridorKmRadius, recentDays, maxStops, mapProvider}`.
- `ebird_token`: plain text. Encrypted at rest by Supabase. Same threat model as today's localStorage value.

Row-Level Security:

```sql
alter table profiles enable row level security;

create policy "own row read"
  on profiles for select using (auth.uid() = user_id);

create policy "own row insert"
  on profiles for insert with check (auth.uid() = user_id);

create policy "own row update"
  on profiles for update using (auth.uid() = user_id);
```

Browser-direct access is safe because the anon key can only read or write the signed-in user's own row.

One denormalized row is the YAGNI choice: life lists are small (a few KB JSON), always read and written together, and never queried across users.

## Sign-In UX

Sign-in button in the top-right of the app shell. States:

- **Signed out:** "Sign in with Google" button.
- **Signed in:** avatar and email, with a "Sign out" menu item.
- **Loading:** small spinner during the initial Supabase session check.

Flow:

1. User clicks "Sign in with Google".
2. Supabase JS kicks off the OAuth redirect to Google.
3. Google redirects back to `birdtrip.org`; Supabase handles the callback.
4. App code runs the merge step (below) and hydrates UI.
5. Avatar appears; life list, targets, token, and preferences reflect the account.

Session persistence: Supabase JS keeps the JWT in localStorage and refreshes it silently. Users stay signed in across visits until they sign out or the refresh token expires.

Sign-out clears the Supabase session and in-memory state, but leaves the localStorage cache in place so the next anonymous session is not empty.

## Anonymous → Signed-In Merge

Runs once, the first time a sign-in completes within a session.

```
For each field in {life_list, targets, ebird_token, preferences}:
  account_val = profile row from Supabase
  local_val   = current in-browser value
  if account_val empty and local_val non-empty:
      push local_val → account
  elif account_val non-empty and local_val empty:
      hydrate local from account
  elif both non-empty and differ:
      queue for the conflict dialog
  else:
      no-op
```

If any fields are queued, show a single modal at the end of merging listing all conflicting fields. Per-field choices:

- **Use account**
- **Use this browser**
- **Merge (union for lists, account-wins for scalars)**

After the merge step completes, the account is canonical and localStorage becomes a cache of it.

## Read / Write Flow

On app start, every session:

1. Hydrate from localStorage as today (instant, works offline).
2. In parallel, ask Supabase for the current session.
3. If signed in, fetch the `profiles` row and overwrite in-memory state with account values; cache back to localStorage.
4. If not signed in, stop. localStorage is the only source.

On any mutation (CSV import, target edit, token paste, preference change):

1. Update in-memory state immediately. UI re-renders.
2. Write through to localStorage immediately.
3. If signed in, `upsert` the changed field(s) to the user's `profiles` row.
4. On Supabase write failure, surface a small toast: "Couldn't save to your account — still saved in this browser." Retry on the next mutation. Do not block the UI.

Writes are field-scoped (jsonb column updates), not whole-row replaces, so a write to targets does not clobber life_list.

Reads happen exactly twice per session: once on initial hydration, once after sign-in if that happens mid-session. No polling, no realtime subscriptions.

## Error Handling

- **Supabase unreachable on app load:** fall back to anonymous mode silently. Sign-in button shows a "Sign-in unavailable" tooltip.
- **Sign-in fails (Google denies, popup blocked):** stay anonymous; surface the Supabase error in a toast.
- **Hydrate fetch fails:** keep localStorage values. Retry once. Do not block the UI.
- **Write fails:** see Read/Write flow above.
- **JWT expires mid-session:** Supabase JS auto-refreshes. If refresh fails, revert to anonymous mode and toast "Signed out — please sign in again."

## Testing

Manual:

- Sign in, sign out, sign back in.
- All four merge-dialog cases per field: empty+empty, account-only, browser-only, both-conflict.
- Mutation write-through with the network throttled to verify offline-tolerant behavior.
- Cross-browser smoke test: import an eBird CSV in browser A, sign in; sign in to browser B; confirm the list shows up.

Automated: out of scope. Flagged as a follow-up.

## Rollout

1. Build behind a `?auth=1` query-param feature flag on `birdtrip.org`.
2. Iterate until the flow feels right.
3. Flip the flag default to on.

No data migration needed: existing anonymous users keep working unchanged; the merge step handles their first sign-in.

## Configuration

Render environment variables added:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Both are exposed to the browser (via `/api/config` or by templating into `index.html`). RLS is the security boundary, not key secrecy.

Google Cloud and Supabase one-time setup:

- Create a Google Cloud OAuth client with `birdtrip.org` and `localhost:4177` in the authorized redirect URIs.
- Configure Google as a Supabase auth provider with the same redirect URIs.

## Follow-Ups (Not in This Slice)

- Saved trips, with its own design.
- Account deletion and data export.
- iNaturalist OAuth import.
- Lifer-aware ranking that uses the now-persistent life list to boost likely lifers in scoring (currently only happens when a user imports per-session).
- Seasonal awareness in scoring.
- Automated test harness.
- Privacy policy and Terms of Service, if and when the user base widens.
