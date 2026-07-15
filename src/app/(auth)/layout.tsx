import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication",
  description: "Sign in or create an account on FaktCheck",
};

/**
 * (auth) route group layout — No Navbar/Footer.
 * Used for login, register, verify-otp, forgot-password, reset-password.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
