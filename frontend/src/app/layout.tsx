import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadForge AI - AI-Powered Lead Generation & Outreach",
  description:
    "Find business leads, extract contacts, and send AI-powered personalized outreach at scale.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
