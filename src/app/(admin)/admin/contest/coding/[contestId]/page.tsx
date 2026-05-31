"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { Code, ArrowLeft, Plus, Trash2, Save, Edit, X, Library, Search } from "lucide-react";
import ImageUpload from "@/components/ui/ImageUpload";

const inputStyle = { background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" };

export default function ManageCodingPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const { token, user, isAdmin } = useAuth();
  const router = useRouter();
  const [problems, setProblems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Save to library state
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [libraryIsPublic, setLibraryIsPublic] = useState(false);

  // Library modal state
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryProblems, setLibraryProblems] = useState<any[]>([]);
  const [selectedLibraryProblems, setSelectedLibraryProblems] = useState<string[]>([]);
  const [libraryFilter, setLibraryFilter] = useState({ category: "", search: "" });
  const [libraryLoading, setLibraryLoading] = useState(false);

  const defaultForm = {
    title: "", description: "", category: "", difficulty: "MEDIUM", score: 100,
    inputFormat: "", outputFormat: "", constraints: "",
    sampleInput: "", sampleOutput: "",
    testcases: [{ input: "", expectedOutput: "", isHidden: false }],
    imageUrl: null as string | null, imagePublicId: null as string | null,
  };
  const [form, setForm] = useState<any>(defaultForm);

  const fetchProblems = async () => {
    try {
      const res = await fetch(`/api/coding/contest/${contestId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setProblems(data.problems || []);
    } catch { toast.error("Failed to load problems"); }
    setLoading(false);
  };

  useEffect(() => { fetchProblems(); }, [contestId]);

  // Fetch library problems when modal opens
  const fetchLibraryProblems = async () => {
    setLibraryLoading(true);
    try {
      const params = new URLSearchParams();
      if (libraryFilter.category) params.append("category", libraryFilter.category);
      const res = await fetch(`/api/coding/library?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      let filtered = data.problems || [];
      if (libraryFilter.search) {
        const s = libraryFilter.search.toLowerCase();
        filtered = filtered.filter((p: any) => p.title?.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s));
      }
      setLibraryProblems(filtered);
    } catch { toast.error("Failed to load library"); }
    setLibraryLoading(false);
  };

  useEffect(() => {
    if (showLibrary) fetchLibraryProblems();
  }, [showLibrary, libraryFilter]);

  const handleAddFromLibrary = async () => {
    if (selectedLibraryProblems.length === 0) { toast.error("Select at least one problem"); return; }
    try {
      const res = await fetch(`/api/coding/contest/${contestId}/add-from-library`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ problemIds: selectedLibraryProblems }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${selectedLibraryProblems.length} problem(s) added`);
        setShowLibrary(false);
        setSelectedLibraryProblems([]);
        fetchProblems();
      } else toast.error(data.message || "Failed");
    } catch { toast.error("Failed to add problems"); }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    if (form.testcases.length === 0) { toast.error("At least 1 test case required"); return; }
    setSaving(true);
    try {
      const url = editingId ? `/api/coding/${editingId}` : `/api/coding`;
      const method = editingId ? "PUT" : "POST";
      const body = {
        ...form, contestId, score: Number(form.score),
        imageUrl: form.imageUrl, imagePublicId: form.imagePublicId,
        ...(!editingId && saveToLibrary ? { saveToLibrary: true, libraryIsPublic: isAdmin ? libraryIsPublic : false } : {}),
      };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success || res.ok) {
        toast.success(editingId ? "Updated!" : saveToLibrary ? "Created & saved to library!" : "Created!");
        setShowForm(false); setEditingId(null); setForm(defaultForm); setSaveToLibrary(false); setLibraryIsPublic(false);
        fetchProblems();
      } else toast.error(data.message || "Failed");
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this problem?")) return;
    try {
      await fetch(`/api/coding/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      toast.success("Deleted"); fetchProblems();
    } catch { toast.error("Failed"); }
  };

  const startEdit = (p: any) => {
    setForm({
      title: p.title, description: p.description, category: p.category || "",
      difficulty: p.difficulty || "MEDIUM", score: p.score,
      inputFormat: p.inputFormat || "", outputFormat: p.outputFormat || "",
      constraints: p.constraints || "", sampleInput: p.sampleInput || "", sampleOutput: p.sampleOutput || "",
      testcases: p.testcases || [{ input: "", expectedOutput: "", isHidden: false }],
      imageUrl: p.imageUrl || null, imagePublicId: p.imagePublicId || null,
    });
    setEditingId(p._id);
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
            <Code className="w-8 h-8" style={{ color: "#F97316" }} />
            <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Manage Coding ({problems.length})</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowLibrary(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold" style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
              <Library className="w-5 h-5" /> Add from Library
            </button>
            <button onClick={() => { setShowForm(true); setEditingId(null); setForm(defaultForm); setSaveToLibrary(false); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold" style={{ background: "var(--primary)" }}>
              <Plus className="w-5 h-5" /> Add Problem
            </button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="rounded-xl p-6 mb-6 space-y-4" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>{editingId ? "Edit Problem" : "New Problem"}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }}><X className="w-5 h-5" style={{ color: "var(--foreground-secondary)" }} /></button>
            </div>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2.5 rounded-lg text-sm" style={inputStyle} placeholder="Problem title" />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} className="w-full px-3 py-2.5 rounded-lg text-sm resize-none font-mono" style={inputStyle} placeholder="Problem description (supports markdown)" />

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Category</label>
                <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder="e.g., Arrays" />
              </div>
              <div>
                <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Difficulty</label>
                <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                  <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
                </select>
              </div>
              <div>
                <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Score</label>
                <input type="number" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Input Format</label>
                <textarea value={form.inputFormat} onChange={(e) => setForm({ ...form, inputFormat: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Output Format</label>
                <textarea value={form.outputFormat} onChange={(e) => setForm({ ...form, outputFormat: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={inputStyle} />
              </div>
            </div>

            <div>
              <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Constraints</label>
              <textarea value={form.constraints} onChange={(e) => setForm({ ...form, constraints: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={inputStyle} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Sample Input</label>
                <textarea value={form.sampleInput} onChange={(e) => setForm({ ...form, sampleInput: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg text-sm resize-none font-mono" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Sample Output</label>
                <textarea value={form.sampleOutput} onChange={(e) => setForm({ ...form, sampleOutput: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg text-sm resize-none font-mono" style={inputStyle} />
              </div>
            </div>

            {/* Test Cases */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium" style={{ color: "var(--foreground-secondary)" }}>Test Cases ({form.testcases.length})</label>
                <button onClick={() => setForm({ ...form, testcases: [...form.testcases, { input: "", expectedOutput: "", isHidden: true }] })} className="text-sm" style={{ color: "var(--primary)" }}>+ Add Test Case</button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {form.testcases.map((tc: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color: "var(--foreground-secondary)" }}>TC #{i + 1}</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={tc.isHidden} onChange={() => setForm({ ...form, testcases: form.testcases.map((t: any, j: number) => j === i ? { ...t, isHidden: !t.isHidden } : t) })} className="w-3 h-3" />
                          <span className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Hidden</span>
                        </label>
                        {form.testcases.length > 1 && <button onClick={() => setForm({ ...form, testcases: form.testcases.filter((_: any, j: number) => j !== i) })}><Trash2 className="w-3 h-3" style={{ color: "#EF4444" }} /></button>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <textarea value={tc.input} onChange={(e) => setForm({ ...form, testcases: form.testcases.map((t: any, j: number) => j === i ? { ...t, input: e.target.value } : t) })} rows={2} className="w-full px-2 py-1 rounded text-xs font-mono resize-none" style={inputStyle} placeholder="Input" />
                      <textarea value={tc.expectedOutput} onChange={(e) => setForm({ ...form, testcases: form.testcases.map((t: any, j: number) => j === i ? { ...t, expectedOutput: e.target.value } : t) })} rows={2} className="w-full px-2 py-1 rounded text-xs font-mono resize-none" style={inputStyle} placeholder="Expected Output" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ImageUpload
              value={form.imageUrl}
              onChange={(data) => setForm({ ...form, imageUrl: data?.url || null, imagePublicId: data?.publicId || null })}
              label="Problem Image (optional)"
            />

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
                      <input type="radio" name="codingLibVisibility" checked={!libraryIsPublic} onChange={() => setLibraryIsPublic(false)} className="w-4 h-4" />
                      <span className="text-sm" style={{ color: "#EAB308" }}>Private Library</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="codingLibVisibility" checked={libraryIsPublic} onChange={() => setLibraryIsPublic(true)} className="w-4 h-4" />
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
                {saving ? "Saving..." : <><Save className="w-4 h-4" /> Save Problem</>}
              </button>
            </div>
          </div>
        )}

        {/* Problem List */}
        <div className="space-y-3">
          {problems.length === 0 && !showForm ? (
            <div className="rounded-xl text-center py-12" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
              <Code className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-secondary)" }} />
              <p className="mb-4" style={{ color: "var(--foreground-secondary)" }}>No problems added yet</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setShowLibrary(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold" style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
                  <Library className="w-5 h-5" /> Add from Library
                </button>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold" style={{ background: "var(--primary)" }}>
                  <Plus className="w-5 h-5" /> Create New
                </button>
              </div>
            </div>
          ) : problems.map((p, i) => (
            <div key={p._id} className="rounded-xl p-4" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{i + 1}. {p.title}</span>
                    <span className="px-2 py-0.5 rounded text-xs" style={{ color: p.difficulty === "EASY" ? "#22C55E" : p.difficulty === "HARD" ? "#EF4444" : "#EAB308", background: "var(--background-secondary)" }}>{p.difficulty}</span>
                    {p.isLibrary && (
                      <span className="text-xs flex items-center gap-1" style={{ color: "#A855F7" }}>
                        <Library className="w-3 h-3" /> From Library
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs" style={{ color: "var(--foreground-secondary)" }}>
                    {p.category && <span>{p.category}</span>}
                    <span>{p.score} pts</span>
                    <span>{p.testcases?.length || 0} test cases</span>
                  </div>
                  {p.imageUrl && <img src={p.imageUrl} alt={p.title} className="rounded-lg max-h-20 mt-2 object-contain" />}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(p)} className="p-2 rounded-lg hover:opacity-80"><Edit className="w-4 h-4" style={{ color: "#EAB308" }} /></button>
                  <button onClick={() => handleDelete(p._id)} className="p-2 rounded-lg hover:opacity-80"><Trash2 className="w-4 h-4" style={{ color: "#EF4444" }} /></button>
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
                <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Select from Coding Library</h2>
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{selectedLibraryProblems.length} selected</p>
              </div>
              <button onClick={() => { setShowLibrary(false); setSelectedLibraryProblems([]); }}><X className="w-6 h-6" style={{ color: "var(--foreground-secondary)" }} /></button>
            </div>

            <div className="p-4 flex flex-col sm:flex-row gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: "var(--foreground-secondary)" }} />
                <input type="text" placeholder="Search problems..." value={libraryFilter.search} onChange={(e) => setLibraryFilter({ ...libraryFilter, search: e.target.value })} className="w-full pl-10 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <input type="text" placeholder="Category" value={libraryFilter.category} onChange={(e) => setLibraryFilter({ ...libraryFilter, category: e.target.value })} className="px-3 py-2 rounded-lg text-sm w-full sm:w-40" style={inputStyle} />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {libraryLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} /></div>
              ) : libraryProblems.length === 0 ? (
                <p className="text-center py-8" style={{ color: "var(--foreground-secondary)" }}>No problems in library</p>
              ) : libraryProblems.map((p) => (
                <div
                  key={p._id}
                  onClick={() => setSelectedLibraryProblems(prev => prev.includes(p._id) ? prev.filter(id => id !== p._id) : [...prev, p._id])}
                  className="p-4 rounded-lg cursor-pointer transition-all"
                  style={{
                    border: selectedLibraryProblems.includes(p._id) ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: selectedLibraryProblems.includes(p._id) ? "rgba(255,107,53,0.1)" : "var(--background-secondary)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selectedLibraryProblems.includes(p._id)} onChange={() => {}} className="w-5 h-5 mt-1 rounded" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold" style={{ color: "var(--foreground)" }}>{p.title}</span>
                        <span className="px-2 py-0.5 rounded text-xs" style={{ color: p.difficulty === "EASY" ? "#22C55E" : p.difficulty === "HARD" ? "#EF4444" : "#EAB308", background: "var(--background)" }}>{p.difficulty}</span>
                        <span className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{p.score} pts</span>
                      </div>
                      <p className="text-sm line-clamp-2" style={{ color: "var(--foreground-secondary)" }}>{p.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 flex justify-end gap-3" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => { setShowLibrary(false); setSelectedLibraryProblems([]); }} className="px-4 py-2 rounded-xl font-semibold" style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>Cancel</button>
              <button onClick={handleAddFromLibrary} disabled={selectedLibraryProblems.length === 0} className="px-4 py-2 rounded-xl text-white font-semibold disabled:opacity-50" style={{ background: "var(--primary)" }}>
                Add {selectedLibraryProblems.length} Problem(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
