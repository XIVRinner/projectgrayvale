# Content Validation Pipeline Design (Kairos Edit Follow-On)

**Date:** 2026-05-18  
**Status:** Draft approved in brainstorming (ready for plan)  
**Scope:** Repo-level data-pipeline validation for priorities C → D → E → F

## 1. Context

The project’s authoring workflow priority is:

1. B) JSON authoring/editing speed (already covered by **Kairos Edit**)
2. C) Cross-content reference integrity
3. D) Angular data loading/parsing reliability
4. E) Dialogue compile/runtime input validity
5. F) Safe regression detection before gameplay breaks

This design defines a single validation entrypoint that hardens C→F while preserving fast authoring velocity.

## 2. Goals

- Provide one command for local and CI validation.
- Fail on dangling IDs across content files.
- Catch Angular asset-load + schema-parse failures early.
- Catch dialogue script compile failures early.
- Run fast smoke checks for data-dependent paths.
- Produce both engineer-readable console output and machine-readable JSON artifact.

## 3. Non-Goals

- Replacing Kairos Edit authoring UX.
- Full gameplay/balance validation in this milestone.
- Heavy full-suite test execution in content validation.
- New data model invention outside existing schemas/contracts.

## 4. Recommended Approach

Adopt **Approach 1: Monolithic validator CLI** (single repo-level command), with internal structure that can later split into modular validators if needed.

Rationale:
- Best local ergonomics (one command).
- Easiest CI integration.
- Most straightforward reporting consistency.

## 5. Architecture

Create one repo entrypoint:

- `scripts/validate-content`

It runs ordered stages:

1. **Reference integrity** (dangling ID detection)
2. **Angular data-load validation** (assets load + Zod parse checks)
3. **Dialogue validation** (`.fsc` / `.vf` compile checks)
4. **Smoke tests** (fast data-dependent verification)

Behavior:
- Sequential stage execution (deterministic ordering).
- Continue-through-failure by default to produce a complete report.
- Non-zero exit code if any stage fails.

## 6. Stage Result Contract

Every stage returns a normalized result:

```ts
{
  stage: string;
  status: 'pass' | 'fail';
  issues: Array<{
    file: string;
    pathOrField: string;
    code: string;
    message: string;
    relatedId?: string;
  }>;
  timingMs: number;
}
```

Pipeline aggregation:
- `overallStatus = fail` when one or more stages fail.
- Preserve per-stage issue lists for reporting and artifact output.

## 7. Reference Integrity Stage (C priority)

Implementation expectations:
- Build in-memory indexes of known IDs by entity type from configured content roots.
- Scan reference-bearing fields and validate target IDs exist in the correct type index.
- Emit precise issues with:
  - source file
  - field path
  - missing ID
  - issue code

Primary rule for milestone 1:
- **No dangling IDs** across content.

## 8. Reporting Design (Engineer-first)

### Console output

Per stage:
- Stage header with pass/fail + duration.
- Group failures by:
  1. `code`
  2. file
  3. field path

Final summary:
- total issue count
- failed stage list
- JSON artifact path

### JSON artifact

Stable artifact schema:

```json
{
  "schemaVersion": "1",
  "meta": {
    "timestamp": "ISO-8601",
    "commitSha": "optional",
    "durationMs": 0
  },
  "stages": [],
  "summary": {
    "failedStages": [],
    "issueCount": 0,
    "countsByCode": {}
  }
}
```

Rules:
- Emit artifact on both pass and fail.
- CI pass/fail is determined by process exit code, not by parsing artifact.

## 9. CI Integration

Add one CI command path, e.g.:

- `rtk npm run validate:content`

Artifact path should be stable, e.g.:

- `reports/content-validation/latest.json`

CI should upload this artifact in both success and failure cases.

## 10. Testing Strategy

- **Unit tests** for each stage checker (especially dangling-ID resolver/indexing).
- **Fixture integration tests** with intentionally broken references.
- **End-to-end validator test** for:
  - multi-stage execution
  - artifact generation
  - non-zero exit behavior on failure

Performance guardrail:
- Smoke tests only in this pipeline; avoid heavy test suites.

## 11. Rollout Plan

1. Land validator with full reporting.
2. Optionally run short non-blocking baseline period if needed.
3. Enforce blocking mode once baseline issues are addressed.
4. Add new validation codes incrementally (avoid broad, unstable rule explosions).

## 12. Future Extensions (Out of current milestone)

- `--stage <name>` filtered runs.
- `--fail-fast` behavior.
- Split internals into modular validator packages if scale requires it.
- Additional semantic integrity rules (progression bounds, balance envelopes, etc.).

## 13. Acceptance Criteria

- Single command exists and runs all four stages in order.
- Dangling IDs are detected with exact file + field path diagnostics.
- Angular loader/parse failures and dialogue compile failures are surfaced in the same report.
- Fast smoke checks run and influence final status.
- Console output is engineer-readable and grouped.
- JSON artifact is always written and uploaded by CI.
- CI fails when any stage fails.
