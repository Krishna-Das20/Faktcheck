/**
 * SSE Connection Manager
 *
 * Tracks active SSE connections per user. When an admin changes a user's role,
 * this manager pushes the update instantly to all of that user's active connections
 * (they may have multiple tabs/devices).
 *
 * For offline users: When they reconnect (open the app/tab), the SSE endpoint
 * sends the current role immediately on connection, so they always get the
 * latest role without needing a separate API call.
 */

// Map of userId -> Set of WritableStreamDefaultWriter (one user can have multiple tabs)
const connections = new Map<string, Set<WritableStreamDefaultWriter>>();
const encoder = new TextEncoder();

/**
 * Register a new SSE connection for a user.
 * Returns a cleanup function to call on disconnect.
 */
export function addConnection(userId: string, writer: WritableStreamDefaultWriter): () => void {
  const id = userId.toString();
  if (!connections.has(id)) {
    connections.set(id, new Set());
  }
  connections.get(id)!.add(writer);

  // Return cleanup function
  return () => {
    const userConns = connections.get(id);
    if (userConns) {
      userConns.delete(writer);
      if (userConns.size === 0) {
        connections.delete(id);
      }
    }
  };
}

/**
 * Send an SSE event to a specific user (all their connections).
 */
export function sendToUser(userId: string, event: string, data: any): boolean {
  const id = userId.toString();
  const userConns = connections.get(id);

  if (userConns && userConns.size > 0) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoded = encoder.encode(payload);

    userConns.forEach((writer) => {
      try {
        writer.write(encoded);
      } catch {
        userConns.delete(writer);
      }
    });
    return true; // User was online
  }
  return false; // User was offline
}

/**
 * Broadcast an SSE event to ALL connected users.
 */
export function broadcast(event: string, data: any): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = encoder.encode(payload);

  connections.forEach((userConns) => {
    userConns.forEach((writer) => {
      try {
        writer.write(encoded);
      } catch {
        userConns.delete(writer);
      }
    });
  });
}

/**
 * Get count of connected users (for monitoring).
 */
export function getConnectionCount(): { users: number; connections: number } {
  let total = 0;
  connections.forEach((userConns) => {
    total += userConns.size;
  });
  return { users: connections.size, connections: total };
}
