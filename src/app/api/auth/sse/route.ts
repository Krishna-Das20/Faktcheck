import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { getAuthUser } from "@/lib/api-auth";
import { addConnection } from "@/lib/sseManager";

// GET /api/auth/sse — SSE endpoint for real-time role/user updates
// Token passed via query param since EventSource can't set headers
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  await connectDB();

  // Get fresh user data from DB
  const freshUser = await User.findById(user._id).select("role name email");

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send current role immediately on connect (handles offline→online sync)
  if (freshUser) {
    const syncPayload = `event: role-sync\ndata: ${JSON.stringify({
      role: freshUser.role,
      name: freshUser.name,
      email: freshUser.email,
    })}\n\n`;
    writer.write(encoder.encode(syncPayload));
  }

  // Register this connection for future pushes
  const cleanup = addConnection(user._id, writer);

  // Heartbeat every 30s to keep connection alive through proxies/load balancers
  const heartbeat = setInterval(() => {
    try {
      writer.write(encoder.encode(": heartbeat\n\n"));
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Clean up when the client disconnects
  request.signal.addEventListener("abort", () => {
    clearInterval(heartbeat);
    cleanup();
    try {
      writer.close();
    } catch {
      // Already closed
    }
  });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}
