"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { Plus, Trash2, Save, ArrowLeft, Type, AlignLeft, CircleDot, CheckSquare, Hash, Link2, Calendar, Eye, Upload } from "lucide-react";
import ImageUpload from "@/components/ui/ImageUpload";

const inputStyle = { background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" };

const FIELD_TYPES = [
  { value: "TEXT", label: "Text Input", icon: Type },
  { value: "TEXTAREA", label: "Text Area", icon: AlignLeft },
  { value: "RADIO", label: "Single Choice", icon: CircleDot },
  { value: "CHECKBOX", label: "Multiple Choice", icon: CheckSquare },
  { value: "NUMBER", label: "Number", icon: Hash },
  { value: "URL", label: "URL", icon: Link2 },
  { value: "DATE", label: "Date", icon: Calendar },
  { value: "FILE", label: "File Upload", icon: Upload },
];

interface FormField {
  fieldId: string; type: string; label: string; required: boolean; placeholder: string;
  options: string[]; correctAnswers: string[]; isAutoScored: boolean; marks: number; order: number;
  descriptionImage: string | null;
  allowedFileTypes: string[];
  maxFileSize: number;
}

const FILE_TYPE_OPTIONS = [
  { value: "image/*", label: "Images (JPG, PNG, GIF, WebP)" },
  { value: "application/pdf", label: "PDF Documents" },
  { value: ".doc,.docx", label: "Word Documents" },
  { value: ".xls,.xlsx", label: "Excel Spreadsheets" },
  { value: ".ppt,.pptx", label: "PowerPoint Presentations" },
  { value: ".zip,.rar", label: "Archives (ZIP, RAR)" },
  { value: "video/*", label: "Videos" },
  { value: "audio/*", label: "Audio Files" },
  { value: ".txt,.csv", label: "Text/CSV Files" },
  { value: "*", label: "Any File Type" },
];

export default function FormBuilderPage() {
  const params = useParams<{ contestId: string; formId?: string }>();
  const contestId = params.contestId;
  const formId = (params as any).formId;
  const router = useRouter();
  const { token } = useAuth();

  const [loading, setLoading] = useState(!!formId);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [formData, setFormData] = useState({ title: "", description: "", fields: [] as FormField[] });

  useEffect(() => {
    if (formId && formId !== "new") {
      fetch(`/api/forms/${formId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => { if (d.form) setFormData({ title: d.form.title, description: d.form.description, fields: d.form.fields }); })
        .catch(() => toast.error("Failed to load form"))
        .finally(() => setLoading(false));
    }
  }, [formId]);

  const addField = (type: string) => {
    const ft = FIELD_TYPES.find((t) => t.value === type)!;
    const field: FormField = {
      fieldId: crypto.randomUUID(), type, label: `New ${ft.label} Field`, required: false, placeholder: "",
      options: type === "RADIO" || type === "CHECKBOX" ? ["Option 1", "Option 2"] : [],
      correctAnswers: [], isAutoScored: false, marks: 0, order: formData.fields.length,
      descriptionImage: null,
      allowedFileTypes: type === "FILE" ? ["*"] : [],
      maxFileSize: 5,
    };
    setFormData((p) => ({ ...p, fields: [...p.fields, field] }));
    setShowAddField(false);
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setFormData((p) => ({ ...p, fields: p.fields.map((f) => (f.fieldId === fieldId ? { ...f, ...updates } : f)) }));
  };

  const removeField = (fieldId: string) => {
    setFormData((p) => ({ ...p, fields: p.fields.filter((f) => f.fieldId !== fieldId) }));
  };

  const moveField = (index: number, dir: "up" | "down") => {
    const nf = [...formData.fields];
    const ni = dir === "up" ? index - 1 : index + 1;
    if (ni < 0 || ni >= nf.length) return;
    [nf[index], nf[ni]] = [nf[ni], nf[index]];
    nf.forEach((f, i) => (f.order = i));
    setFormData((p) => ({ ...p, fields: nf }));
  };

  const handleSave = async () => {
    if (!formData.title.trim()) { toast.error("Title required"); return; }
    if (formData.fields.length === 0) { toast.error("Add at least one field"); return; }
    setSaving(true);
    try {
      const isEdit = formId && formId !== "new";
      const url = isEdit ? `/api/forms/${formId}` : "/api/forms";
      const method = isEdit ? "PUT" : "POST";
      const body = isEdit ? formData : { ...formData, contestId };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (res.ok) { toast.success(isEdit ? "Updated!" : "Created!"); router.push(`/admin/contest/forms/${contestId}`); }
      else toast.error("Failed to save");
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  const totalMarks = formData.fields.reduce((s, f) => s + (f.marks || 0), 0);

  if (loading) return <div className="page-shell flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} /></div>;

  return (
    <div className="page-shell">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 rounded-lg" style={{ color: "var(--foreground-secondary)" }}><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--foreground)" }}>{formId && formId !== "new" ? "Edit Form" : "Create Form"}</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>
              <Eye className="w-4 h-4" /> {showPreview ? "Edit" : "Preview"}
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-white font-semibold" style={{ background: "var(--primary)" }}>
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Title + Description */}
        <div className="rounded-xl p-6 mb-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
          <input type="text" value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} placeholder="Form Title" className="w-full px-3 py-2.5 rounded-lg text-xl font-semibold mb-4" style={inputStyle} />
          <textarea value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" className="w-full px-3 py-2.5 rounded-lg resize-none text-sm" style={inputStyle} rows={2} />
          <p className="mt-3 text-sm" style={{ color: "var(--foreground-secondary)" }}>Total Marks: <span className="font-semibold" style={{ color: "var(--primary)" }}>{totalMarks}</span></p>
        </div>

        {showPreview ? (
          /* Preview */
          <div className="rounded-xl p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--foreground)" }}>{formData.title || "Untitled"}</h2>
            {formData.description && <p className="mb-6" style={{ color: "var(--foreground-secondary)" }}>{formData.description}</p>}
            {formData.fields.map((field) => (
              <div key={field.fieldId} className="mb-6 p-4 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                <label className="block font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  {field.label} {field.required && <span style={{ color: "#EF4444" }}>*</span>}
                  <span className="text-sm ml-2" style={{ color: "var(--foreground-secondary)" }}>({field.marks} marks)</span>
                </label>
                {field.descriptionImage && (
                  <img src={field.descriptionImage} alt="" className="rounded-lg mb-2 max-h-40 object-contain" />
                )}
                {["TEXT", "NUMBER", "URL"].includes(field.type) && <input type={field.type.toLowerCase()} placeholder={field.placeholder} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} disabled />}
                {field.type === "TEXTAREA" && <textarea placeholder={field.placeholder} className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={inputStyle} rows={3} disabled />}
                {field.type === "DATE" && <input type="date" className="px-3 py-2 rounded-lg text-sm" style={inputStyle} disabled />}
                {(field.type === "RADIO" || field.type === "CHECKBOX") && (
                  <div className="space-y-2">{field.options.map((opt, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm" style={{ color: "var(--foreground-secondary)" }}><input type={field.type.toLowerCase()} disabled /> {opt}</label>
                  ))}</div>
                )}
                {field.type === "FILE" && (
                  <div className="border-2 border-dashed rounded-lg p-4 text-center" style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}>
                    📎 File upload area (max {field.maxFileSize || 5}MB)
                    {field.allowedFileTypes?.length > 0 && !field.allowedFileTypes.includes("*") && (
                      <p className="text-xs mt-1">Allowed: {field.allowedFileTypes.map((t) => FILE_TYPE_OPTIONS.find((ft) => ft.value === t)?.label || t).join(", ")}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Field Editors */}
            <div className="space-y-4 mb-6">
              {formData.fields.map((field, index) => {
                const TypeIcon = FIELD_TYPES.find((t) => t.value === field.type)?.icon || Type;
                const canAutoScore = field.type === "RADIO" || field.type === "CHECKBOX";
                return (
                  <div key={field.fieldId} className="rounded-xl p-5" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
                      <div className="flex flex-col text-sm" style={{ color: "var(--foreground-secondary)" }}>
                        <button onClick={() => moveField(index, "up")} disabled={index === 0} className="disabled:opacity-30">▲</button>
                        <button onClick={() => moveField(index, "down")} disabled={index === formData.fields.length - 1} className="disabled:opacity-30">▼</button>
                      </div>
                      <TypeIcon className="w-5 h-5 flex-shrink-0" style={{ color: "var(--primary)" }} />
                      <input type="text" value={field.label} onChange={(e) => updateField(field.fieldId, { label: e.target.value })} className="flex-1 min-w-0 bg-transparent font-medium outline-none" style={{ color: "var(--foreground)", borderBottom: "1px solid var(--border)" }} />
                      <button onClick={() => removeField(field.fieldId)} className="p-2 flex-shrink-0"><Trash2 className="w-4 h-4" style={{ color: "#EF4444" }} /></button>
                    </div>
                    <div className="mb-3">
                      <ImageUpload
                        value={field.descriptionImage || null}
                        onChange={(data) => updateField(field.fieldId, { descriptionImage: data?.url || null })}
                        label="Description Image (optional)"
                        compact
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <label className="flex items-center gap-2 text-sm" style={{ color: "var(--foreground-secondary)" }}>
                        <input type="checkbox" checked={field.required} onChange={(e) => updateField(field.fieldId, { required: e.target.checked })} /> Required
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Marks:</span>
                        <input type="number" min="0" value={field.marks} onChange={(e) => updateField(field.fieldId, { marks: Number(e.target.value) })} className="w-16 px-2 py-1 rounded text-sm" style={inputStyle} />
                      </div>
                      {canAutoScore && (
                        <label className="flex items-center gap-2 col-span-2 text-sm" style={{ color: "var(--foreground-secondary)" }}>
                          <input type="checkbox" checked={field.isAutoScored} onChange={(e) => updateField(field.fieldId, { isAutoScored: e.target.checked })} /> Auto-score
                        </label>
                      )}
                    </div>
                    {["TEXT", "TEXTAREA", "NUMBER", "URL"].includes(field.type) && (
                      <input type="text" value={field.placeholder} onChange={(e) => updateField(field.fieldId, { placeholder: e.target.value })} placeholder="Placeholder..." className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    )}
                    {(field.type === "RADIO" || field.type === "CHECKBOX") && (
                      <div className="space-y-2 mt-3">
                        <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Options:</p>
                        {field.options.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            {field.isAutoScored && (
                              <input type={field.type.toLowerCase()} checked={field.correctAnswers.includes(opt)} onChange={() => {
                                const nc = field.type === "RADIO" ? [opt] : field.correctAnswers.includes(opt) ? field.correctAnswers.filter((a) => a !== opt) : [...field.correctAnswers, opt];
                                updateField(field.fieldId, { correctAnswers: nc });
                              }} />
                            )}
                            <input type="text" value={opt} onChange={(e) => { const no = [...field.options]; no[i] = e.target.value; updateField(field.fieldId, { options: no }); }} className="flex-1 px-3 py-1.5 rounded-lg text-sm" style={inputStyle} />
                            <button onClick={() => { updateField(field.fieldId, { options: field.options.filter((_, j) => j !== i), correctAnswers: field.correctAnswers.filter((a) => a !== opt) }); }}><Trash2 className="w-3 h-3" style={{ color: "#EF4444" }} /></button>
                          </div>
                        ))}
                        <button onClick={() => updateField(field.fieldId, { options: [...field.options, `Option ${field.options.length + 1}`] })} className="text-sm" style={{ color: "var(--primary)" }}>+ Add Option</button>
                        {field.isAutoScored && <p className="text-xs mt-1" style={{ color: "#22C55E" }}>✓ Correct: {field.correctAnswers.join(", ") || "None"}</p>}
                      </div>
                    )}
                    {field.type === "FILE" && (
                      <div className="space-y-3 p-4 rounded-lg" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}>
                        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>📎 File Upload Settings</p>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: "var(--foreground-secondary)" }}>Allowed File Types</label>
                          <div className="grid grid-cols-2 gap-2">
                            {FILE_TYPE_OPTIONS.map((ft) => (
                              <label key={ft.value} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--foreground-secondary)" }}>
                                <input
                                  type="checkbox"
                                  checked={field.allowedFileTypes?.includes(ft.value) || false}
                                  onChange={(e) => {
                                    let updated: string[];
                                    if (ft.value === "*") {
                                      updated = e.target.checked ? ["*"] : [];
                                    } else {
                                      const without = (field.allowedFileTypes || []).filter((t) => t !== "*" && t !== ft.value);
                                      updated = e.target.checked ? [...without, ft.value] : without;
                                    }
                                    updateField(field.fieldId, { allowedFileTypes: updated });
                                  }}
                                  className="w-4 h-4"
                                />
                                {ft.label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Max File Size (MB):</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={field.maxFileSize || 5}
                            onChange={(e) => updateField(field.fieldId, { maxFileSize: Number(e.target.value) })}
                            className="w-20 px-2 py-1 rounded text-sm"
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add Field */}
            {showAddField ? (
              <div className="rounded-xl p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>Select Field Type</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {FIELD_TYPES.map((type) => (
                    <button key={type.value} onClick={() => addField(type.value)} className="flex flex-col items-center gap-2 p-4 rounded-lg transition-colors" style={{ background: "var(--background-secondary)" }}>
                      <type.icon className="w-6 h-6" style={{ color: "var(--primary)" }} />
                      <span className="text-sm" style={{ color: "var(--foreground)" }}>{type.label}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowAddField(false)} className="mt-4 text-sm" style={{ color: "var(--foreground-secondary)" }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowAddField(true)} className="w-full border-2 border-dashed rounded-lg p-6 flex items-center justify-center gap-2 transition-colors" style={{ borderColor: "var(--border)", color: "var(--foreground-secondary)" }}>
                <Plus className="w-5 h-5" /> Add Field
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
