"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { DoorOpen, Plus, Users, Copy, LogIn, ChevronRight } from "lucide-react";
import Link from "next/link";
import Loader from "@/components/common/Loader";

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
    if (token) fetchRooms();
  }, [token]);

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

  if (loading) return <Loader fullScreen />;

  return (
    <div className="page-shell">
      <div className="section-shell">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="page-title">My Rooms</h1>
            <p className="page-subtitle">
              {isAdminOrOrganiser
                ? "Create and manage your private contest rooms"
                : "View and join contest rooms"}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="btn-secondary"
            >
              <LogIn className="w-5 h-5" />
              <span className="hidden sm:inline">Join Room</span>
            </button>
            {isAdminOrOrganiser && (
              <Link href="/rooms/create" className="btn-primary">
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Create Room</span>
              </Link>
            )}
          </div>
        </div>

        {/* Rooms Grid */}
        {rooms.length === 0 ? (
          <div className="card text-center py-16">
            <DoorOpen className="w-16 h-16 mx-auto mb-4 text-muted-ui" />
            <h3 className="text-xl font-semibold text-strong mb-2">No Rooms Yet</h3>
            <p className="text-muted-ui mb-6">
              {isAdminOrOrganiser
                ? "You haven't created or joined any rooms yet"
                : "You haven't joined any rooms yet"}
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={() => setShowJoinModal(true)} className="btn-secondary">
                Join with Code
              </button>
              {isAdminOrOrganiser && (
                <Link href="/rooms/create" className="btn-primary">
                  Create Your First Room
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => {
              const role = getRoleInRoom(room);
              return (
                <div
                  key={room._id}
                  className="card-hover cursor-pointer group relative overflow-hidden border border-transparent hover:border-[rgb(var(--color-border-strong))]"
                  onClick={() => router.push(`/rooms/${room._id}`)}
                >
                  {/* Top: Icon + Role Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="p-3 rounded-xl"
                      style={{ background: "linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-accent-400)))" }}
                    >
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={
                        role === "Owner"
                          ? { background: "rgb(234 179 8 / 0.2)", color: "#FBBF24" }
                          : role === "Co-Organiser"
                          ? { background: "rgb(59 130 246 / 0.2)", color: "#60A5FA" }
                          : { background: "rgb(156 163 175 / 0.2)", color: "#9CA3AF" }
                      }
                    >
                      {role}
                    </span>
                  </div>

                  {/* Room Name */}
                  <h3 className="text-lg font-semibold text-strong mb-2 group-hover:text-[rgb(var(--color-accent-400))] transition-colors">
                    {room.name}
                  </h3>

                  {/* Description */}
                  {room.description && (
                    <p className="text-sm text-muted-ui mb-4 line-clamp-2">
                      {room.description}
                    </p>
                  )}

                  {/* Created by */}
                  <div className="text-xs text-soft-ui mb-3">
                    Created by: <span className="text-muted-ui">{room.owner?.name || "Unknown"}</span>
                  </div>

                  {/* Bottom: Members + Short Code */}
                  <div
                    className="flex items-center justify-between pt-4"
                    style={{ borderTop: "1px solid rgb(var(--color-border))" }}
                  >
                    <div className="flex items-center gap-1 text-sm text-soft-ui">
                      <Users className="w-4 h-4" />
                      <span>{room.participantCount || room.participants?.length || 0} members</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyRoomCode(room.shortCode); }}
                      className="flex items-center gap-1 text-sm transition-colors hover:opacity-80"
                      style={{ color: "rgb(var(--color-accent-500))" }}
                    >
                      <span className="font-mono font-semibold">{room.shortCode}</span>
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Hover chevron */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-5 h-5" style={{ color: "rgb(var(--color-accent-400))" }} />
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
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-bold text-strong mb-4">Join a Room</h2>
            <p className="text-sm text-muted-ui mb-6">
              Enter the 6-character room code shared by your organiser
            </p>

            <form onSubmit={handleJoinRoom}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABCD12"
                maxLength={6}
                className="input-field w-full text-center text-2xl tracking-widest font-mono mb-6"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowJoinModal(false); setJoinCode(""); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining || joinCode.length < 6}
                  className="btn-primary flex-1"
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
