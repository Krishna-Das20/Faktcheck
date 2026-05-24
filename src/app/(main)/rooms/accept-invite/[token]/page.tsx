"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { DoorOpen, CheckCircle, XCircle } from "lucide-react";

export default function AcceptInvitePage() {
  const { token: inviteToken } = useParams<{ token: string }>();
  const { token: authToken } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const accept = async () => {
      try {
        const res = await fetch(`/api/rooms/accept-invite/${inviteToken}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (data.success || res.ok) {
          setStatus("success");
          setMessage("You have joined the room!");
          toast.success("Invite accepted!");
          setTimeout(() => router.push(`/rooms/${data.room?._id || ""}`), 2000);
        } else {
          setStatus("error");
          setMessage(data.message || "Invalid or expired invite");
        }
      } catch {
        setStatus("error");
        setMessage("Failed to accept invite");
      }
    };
    if (authToken) accept();
  }, [inviteToken, authToken]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="text-center rounded-xl p-8" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
        {status === "loading" && (
          <>
            <DoorOpen className="w-12 h-12 mx-auto mb-4" style={{ color: "#06B6D4" }} />
            <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Accepting invite...</p>
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 mx-auto mt-4" style={{ borderTopColor: "var(--primary)" }} />
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#22C55E" }} />
            <p className="text-lg font-semibold" style={{ color: "#22C55E" }}>{message}</p>
            <p className="text-sm mt-2" style={{ color: "var(--foreground-secondary)" }}>Redirecting to room...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#EF4444" }} />
            <p className="text-lg font-semibold" style={{ color: "#EF4444" }}>{message}</p>
            <button onClick={() => router.push("/rooms")} className="mt-4 px-6 py-2 rounded-xl text-white" style={{ background: "var(--primary)" }}>Go to Rooms</button>
          </>
        )}
      </div>
    </div>
  );
}
