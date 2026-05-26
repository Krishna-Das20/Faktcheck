"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import toast from "react-hot-toast";

interface User {
  _id: string;
  name: string;
  email: string;
  role: "USER" | "ORGANISER" | "ADMIN";
  college?: string;
  phone?: string;
  avatar?: string | null;
  isVerified?: boolean;
  totalScore?: number;
  rank?: number | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isOrganiser: boolean;
  isAdminOrOrganiser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const eventSourceRef = useRef<EventSource | null>(null);
  const initialSyncDone = useRef(false);
  const pathnameRef = useRef(pathname);

  // Keep pathname ref in sync
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();

      if (data.success && data.user) {
        setUser(data.user);
        setToken(authToken);
        return data.user as User;
      } else {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
        return null;
      }
    } catch {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /* ───── SSE connection for real-time role updates ─────
   * Connects to /api/auth/sse (token via query param since EventSource can't set headers).
   *
   * Events:
   *   role-sync   — fires on connect, syncs role if changed while offline
   *   role-update — fires in real-time when admin changes role
   *
   * Zero polling. Zero wasted requests. Truly instant.
   */
  useEffect(() => {
    if (!token) return;

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sseUrl = `/api/auth/sse?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    // Fires on initial connect — syncs role from server (handles offline→online)
    eventSource.addEventListener("role-sync", (event) => {
      try {
        const serverData = JSON.parse(event.data);
        setUser((prev) => {
          if (!prev) return prev;
          // Only show toast if role actually changed AND this isn't the first connect
          if (prev.role !== serverData.role && initialSyncDone.current) {
            toast.success(`Your role has been updated to ${serverData.role}`, {
              duration: 5000,
              icon: "🔄",
            });
          }
          return { ...prev, role: serverData.role, name: serverData.name };
        });
        initialSyncDone.current = true;
      } catch (err) {
        console.error("SSE role-sync parse error:", err);
      }
    });

    // Fires when admin changes role in real-time
    eventSource.addEventListener("role-update", (event) => {
      try {
        const data = JSON.parse(event.data);
        setUser((prev) => {
          if (!prev) return prev;
          return { ...prev, role: data.role, name: data.name };
        });

        const roleLabel =
          data.role === "ORGANISER"
            ? "Organiser"
            : data.role === "ADMIN"
              ? "Admin"
              : "User";

        toast.success(`Your role has been changed to ${roleLabel}`, {
          duration: 5000,
          icon: "🔄",
        });

        // Auto-redirect if demoted and currently on admin page (use ref for current pathname)
        if (data.role === "USER" && pathnameRef.current?.startsWith("/admin")) {
          toast.error("You no longer have access to this page", { duration: 4000 });
          router.push("/");
        }
      } catch (err) {
        console.error("SSE role-update parse error:", err);
      }
    });

    eventSource.onerror = () => {
      // EventSource auto-reconnects on error (built-in browser behavior).
      // On reconnect, the server sends role-sync again, so offline changes are caught.
      console.warn("SSE connection error, will auto-reconnect...");
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [token]);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    router.push("/login");
  }, [router]);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  // Manual refresh (can be called from any component)
  const refreshUser = useCallback(async () => {
    const storedToken = token || localStorage.getItem("token");
    if (storedToken) {
      await fetchUser(storedToken);
    }
  }, [token]);

  const isAdmin = user?.role === "ADMIN";
  const isOrganiser = user?.role === "ORGANISER";
  const isAdminOrOrganiser = user?.role === "ADMIN" || user?.role === "ORGANISER";
  const isAuthenticated = !!user && !!token;

  return (
    <AuthContext.Provider
      value={{ user, token, loading, isAuthenticated, login, logout, updateUser, refreshUser, isAdmin, isOrganiser, isAdminOrOrganiser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
