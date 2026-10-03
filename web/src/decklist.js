/**
 * Decklist text helpers for the UI (T-C2). No DOM, so they're unit-tested.
 */

/**
 * The line containing `position` (a caret offset).
 * @returns {{ index: number, start: number, text: string }} 0-based line index,
 *   offset of its first character, and its text.
 */
export function lineAt(text, position) {
  const start = text.lastIndexOf('\n', position - 1) + 1;
  const end = text.indexOf('\n', position);
  const index = text.slice(0, start).split('\n').length - 1;
  return { index, start, text: text.slice(start, end === -1 ? text.length : end) };
}

/** Offset of the first character of a 1-based line number. */
export function lineStart(text, lineNumber) {
  let offset = 0;
  for (let i = 1; i < lineNumber; i++) {
    const next = text.indexOf('\n', offset);
    if (next === -1) return text.length;
    offset = next + 1;
  }
  return offset;
}

/**
 * Lines worth previewing: not blank, not a comment. Section headers ("Deck")
 * are left to the API, which reports them as having no card.
 */
export function isPreviewable(line) {
  const trimmed = line.trim();
  return Boolean(trimmed) && !trimmed.startsWith('//') && !trimmed.startsWith('#');
}

/** Replaces the first `name` in line `index` with `replacement` (a suggestion). */
export function replaceInLine(text, index, name, replacement) {
  const lines = text.split('\n');
  lines[index] = lines[index].replace(name, replacement);
  return lines.join('\n');
}

/**
 * One entry per problem in a job report, by decklist line (3.2.6), then
 * render warnings by file.
 * @param {object} job GET /api/jobs/:id
 * @returns {{ lineNumber: number | null, message: string, suggestions?: string[], name?: string }[]}
 */
export function reportProblems(job) {
  const byLine = [
    ...(job.errors ?? []).map((e) => ({
      lineNumber: e.lineNumber,
      message: `${e.error}: ${e.line}`,
    })),
    ...(job.unmatched ?? []).map((u) => ({
      lineNumber: u.lineNumber,
      message: `No card named "${u.name}"`,
      name: u.name,
      suggestions: u.suggestions,
    })),
    ...(job.fallbacks ?? []).map((f) => ({ lineNumber: f.lineNumber, message: f.warning })),
    ...(job.skipped ?? []).map((s) => ({
      lineNumber: s.lineNumber,
      message: `${s.reason}; skipped`,
    })),
  ].sort((a, b) => a.lineNumber - b.lineNumber);
  const render = (job.renderWarnings ?? []).map((w) => ({
    lineNumber: null,
    message: `${w.fileName}: ${w.warning}`,
  }));
  return [...byLine, ...render];
}
