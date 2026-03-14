"use client";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useStore();

  return (
    <div className="min-h-screen bg-atlas-bg grid-bg">
      <Sidebar />
      <div className={cn("transition-all duration-300", sidebarOpen ? "ml-60" : "ml-16")}>
        <TopBar />
        <main className="p-4">{children}</main>
      </div>
    </div>
  );
}
