# Plan: Auto-Guess Config Name & Description

## TL;DR

When the `init` command creates a `.workonrc.json`, populate `name` and `description` fields by parsing project manifest files (package.json, Cargo.toml, pyproject.toml, pom.xml, .csproj, go.mod) and README.md. For name: prefer manifest over directory basename. For description: prefer manifest over README first line, max 100 chars.

## Steps

**Phase 1: Create Manifest Parsing Utility**

1. Create new module `src/core/metadata.ts` to extract name/description from manifests by project type:
   - **nodejs** (package.json): `name`, `description` fields
   - **rust** (Cargo.toml): `[package]` section's `name`, `description` fields
   - **python** (pyproject.toml or setup.py): `project.name`/`[project]name`, `project.description` fields
   - **go** (go.mod): Extract module name from first `module` directive
   - **java** (pom.xml): `<artifactId>` and `<description>` tags
   - **dotnet** (.csproj): `<AssemblyName>` and `<AssemblyDescription>` tags
   - Each language handler: returns `{ name?: string; description?: string }` or `null` on error
2. Create utility `extractReadmeFirstLine(projectPath: string): string | null` that finds README.md and returns truncated first non-empty line (≤100 chars)

**Phase 2: Create Guessing Logic** 3. Create exported function `guessProjectMetadata(projectPath: string, projectType: ProjectType): { name?: string; description?: string }` in `metadata.ts`:

- Call appropriate manifest parser for detected project type
- If manifest returns name/description, use them
- If manifest description missing but README found, use README first line (truncated to 100 chars)
- If name missing, default to directory basename (via path.basename)
- Return `{ name, description }` with only populated fields

**Phase 3: Integrate into Init Command** 4. Update `src/commands/init.ts` to call `guessProjectMetadata`:

- After detecting project type, call `guessProjectMetadata(cwd, projectType)`
- Merge guessed metadata into the `devProjectConfig` object before writing
- Preserve existing behavior (IDE, profile from global config, etc.)

**Phase 4: Testing** 5. Create tests in `tests/metadata.test.ts`:

- Unit tests for each manifest parser (nodejs, rust, python, go, java, dotnet)
- Unit tests for README extraction (normal line, long line, no README, empty README)
- Integration test for `guessProjectMetadata` with real fixture directories
- Tests for fallback behavior (missing manifest fields, missing files)

6. Verify against existing fixtures in `tests/fixtures/` (configured, nodejs, python, rust) and create additional fixtures if needed
7. Manual test: `pnpm run init` in sample project directory to verify name/description auto-population

## Relevant Files

- `src/core/metadata.ts` — **new file** with manifest parsers and metadata guessing logic
- `src/commands/init.ts` — integrate guessing call before writing config
- `src/core/project.ts` — reference ProjectType enum for supported types
- `src/types.ts` — reference DevProjectConfig type shape
- `tests/metadata.test.ts` — **new file** with unit and integration tests
- `tests/fixtures/` — may need additional sample fixtures with populated package.json/Cargo.toml descriptions

## Verification

1. **Automated**: Run `pnpm test` to validate all metadata parsing tests pass
2. **Integration**: Create test fixture with populated manifest files, run init, verify .workonrc.json contains guessed name/description
3. **Manual**:
   - `cd` to a real Node.js project with package.json (has name/description) → run `pnpm run init` → verify name/description are populated
   - `cd` to a project with only README.md (no manifest) → run `pnpm run init` → verify name from basename, description from README
   - `cd` to project missing both manifest description and README → verify name from manifest or basename, description omitted

## Decisions

- **Length limit**: 100 chars for guessed descriptions (truncate with ellipsis if needed)
- **Priority order for description**: manifest → README → omit
- **Priority order for name**: manifest → directory basename
- **Error handling**: Silently fall back to defaults on parse errors; don't block config creation
- **Supported types**: All 7 ProjectType values (nodejs, rust, go, python, java, dotnet, generic)

## Further Considerations

1. **README parsing**: Should we strip leading `#` markdown headers and normalize whitespace? _Recommendation: Yes, basic cleanup (trim, remove leading `#`, normalize spaces) improves description quality._
2. **Long descriptions**: Is 100 char truncation with `…` suffix sufficient, or should we preserve word boundaries? _Recommendation: Truncate at word boundary before 100 chars to avoid cutting mid-word._
3. **Generic projects**: For projects with no recognized manifest, should name default to basename or remain empty? _Recommendation: Always provide name (basename fallback ensures consistency)._
