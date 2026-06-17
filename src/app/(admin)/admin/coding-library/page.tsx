"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  BarChart3,
  Tag,
  Clock,
  Code,
} from "lucide-react";
import ImageUpload from "@/components/ui/ImageUpload";

const CODING_CATEGORIES = ["GENERAL", "DSA", "ALGORITHMS", "DATABASE", "SYSTEM_DESIGN"];
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];

export default function CodingLibraryPage() {
  const { user, token, isAdmin } = useAuth();
  const [problems, setProblems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProblem, setEditingProblem] = useState<any>(null);
  const [filters, setFilters] = useState({ category: "", difficulty: "", search: "" });
  const [poolFilter, setPoolFilter] = useState("all");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    inputFormat: "",
    outputFormat: "",
    constraints: "",
    examples: [{ input: "", output: "", explanation: "" }],
    testcases: [{ input: "", output: "", hidden: false, points: 10 }],
    category: "GENERAL",
    difficulty: "MEDIUM",
    score: 100,
    timeLimit: 2,
    memoryLimit: 256,
    tags: "",
    imageUrl: "",
    imagePublicId: "",
    isPublic: true,
  });

  useEffect(() => {
    fetchProblems();
  }, [filters]);

  const fetchProblems = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.category) params.append("category", filters.category);
      if (filters.difficulty) params.append("difficulty", filters.difficulty);
      if (filters.search) params.append("search", filters.search);

      const res = await fetch(`/api/coding/library?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setProblems(data.problems || []);
    } catch {
      toast.error("Failed to fetch problems");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        constraints: formData.constraints.split("\n").filter(Boolean),
        tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
        isPublic: isAdmin ? formData.isPublic : false,
        isLibrary: true,
      };

      const url = editingProblem ? `/api/coding/${editingProblem._id}` : "/api/coding/library";
      const method = editingProblem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingProblem ? "Problem updated successfully" : "Problem created successfully");
        setShowModal(false);
        resetForm();
        fetchProblems();
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to save problem");
      }
    } catch {
      toast.error("Failed to save problem");
    }
  };

  const handleEdit = (problem: any) => {
    setEditingProblem(problem);
    setFormData({
      title: problem.title,
      description: problem.description,
      inputFormat: problem.inputFormat || "",
      outputFormat: problem.outputFormat || "",
      constraints: problem.constraints?.join("\n") || "",
      examples: problem.examples?.length ? problem.examples : [{ input: "", output: "", explanation: "" }],
      testcases: problem.testcases?.length ? problem.testcases : [{ input: "", output: "", hidden: false, points: 10 }],
      category: problem.category || "GENERAL",
      difficulty: problem.difficulty,
      score: problem.score,
      timeLimit: problem.timeLimit || 2,
      memoryLimit: problem.memoryLimit || 256,
      tags: problem.tags?.join(", ") || "",
      imageUrl: problem.imageUrl || "",
      imagePublicId: problem.imagePublicId || "",
      isPublic: problem.isPublic || false,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this problem from library?")) return;

    try {
      await fetch(`/api/coding/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Problem deleted");
      fetchProblems();
    } catch {
      toast.error("Failed to delete problem");
    }
  };

  const resetForm = () => {
    setEditingProblem(null);
    setFormData({
      title: "",
      description: "",
      inputFormat: "",
      outputFormat: "",
      constraints: "",
      examples: [{ input: "", output: "", explanation: "" }],
      testcases: [{ input: "", output: "", hidden: false, points: 10 }],
      category: "GENERAL",
      difficulty: "MEDIUM",
      score: 100,
      timeLimit: 2,
      memoryLimit: 256,
      tags: "",
      imageUrl: "",
      imagePublicId: "",
      isPublic: true,
    });
  };

  const addExample = () => {
    setFormData({
      ...formData,
      examples: [...formData.examples, { input: "", output: "", explanation: "" }],
    });
  };

  const addTestcase = () => {
    setFormData({
      ...formData,
      testcases: [...formData.testcases, { input: "", output: "", hidden: false, points: 10 }],
    });
  };

  const updateExample = (index: number, field: string, value: string) => {
    const newExamples = [...formData.examples];
    newExamples[index] = { ...newExamples[index], [field]: value };
    setFormData({ ...formData, examples: newExamples });
  };

  const updateTestcase = (index: number, field: string, value: any) => {
    const newTestcases = [...formData.testcases];
    newTestcases[index] = { ...newTestcases[index], [field]: value };
    setFormData({ ...formData, testcases: newTestcases });
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      GENERAL: "bg-gray-500",
      DSA: "bg-blue-500",
      ALGORITHMS: "bg-purple-500",
      DATABASE: "bg-orange-500",
      SYSTEM_DESIGN: "bg-green-500",
    };
    return colors[cat] || "bg-gray-500";
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen  py-8">
      <div className="section-shell">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold">Coding Problem Library</h1>
            <p className="text-muted-ui">Manage reusable coding problems</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="btn-primary flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Add Problem
          </button>
        </div>

        {/* Pool Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setPoolFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              poolFilter === "all"
                ? "bg-primary-500 text-white"
                : "surface-muted text-muted-ui hover:text-white hover:bg-dark-600"
            }`}
          >
            All Problems
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs /50">
              {problems.length}
            </span>
          </button>
          <button
            onClick={() => setPoolFilter("public")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              poolFilter === "public"
                ? "bg-green-500/20 text-green-400 border border-green-500/40"
                : "surface-muted text-muted-ui hover:text-white hover:bg-dark-600"
            }`}
          >
            🌐 Public Pool
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs /50">
              {problems.filter((p) => p.isPublic).length}
            </span>
          </button>
          <button
            onClick={() => setPoolFilter("private")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              poolFilter === "private"
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                : "surface-muted text-muted-ui hover:text-white hover:bg-dark-600"
            }`}
          >
            🔒 {isAdmin ? "Private Pool" : "My Problems"}
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs /50">
              {problems.filter((p) => !p.isPublic).length}
            </span>
          </button>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-ui w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search problems..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="input-field pl-10 w-full"
                />
              </div>
            </div>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="input-field min-w-[150px]"
            >
              <option value="">All Categories</option>
              {CODING_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={filters.difficulty}
              onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
              className="input-field min-w-[150px]"
            >
              <option value="">All Difficulties</option>
              {DIFFICULTIES.map((diff) => (
                <option key={diff} value={diff}>{diff}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Problem List */}
        <div className="space-y-4">
          {(() => {
            const filteredProblems = problems.filter((problem) => {
              if (poolFilter === "public") return problem.isPublic;
              if (poolFilter === "private") return !problem.isPublic;
              return true;
            });
            return filteredProblems.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-muted-ui">
                  {poolFilter === "all"
                    ? "No problems in library. Create your first one!"
                    : poolFilter === "public"
                    ? "No public problems in the library."
                    : "No private problems yet. Create one!"}
                </p>
              </div>
            ) : (
              filteredProblems.map((problem) => (
                <div key={problem._id} className="card hover:border transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Code className="w-5 h-5 text-primary-500" />
                        <h3 className="text-lg font-bold">{problem.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getCategoryColor(problem.category)}`}>
                          {problem.category}
                        </span>
                        <span className={`badge-${problem.difficulty?.toLowerCase()}`}>
                          {problem.difficulty}
                        </span>
                        {problem.isPublic ? (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                            Public
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            Private
                          </span>
                        )}
                      </div>
                      <p className="text-muted-ui line-clamp-2">{problem.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(isAdmin || (problem.createdBy?._id === user?._id && !problem.isPublic)) && (
                        <>
                          <button onClick={() => handleEdit(problem)} className="p-2 hover:surface-muted rounded-lg transition-colors cursor-pointer">
                            <Edit className="w-4 h-4 text-blue-400" />
                          </button>
                          <button onClick={() => handleDelete(problem._id)} className="p-2 hover:surface-muted rounded-lg transition-colors cursor-pointer">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-ui border-t border-dark-700 pt-3">
                    <div className="flex items-center gap-1">
                      <span className="text-primary-400 font-semibold">{problem.score}</span> points
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{problem.timeLimit || 2}s limit</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BarChart3 className="w-4 h-4" />
                      <span>Attempted: {problem.metrics?.attempted || 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span>Accepted: {problem.metrics?.accepted || 0}</span>
                    </div>
                    {problem.tags?.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        <span>{problem.tags.join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            );
          })()}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="surface-muted rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-700">
              <h2 className="text-xl font-bold">
                {editingProblem ? "Edit Problem" : "Add New Problem"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-field w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field w-full h-32"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input-field w-full"
                  >
                    {CODING_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Difficulty</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="input-field w-full"
                  >
                    {DIFFICULTIES.map((diff) => (
                      <option key={diff} value={diff}>{diff}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Score</label>
                  <input
                    type="number"
                    value={formData.score}
                    onChange={(e) => setFormData({ ...formData, score: parseInt(e.target.value) })}
                    className="input-field w-full"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Input Format *</label>
                  <textarea
                    value={formData.inputFormat}
                    onChange={(e) => setFormData({ ...formData, inputFormat: e.target.value })}
                    className="input-field w-full h-20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Output Format *</label>
                  <textarea
                    value={formData.outputFormat}
                    onChange={(e) => setFormData({ ...formData, outputFormat: e.target.value })}
                    className="input-field w-full h-20"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Constraints (one per line)</label>
                <textarea
                  value={formData.constraints}
                  onChange={(e) => setFormData({ ...formData, constraints: e.target.value })}
                  className="input-field w-full h-20"
                  placeholder={"1 <= n <= 1000\n-10^9 <= arr[i] <= 10^9"}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Time Limit (seconds)</label>
                  <input
                    type="number"
                    value={formData.timeLimit}
                    onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) })}
                    className="input-field w-full"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Memory Limit (MB)</label>
                  <input
                    type="number"
                    value={formData.memoryLimit}
                    onChange={(e) => setFormData({ ...formData, memoryLimit: parseInt(e.target.value) })}
                    className="input-field w-full"
                    min="16"
                  />
                </div>
              </div>

              {/* Examples */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Examples</label>
                  <button type="button" onClick={addExample} className="text-sm text-primary-500 hover:text-primary-400 cursor-pointer">+ Add Example</button>
                </div>
                {formData.examples.map((ex, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2 p-3 rounded-lg surface-muted/50 border border">
                    <textarea value={ex.input} onChange={(e) => updateExample(idx, "input", e.target.value)} className="input-field h-16 font-mono text-sm" placeholder="Input" />
                    <textarea value={ex.output} onChange={(e) => updateExample(idx, "output", e.target.value)} className="input-field h-16 font-mono text-sm" placeholder="Output" />
                    <textarea value={ex.explanation} onChange={(e) => updateExample(idx, "explanation", e.target.value)} className="input-field h-16 text-sm" placeholder="Explanation" />
                  </div>
                ))}
              </div>

              {/* Test Cases */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Test Cases</label>
                  <button type="button" onClick={addTestcase} className="text-sm text-primary-500 hover:text-primary-400 cursor-pointer">+ Add Test Case</button>
                </div>
                {formData.testcases.map((tc, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2 p-3 rounded-lg surface-muted/50 border border">
                    <textarea value={tc.input} onChange={(e) => updateTestcase(idx, "input", e.target.value)} className="input-field h-16 font-mono text-sm" placeholder="Input" />
                    <textarea value={tc.output} onChange={(e) => updateTestcase(idx, "output", e.target.value)} className="input-field h-16 font-mono text-sm" placeholder="Output" />
                    <input type="number" value={tc.points} onChange={(e) => updateTestcase(idx, "points", parseInt(e.target.value))} className="input-field text-sm" placeholder="Points" />
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={tc.hidden} onChange={(e) => updateTestcase(idx, "hidden", e.target.checked)} className="w-4 h-4" />
                        Hidden
                      </label>
                      {formData.testcases.length > 1 && (
                        <button type="button" onClick={() => setFormData({ ...formData, testcases: formData.testcases.filter((_, j) => j !== idx) })} className="p-1 cursor-pointer">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="input-field w-full"
                  placeholder="arrays, two-pointers, hash-table"
                />
              </div>

              <div>
                <ImageUpload
                  value={formData.imageUrl || null}
                  onChange={(data) => setFormData({ ...formData, imageUrl: data?.url || "", imagePublicId: data?.publicId || "" })}
                  label="Problem Image (optional)"
                />
              </div>

              {/* Visibility - Admin only */}
              {isAdmin && (
                <div className="flex items-center gap-3 p-3 rounded-lg surface-muted/50 border border">
                  <label className="text-sm font-medium">Visibility:</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isPublicCoding"
                      checked={formData.isPublic === true}
                      onChange={() => setFormData({ ...formData, isPublic: true })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-green-400">Public</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isPublicCoding"
                      checked={formData.isPublic === false}
                      onChange={() => setFormData({ ...formData, isPublic: false })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-yellow-400">Private</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="btn-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary cursor-pointer">
                  {editingProblem ? "Update Problem" : "Create Problem"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
