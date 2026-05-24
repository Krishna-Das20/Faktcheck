import { NextResponse } from "next/server";

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
