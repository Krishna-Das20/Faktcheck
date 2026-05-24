"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { LogIn, DoorOpen } from "lucide-react";

export default function JoinRoomPage() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [joining, setJoining] = useState(true);

  useEffect(() => {
    const join = async () => {
      try {
        const res = await fetch("/api/rooms/join", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ shortCode }),
        });
        const data = await res.json();
        if (data.success || res.ok) {
          toast.success("Joined room!");
          router.push(`/rooms/${data.room?._id || shortCode}`);
        } else {
          toast.error(data.message || "Failed to join");
          router.push("/rooms");
        }
      } catch {
        toast.error("Failed to join room");
        router.push("/rooms");
      }
      setJoining(false);
    };
    if (token) join();
  }, [shortCode, token]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="text-center">
        <DoorOpen className="w-12 h-12 mx-auto mb-4" style={{ color: "#06B6D4" }} />
        <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          {joining ? "Joining room..." : "Redirecting..."}
        </p>
        <p className="text-sm mt-2" style={{ color: "var(--foreground-secondary)" }}>Code: {shortCode}</p>
        {joining && <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 mx-auto mt-4" style={{ borderTopColor: "var(--primary)" }} />}
      </div>
    </div>
  );
}
