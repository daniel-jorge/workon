---
description: "Update UBIQUITOUS_LANGUAGE.md with new or changed domain terms. Use when adding a new spec, feature, type, or config field that introduces new terminology."
agent: "agent"
---

Review the project's domain vocabulary and update [UBIQUITOUS_LANGUAGE.md](../../UBIQUITOUS_LANGUAGE.md).

## Steps

1. **Read the current glossary** from [UBIQUITOUS_LANGUAGE.md](../../UBIQUITOUS_LANGUAGE.md).

2. **Scan for new or changed terms** across:
   - [src/types.ts](../../src/types.ts) — shared TypeScript types
   - [src/core/config.ts](../../src/core/config.ts) — global config schema
   - [src/core/devproject.ts](../../src/core/devproject.ts) — per-project config schema
   - All `docs/*.spec.md` files — functional specifications
   - All `docs/*.feature` files — Gherkin acceptance criteria (if any)

3. **Identify gaps**: terms that appear in the source material but are missing or outdated in the glossary.

4. **Update the glossary**:
   - Add new terms under the most appropriate existing section.
   - Create a new section only if no existing section fits.
   - Update definitions that have become inaccurate.
   - Do NOT remove terms unless they have been fully deleted from the codebase and all specs.
   - Keep definitions concise (1–3 sentences). Cross-reference related terms using bold.

5. **Report** which terms were added, updated, or left unchanged.
