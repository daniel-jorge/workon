---
name: gen-spec
description: "Generate an implementable functional specification and Gherkin BDD acceptance criteria from a user requirement. Use when: defining a new feature, writing a .spec.md, creating requirements, planning a feature, describing user flows, writing acceptance criteria, specifying a CLI command, specifying a TUI interaction, generating a .feature file, decision-forcing questions, edge case coverage, preventing ambiguous specs."
argument-hint: 'Describe the feature or change to specify (e.g. "namespace aliases for project tags")'
---

# Generate Functional Specification

Produces **two documents** in `docs/`:

- `docs/<feature-slug>.spec.md` — Implementable functional specification
- `docs/<feature-slug>.feature` — Gherkin acceptance criteria

## Workflow Overview

```
[1] Explore codebase context
        ↓
[2] Analyze input — identify gaps, ambiguities
        ↓
[3] Ask clarifying questions
        ↓
[4] Draft .spec.md
        ↓
[5] Subagent review → identify missing decisions
        ↓
[6] Iterate with user until spec is approved
        ↓
[7] Generate .feature (Gherkin) via subagent
        ↓
[7b] Subagent review → verify Gherkin completeness
        ↓
[7c] Fix gaps, re-review until clean
```

---

## Phase 1 — Explore Project Context

Use a **read-only subagent** (`Explore` agent) to gather:

1. **Existing feature scope** — What already exists related to the request? Read `docs/workon.tech.md` and all `docs/*.spec.md` files to find existing features and the **highest current F-number**. This determines the next F-number for the new feature.
2. **Relevant types** — Read `src/types.ts`, `src/core/config.ts` for current data shapes (`Project`, `GlobalConfig`, `OpenCommand`).
3. **Affected source files** — Which commands, core modules, or TUI components are likely touched?
4. **Existing specs structure** — Skim `docs/pinned-projects.spec.md` or `docs/ide-selection.spec.md` to calibrate format and detail level.
5. **Multi-system check** — Note if the feature spans CLI + TUI + core simultaneously; if so, separate user flows per entry point will be needed.

Subagent prompt hint:

> "Explore the workon project. Find what already exists related to [user input]. Scan all docs/\*.spec.md files and return the highest F-number currently assigned. Return: relevant existing features, highest F-number, types, affected files, and any prior spec/plan covering similar ground."

---

## Phase 2 — Analyze the Input

Before asking questions, extract from the user input what is **already known** vs **ambiguous**:

| Known                                    | Ambiguous (needs clarification)                              |
| ---------------------------------------- | ------------------------------------------------------------ |
| What the user wants to achieve (goal)    | How the user interacts with it (CLI args? TUI keys? Config?) |
| Which area it affects (core / TUI / CLI) | Where new data is stored (GlobalConfig? per-project?)        |
| Feature name / slug                      | Error handling behavior                                      |
|                                          | Backward compatibility constraints                           |
|                                          | Performance constraints                                      |

---

## Phase 3 — Ask Clarifying Questions

Use `vscode_askQuestions` to ask the user. Only ask about genuinely **ambiguous** items — do not ask what you can infer from context.

**Core questions to consider** (omit any that are already clear):

1. **Goal statement** — "In one sentence: what problem does this solve for the developer?"
2. **Entry point** — Is this a new CLI subcommand, a flag on an existing command, a TUI interaction, or a config option?
3. **User interaction model** — How does the user trigger it? (keyboard shortcut, argument, menu item)
4. **Data persistence** — Does this require new state? If so, where does it live? (GlobalConfig at `~/.workonrc.json`, per-project `.workonrc.json`, or runtime-only)
5. **Error cases** — What should happen when it fails? (silent skip, error message, prompt)
6. **Edge cases** — What edge cases do you anticipate? (empty state, missing files, concurrent operations, large datasets, deleted directories). List 2-3.
7. **Backward compatibility** — Must existing config, commands, or behavior remain unchanged? If yes, should the old behavior deprecate gradually or immediately?
8. **Scope boundaries** — What is explicitly OUT of scope for the first version?

**Decision-forcing questions** (always ask if applicable):

- If the feature touches the TUI: "What keyboard shortcut should trigger this? Provide options and recommend one."
- If the feature adds config: "Should this config key be optional with a default value? What's the default?"
- If the feature changes scan behavior: "Should this affect pinned projects differently from discovered projects?"

**Format**: Present options with a recommended default (marked **recommended**) for decision questions. The user can accept or choose an alternative.

---

## Phase 4 — Draft the Specification

Follow the [spec template](./references/spec-template.md) strictly. Key rules:

- **Feature number**: Assign the next available F-number using the highest F-number found in Phase 1 exploration (parse all `docs/*.spec.md` and `docs/workon.tech.md`). Do NOT rely on a hardcoded range — always derive dynamically.
- **Requirement IDs**: FR1–FRn for functional, NFR1–NFRn for non-functional, EC1–ECn for edge cases
- **User flows**: Written as numbered step sequences with explicit "User does X → System responds Y" format
- **No implementation details in the spec**: Don't mention file names, function names, or library choices — those belong in `.plan.md`
- **Acceptance criteria**: Each item must be independently verifiable (testable)

Name the file: `docs/<feature-slug>.spec.md` where slug is lowercase, hyphenated (e.g., `namespace-aliases`, `bulk-pin`, `export-config`).

---

## Phase 5 — Subagent Review

After drafting the spec, use a **subagent** to review it for completeness and implementability. Provide the subagent with:

1. The full draft spec content
2. The full `docs/workon.tech.md` content (for architecture context)
3. Current `src/types.ts` content

**Subagent review prompt**:

> "Review this functional specification for the `workon` CLI tool. Check:
>
> 1. Are all functional requirements clearly stated and unambiguous?
> 2. Are there missing edge cases (empty states, concurrent operations, invalid input, disk errors)?
> 3. Are there open decisions not yet resolved (any 'TBD', vague 'should', or conflicting requirements)?
> 4. Is every acceptance criterion independently verifiable (testable in under 2 minutes)?
> 5. Is the spec consistent with the existing architecture (types, config schema, TUI patterns)?
> 6. Are there backward-compatibility or migration concerns not mentioned?
> 7. If the feature touches CLI and TUI, are both entry points covered in separate user flows?
>
> Return findings as YAML:
>
> ```yaml
> issues:
>   - issue_id: 1
>     severity: blocking|important|minor
>     description: "..."
>     suggested_fix: "..."
> ```
>
> If no issues found, return `issues: []`."

**If subagent is unavailable**: Ask the user: "Automated review is unavailable. Proceed without it? (Spec may have gaps.)" If yes, continue to Phase 6 with a `> ⚠ Not reviewed` note at the top of the spec.

---

## Phase 6 — Iterate Until Approved

For each **blocking** or **important** issue found by the review subagent:

1. Present the issue clearly to the user with the `suggested_fix` from the review
2. Propose 2-3 concrete options with a recommendation
3. Ask for the user's decision
4. Update the spec accordingly

**Re-review mandate**: After any round of changes that addresses blocking or important issues, **re-run Phase 5** before proceeding. Only terminate when the review returns `issues: []` (or only minor issues remain) **and** the user explicitly approves ("looks good", "proceed", "ship it").

**Status tracking**: Update the spec's `Status:` field as it progresses:

- `Draft` → during initial writing
- `Review` → while under subagent review / iteration
- `Approved` → when user approves and no blocking issues remain

---

## Phase 7 — Generate Gherkin Acceptance Criteria

Once the spec is approved, use a **subagent** to generate the `.feature` file. Provide:

1. The finalized spec
2. The [gherkin guide](./references/gherkin-guide.md)
3. An existing `.feature` example: `docs/pinned-projects.feature`

**Subagent generation prompt**:

> "Generate a Gherkin `.feature` file for the `workon` CLI tool based on the attached functional specification. Follow the conventions in the gherkin guide and match the style of the provided example.
> Rules:
>
> - Organize scenarios in groups: Happy Path → Edge Cases → Error Handling → Integration
> - Each Acceptance Criterion (AC) in the spec must have **at least one** corresponding Gherkin scenario
> - Each Edge Case (EC) must have 1-2 scenarios
> - Use Scenario Outline + Examples for parametric cases (e.g., different IDE options)
> - Use data tables where there are lists of options or projects
> - Include inline comment mapping each scenario group to its spec ACs (e.g., `# Covers AC1, AC3`)
> - All CLI scenarios must end with `And the CLI should exit with code 0` (or `code 1` for errors)"

Save the result as `docs/<feature-slug>.feature`.

### Phase 7b — Review Generated Gherkin

After saving the `.feature` file, use a **second subagent** to review it for completeness and quality. Provide:

1. The generated `.feature` file content
2. The finalized `.spec.md` content

**Subagent review prompt**:
> "Review this Gherkin `.feature` file against the attached functional specification for the `workon` CLI tool. Check:
> 1. Does every Acceptance Criterion (AC1–ACn) have at least one corresponding scenario?
> 2. Does every Edge Case (EC1–ECn) have at least one scenario?
> 3. Are scenarios organized into the four groups: Happy Path, Edge Cases, Error Handling, Integration?
> 4. Are all Given/When/Then steps specific and verifiable (no vague steps like 'it should work')?
> 5. Do all CLI scenarios assert the exit code (code 0 or code 1)?
> 6. Are there missing integration scenarios (search + feature, scan + feature, config persistence)?
> 7. Are scenario titles descriptive and unique?
>
> Return findings as YAML:
> ```yaml
> issues:
>   - issue_id: 1
>     severity: blocking|important|minor
>     description: \"...\"
>     suggested_fix: \"...\"
>     missing_ac_or_ec: \"AC3\"   # if applicable
> ```
> If no issues found, return `issues: []`."

For each **blocking** or **important** issue: update the `.feature` file directly (no user decision needed for coverage gaps — add the missing scenarios). For **minor** issues, present them to the user and ask whether to fix.

Re-run the review after fixes until `issues: []` or only minor issues remain.

---

## Output Checklist

Before finishing, confirm both files exist and:

- [ ] `docs/<slug>.spec.md` — has Purpose, FR1–FRn, User Flow, NFRs, EC1–ECn, Acceptance Criteria
- [ ] `docs/<slug>.spec.md` — Status is set to `Approved`
- [ ] `docs/<slug>.feature` — has Feature header, organized scenario groups (Happy Path / Edge Cases / Error Handling / Integration)
- [ ] `docs/<slug>.feature` — each scenario title is descriptive (no "test that X works" patterns)
- [ ] `docs/<slug>.feature` — inline `# Covers ACn` comments link scenarios to spec ACs
- [ ] No open `TBD` items remain in the spec
- [ ] Every acceptance criterion in the spec has at least one corresponding Gherkin scenario
- [ ] Feature number (F{N}) is noted in the spec title for cross-reference with `workon.tech.md`
- [ ] F-number was derived dynamically (not guessed from a hardcoded range)

---

## References

- [Spec Template](./references/spec-template.md) — Full `.spec.md` template with all sections
- [Gherkin Guide](./references/gherkin-guide.md) — Conventions for `.feature` files in this project
