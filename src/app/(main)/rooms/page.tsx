"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { DoorOpen, Plus, Users, Trophy, Copy, Search, LogIn } from "lucide-react";
import Link from "next/link";

export default function MyRoomsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/rooms", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setRooms(data.rooms || []);
      } catch { toast.error("Failed to load rooms"); }
      setLoading(false);
    };
    fetch_();
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) { toast.error("Enter a room code"); return; }
    setJoining(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shortCode: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (data.success || res.ok) { toast.success("Joined room!"); router.push(`/rooms/${data.room?._id || data.room?.shortCode}`); }
      else toast.error(data.message || "Failed to join");
    } catch { toast.error("Failed to join room"); }
    setJoining(false);
  };

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); toast.success("Copied!"); };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} /></div>;

  return (
    <div className="min-h-screen py-8" style={{ background: "var(--background)" }}>
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <DoorOpen className="w-8 h-8" style={{ color: "#06B6D4" }} />
            <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>Rooms</h1>
          </div>
          <Link href="/rooms/create" className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold" style={{ background: "linear-gradient(135deg, var(--primary), #FF8C5A)" }}>
            <Plus className="w-5 h-5" /> Create Room
          </Link>
        </div>

        {/* Join Room */}
        <div className="rounded-xl p-6 mb-8" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-bold mb-3" style={{ color: "var(--foreground)" }}>Join a Room</h2>
          <form onSubmit={handleJoin} className="flex gap-3">
            <div className="relative flex-1">
              <LogIn className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground-secondary)" }} />
              <input type="text" placeholder="Enter room code (e.g., ABCD12)" value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm uppercase tracking-wider font-mono" style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
            </div>
            <button type="submit" disabled={joining} className="px-6 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: "var(--primary)" }}>
              {joining ? "Joining..." : "Join"}
            </button>
          </form>
        </div>

        {/* Rooms Grid */}
        {rooms.length === 0 ? (
          <div className="rounded-xl text-center py-12" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <DoorOpen className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--foreground-secondary)" }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>No Rooms Yet</h2>
            <p className="mb-4" style={{ color: "var(--foreground-secondary)" }}>Create or join a room to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <Link key={room._id} href={`/rooms/${room._id}`} className="rounded-xl p-5 transition-all hover:scale-[1.02] block" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>{room.name}</h3>
                  <button onClick={(e) => { e.preventDefault(); copyCode(room.shortCode); }} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono" style={{ background: "var(--background-secondary)", color: "var(--primary)" }}>
                    {room.shortCode} <Copy className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-sm line-clamp-2 mb-4" style={{ color: "var(--foreground-secondary)" }}>{room.description || "No description"}</p>
                <div className="flex items-center gap-4 text-xs" style={{ color: "var(--foreground-secondary)" }}>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {room.members?.length || 0}</span>
                  <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> {room.contests?.length || 0} contests</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
