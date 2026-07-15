import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Certificate",
  description: "View and download your contest completion certificate from FaktCheck",
};

export default function CertificateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
