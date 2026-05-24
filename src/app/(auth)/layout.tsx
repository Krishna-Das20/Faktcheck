/**
 * (auth) route group layout — No Navbar/Footer.
 * Used for login, register, verify-otp, forgot-password, reset-password.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
