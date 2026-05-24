import type { Metadata } from "next";
import { Manrope, Space_Grotesk, Syne_Mono, Fira_Code } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const syneMono = Syne_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-syne-mono",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FAKT CHECK — Competitive Contest Platform",
    template: "%s | FAKT CHECK",
  },
  description:
    "A professional platform for weekly coding contests, MCQ tests, and skill assessments. Kompete, Kode, and Konquer!",
  keywords: [
    "coding contests",
    "MCQ",
    "competitive programming",
    "proctoring",
    "leaderboard",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${spaceGrotesk.variable} ${syneMono.variable} ${firaCode.variable}`}
    >
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "rgb(10 10 10)",
                color: "#ffffff",
                border: "1px solid rgb(44 44 44)",
                borderRadius: "0.75rem",
              },
              success: {
                iconTheme: {
                  primary: "#FF6B35",
                  secondary: "#ffffff",
                },
              },
              error: {
                iconTheme: {
                  primary: "#FF6B35",
                  secondary: "#ffffff",
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
