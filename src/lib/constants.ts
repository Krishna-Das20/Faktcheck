// ─── Contest Status ──────────────────────────────────────
export const CONTEST_STATUS = {
  UPCOMING: "UPCOMING",
  LIVE: "LIVE",
  ENDED: "ENDED",
} as const;

// ─── Submission Verdicts ─────────────────────────────────
export const SUBMISSION_VERDICT = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  WRONG_ANSWER: "WRONG_ANSWER",
  TIME_LIMIT_EXCEEDED: "TIME_LIMIT_EXCEEDED",
  MEMORY_LIMIT_EXCEEDED: "MEMORY_LIMIT_EXCEEDED",
  RUNTIME_ERROR: "RUNTIME_ERROR",
  COMPILATION_ERROR: "COMPILATION_ERROR",
  JUDGE0_UNAVAILABLE: "JUDGE0_UNAVAILABLE",
} as const;

// ─── Language Mappings ───────────────────────────────────
export const LANGUAGES = [
  { value: "c", label: "C", id: 50, monaco: "c" },
  { value: "cpp", label: "C++", id: 54, monaco: "cpp" },
  { value: "java", label: "Java", id: 62, monaco: "java" },
  { value: "python", label: "Python", id: 71, monaco: "python" },
  { value: "javascript", label: "JavaScript", id: 63, monaco: "javascript" },
  { value: "go", label: "Go", id: 60, monaco: "go" },
  { value: "rust", label: "Rust", id: 73, monaco: "rust" },
] as const;

// String → Judge0 language ID
export const LANGUAGE_MAP: Record<string, number> = {
  c: 50, cpp: 54, java: 62, python: 71, javascript: 63, go: 60, rust: 73,
};

// Judge0 language ID → string
export const LANGUAGE_ID_MAP: Record<number, string> = {
  50: "c", 54: "cpp", 62: "java", 71: "python", 63: "javascript", 60: "go", 73: "rust",
};

// ─── Difficulty Colors ───────────────────────────────────
export const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "text-green-400",
  MEDIUM: "text-yellow-400",
  HARD: "text-red-400",
};

// ─── Default Code Templates ──────────────────────────────
export const DEFAULT_CODE: Record<string, string> = {
  c: '#include <stdio.h>\n\nint main() {\n    // Your code here\n    return 0;\n}',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code here\n    return 0;\n}',
  java: 'public class Main {\n    public static void main(String[] args) {\n        // Your code here\n    }\n}',
  python: '# Your code here\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()',
  javascript: '// Your code here\n\nfunction main() {\n    \n}\n\nmain();',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    // Your code here\n}',
  rust: 'fn main() {\n    // Your code here\n}',
};
