---
name: github-issue-intake
description: Create and track GitHub issues in the current repository using strict existing-label policy. Use when user reports bugs, UI/UX problems, behavior complaints, or missing UI/UX and wants issue tracking.
---

# GitHub Issue Intake

Use this skill when user wants issue creation/tracking in this repo.

## Definitions
Treat all as issue-worthy bugs when user says:
- broken functionality
- “I don’t like this UI”
- “I don’t like this behavior”
- missing UI/UX

## Required fields
Before creating issue, ensure:
1. Title (required)
2. Description (required)
3. Labels (required, 1+)

Assignee is optional and should not block creation.

## Strict label policy
- Labels must already exist in repository.
- Never invent new labels silently.
- If requested label is missing, ask user before creating it.

## Tool workflow
1. Call `github_issue_labels` to fetch valid labels if label certainty is low.
2. Build issue draft from user report.
3. Confirm title/description/labels with user if any ambiguity remains.
4. Call `github_issue_create`.
   - Default: `allowCreateMissingLabels=false`
   - Set `allowCreateMissingLabels=true` only after explicit user approval.
5. Preserve multiline formatting in descriptions.
   - Do **not** rely on literal `\n` text in issue body inputs.
   - Use real newlines (e.g., heredoc/file input) so bullets/paragraphs render correctly.

## Tracking workflow
For “track my issues” requests:
- Use `github_issue_list_mine` (default open issues)
- Use `github_issue_summary_mine` for fast status overview

## Output style
- Keep updates compact.
- Always return created issue URL.
- If blocked by labels, list missing labels and ask next action.
