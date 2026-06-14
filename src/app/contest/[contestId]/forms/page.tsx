"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useContestTimer } from "@/context/ContestTimerContext";
import toast from "react-hot-toast";
import { ClipboardList, CheckCircle, Send, ArrowLeft, ArrowRight, Clock, Loader } from "lucide-react";

export default function ContestFormsPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const {
    activeSectionTimer,
    activeSectionFormatted,
    sectionStatuses,
    startSection,
    submitSection,
    progress,
  } = useContestTimer();

  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<number>(0);
  const [responses, setResponses] = useState<Record<string, Record<string, any>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [formStartTimes, setFormStartTimes] = useState<Record<string, number>>({});

  // Block re-entry if section already submitted
  useEffect(() => {
    if (sectionStatuses.forms === "SUBMITTED") {
      toast.error("Forms section already submitted. Cannot re-enter.");
      router.replace(`/contest/${contestId}/hub`);
      return;
    }
    if (progress?.status === "SUBMITTED" || progress?.status === "TIMED_OUT") {
      toast.error("Contest already submitted.");
      router.replace(`/contest/${contestId}/review`);
    }
    if (progress?.terminationReason === "MALPRACTICE") {
      toast.error("Contest terminated due to malpractice.");
      router.replace(`/contest/${contestId}/review`);
    }
  }, [sectionStatuses, progress, contestId, router]);

  // Start section timer on mount
  useEffect(() => {
    if (sectionStatuses.forms !== "SUBMITTED") {
      startSection("forms").catch(() => {
        router.replace(`/contest/${contestId}/hub`);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) return;
    const fetch_ = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [formsRes, submissionsRes] = await Promise.all([
          fetch(`/api/forms/contest/${contestId}`, { headers }),
          fetch(`/api/form-submissions/my/${contestId}`, { headers }),
        ]);
        const formsData = await formsRes.json();
        const submissionsData = await submissionsRes.json();
        setForms(formsData.forms || []);
        setSubmitted(new Set((submissionsData.submissions || []).map((submission: any) => submission.formId?._id || submission.formId)));
        const saved = localStorage.getItem(`form_responses_${contestId}`);
        if (saved) setResponses(JSON.parse(saved));
      } catch { toast.error("Failed to load forms"); }
      setLoading(false);
    };
    fetch_();
  }, [contestId, token]);

  useEffect(() => {
    localStorage.setItem(`form_responses_${contestId}`, JSON.stringify(responses));
  }, [contestId, responses]);

  const startTrackingForm = (formId: string) => {
    if (!formStartTimes[formId]) {
      setFormStartTimes(prev => ({ ...prev, [formId]: Date.now() }));
    }
  };

  const getTimeSpent = (formId: string) => {
    const startTime = formStartTimes[formId];
    if (!startTime) return 0;
    return Math.floor((Date.now() - startTime) / 1000);
  };

  const updateResponse = (formId: string, fieldId: string, value: any) => {
    startTrackingForm(formId);
    setResponses((prev) => ({
      ...prev,
      [formId]: { ...prev[formId], [fieldId]: value },
    }));
  };

  const handleSubmit = async (formId: string) => {
    const form = forms.find((f) => f._id === formId);
    if (!form) return;

    const formResponses = responses[formId] || {};
    for (const field of form.fields) {
      if (field.required && !formResponses[field.fieldId]) {
        toast.error(`Please fill in: ${field.label}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const responseArray = form.fields.map((field: any) => ({
        fieldId: field.fieldId,
        value: formResponses[field.fieldId] || null,
      }));

      const res = await fetch("/api/form-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ formId, contestId, responses: responseArray, timeTaken: getTimeSpent(formId) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Form submitted successfully!");
        setSubmitted((prev) => new Set([...prev, formId]));

        // Clear responses for this form
        setResponses(prev => {
          const newResponses = { ...prev };
          delete newResponses[formId];
          return newResponses;
        });

        // Move to next form or submit section
        if (activeForm < forms.length - 1) {
          setActiveForm((p) => p + 1);
        } else {
          // Check if all forms are now submitted
          const allDone = forms.every((f) => submitted.has(f._id) || f._id === formId);
          if (allDone) {
            toast.success("All forms completed! Submitting section...", { duration: 2000 });
            try {
              await submitSection("forms");
            } catch { /* handled by submitSection */ }
            setTimeout(() => router.push(`/contest/${contestId}/hub`), 1500);
          }
        }
      } else {
        toast.error(data.message || "Failed to submit");
      }
    } catch {
      toast.error("Failed to submit form");
    }
    setSubmitting(false);
  };

  const handleSubmitFormsSection = async () => {
    const confirmed = window.confirm(
      "Submitting will lock this section. You cannot re-enter. Continue?"
    );
    if (!confirmed) return;
    try {
      await submitSection("forms");
      router.push(`/contest/${contestId}/hub`);
    } catch {
      toast.error("Failed to submit forms section");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  if (forms.length === 0) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <div
            className="rounded-2xl text-center py-12"
            style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}
          >
            <ClipboardList className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--foreground-muted)" }} />
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--foreground-secondary)" }}>No Forms Available</h2>
            <p style={{ color: "var(--foreground-muted)" }}>There are no forms to fill in this contest.</p>
            <button
              onClick={() => router.push(`/contest/${contestId}/hub`)}
              className="mt-6 px-6 py-3 rounded-xl text-white font-semibold"
              style={{ background: "linear-gradient(135deg, var(--primary), #FF8C5A)" }}
            >
              Back to Contest Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentForm = forms[activeForm];
  const isCurrentFormSubmitted = submitted.has(currentForm?._id);
  const isTimeLow = (activeSectionTimer ?? Infinity) < 300;

  return (
    <div className="min-h-screen p-3 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header — matches KK layout: [Back to Hub] [Timer] [Form X of Y] */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <button
            onClick={handleSubmitFormsSection}
            className="flex items-center gap-1 sm:gap-2 transition-colors"
            style={{ color: "var(--foreground-secondary)" }}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Submit & Back to Hub</span>
          </button>

          {activeSectionTimer !== null && (
            <div
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-mono text-sm sm:text-lg font-bold ${
                isTimeLow ? "animate-pulse" : ""
              }`}
              style={{
                background: isTimeLow ? "rgba(239,68,68,0.2)" : "var(--background-secondary)",
                color: isTimeLow ? "#ef4444" : "var(--foreground)",
              }}
              role="timer"
              aria-live="polite"
            >
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{activeSectionFormatted}</span>
            </div>
          )}

          <div className="text-right">
            <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
              Form {activeForm + 1} of {forms.length}
            </span>
          </div>
        </div>

        {/* Form Navigation Tabs — matches KK: horizontal scrollable pills */}
        {forms.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {forms.map((form, idx) => (
              <button
                key={form._id}
                onClick={() => setActiveForm(idx)}
                className="px-4 py-2 rounded-lg whitespace-nowrap transition-colors text-sm font-semibold"
                style={{
                  background:
                    idx === activeForm
                      ? "var(--primary)"
                      : submitted.has(form._id)
                        ? "rgba(34,197,94,0.2)"
                        : "var(--background-secondary)",
                  color:
                    idx === activeForm
                      ? "#fff"
                      : submitted.has(form._id)
                        ? "#22C55E"
                        : "var(--foreground-secondary)",
                  border: submitted.has(form._id) && idx !== activeForm
                    ? "1px solid rgba(34,197,94,0.5)"
                    : "1px solid transparent",
                }}
              >
                {submitted.has(form._id) && <CheckCircle className="w-4 h-4 inline mr-2" />}
                {form.title}
              </button>
            ))}
          </div>
        )}

        {/* Current Form Card — matches KK card style */}
        {currentForm && (
          <div
            className="rounded-2xl p-6"
            style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}
          >
            {/* Form title with icon */}
            <div className="flex items-center gap-3 mb-4">
              <ClipboardList className="w-6 h-6" style={{ color: "var(--primary)" }} />
              <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {currentForm.title}
              </h1>
            </div>
            {currentForm.description && (
              <p className="mb-6" style={{ color: "var(--foreground-secondary)" }}>{currentForm.description}</p>
            )}
            <p className="text-sm mb-6" style={{ color: "var(--foreground-muted)" }}>
              Total Marks: {currentForm.totalMarks}
            </p>

            {isCurrentFormSubmitted ? (
              <div
                className="rounded-lg p-6 text-center"
                style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}
              >
                <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "#22C55E" }} />
                <h3 className="text-lg font-semibold" style={{ color: "#22C55E" }}>Form Submitted!</h3>
                <p className="mt-2" style={{ color: "var(--foreground-secondary)" }}>You have already submitted this form.</p>
              </div>
            ) : (
              <>
                {/* Form Fields — each in a card bg */}
                <div className="space-y-6">
                  {currentForm.fields?.map((field: any) => (
                    <div
                      key={field.fieldId}
                      className="p-4 rounded-lg"
                      style={{ background: "var(--background-secondary)" }}
                    >
                      <label className="block font-medium mb-2" style={{ color: "var(--foreground)" }}>
                        {field.label}
                        {field.required && <span style={{ color: "#EF4444" }} className="ml-1">*</span>}
                        {field.marks > 0 && (
                          <span className="text-sm ml-2" style={{ color: "var(--foreground-muted)" }}>
                            ({field.marks} marks)
                          </span>
                        )}
                      </label>

                      {field.type === "TEXT" && (
                        <input
                          type="text"
                          placeholder={field.placeholder}
                          value={responses[currentForm._id]?.[field.fieldId] || ""}
                          onChange={(e) => updateResponse(currentForm._id, field.fieldId, e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg text-sm"
                          style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                        />
                      )}

                      {field.type === "TEXTAREA" && (
                        <textarea
                          placeholder={field.placeholder}
                          value={responses[currentForm._id]?.[field.fieldId] || ""}
                          onChange={(e) => updateResponse(currentForm._id, field.fieldId, e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
                          style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                        />
                      )}

                      {field.type === "NUMBER" && (
                        <input
                          type="number"
                          placeholder={field.placeholder}
                          value={responses[currentForm._id]?.[field.fieldId] || ""}
                          onChange={(e) => updateResponse(currentForm._id, field.fieldId, e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg text-sm"
                          style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                        />
                      )}

                      {field.type === "URL" && (
                        <input
                          type="url"
                          placeholder={field.placeholder || "https://"}
                          value={responses[currentForm._id]?.[field.fieldId] || ""}
                          onChange={(e) => updateResponse(currentForm._id, field.fieldId, e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg text-sm"
                          style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                        />
                      )}

                      {field.type === "DATE" && (
                        <input
                          type="date"
                          value={responses[currentForm._id]?.[field.fieldId] || ""}
                          onChange={(e) => updateResponse(currentForm._id, field.fieldId, e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg text-sm"
                          style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                        />
                      )}

                      {field.type === "RADIO" && (
                        <div className="space-y-2">
                          {field.options?.map((opt: string, i: number) => (
                            <label
                              key={i}
                              className="flex items-center gap-3 p-3 rounded cursor-pointer transition-colors"
                              style={{
                                background: responses[currentForm._id]?.[field.fieldId] === opt
                                  ? "rgba(var(--primary-rgb, 255,107,53), 0.1)"
                                  : "var(--background)",
                              }}
                            >
                              <input
                                type="radio"
                                name={`${currentForm._id}-${field.fieldId}`}
                                value={opt}
                                checked={responses[currentForm._id]?.[field.fieldId] === opt}
                                onChange={(e) => updateResponse(currentForm._id, field.fieldId, e.target.value)}
                                className="w-4 h-4"
                                style={{ accentColor: "var(--primary)" }}
                              />
                              <span style={{ color: "var(--foreground-secondary)" }}>{opt}</span>
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
                              <label
                                key={i}
                                className="flex items-center gap-3 p-3 rounded cursor-pointer transition-colors"
                                style={{ background: "var(--background)" }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const newVal = isChecked
                                      ? selected.filter((v: string) => v !== opt)
                                      : [...selected, opt];
                                    updateResponse(currentForm._id, field.fieldId, newVal);
                                  }}
                                  className="w-4 h-4 rounded"
                                  style={{ accentColor: "var(--primary)" }}
                                />
                                <span style={{ color: "var(--foreground-secondary)" }}>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bottom Navigation — matches KK: [Previous] [Submit Form] [Next] */}
                <div className="flex items-center justify-between mt-8">
                  <button
                    onClick={() => setActiveForm((p) => Math.max(0, p - 1))}
                    disabled={activeForm === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    style={{ background: "var(--background-secondary)", color: "var(--foreground-secondary)", border: "1px solid var(--border)" }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Previous
                  </button>

                  <button
                    onClick={() => handleSubmit(currentForm._id)}
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-semibold disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, var(--primary), #FF8C5A)" }}
                  >
                    {submitting ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {submitting ? "Submitting..." : "Submit Form"}
                  </button>

                  <button
                    onClick={() => setActiveForm((p) => Math.min(forms.length - 1, p + 1))}
                    disabled={activeForm === forms.length - 1}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    style={{ background: "var(--background-secondary)", color: "var(--foreground-secondary)", border: "1px solid var(--border)" }}
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
