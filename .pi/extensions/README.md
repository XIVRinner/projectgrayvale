# Project Extensions

## github-issues.ts
GitHub issue automation tools for this repo.

### Prerequisites
1. Install GitHub CLI:
   - Ubuntu/WSL: `sudo apt update && sudo apt install -y gh`
2. Authenticate:
   - `gh auth login`

### Load
Project-local extension is auto-discovered from `.pi/extensions/`.
Use `/reload` in Pi after changes.

### Tools
- `github_issue_labels`
- `github_issue_create`
- `github_issue_list_mine`
- `github_issue_summary_mine`
