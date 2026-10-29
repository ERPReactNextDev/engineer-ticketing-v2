# Prompt: Migrate the Job Request workflow from Firebase to Supabase

Copy and paste the prompt below when you are ready to implement the migration.

---

## Prompt

I want to migrate the **complete Job Request workflow** in this repository from Firebase/Firestore to Supabase/Postgres. Please inspect the current code and implement the migration end to end. Do not stop after creating a table or migrating only the submission form.

### Scope

Trace every screen, component, API route, helper, and background operation that reads or writes data for the Job Request workflow. At minimum, inspect and account for:

- Creating and submitting a Job Request, including draft behavior, generated Job Request numbers, test-mode numbers, and number reservations.
- The Job Request list/dashboard: subscriptions or refresh behavior, sorting, filtering, search, pagination, counts, access to requests, and priority toggling.
- The Job Request detail page: loading a request, status transitions, role-specific notes, per-user viewed status, approval timestamps, approver IDs/names/signatures, document URLs, and procurement summary data.
- The Fill Up Form draft and procurement data currently saved separately from the request, including its lifecycle and any data copied into the request.
- Collaboration/chat messages and any other data stored in or associated with a Job Request.
- Realtime updates, notifications, and all related reads/writes that depend on Job Request changes.
- Every existing Firebase collection/helper used by these flows, including `job_requests`, `job_fill_ups`, and any counter/reservation collections.

Do not migrate unrelated Firebase features or replace Firebase throughout the whole application. Keep the scope limited to the Job Request workflow and the supporting code it actually depends on.

### Requirements

1. **Audit before editing.** Identify all Job Request Firebase operations and their callers. Follow the data end to end so that no workflow path silently continues to use Firestore after migration.
2. **Preserve existing behavior and UX.** Keep the current form fields, status values, approval order, permissions, notes, number format, filters, notifications, and error handling unless a change is necessary for the Supabase migration. Explain any unavoidable behavior change.
3. **Use a relational schema intentionally.** Review `supabase/job_requests.sql` and update or replace it as needed. Choose appropriately between columns and related tables for workflow records, drafts, approvals, and messages. Use `jsonb` only where the data is genuinely flexible or nested. Include constraints, indexes, timestamp handling, and migration-safe SQL.
4. **Preserve Firebase records.** Provide a documented, repeatable data migration path that preserves Firebase document IDs and maps legacy field names and values correctly. Handle missing/nullable fields, Firestore timestamps, arrays, nested objects, and duplicate Job Request numbers. Do not delete or mutate Firebase data as part of a one-time migration unless explicitly approved.
5. **Implement safe data access.** Use the repository's existing Supabase setup and patterns where available. Keep privileged credentials server-side. Define and document Row Level Security policies that match the application's actual identity and role model. Do not create permissive policies such as unrestricted access for all users, and do not assume Firebase authentication automatically maps to Supabase authentication.
6. **Preserve realtime and atomicity.** Replace Firestore listeners with appropriate Supabase realtime subscriptions or a reliable refresh strategy. Make multi-record workflow changes atomic where needed, using a database function/RPC or another appropriate transaction boundary. Ensure sequential Job Request number generation remains safe under concurrent submissions.
7. **Handle uploads deliberately.** Inspect the current image/PDF upload providers. Preserve existing file URLs and providers unless moving storage is explicitly required; if storage migration is required, include bucket setup, access policies, and a safe plan for existing files.
8. **Keep interfaces consistent.** Normalize Supabase snake_case rows into the shapes expected by existing UI code, or update all consumers consistently. Avoid a partial conversion that leaves mixed Firestore and Supabase field conventions.
9. **Update directly related documentation.** Document required Supabase setup, schema application, environment variables, RLS/auth assumptions, data backfill, and any manual dashboard steps.
10. **Validate the exact workflow.** Run focused tests, linting, and type checks available in the repository. Add or update tests for submission, number uniqueness, request visibility, status/approval updates, drafts, and relevant realtime behavior. Report anything that cannot be tested locally.

### Implementation approach

- First report a concise inventory of the workflow surfaces and proposed migration/data model.
- If an unresolved decision affects authorization, data retention, file storage, or workflow behavior, ask me before making that decision.
- Then implement the complete migration in coherent changes, updating every relevant caller and removing obsolete Firestore use from this workflow only.
- Do not add fake success fallbacks, silently swallow errors, weaken access controls, or make unrelated cleanup changes.
- Preserve unrelated work already present in the working tree.

### Completion report

When finished, summarize:

- What workflow surfaces and data were migrated.
- Which SQL/migration files and setup steps I need to apply.
- How existing Firebase records are backfilled and how IDs are preserved.
- The RLS/auth model and any assumptions or remaining manual setup.
- Tests and validation run, including any failures or limitations.
