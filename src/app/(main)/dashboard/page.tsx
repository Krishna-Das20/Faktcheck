"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import ContestCard from "@/components/contest/ContestCard";
import Loader from "@/components/common/Loader";
import { User, Trophy, Target, Calendar, Edit, Save, X } from "lucide-react";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const { user, token, updateUser } = useAuth();
  const router = useRouter();
  const [myContests, setMyContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit profile state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    college: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
    fetchMyContests();
  }, [token]);

  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name || "",
        college: user.college || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  const fetchMyContests = async () => {
    try {
      const res = await fetch("/api/contests/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMyContests(data.contests);
      }
    } catch {
      toast.error("Failed to fetch contests");
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editForm.name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();

      if (data.success) {
        updateUser({
          ...(user as any),
          name: data.user.name,
          college: data.user.college,
          phone: data.user.phone,
        });
        toast.success("Profile updated successfully!");
        setShowEditModal(false);
      } else {
        toast.error(data.message || "Failed to update profile");
      }
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader fullScreen />;

  const stats = [
    { icon: Calendar, label: "Contests joined", value: myContests.length },
    { icon: Target, label: "Total score", value: user?.totalScore || 0 },
    { icon: Trophy, label: "Global rank", value: user?.rank || "N/A" },
  ];

  return (
    <div className="page-shell">
      <div className="section-shell space-y-6">
        {/* Profile Header Card */}
        <section className="card">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl">
                <User className="h-8 w-8 text-primary-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-dark-50">{user?.name}</h1>
                <p className="text-sm text-dark-300">{user?.email}</p>
                {user?.college && (
                  <p className="mt-1 text-sm text-dark-400">
                    {user.college}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="badge-primary">{user?.role}</span>
              <button onClick={() => setShowEditModal(true)} className="btn-secondary">
                <Edit className="h-4 w-4" />
                Edit profile
              </button>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid gap-4 md:grid-cols-3">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="card">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl">
                <Icon className="h-5 w-5 text-primary-500" />
              </div>
              <div className="text-sm text-dark-300">{label}</div>
              <div className="mt-1 text-2xl font-bold text-dark-50">{value}</div>
            </div>
          ))}
        </section>

        {/* My Contests */}
        <section>
          <div className="page-header">
            <h2 className="page-title">My contests</h2>
            <p className="page-subtitle">Everything you have joined, in a single compact list.</p>
          </div>

          {myContests.length === 0 ? (
            <div className="card py-12 text-center">
              <p className="text-dark-300">You haven&apos;t joined any contests yet.</p>
              <Link href="/contests" className="btn-primary mt-4 inline-flex">
                Browse contests
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {myContests.map((contest) => (
                <ContestCard key={contest._id} contest={contest} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card w-full max-w-md">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-dark-50">Edit profile</h3>
              <button onClick={() => setShowEditModal(false)} className="btn-icon">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditProfile} className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input-field"
                  placeholder="Your name"
                  required
                />
              </div>

              <div>
                <label className="label">College</label>
                <input
                  type="text"
                  value={editForm.college}
                  onChange={(e) => setEditForm({ ...editForm, college: e.target.value })}
                  className="input-field"
                  placeholder="Your college or university"
                />
              </div>

              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="input-field"
                  placeholder="Your phone number"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
