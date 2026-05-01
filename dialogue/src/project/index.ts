import {
  Program, Node, BlockNode, DeclarationNode,
  ScriptFile, LabelRef, Project,
} from "../types.js";
import { tokenize }  from "../lexer/index.js";
import { parse }     from "../parser/index.js";

// ─────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────

export interface LoadInput {
  /** Logical filename used to resolve cross-file goto targets. */
  filename: string;
  /** Raw ValeFlow source text for this file. */
  source: string;
}

// ─────────────────────────────────────────────────────────────
// loadProject
// ─────────────────────────────────────────────────────────────

/**
 * Parse, validate, and link multiple ValeFlow files into a single
 * executable `Project`.
 *
 * Rules:
 * - Files whose name starts with `globals` (e.g. `globals.flow`) are treated
 *   as global-declaration files — all their `declare` nodes become globals,
 *   and they are excluded from the execution entry point.
 * - In any other file, `declare global x = …` marks a variable as global.
 * - Duplicate chapter names within the **same** file → error.
 * - Duplicate global variable names across files → error.
 * - The entry point is the first non-globals file.
 */
export function loadProject(inputs: LoadInput[]): Project {
  if (inputs.length === 0) {
    throw new Error("loadProject: at least one file is required");
  }

  const files: Record<string, ScriptFile>    = {};
  const globalLabels: Record<string, LabelRef> = {};
  const globalDeclarations: DeclarationNode[] = [];
  const globalVarNames       = new Set<string>();
  const seenGlobalVars        = new Map<string, string>(); // name → first-seen file

  let entryFile: string | null = null;

  for (const input of inputs) {
    const { filename, source } = input;

    // Detect globals files: filename is "globals", "globals.flow", "globals-data.fsc", etc.
    const isGlobalsFile =
      filename === "globals" ||
      /^globals[.\-_]/.test(filename);

    // Parse
    const ast = parse(tokenize(source));

    // Extract top-level labels and declarations
    const labels: Record<string, BlockNode> = {};
    const declarations: DeclarationNode[]   = [];

    for (const node of ast.body) {
      if (node.type === "block") {
        if (labels[node.name]) {
          throw new Error(
            `Duplicate chapter "${node.name}" in file "${filename}"`
          );
        }
        labels[node.name] = node;

        // Register qualified label: "filename::CHAPTER"
        const key = `${filename}::${node.name}`;
        globalLabels[key] = { file: filename, chapter: node };
      }

      if (node.type === "declare") {
        declarations.push(node);
      }
    }

    files[filename] = { filename, ast, labels, declarations };

    // Determine which declarations are globally scoped
    const globalDeclsThisFile = isGlobalsFile
      ? declarations                          // ALL decls in a globals file are global
      : declarations.filter(d => d.isGlobal); // Only explicit `declare global …`

    for (const decl of globalDeclsThisFile) {
      const prev = seenGlobalVars.get(decl.name);
      if (prev !== undefined) {
        throw new Error(
          `Duplicate global variable "${decl.name}": ` +
          `first declared in "${prev}", redeclared in "${filename}"`
        );
      }
      seenGlobalVars.set(decl.name, filename);
      globalVarNames.add(decl.name);
      globalDeclarations.push(decl);
    }

    // Entry point = first non-globals file
    if (!isGlobalsFile && entryFile === null) {
      entryFile = filename;
    }
  }

  // Fallback: if everything is a globals file use the first file
  if (entryFile === null) {
    entryFile = inputs[0].filename;
  }

  return {
    type: "project",
    files,
    globalLabels,
    globalDeclarations,
    globalVarNames,
    entryFile,
  };
}

// ─────────────────────────────────────────────────────────────
// Label resolution (exported for testing / advanced use)
// ─────────────────────────────────────────────────────────────

/**
 * Resolve a goto target to a concrete `{ file, chapter }` reference.
 *
 * Resolution order:
 *  1. Explicit cross-file:  "shop.flow::SHOP" → direct lookup
 *  2. Local label:          "HUB" → `currentFile::HUB`
 *  3. Global fallback:      search all files — error if ambiguous
 */
export function resolveLabel(
  project: Project,
  currentFile: string,
  target: string,
  line = 0
): LabelRef {
  // ── Case 1: cross-file explicit ────────────────────────────
  if (target.includes("::")) {
    const ref = project.globalLabels[target];
    if (ref) return ref;

    const sep  = target.indexOf("::");
    const file  = target.slice(0, sep);
    const label = target.slice(sep + 2);

    if (!project.files[file]) {
      throw new Error(
        `goto: file "${file}" not found (target: "${target}"` +
        (line ? `, line ${line}` : "") + ")"
      );
    }
    throw new Error(
      `goto: label "${label}" not found in file "${file}"` +
      (line ? ` (line ${line})` : "")
    );
  }

  // ── Case 2: local label ────────────────────────────────────
  const localKey = `${currentFile}::${target}`;
  const localRef = project.globalLabels[localKey];
  if (localRef) return localRef;

  // ── Case 3: global fallback (unique across all files) ──────
  const matches = Object.entries(project.globalLabels)
    .filter(([key]) => key.endsWith(`::${target}`))
    .map(([, ref]) => ref);

  if (matches.length === 1) return matches[0];

  if (matches.length > 1) {
    const fileList = matches.map(r => r.file).join('", "');
    throw new Error(
      `goto: label "${target}" is ambiguous — found in "${fileList}". ` +
      `Use "filename::LABEL" syntax` +
      (line ? ` (line ${line})` : "")
    );
  }

  throw new Error(
    `goto: label "${target}" not found` +
    (line ? ` (line ${line})` : "")
  );
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/** Type guard: is this a `Project` (multi-file) rather than a `Program`? */
export function isProject(v: Program | Project): v is Project {
  return (v as Project).type === "project";
}

/**
 * Wrap a single-file `Program` into a minimal `Project` so the Engine
 * can use the same code path regardless of input type.
 */
export function wrapSingleProgram(program: Program): Project {
  const filename = "__main__";
  const labels: Record<string, BlockNode> = {};
  const declarations: DeclarationNode[]   = [];

  for (const node of program.body) {
    if (node.type === "block") labels[node.name] = node;
    if (node.type === "declare") declarations.push(node);
  }

  const file: ScriptFile = { filename, ast: program, labels, declarations };

  const globalLabels: Record<string, LabelRef> = {};
  for (const [name, chapter] of Object.entries(labels)) {
    globalLabels[`${filename}::${name}`] = { file: filename, chapter };
  }

  return {
    type: "project",
    files:               { [filename]: file },
    globalLabels,
    globalDeclarations:  [],   // single-file: no globals (all decls run inline)
    globalVarNames:      new Set<string>(),
    entryFile:           filename,
  };
}
