/**
 * Security gate: static analysis for SQL injection risk patterns.
 *
 * Scans TypeScript source files for template literals that contain SQL
 * keywords alongside variable interpolations — the primary surface for SQL
 * injection in this codebase (parameterized queries use `?` placeholders and
 * pass values as separate arguments; template-literal SQL with user-controlled
 * variables bypasses that protection).
 *
 * KNOWN SAFE EXCEPTION:
 *   database.ts ensureColumn() uses template literals to interpolate table/column
 *   names, but those values are always hardcoded server-boot constants (never
 *   derived from request input).  The file is excluded from this check.
 *
 * Exit 0 = no issues found.
 * Exit 1 = potential SQL injection patterns detected; review required.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "src");

// Files excluded from template-literal SQL checks because all interpolated
// values are verified server-controlled constants (not user input).
const EXCLUDED_FILES = new Set([
  path.join(SRC_DIR, "db", "database.ts"),
]);

// Pattern: template literal that STARTS with a SQL command keyword (after
// optional whitespace/newlines) AND contains a ${...} interpolation.
// Real SQL queries always start with the SQL verb; error-message strings that
// happen to contain words like "create" will not match.
// The 's' (dotAll) flag makes '.' match newlines so multiline templates are
// detected correctly.
//
// Known limitation: template literals that begin with a SQL keyword followed
// by a comment (e.g. `SELECT -- filter`) before an interpolation would be
// flagged.  Such patterns do not exist in this codebase, but reviewers should
// verify any new false positives before suppressing.
const UNSAFE_SQL_TEMPLATE = /`[\s\n]*(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|PRAGMA)\b[^`]*\$\{[^`]*`/is;

let issueCount = 0;

function scanFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");

  let match;
  // Reset the regex lastIndex for global search.
  const globalPattern = new RegExp(UNSAFE_SQL_TEMPLATE.source, UNSAFE_SQL_TEMPLATE.flags.replace("y", "") + "g");

  while ((match = globalPattern.exec(source)) !== null) {
    const before = source.slice(0, match.index);
    const lineNumber = (before.match(/\n/g) || []).length + 1;
    const snippet = match[0].slice(0, 120).replace(/\n/g, "\\n");
    const relPath = path.relative(process.cwd(), filePath);
    process.stderr.write(
      `[security-check] Potential SQL injection: ${relPath}:${lineNumber}\n  ${snippet}\n`,
    );
    issueCount += 1;
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && fullPath.endsWith(".ts") && !EXCLUDED_FILES.has(fullPath)) {
      scanFile(fullPath);
    }
  }
}

walkDir(SRC_DIR);

if (issueCount > 0) {
  process.stderr.write(
    `\n[security-check] ${issueCount} potential SQL injection issue(s) found.\n` +
    `Review each occurrence and ensure user input is only passed as bound\n` +
    `parameters (?), never interpolated directly into SQL strings.\n`,
  );
  process.exit(1);
} else {
  process.stdout.write("[security-check] No SQL injection patterns found.\n");
  process.exit(0);
}
