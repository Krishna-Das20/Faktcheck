/**
 * Judge0 Service — handles code submission, polling, and result parsing.
 * Server-side only (uses process.env).
 */

const JUDGE0_API_URL =
  process.env.JUDGE0_API_URL || "http://localhost:2358";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || "";

// Base64 encode/decode helpers
const toBase64 = (str: string): string =>
  Buffer.from(str || "").toString("base64");
const fromBase64 = (str: string): string =>
  str ? Buffer.from(str, "base64").toString("utf-8") : "";

// Common headers for Judge0 requests
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (JUDGE0_API_KEY) {
    headers["X-Auth-Token"] = JUDGE0_API_KEY;
  }
  return headers;
}

/**
 * Submit a single code to Judge0 and poll for results.
 */
export async function submitToJudge0(
  sourceCode: string,
  languageId: number,
  input: string,
  expectedOutput: string
) {
  // Create submission
  const createRes = await fetch(
    `${JUDGE0_API_URL}/submissions?base64_encoded=true`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        source_code: toBase64(sourceCode),
        language_id: languageId,
        stdin: toBase64(input),
        expected_output: toBase64(expectedOutput),
        cpu_time_limit: 2,
        memory_limit: 256000, // 256 MB in KB
      }),
    }
  );

  if (!createRes.ok) {
    throw new Error(`Judge0 submission failed: ${createRes.statusText}`);
  }

  const { token } = await createRes.json();

  // Poll for result
  let result: any;
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const pollRes = await fetch(
      `${JUDGE0_API_URL}/submissions/${token}?base64_encoded=true`,
      { headers: getHeaders() }
    );
    result = await pollRes.json();

    // Status > 2 means completed (1=In Queue, 2=Processing)
    if (result.status.id > 2) break;
  }

  // Decode base64 fields
  if (result.stdout) result.stdout = fromBase64(result.stdout);
  if (result.stderr) result.stderr = fromBase64(result.stderr);
  if (result.compile_output)
    result.compile_output = fromBase64(result.compile_output);
  if (result.message) result.message = fromBase64(result.message);

  return result;
}

/**
 * Map Judge0 status ID to our verdict string.
 */
export function mapStatusToVerdict(
  statusId: number
): string {
  switch (statusId) {
    case 3:
      return "ACCEPTED";
    case 4:
      return "WRONG_ANSWER";
    case 5:
      return "TIME_LIMIT_EXCEEDED";
    case 6:
      return "COMPILATION_ERROR";
    default:
      if (statusId >= 7 && statusId <= 12) return "RUNTIME_ERROR";
      return "PENDING";
  }
}

/**
 * Judge0 status ID descriptions.
 */
export const STATUS_MAP: Record<number, string> = {
  1: "IN_QUEUE",
  2: "PROCESSING",
  3: "ACCEPTED",
  4: "WRONG_ANSWER",
  5: "TIME_LIMIT_EXCEEDED",
  6: "COMPILATION_ERROR",
  7: "RUNTIME_ERROR_SIGSEGV",
  8: "RUNTIME_ERROR_SIGXFSZ",
  9: "RUNTIME_ERROR_SIGFPE",
  10: "RUNTIME_ERROR_SIGABRT",
  11: "RUNTIME_ERROR_NZEC",
  12: "RUNTIME_ERROR_OTHER",
  13: "INTERNAL_ERROR",
  14: "EXEC_FORMAT_ERROR",
};
