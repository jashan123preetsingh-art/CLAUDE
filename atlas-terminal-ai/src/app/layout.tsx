import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas Terminal AI | AI-Powered Market Intelligence",
  description:
    "Bloomberg-style trading intelligence dashboard powered by AI. Real-time market data, whale tracking, sector analytics, and AI-driven analysis for crypto, forex, and macro markets.",
  keywords: ["trading", "crypto", "forex", "AI", "analytics", "Bloomberg", "market data", "whale tracking"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
