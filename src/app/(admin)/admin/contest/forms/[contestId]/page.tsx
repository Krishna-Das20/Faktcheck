"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { ClipboardList, ArrowLeft, Plus, Trash2, Edit, FileText, CheckSquare } from "lucide-react";

export default function ManageFormsPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [forms, setForms] = useState<any[]>([]);
  const [contest, setContest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const [contestRes, formsRes] = await Promise.all([
          fetch(`/api/contests/${contestId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/forms/contest/${contestId}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const cData = await contestRes.json();
        const fData = await formsRes.json();
        setContest(cData.contest);
        setForms(fData.forms || []);
      } catch { toast.error("Failed to load"); }
      setLoading(false);
    };
    fetch_();
  }, [contestId]);

  const handleDelete = async (formId: string) => {
    if (!confirm("Delete this form? All submissions will be lost.")) return;
    try {
      await fetch(`/api/forms/${formId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      toast.success("Deleted");
      setForms((prev) => prev.filter((f) => f._id !== formId));
    } catch { toast.error("Failed"); }
  };

  if (loading) return <div className="page-shell flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} /></div>;

  return (
    <div className="page-shell">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/admin/dashboard")} className="p-2 rounded-lg" style={{ color: "var(--foreground-secondary)" }}><ArrowLeft className="w-6 h-6" /></button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--foreground)" }}><ClipboardList className="w-8 h-8" style={{ color: "#06B6D4" }} /> Manage Forms</h1>
              <p className="mt-1" style={{ color: "var(--foreground-secondary)" }}>{contest?.title}</p>
            </div>
          </div>
          <button onClick={() => router.push(`/admin/contest/forms/${contestId}/new`)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold" style={{ background: "var(--primary)" }}>
            <Plus className="w-5 h-5" /> Create New Form
          </button>
        </div>

        {forms.length === 0 ? (
          <div className="rounded-xl text-center py-16" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <ClipboardList className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--foreground-secondary)" }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>No Forms Created Yet</h2>
            <p className="mb-6" style={{ color: "var(--foreground-secondary)" }}>Create custom forms to collect submissions from participants.</p>
            <button onClick={() => router.push(`/admin/contest/forms/${contestId}/new`)} className="px-6 py-3 rounded-xl text-white font-semibold" style={{ background: "var(--primary)" }}>Create Your First Form</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map((form) => (
              <div key={form._id} className="rounded-xl p-5 transition-all hover:scale-[1.02]" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-lg" style={{ background: "rgba(6,182,212,0.1)" }}><FileText className="w-6 h-6" style={{ color: "#06B6D4" }} /></div>
                  <div className="flex gap-2">
                    <button onClick={() => router.push(`/admin/contest/forms/${contestId}/${form._id}`)} className="p-2 rounded-lg" title="Edit"><Edit className="w-4 h-4" style={{ color: "var(--foreground-secondary)" }} /></button>
                    <button onClick={() => handleDelete(form._id)} className="p-2 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" style={{ color: "#EF4444" }} /></button>
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-1 line-clamp-1" style={{ color: "var(--foreground)" }}>{form.title}</h3>
                <p className="text-sm mb-4 line-clamp-2" style={{ color: "var(--foreground-secondary)" }}>{form.description || "No description"}</p>
                <div className="flex items-center justify-between text-sm pt-3" style={{ borderTop: "1px solid var(--border)", color: "var(--foreground-secondary)" }}>
                  <span className="flex items-center gap-1"><CheckSquare className="w-4 h-4" /> {form.totalMarks || 0} Marks</span>
                  <span className="flex items-center gap-1"><ClipboardList className="w-4 h-4" /> {form.fields?.length || 0} Fields</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
