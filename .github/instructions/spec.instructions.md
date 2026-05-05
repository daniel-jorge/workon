---
description: "Use when writing, editing, or reviewing a spec file (*.spec.md). Ensures new domain terms introduced in the spec are reflected in the ubiquitous language glossary."
applyTo: "**/*.spec.md"
---

When writing or editing this spec, check whether any new domain terms are introduced.

After finishing the spec, run the `/update-ubiquitous-language` prompt to add any new terms to [UBIQUITOUS_LANGUAGE.md](../../UBIQUITOUS_LANGUAGE.md).

Guidelines for naming terms in specs:

- Use the exact same term that appears (or will appear) in `src/types.ts` and schema files.
- Prefer noun phrases that match the code (e.g., "Open Command", not "Launch Command" or "IDE").
- If a spec introduces a new concept, define it clearly in the spec itself before using it.
