"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { UserCheck, Search, ChevronLeft, ChevronRight } from "lucide-react";

export default function UserManagementPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      const res = await fetch(`/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setUsers(data.users || []);
      setPagination(data.pagination || { total: 0, pages: 1 });
    } catch { toast.error("Failed to load users"); }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [page, roleFilter]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchUsers(); };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (data.success) { toast.success(data.message); fetchUsers(); }
      else toast.error(data.message);
    } catch { toast.error("Failed to update role"); }
  };

  const roleColors: Record<string, { bg: string; color: string }> = {
    ADMIN: { bg: "rgba(239,68,68,0.2)", color: "#EF4444" },
    ORGANISER: { bg: "rgba(168,85,247,0.2)", color: "#A855F7" },
    USER: { bg: "rgba(59,130,246,0.2)", color: "#3B82F6" },
  };

  return (
    <div className="page-shell" >
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-8">
          <UserCheck className="w-8 h-8" style={{ color: "var(--primary)" }} />
          <h1 className="text-3xl font-bold text-strong">User Management</h1>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground-secondary)" }} />
              <input type="text" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm" style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
            </div>
            <button type="submit" className="px-4 py-2.5 rounded-lg text-white text-sm font-semibold" style={{ background: "var(--primary)" }}>Search</button>
          </form>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-lg text-sm" style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
            <option value="">All Roles</option>
            <option value="USER">User</option>
            <option value="ORGANISER">Organiser</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--background-secondary)" }}>
                    {["Name", "Email", "Role", "Joined", "Actions"].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-sm font-semibold" style={{ color: "var(--foreground-secondary)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="py-3 px-4 font-semibold text-strong">{u.name}</td>
                      <td className="py-3 px-4 text-sm" style={{ color: "var(--foreground-secondary)" }}>{u.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded text-xs font-semibold" style={roleColors[u.role] || roleColors.USER}>{u.role}</span>
                      </td>
                      <td className="py-3 px-4 text-sm" style={{ color: "var(--foreground-secondary)" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        {u.role !== "ADMIN" && (
                          <select value={u.role} onChange={(e) => handleRoleChange(u._id, e.target.value)}
                            className="px-2 py-1 rounded text-xs" style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
                            <option value="USER">User</option>
                            <option value="ORGANISER">Organiser</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
            Showing {users.length} of {pagination.total} users
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg disabled:opacity-50" style={{ background: "var(--background-secondary)" }}>
              <ChevronLeft className="w-4 h-4 text-strong" />
            </button>
            <span className="flex items-center px-3 text-sm text-strong">{page} / {pagination.pages}</span>
            <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages} className="p-2 rounded-lg disabled:opacity-50" style={{ background: "var(--background-secondary)" }}>
              <ChevronRight className="w-4 h-4 text-strong" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
