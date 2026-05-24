"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { FileQuestion, ArrowLeft, Plus, Trash2, Save, Edit, X, CheckCircle, Library, Search } from "lucide-react";
import ImageUpload from "@/components/ui/ImageUpload";

const inputStyle = { background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" };

export default function ManageMCQPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const [mcqs, setMcqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Save to library state
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [libraryIsPublic, setLibraryIsPublic] = useState(false);

  // Library modal state
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryMcqs, setLibraryMcqs] = useState<any[]>([]);
  const [selectedLibraryMcqs, setSelectedLibraryMcqs] = useState<string[]>([]);
  const [libraryFilter, setLibraryFilter] = useState({ category: "", search: "" });
  const [libraryLoading, setLibraryLoading] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  const defaultForm = {
    question: "", options: [{ text: "", isCorrect: false, imageUrl: null as string | null }, { text: "", isCorrect: false, imageUrl: null as string | null }, { text: "", isCorrect: false, imageUrl: null as string | null }, { text: "", isCorrect: false, imageUrl: null as string | null }],
    marks: 1, negativeMarks: 0, category: "", difficulty: "MEDIUM", explanation: "",
    imageUrl: null as string | null, imagePublicId: null as string | null,
  };
  const [form, setForm] = useState<any>(defaultForm);

  const fetchMCQs = async () => {
    try {
      const res = await fetch(`/api/mcqs/contest/${contestId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMcqs(data.mcqs || []);
    } catch { toast.error("Failed to load MCQs"); }
    setLoading(false);
  };

  useEffect(() => { fetchMCQs(); }, [contestId]);

  // Fetch library MCQs when modal opens
  const fetchLibraryMcqs = async () => {
    setLibraryLoading(true);
    try {
      const params = new URLSearchParams();
      if (libraryFilter.category) params.append("category", libraryFilter.category);
      const res = await fetch(`/api/mcqs/library?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      let filtered = data.mcqs || [];
      if (libraryFilter.search) {
        const s = libraryFilter.search.toLowerCase();
        filtered = filtered.filter((m: any) => m.question?.toLowerCase().includes(s));
      }
      setLibraryMcqs(filtered);
    } catch { toast.error("Failed to load library"); }
    setLibraryLoading(false);
  };

  useEffect(() => {
    if (showLibrary) fetchLibraryMcqs();
  }, [showLibrary, libraryFilter]);

  const handleAddFromLibrary = async () => {
    if (selectedLibraryMcqs.length === 0) { toast.error("Select at least one MCQ"); return; }
    try {
      const res = await fetch(`/api/mcqs/contest/${contestId}/add-from-library`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mcqIds: selectedLibraryMcqs }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${selectedLibraryMcqs.length} MCQ(s) added`);
        setShowLibrary(false);
        setSelectedLibraryMcqs([]);
        fetchMCQs();
      } else toast.error(data.message || "Failed");
    } catch { toast.error("Failed to add MCQs"); }
  };

  const handleSave = async () => {
    if (!form.question.trim()) { toast.error("Question is required"); return; }
    if (!form.options.some((o: any) => o.isCorrect)) { toast.error("At least one correct answer required"); return; }
    setSaving(true);
    try {
      const url = editingId ? `/api/mcqs/${editingId}` : `/api/mcqs`;
      const method = editingId ? "PUT" : "POST";
      const body = {
        ...form, contestId,
        imageUrl: form.imageUrl, imagePublicId: form.imagePublicId,
        ...(!editingId && saveToLibrary ? { saveToLibrary: true, libraryIsPublic: isAdmin ? libraryIsPublic : false } : {}),
      };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success || res.ok) {
        toast.success(editingId ? "Updated!" : saveToLibrary ? "Created & saved to library!" : "Created!");
        setShowForm(false); setEditingId(null); setForm(defaultForm); setSaveToLibrary(false); setLibraryIsPublic(false);
        fetchMCQs();
      } else toast.error(data.message || "Failed");
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this MCQ?")) return;
    try {
      await fetch(`/api/mcqs/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      toast.success("Deleted"); fetchMCQs();
    } catch { toast.error("Failed to delete"); }
  };

  const startEdit = (mcq: any) => {
    setForm({ question: mcq.question, options: mcq.options, marks: mcq.marks, negativeMarks: mcq.negativeMarks || 0, category: mcq.category || "", difficulty: mcq.difficulty || "MEDIUM", explanation: mcq.explanation || "", imageUrl: mcq.imageUrl || null, imagePublicId: mcq.imagePublicId || null });
    setEditingId(mcq._id);
    setShowForm(true);
    setSaveToLibrary(false);
  };

  if (loading) {
    return <div className="page-shell flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} /></div>;
  }

  return (
    <div className="page-shell">
      <div className="max-w-4xl mx-auto px-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 mb-4" style={{ color: "var(--foreground-secondary)" }}><ArrowLeft className="w-5 h-5" /> Back</button>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileQuestion className="w-8 h-8" style={{ color: "#A855F7" }} />
            <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Manage MCQs ({mcqs.length})</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowLibrary(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold" style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
              <Library className="w-5 h-5" /> Add from Library
            </button>
            <button onClick={() => { setShowForm(true); setEditingId(null); setForm(defaultForm); setSaveToLibrary(false); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold" style={{ background: "var(--primary)" }}>
              <Plus className="w-5 h-5" /> Create New
            </button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="rounded-xl p-6 mb-6 space-y-4" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>{editingId ? "Edit MCQ" : "New MCQ"}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }}><X className="w-5 h-5" style={{ color: "var(--foreground-secondary)" }} /></button>
            </div>
            <textarea value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-lg resize-none text-sm" style={inputStyle} placeholder="Enter question..." />

            <ImageUpload
              value={form.imageUrl}
              onChange={(data) => setForm({ ...form, imageUrl: data?.url || null, imagePublicId: data?.publicId || null })}
              label="Question Image (optional)"
            />
            
            <div className="space-y-3">
              <label className="text-sm font-medium" style={{ color: "var(--foreground-secondary)" }}>Options (check correct answers)</label>
              {form.options.map((opt: any, i: number) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: "var(--background-secondary)", border: opt.isCorrect ? "1px solid rgba(34,197,94,0.4)" : "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={opt.isCorrect} onChange={() => setForm({ ...form, options: form.options.map((o: any, j: number) => j === i ? { ...o, isCorrect: !o.isCorrect } : o) })} className="w-5 h-5" />
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "var(--primary)", color: "white" }}>{String.fromCharCode(65 + i)}</span>
                    <input type="text" value={opt.text} onChange={(e) => setForm({ ...form, options: form.options.map((o: any, j: number) => j === i ? { ...o, text: e.target.value } : o) })} className="flex-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder={`Option ${String.fromCharCode(65 + i)} text`} />
                    {form.options.length > 2 && <button onClick={() => setForm({ ...form, options: form.options.filter((_: any, j: number) => j !== i) })}><Trash2 className="w-4 h-4" style={{ color: "#EF4444" }} /></button>}
                  </div>
                  <ImageUpload
                    value={opt.imageUrl || null}
                    onChange={(data) => setForm({ ...form, options: form.options.map((o: any, j: number) => j === i ? { ...o, imageUrl: data?.url || null } : o) })}
                    label={`Option ${String.fromCharCode(65 + i)} image (optional)`}
                    compact
                  />
                </div>
              ))}
              {form.options.length < 6 && (
                <button onClick={() => setForm({ ...form, options: [...form.options, { text: "", isCorrect: false, imageUrl: null }] })} className="text-sm cursor-pointer" style={{ color: "var(--primary)" }}>+ Add Option</button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Marks</label>
                <input type="number" value={form.marks} onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} min="0" />
              </div>
              <div>
                <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Negative Marks</label>
                <input type="number" value={form.negativeMarks} onChange={(e) => setForm({ ...form, negativeMarks: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} min="0" />
              </div>
              <div>
                <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Category</label>
                <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder="e.g., DSA" />
              </div>
              <div>
                <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Difficulty</label>
                <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                  <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Explanation (optional)</label>
              <textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={inputStyle} />
            </div>

            {/* Save to Library toggle */}
            {!editingId && (
              <div className="p-4 rounded-lg space-y-3" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={saveToLibrary} onChange={(e) => setSaveToLibrary(e.target.checked)} className="w-4 h-4 rounded" />
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Also save to my question library</span>
                </label>
                {saveToLibrary && isAdmin && (
                  <div className="flex items-center gap-4 ml-7">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="libraryVisibility" checked={!libraryIsPublic} onChange={() => setLibraryIsPublic(false)} className="w-4 h-4" />
                      <span className="text-sm" style={{ color: "#EAB308" }}>Private Library</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="libraryVisibility" checked={libraryIsPublic} onChange={() => setLibraryIsPublic(true)} className="w-4 h-4" />
                      <span className="text-sm" style={{ color: "#22C55E" }}>Public Library</span>
                    </label>
                  </div>
                )}
                {saveToLibrary && !isAdmin && (
                  <p className="text-xs ml-7" style={{ color: "var(--foreground-secondary)" }}>Will be saved to your private library</p>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold" style={{ background: "var(--primary)" }}>
                {saving ? "Saving..." : <><Save className="w-4 h-4" /> Save MCQ</>}
              </button>
            </div>
          </div>
        )}

        {/* MCQ List */}
        <div className="space-y-3">
          {mcqs.length === 0 && !showForm ? (
            <div className="rounded-xl text-center py-12" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
              <FileQuestion className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-secondary)" }} />
              <p className="mb-4" style={{ color: "var(--foreground-secondary)" }}>No MCQs added yet</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setShowLibrary(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold" style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
                  <Library className="w-5 h-5" /> Add from Library
                </button>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold" style={{ background: "var(--primary)" }}>
                  <Plus className="w-5 h-5" /> Create New
                </button>
              </div>
            </div>
          ) : mcqs.map((mcq, i) => (
            <div key={mcq._id} className="rounded-xl p-4" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold text-white" style={{ background: "var(--primary)" }}>Q{i + 1}</span>
                    <span className="px-2 py-0.5 rounded text-xs" style={{ background: "var(--background-secondary)", color: mcq.difficulty === "EASY" ? "#22C55E" : mcq.difficulty === "HARD" ? "#EF4444" : "#EAB308" }}>{mcq.difficulty}</span>
                    {mcq.category && <span className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{mcq.category}</span>}
                    <span className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{mcq.marks} marks</span>
                    {mcq.isLibrary && (
                      <span className="text-xs flex items-center gap-1" style={{ color: "#A855F7" }}>
                        <Library className="w-3 h-3" /> From Library
                      </span>
                    )}
                  </div>
                  <p className="text-sm mb-2" style={{ color: "var(--foreground)" }}>{typeof mcq.question === "object" ? mcq.question.text : mcq.question}</p>
                  {mcq.imageUrl && <img src={mcq.imageUrl} alt="Question" className="rounded-lg max-h-32 mb-2 object-contain" />}
                  <div className="grid grid-cols-2 gap-1">
                    {mcq.options?.map((opt: any, j: number) => (
                      <div key={j} className="flex flex-col gap-1 text-xs px-2 py-1 rounded" style={{ color: opt.isCorrect ? "#22C55E" : "var(--foreground-secondary)", background: opt.isCorrect ? "rgba(34,197,94,0.1)" : "transparent" }}>
                        <span className="flex items-center gap-1">
                          {opt.isCorrect && <CheckCircle className="w-3 h-3" />} {String.fromCharCode(65 + j)}. {typeof opt === "object" ? opt.text : opt}
                        </span>
                        {opt.imageUrl && <img src={opt.imageUrl} alt={`Option ${String.fromCharCode(65 + j)}`} className="rounded max-h-16 object-contain" />}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => startEdit(mcq)} className="p-2 rounded-lg hover:opacity-80"><Edit className="w-4 h-4" style={{ color: "#EAB308" }} /></button>
                  <button onClick={() => handleDelete(mcq._id)} className="p-2 rounded-lg hover:opacity-80"><Trash2 className="w-4 h-4" style={{ color: "#EF4444" }} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Library Modal */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <div className="p-6 flex justify-between items-center" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Select from MCQ Library</h2>
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{selectedLibraryMcqs.length} selected</p>
              </div>
              <button onClick={() => { setShowLibrary(false); setSelectedLibraryMcqs([]); }}><X className="w-6 h-6" style={{ color: "var(--foreground-secondary)" }} /></button>
            </div>

            {/* Filters */}
            <div className="p-4 flex flex-col sm:flex-row gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: "var(--foreground-secondary)" }} />
                <input type="text" placeholder="Search questions..." value={libraryFilter.search} onChange={(e) => setLibraryFilter({ ...libraryFilter, search: e.target.value })} className="w-full pl-10 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <input type="text" placeholder="Category" value={libraryFilter.category} onChange={(e) => setLibraryFilter({ ...libraryFilter, category: e.target.value })} className="px-3 py-2 rounded-lg text-sm w-full sm:w-40" style={inputStyle} />
            </div>

            {/* MCQ List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {libraryLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} /></div>
              ) : libraryMcqs.length === 0 ? (
                <p className="text-center py-8" style={{ color: "var(--foreground-secondary)" }}>No MCQs in library</p>
              ) : libraryMcqs.map((mcq) => (
                <div
                  key={mcq._id}
                  onClick={() => setSelectedLibraryMcqs(prev => prev.includes(mcq._id) ? prev.filter(id => id !== mcq._id) : [...prev, mcq._id])}
                  className="p-4 rounded-lg cursor-pointer transition-all"
                  style={{
                    border: selectedLibraryMcqs.includes(mcq._id) ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: selectedLibraryMcqs.includes(mcq._id) ? "rgba(255,107,53,0.1)" : "var(--background-secondary)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selectedLibraryMcqs.includes(mcq._id)} onChange={() => {}} className="w-5 h-5 mt-1 rounded" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {mcq.category && <span className="px-2 py-0.5 rounded text-xs" style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6" }}>{mcq.category}</span>}
                        <span className="px-2 py-0.5 rounded text-xs" style={{ background: "var(--background)", color: mcq.difficulty === "EASY" ? "#22C55E" : mcq.difficulty === "HARD" ? "#EF4444" : "#EAB308" }}>{mcq.difficulty}</span>
                        <span className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{mcq.marks} marks</span>
                      </div>
                      <p style={{ color: "var(--foreground)" }}>{mcq.question}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 flex justify-end gap-3" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => { setShowLibrary(false); setSelectedLibraryMcqs([]); }} className="px-4 py-2 rounded-xl font-semibold" style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>Cancel</button>
              <button onClick={handleAddFromLibrary} disabled={selectedLibraryMcqs.length === 0} className="px-4 py-2 rounded-xl text-white font-semibold disabled:opacity-50" style={{ background: "var(--primary)" }}>
                Add {selectedLibraryMcqs.length} MCQ(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
