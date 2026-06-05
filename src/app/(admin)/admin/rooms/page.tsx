"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { DoorOpen, ArrowLeft, Users, Trophy, Plus, Settings, Copy, Search } from "lucide-react";

export default function AdminRoomsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      toast.error("Admin access required");
      router.push("/");
    }
  }, [user]);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/rooms", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        let allRooms = data.rooms || [];
        // Organiser sees only their rooms
        if (user?.role === "ORGANISER") {
          allRooms = allRooms.filter((r: any) => {
            const ownerId = r.owner?._id || r.owner;
            return ownerId === user._id;
          });
        }
        setRooms(allRooms);
      } catch { toast.error("Failed to load rooms"); }
      setLoading(false);
    };
    fetch_();
  }, []);

  const filtered = rooms.filter((r) => !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.shortCode?.toLowerCase().includes(search.toLowerCase()));

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); toast.success("Code copied!"); };

  if (loading) return <div className="page-shell flex items-center justify-center" ><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} /></div>;

  return (
    <div className="page-shell" >
      <div className="max-w-5xl mx-auto px-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 mb-4" style={{ color: "var(--foreground-secondary)" }}><ArrowLeft className="w-5 h-5" /> Back</button>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DoorOpen className="w-8 h-8" style={{ color: "#06B6D4" }} />
            <h1 className="text-2xl font-bold text-strong">Rooms ({rooms.length})</h1>
          </div>
          <button onClick={() => router.push("/rooms/create")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold" style={{ background: "var(--primary)" }}>
            <Plus className="w-5 h-5" /> Create Room
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground-secondary)" }} />
          <input type="text" placeholder="Search rooms..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm" style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl text-center py-12" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <DoorOpen className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-secondary)" }} />
            <p style={{ color: "var(--foreground-secondary)" }}>No rooms found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((room) => (
              <div key={room._id} className="rounded-xl p-5 transition-all hover:scale-[1.01]" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-strong">{room.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: "var(--background-secondary)", color: "var(--primary)" }}>{room.shortCode}</span>
                      <button onClick={() => copyCode(room.shortCode)} title="Copy code"><Copy className="w-3 h-3" style={{ color: "var(--foreground-secondary)" }} /></button>
                    </div>
                  </div>
                  <button onClick={() => router.push(`/rooms/${room.shortCode}`)} className="p-2 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                    <Settings className="w-4 h-4" style={{ color: "var(--foreground-secondary)" }} />
                  </button>
                </div>
                <p className="text-sm line-clamp-2 mb-3" style={{ color: "var(--foreground-secondary)" }}>{room.description || "No description"}</p>
                <div className="flex items-center gap-4 text-sm" style={{ color: "var(--foreground-secondary)" }}>
                  <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {room.members?.length || 0} members</span>
                  <span className="flex items-center gap-1"><Trophy className="w-4 h-4" /> {room.contests?.length || 0} contests</span>
                </div>
                <p className="text-xs mt-2" style={{ color: "var(--foreground-secondary)" }}>Owner: {room.owner?.name || "Unknown"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
