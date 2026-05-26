"use client";

import { useAuth } from "@/context/AuthContext";
import OnboardingModal from "./OnboardingModal";

const normalize = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export default function OnboardingWrapper() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) return null;

  const needsOnboarding = !Boolean(
    normalize(user.name) && normalize(user.college) && normalize(user.phone)
  );

  return <OnboardingModal isOpen={needsOnboarding} />;
}
