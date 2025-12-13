# Execution Rules (Authoritative)

These rules apply to all tasks in this repository.

## Authority
- You are authorized to proceed autonomously.
- Do NOT ask for confirmation before implementing changes.
- Do NOT pause for approval or design discussions.
- If something is ambiguous, choose the simplest reasonable option and proceed.

## Scope & Boundaries
- Do NOT introduce new technologies, frameworks, or major dependencies unless explicitly requested.
- Do NOT upgrade existing dependencies (e.g., Prisma, React, Node) unless explicitly instructed.
- Follow the existing architecture and Execution-Plan.md.

## Code Changes
- Prefer minimal, incremental changes.
- Do NOT rename existing models, tables, or public APIs.
- Do NOT change the Prisma schema unless explicitly instructed.
- Keep logic on the server; the client should only consume APIs.

## Data & Persistence
- Use Prisma Client for all DB access.
- SQLite is the only database.
- JSON data should be stored as strings where required by the schema.

## Error Handling
- Validate all API inputs (zod).
- Return meaningful HTTP errors (400 for validation, 500 for unexpected errors).
- Do not silently swallow errors.

## Output Expectations
- Deliver final code directly.
- Avoid explanations unless explicitly requested.
- No TODO placeholders unless explicitly allowed.

## Questions Policy
- Do not ask clarifying questions.
- Only ask a question if you are completely blocked and cannot proceed without new information.
