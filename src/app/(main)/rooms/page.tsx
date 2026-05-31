"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { DoorOpen, Plus, Users, Copy, LogIn, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function MyRoomsPage() {
  const { user, token, isAdminOrOrganiser } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch("/api/rooms", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setRooms(data.rooms || []);
      } catch { toast.error("Failed to load rooms"); }
      setLoading(false);
    };
    fetchRooms();
  }, []);

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) { toast.error("Please enter a room code"); return; }
    setJoining(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shortCode: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        toast.success("Successfully joined room!");
        setShowJoinModal(false);
        setJoinCode("");
        router.push(`/rooms/${data.room?._id || data.room?.shortCode}`);
      } else toast.error(data.message || "Failed to join room");
    } catch { toast.error("Failed to join room"); }
    setJoining(false);
  };

  const copyRoomCode = (shortCode: string) => {
    navigator.clipboard.writeText(shortCode);
    toast.success("Room code copied!");
  };

  const getRoleInRoom = (room: any) => {
    const userId = user?._id?.toString() || user?._id;
    const ownerId = room.owner?._id?.toString() || room.owner;
    if (ownerId === userId) return "Owner";
    if (room.coOrganisers?.some((co: any) => (co._id?.toString() || co) === userId)) return "Co-Organiser";
    return "Participant";
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "Owner":
        return { background: "rgba(234,179,8,0.2)", color: "#EAB308" };
      case "Co-Organiser":
        return { background: "rgba(59,130,246,0.2)", color: "#3B82F6" };
      default:
        return { background: "rgba(156,163,175,0.2)", color: "#9CA3AF" };
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} />
    </div>
  );

  return (
    <div className="min-h-screen py-8" style={{ background: "var(--background)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "var(--foreground)" }}>My Rooms</h1>
            <p className="mt-1" style={{ color: "var(--foreground-secondary)" }}>
              {isAdminOrOrganiser
                ? "Create and manage your private contest rooms"
                : "View and join contest rooms"}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-semibold transition-colors"
              style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            >
              <LogIn className="w-5 h-5" />
              <span className="hidden sm:inline">Join Room</span>
            </button>
            {isAdminOrOrganiser && (
              <Link
                href="/rooms/create"
                className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl text-white font-semibold"
                style={{ background: "var(--primary)" }}
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Create Room</span>
              </Link>
            )}
          </div>
        </div>

        {/* Rooms Grid */}
        {rooms.length === 0 ? (
          <div className="rounded-xl text-center py-16" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <DoorOpen className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--foreground-secondary)" }} />
            <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>No Rooms Yet</h3>
            <p className="mb-6" style={{ color: "var(--foreground-secondary)" }}>
              {isAdminOrOrganiser
                ? "You haven't created or joined any rooms yet"
                : "You haven't joined any rooms yet"}
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowJoinModal(true)}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm"
                style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              >
                Join with Code
              </button>
              {isAdminOrOrganiser && (
                <Link href="/rooms/create" className="px-4 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: "var(--primary)" }}>
                  Create Your First Room
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => {
              const role = getRoleInRoom(room);
              const badgeStyle = getRoleBadgeStyle(role);
              return (
                <div
                  key={room._id}
                  className="rounded-xl p-5 transition-all cursor-pointer group relative overflow-hidden"
                  style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}
                  onClick={() => router.push(`/rooms/${room._id}`)}
                >
                  {/* Top: Icon + Role Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl" style={{ background: "linear-gradient(135deg, var(--primary), #FF8C5A)" }}>
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={badgeStyle}
                    >
                      {role}
                    </span>
                  </div>

                  {/* Room Name */}
                  <h3
                    className="text-lg font-semibold mb-2 transition-colors"
                    style={{ color: "var(--foreground)" }}
                  >
                    {room.name}
                  </h3>

                  {/* Description */}
                  {room.description && (
                    <p className="text-sm mb-4 line-clamp-2" style={{ color: "var(--foreground-secondary)" }}>
                      {room.description}
                    </p>
                  )}

                  {/* Created by */}
                  <div className="text-xs mb-3" style={{ color: "var(--foreground-secondary)" }}>
                    Created by: <span style={{ color: "var(--foreground-tertiary, var(--foreground-secondary))" }}>{room.owner?.name || "Unknown"}</span>
                  </div>

                  {/* Bottom: Members + Short Code */}
                  <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-1 text-sm" style={{ color: "var(--foreground-secondary)" }}>
                      <Users className="w-4 h-4" />
                      <span>{room.participantCount || room.members?.length || 0} members</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyRoomCode(room.shortCode); }}
                      className="flex items-center gap-1 text-sm transition-colors"
                      style={{ color: "var(--primary)" }}
                    >
                      <span className="font-mono font-semibold">{room.shortCode}</span>
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Hover chevron */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-5 h-5" style={{ color: "var(--primary)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl max-w-md w-full p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--foreground)" }}>Join a Room</h2>
            <p className="text-sm mb-6" style={{ color: "var(--foreground-secondary)" }}>
              Enter the 6-character room code shared by your organiser
            </p>

            <form onSubmit={handleJoinRoom}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABCD12"
                maxLength={6}
                className="w-full text-center text-2xl tracking-widest font-mono mb-6 px-4 py-3 rounded-lg"
                style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowJoinModal(false); setJoinCode(""); }}
                  className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm"
                  style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining || joinCode.length < 6}
                  className="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                  style={{ background: "var(--primary)" }}
                >
                  {joining ? "Joining..." : "Join Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
