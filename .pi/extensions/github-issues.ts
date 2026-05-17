import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

type RepoInfo = { owner: string; name: string; slug: string };

type GhExec = { code: number; stdout: string; stderr: string };

async function gh(pi: ExtensionAPI, cwd: string, args: string[], timeout = 15_000): Promise<GhExec> {
  return pi.exec("gh", args, { cwd, timeout });
}

async function ensureGhReady(pi: ExtensionAPI, cwd: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const version = await gh(pi, cwd, ["--version"], 5_000);
  if (version.code !== 0) {
    return {
      ok: false,
      message:
        "GitHub CLI is not installed. Install with: sudo apt update && sudo apt install gh (or see https://cli.github.com/)",
    };
  }

  const auth = await gh(pi, cwd, ["auth", "status"], 8_000);
  if (auth.code !== 0) {
    return { ok: false, message: "GitHub CLI is not authenticated. Run: gh auth login" };
  }

  return { ok: true };
}

async function resolveRepo(pi: ExtensionAPI, cwd: string): Promise<RepoInfo> {
  const res = await gh(pi, cwd, ["repo", "view", "--json", "owner,name", "--jq", ".owner.login+\"/\"+.name"]);
  if (res.code !== 0) {
    throw new Error(res.stderr.trim() || "Failed to resolve repository via gh repo view");
  }
  const slug = res.stdout.trim();
  const [owner, name] = slug.split("/");
  if (!owner || !name) throw new Error(`Invalid repository slug: ${slug}`);
  return { owner, name, slug };
}

async function fetchLabels(pi: ExtensionAPI, cwd: string, repo: string): Promise<string[]> {
  const res = await gh(pi, cwd, ["label", "list", "--repo", repo, "--limit", "200", "--json", "name", "--jq", ".[].name"]);
  if (res.code !== 0) throw new Error(res.stderr.trim() || "Failed to list labels");
  return res.stdout
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function githubIssuesExtension(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const ready = await ensureGhReady(pi, ctx.cwd);
    if (!ready.ok) ctx.ui.notify(ready.message, "warning");
  });

  pi.registerTool({
    name: "github_issue_labels",
    label: "GitHub Issue Labels",
    description: "List existing labels for the current GitHub repository",
    promptSnippet: "List valid repository labels before issue creation",
    parameters: Type.Object({}),
    async execute() {
      const ready = await ensureGhReady(pi, process.cwd());
      if (!ready.ok) {
        return { content: [{ type: "text", text: ready.message }], isError: true };
      }

      try {
        const repo = await resolveRepo(pi, process.cwd());
        const labels = await fetchLabels(pi, process.cwd(), repo.slug);
        return {
          content: [{ type: "text", text: labels.join("\n") || "No labels found" }],
          details: { repo: repo.slug, count: labels.length, labels },
        };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  });

  pi.registerTool({
    name: "github_issue_create",
    label: "Create GitHub Issue",
    description: "Create an issue with strict label validation against existing repository labels",
    promptSnippet: "Create GitHub issues when title, description, and valid labels are provided",
    promptGuidelines: [
      "Use github_issue_labels first when labels are uncertain.",
      "Use github_issue_create only when title, description, and labels are all present.",
    ],
    parameters: Type.Object({
      title: Type.String({ minLength: 1, description: "Issue title" }),
      description: Type.String({ minLength: 1, description: "Issue body/description" }),
      labels: Type.Array(Type.String({ minLength: 1 }), {
        minItems: 1,
        description: "Existing labels to apply",
      }),
      allowCreateMissingLabels: Type.Optional(
        Type.Boolean({ description: "If true, missing labels will be created before issue creation" }),
      ),
    }),
    async execute(_toolCallId, params) {
      const cwd = process.cwd();
      const ready = await ensureGhReady(pi, cwd);
      if (!ready.ok) return { content: [{ type: "text", text: ready.message }], isError: true };

      try {
        const repo = await resolveRepo(pi, cwd);
        const existing = await fetchLabels(pi, cwd, repo.slug);
        const existingSet = new Set(existing);
        const missing = params.labels.filter((l) => !existingSet.has(l));

        if (missing.length > 0 && !params.allowCreateMissingLabels) {
          return {
            content: [
              {
                type: "text",
                text: `Missing labels (not created): ${missing.join(", ")}. Ask user before creating new labels, or rerun with allowCreateMissingLabels=true.`,
              },
            ],
            details: { repo: repo.slug, missingLabels: missing, existingLabels: existing },
            isError: true,
          };
        }

        if (missing.length > 0 && params.allowCreateMissingLabels) {
          for (const label of missing) {
            const created = await gh(pi, cwd, ["label", "create", label, "--repo", repo.slug]);
            if (created.code !== 0) {
              throw new Error(`Failed to create label '${label}': ${created.stderr.trim() || created.stdout.trim()}`);
            }
          }
        }

        const created = await gh(pi, cwd, [
          "issue",
          "create",
          "--repo",
          repo.slug,
          "--title",
          params.title,
          "--body",
          params.description,
          "--label",
          params.labels.join(","),
        ]);

        if (created.code !== 0) {
          throw new Error(created.stderr.trim() || created.stdout.trim() || "Failed to create issue");
        }

        const url = created.stdout.trim();
        return {
          content: [{ type: "text", text: `Issue created: ${url}` }],
          details: { repo: repo.slug, url, labels: params.labels },
        };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  });

  pi.registerTool({
    name: "github_issue_list_mine",
    label: "List My GitHub Issues",
    description: "List issues authored by the authenticated GitHub user",
    promptSnippet: "Track issues created by the current user",
    parameters: Type.Object({
      state: Type.Optional(Type.Union([Type.Literal("open"), Type.Literal("closed"), Type.Literal("all")], { default: "open" })),
      limit: Type.Optional(Type.Number({ minimum: 1, maximum: 200, default: 50 })),
    }),
    async execute(_toolCallId, params) {
      const cwd = process.cwd();
      const ready = await ensureGhReady(pi, cwd);
      if (!ready.ok) return { content: [{ type: "text", text: ready.message }], isError: true };

      try {
        const repo = await resolveRepo(pi, cwd);
        const state = params.state ?? "open";
        const limit = params.limit ?? 50;
        const res = await gh(pi, cwd, [
          "issue",
          "list",
          "--repo",
          repo.slug,
          "--author",
          "@me",
          "--state",
          state,
          "--limit",
          String(limit),
          "--json",
          "number,title,state,labels,url,createdAt",
        ]);
        if (res.code !== 0) throw new Error(res.stderr.trim() || "Failed to list issues");

        const issues = JSON.parse(res.stdout) as Array<{ number: number; title: string; state: string; url: string }>;
        const lines = issues.map((i) => `#${i.number} [${i.state}] ${i.title}`).join("\n");
        return {
          content: [{ type: "text", text: lines || "No issues found." }],
          details: { repo: repo.slug, count: issues.length, issues },
        };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  });

  pi.registerTool({
    name: "github_issue_summary_mine",
    label: "My Issue Summary",
    description: "Summarize issue counts by state for issues authored by current user",
    parameters: Type.Object({}),
    async execute() {
      const cwd = process.cwd();
      const ready = await ensureGhReady(pi, cwd);
      if (!ready.ok) return { content: [{ type: "text", text: ready.message }], isError: true };

      try {
        const repo = await resolveRepo(pi, cwd);
        const res = await gh(pi, cwd, [
          "issue",
          "list",
          "--repo",
          repo.slug,
          "--author",
          "@me",
          "--state",
          "all",
          "--limit",
          "200",
          "--json",
          "state",
        ]);
        if (res.code !== 0) throw new Error(res.stderr.trim() || "Failed to summarize issues");

        const issues = JSON.parse(res.stdout) as Array<{ state: string }>;
        const summary = issues.reduce<Record<string, number>>((acc, i) => {
          acc[i.state] = (acc[i.state] ?? 0) + 1;
          return acc;
        }, {});

        return {
          content: [{ type: "text", text: `My issues in ${repo.slug}: ${JSON.stringify(summary)}` }],
          details: { repo: repo.slug, summary, total: issues.length },
        };
      } catch (error) {
        return { content: [{ type: "text", text: String(error) }], isError: true };
      }
    },
  });
}
