import { NextResponse } from "next/server";
import { z } from "zod/v4";

// Standard success response
export function successResponse(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

// Standard error response
export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

// Parse JSON body from request
export async function parseBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON body");
  }
}

/**
 * Parse and validate a request body against a Zod schema.
 * Returns { data, error }.
 *  - data: The parsed and sanitized data (transforms applied), or null on failure.
 *  - error: A NextResponse with 400 status and field-level errors, or null on success.
 *
 * Usage:
 *   const { data, error } = await validateBody(request, loginSchema);
 *   if (error) return error;
 *   // data is fully typed and sanitized
 */
export async function validateBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T>; error: null } | { data: null; error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return {
      data: null,
      error: NextResponse.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    // Extract human-readable field errors
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "_root";
      if (!fieldErrors[path]) {
        fieldErrors[path] = issue.message;
      }
    }

    // Use first error as the top-level message
    const firstError = result.error.issues[0]?.message || "Validation failed";

    return {
      data: null,
      error: NextResponse.json(
        {
          success: false,
          message: firstError,
          errors: fieldErrors,
        },
        { status: 400 }
      ),
    };
  }

  return { data: result.data, error: null };
}

