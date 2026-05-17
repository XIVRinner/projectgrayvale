# GitHub Issue Automation (Skill + Extension)

## Goal
Enable fast, structured issue creation and tracking in this project using GitHub CLI.

## Decisions
- Primary execution path: `gh` CLI (local auth/session)
- Required issue fields: Title, Description, Labels
- Labels policy: strict existing labels only
- If requested label does not exist: ask before creating any new label
- Tracking default: issues created by current authenticated user (`@me`)
- Bug definition includes: classic bugs, disliked UI, disliked behavior, missing UI/UX

## Architecture
1. Project skill: `github-issue-intake`
   - Intake and validation workflow
   - Converts user reports into issue draft
   - Enforces required fields and strict label policy
2. Project extension: `github-issues.ts`
   - Custom tools for issue ops via `gh`
   - Repo/label discovery and validation
   - Create/list/summary tools

## Tooling
Extension tools:
- `github_issue_labels` → list available labels
- `github_issue_create` → validate labels, create issue
- `github_issue_list_mine` → list issues authored by `@me`
- `github_issue_summary_mine` → grouped status summary for `@me`

## Error handling
- Missing `gh`: clear install guidance
- Not authenticated: prompt `gh auth login`
- Missing labels: return actionable error with unknown labels
- Optional auto-create labels only when explicitly allowed per call

## Success criteria
- Agent can take natural bug report and open issue with required fields
- Invalid labels are blocked by default
- User can query their issue backlog quickly
