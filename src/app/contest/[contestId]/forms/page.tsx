"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { ClipboardList, CheckCircle, Send, ArrowLeft, ArrowRight } from "lucide-react";

const inputStyle = { background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" };

export default function ContestFormsPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<number>(0);
  const [responses, setResponses] = useState<Record<string, Record<string, any>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`/api/forms/contest/${contestId}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setForms(data.forms || []);
      } catch { toast.error("Failed to load forms"); }
      setLoading(false);
    };
    fetch_();
  }, [contestId]);

  const updateResponse = (formId: string, fieldId: string, value: any) => {
    setResponses((prev) => ({
      ...prev,
      [formId]: { ...prev[formId], [fieldId]: value },
    }));
  };

  const handleSubmit = async (formId: string) => {
    const form = forms.find((f) => f._id === formId);
    if (!form) return;

    // Validate required fields
    for (const field of form.fields) {
      if (field.required) {
        const val = responses[formId]?.[field.fieldId];
        if (!val || (Array.isArray(val) && val.length === 0)) {
          toast.error(`"${field.label}" is required`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const formResponses = form.fields.map((field: any) => ({
        fieldId: field.fieldId,
        value: responses[formId]?.[field.fieldId] ?? null,
      }));

      const res = await fetch("/api/form-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ formId, contestId, responses: formResponses }),
      });

      const data = await res.json();
      if (data.success || res.ok) {
        toast.success("Form submitted!");
        setSubmitted((prev) => new Set([...prev, formId]));
      } else {
        toast.error(data.message || "Failed to submit");
      }
    } catch {
      toast.error("Failed to submit form");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} />
      </div>
    );
  }

  if (forms.length === 0) {
    return (
      <div className="text-center py-12">
        <ClipboardList className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-secondary)" }} />
        <p style={{ color: "var(--foreground-secondary)" }}>No forms available for this contest</p>
      </div>
    );
  }

  const currentForm = forms[activeForm];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Form Navigation */}
      {forms.length > 1 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {forms.map((form, i) => (
            <button
              key={form._id}
              onClick={() => setActiveForm(i)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
              style={{
                background: activeForm === i ? "var(--primary)" : "var(--background-secondary)",
                color: activeForm === i ? "#fff" : "var(--foreground-secondary)",
              }}
            >
              {submitted.has(form._id) && <CheckCircle className="w-4 h-4" />}
              {form.title}
            </button>
          ))}
        </div>
      )}

      {/* Current Form */}
      {currentForm && (
        <div className="rounded-xl p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{currentForm.title}</h2>
          {currentForm.description && <p className="mb-6 text-sm" style={{ color: "var(--foreground-secondary)" }}>{currentForm.description}</p>}

          {submitted.has(currentForm._id) ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: "#22C55E" }} />
              <p className="text-lg font-semibold" style={{ color: "#22C55E" }}>Form Submitted!</p>
              <p className="text-sm mt-2" style={{ color: "var(--foreground-secondary)" }}>Your response has been recorded</p>
            </div>
          ) : (
            <div className="space-y-6">
              {currentForm.fields?.map((field: any) => (
                <div key={field.fieldId}>
                  <label className="block font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    {field.label} {field.required && <span style={{ color: "#EF4444" }}>*</span>}
                    {field.marks > 0 && <span className="text-xs ml-2" style={{ color: "var(--foreground-secondary)" }}>({field.marks} marks)</span>}
                  </label>

                  {field.type === "TEXT" && (
                    <input
                      type="text"
                      placeholder={field.placeholder}
                      value={responses[currentForm._id]?.[field.fieldId] || ""}
                      onChange={(e) => updateResponse(currentForm._id, field.fieldId, e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm"
                      style={inputStyle}
                    />
                  )}

                  {field.type === "TEXTAREA" && (
                    <textarea
                      placeholder={field.placeholder}
                      value={responses[currentForm._id]?.[field.fieldId] || ""}
                      onChange={(e) => updateResponse(currentForm._id, field.fieldId, e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
                      style={inputStyle}
                    />
                  )}

                  {field.type === "NUMBER" && (
                    <input
                      type="number"
                      placeholder={field.placeholder}
                      value={responses[currentForm._id]?.[field.fieldId] || ""}
                      onChange={(e) => updateResponse(currentForm._id, field.fieldId, e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm"
                      style={inputStyle}
                    />
                  )}

                  {field.type === "URL" && (
                    <input
                      type="url"
                      placeholder={field.placeholder || "https://"}
                      value={responses[currentForm._id]?.[field.fieldId] || ""}
                      onChange={(e) => updateResponse(currentForm._id, field.fieldId, e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm"
                      style={inputStyle}
                    />
                  )}

                  {field.type === "DATE" && (
                    <input
                      type="date"
                      value={responses[currentForm._id]?.[field.fieldId] || ""}
                      onChange={(e) => updateResponse(currentForm._id, field.fieldId, e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm"
                      style={inputStyle}
                    />
                  )}

                  {field.type === "RADIO" && (
                    <div className="space-y-2">
                      {field.options?.map((opt: string, i: number) => (
                        <label key={i} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg" style={{ background: responses[currentForm._id]?.[field.fieldId] === opt ? "rgba(var(--primary-rgb), 0.1)" : "transparent" }}>
                          <input
                            type="radio"
                            name={`field-${field.fieldId}`}
                            checked={responses[currentForm._id]?.[field.fieldId] === opt}
                            onChange={() => updateResponse(currentForm._id, field.fieldId, opt)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm" style={{ color: "var(--foreground)" }}>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {field.type === "CHECKBOX" && (
                    <div className="space-y-2">
                      {field.options?.map((opt: string, i: number) => {
                        const selected = responses[currentForm._id]?.[field.fieldId] || [];
                        const isChecked = Array.isArray(selected) && selected.includes(opt);
                        return (
                          <label key={i} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const newVal = isChecked ? selected.filter((v: string) => v !== opt) : [...selected, opt];
                                updateResponse(currentForm._id, field.fieldId, newVal);
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm" style={{ color: "var(--foreground)" }}>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                {activeForm > 0 ? (
                  <button onClick={() => setActiveForm((p) => p - 1)} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>
                    <ArrowLeft className="w-4 h-4" /> Previous
                  </button>
                ) : <div />}
                <div className="flex flex-col sm:flex-row gap-3 sm:ml-auto">
                  {activeForm < forms.length - 1 && (
                    <button onClick={() => setActiveForm((p) => p + 1)} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>
                      Next <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleSubmit(currentForm._id)}
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-white font-semibold"
                    style={{ background: "var(--primary)" }}
                  >
                    <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit Form"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
