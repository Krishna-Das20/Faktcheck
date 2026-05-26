"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

const normalize = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const isComplete = (profile: { name?: string; college?: string; phone?: string } | null) => {
  if (!profile) return false;
  return Boolean(
    normalize(profile.name) && normalize(profile.college) && normalize(profile.phone)
  );
};

export default function OnboardingModal({ isOpen = false }: { isOpen?: boolean }) {
  const { user, updateUser, token } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    college: user?.college || "",
    phone: user?.phone || "",
  });

  useEffect(() => {
    setFormData({
      name: user?.name || "",
      college: user?.college || "",
      phone: user?.phone || "",
    });
  }, [user?._id, user?.name, user?.college, user?.phone]);

  useEffect(() => {
    if (!isOpen || !user || isComplete(user)) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;

        const first = focusable[0] as HTMLElement;
        const last = focusable[focusable.length - 1] as HTMLElement;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    const autofocus = setTimeout(() => {
      const firstInput = modalRef.current?.querySelector("input") as HTMLElement | null;
      firstInput?.focus();
    }, 0);

    return () => {
      clearTimeout(autofocus);
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, user]);

  if (!isOpen || !user || isComplete(user)) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: normalize(formData.name),
      college: normalize(formData.college),
      phone: normalize(formData.phone),
    };

    if (!payload.name || !payload.college || !payload.phone) {
      toast.error("Please complete all required fields");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.user) {
        updateUser(data.user);
        toast.success("Profile completed successfully");
      } else {
        toast.error(data.message || "Failed to save onboarding details");
      }
    } catch {
      toast.error("Failed to save onboarding details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="surface-panel w-full max-w-lg rounded-2xl border p-6 shadow-[0_20px_80px_rgba(0,0,0,0.28)] sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
            One-time setup
          </p>
          <h2 id="onboarding-title" className="mt-2 text-2xl font-bold text-strong">
            Complete your profile
          </h2>
          <p className="mt-2 text-sm text-muted-ui">
            Add your details to unlock the full contest experience.
          </p>
          <p className="mt-1 text-xs text-soft-ui">
            This setup is required before you continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              className="input-field"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Your full name"
              required
            />
          </div>

          <div>
            <label className="label">College/University</label>
            <input
              type="text"
              className="input-field"
              value={formData.college}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, college: e.target.value }))
              }
              placeholder="Your college"
              required
            />
          </div>

          <div>
            <label className="label">Phone Number</label>
            <input
              type="tel"
              className="input-field"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="Your phone number"
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full py-3" disabled={saving}>
            {saving ? "Saving..." : "Complete onboarding"}
          </button>
        </form>
      </div>
    </div>
  );
}
