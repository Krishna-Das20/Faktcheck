/**
 * Lightweight code-similarity engine — a simplified MOSS.
 *
 * Pipeline: normalise source → tokenise → k-gram hashes → winnowing fingerprints
 * → Jaccard similarity between fingerprint sets. Language-agnostic enough to
 * compare submissions in the same language; identifier names are folded away so
 * simple renaming doesn't defeat it.
 *
 * This is a heuristic to *surface pairs for human review*, not a verdict.
 */

const K_GRAM = 5; // tokens per k-gram
const WINDOW = 4; // winnowing window

// Strip comments and string/char literals so only code structure remains.
function stripNoise(src: string): string {
  return src
    // block comments /* ... */
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    // line comments // ... and # ... (python/shell)
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/#[^\n]*/g, " ")
    // string and char literals
    .replace(/"(?:\\.|[^"\\])*"/g, '"S"')
    .replace(/'(?:\\.|[^'\\])*'/g, "'S'")
    .replace(/`(?:\\.|[^`\\])*`/g, "`S`");
}

// Common tokens that carry little discriminating signal across submissions.
const STOPWORDS = new Set([
  "the", "int", "for", "return", "if", "else", "while", "void", "let", "const",
  "var", "def", "class", "public", "static", "def", "print", "println",
]);

function tokenize(src: string): string[] {
  const cleaned = stripNoise(src).toLowerCase();
  // Fold identifiers to a single symbol so renaming variables doesn't help,
  // but keep operators/brackets/keywords which define structure.
  const raw = cleaned.match(/[a-z_][a-z0-9_]*|[0-9]+|[^\sa-z0-9_]/g) || [];
  return raw
    .map((t) => {
      if (/^[0-9]+$/.test(t)) return "N"; // numbers → N
      if (/^[a-z_][a-z0-9_]*$/.test(t)) {
        // keep short keyword-like tokens; fold long identifiers to ID
        return t.length <= 4 && !STOPWORDS.has(t) ? t : STOPWORDS.has(t) ? "" : "ID";
      }
      return t; // operators / punctuation
    })
    .filter(Boolean);
}

// Fast 32-bit rolling-ish hash for a k-gram string.
function hashGram(gram: string): number {
  let h = 2166136261;
  for (let i = 0; i < gram.length; i++) {
    h ^= gram.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Produce a set of winnowed fingerprints for a source file.
 * Returns an empty set for trivially short inputs.
 */
export function fingerprint(src: string): Set<number> {
  const tokens = tokenize(src);
  if (tokens.length < K_GRAM) return new Set();

  const hashes: number[] = [];
  for (let i = 0; i + K_GRAM <= tokens.length; i++) {
    hashes.push(hashGram(tokens.slice(i, i + K_GRAM).join(" ")));
  }

  // Winnowing: from each window of WINDOW hashes, keep the minimum.
  const fps = new Set<number>();
  if (hashes.length <= WINDOW) {
    hashes.forEach((h) => fps.add(h));
    return fps;
  }
  let prevMinPos = -1;
  for (let i = 0; i + WINDOW <= hashes.length; i++) {
    let minPos = i;
    for (let j = i + 1; j < i + WINDOW; j++) {
      if (hashes[j] <= hashes[minPos]) minPos = j;
    }
    if (minPos !== prevMinPos) {
      fps.add(hashes[minPos]);
      prevMinPos = minPos;
    }
  }
  return fps;
}

/** Jaccard similarity (0–1) between two fingerprint sets. */
export function similarity(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
