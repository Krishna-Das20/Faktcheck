"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Loader from "@/components/common/Loader";

export default function JoinRoomPage() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const { token, user } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [roomName, setRoomName] = useState("");

  useEffect(() => {
    if (shortCode && user && token) {
      joinRoomByLink();
    }
  }, [shortCode, user, token]);

  const joinRoomByLink = async () => {
    try {
      const res = await fetch(`/api/rooms/join/${shortCode}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        setRoomName(data.room?.name || "");
        setStatus("success");
        setMessage(data.message || "Successfully joined!");

        // Redirect to room after 2 seconds
        setTimeout(() => {
          router.push(`/rooms/${data.room?._id}`);
        }, 2000);
      } else {
        setStatus("error");
        setMessage(data.message || "Failed to join room");
      }
    } catch {
      setStatus("error");
      setMessage("Failed to join room");
    }
  };

  if (!user) {
    return (
      <div className="page-shell flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-strong mb-4">Login Required</h2>
          <p className="text-muted-ui mb-6">
            You need to be logged in to join a room
          </p>
          <Link href="/login" className="btn-primary inline-block">
            Login
          </Link>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return <Loader fullScreen />;
  }

  return (
    <div className="page-shell flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        {status === "success" ? (
          <>
            <div
              className="p-4 rounded-full w-fit mx-auto mb-6"
              style={{ background: "rgb(34 197 94 / 0.2)" }}
            >
              <CheckCircle className="w-12 h-12" style={{ color: "#4ADE80" }} />
            </div>
            <h2 className="text-xl font-bold text-strong mb-2">
              Successfully Joined!
            </h2>
            <p className="text-muted-ui mb-2">
              You are now a member of{" "}
              <span style={{ color: "rgb(var(--color-accent-400))" }}>{roomName}</span>
            </p>
            <p className="text-soft-ui text-sm">
              Redirecting to room...
            </p>
          </>
        ) : (
          <>
            <div
              className="p-4 rounded-full w-fit mx-auto mb-6"
              style={{ background: "rgb(239 68 68 / 0.2)" }}
            >
              <XCircle className="w-12 h-12" style={{ color: "#F87171" }} />
            </div>
            <h2 className="text-xl font-bold text-strong mb-2">
              Unable to Join
            </h2>
            <p className="text-muted-ui mb-6">{message}</p>
            <Link
              href="/rooms"
              className="btn-primary inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go to My Rooms
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
