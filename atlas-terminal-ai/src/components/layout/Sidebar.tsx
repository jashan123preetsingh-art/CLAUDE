"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Fish,
  PieChart,
  Newspaper,
  Bell,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Whale Tracker", href: "/whale-tracker", icon: Fish },
  { label: "Sectors", href: "/sectors", icon: PieChart },
  { label: "News Intel", href: "/news", icon: Newspaper },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useStore();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full bg-atlas-surface border-r border-atlas-border z-50 transition-all duration-300 flex flex-col",
        sidebarOpen ? "w-60" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b border-atlas-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-atlas-accent to-atlas-cyan flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        {sidebarOpen && (
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">ATLAS</h1>
            <p className="text-[10px] text-atlas-muted font-mono">TERMINAL AI</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                isActive
                  ? "bg-atlas-accent/10 text-atlas-accent border border-atlas-accent/20"
                  : "text-atlas-muted hover:text-atlas-text hover:bg-atlas-card"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Status Bar */}
      {sidebarOpen && (
        <div className="p-4 border-t border-atlas-border">
          <div className="flex items-center gap-2 text-xs text-atlas-muted">
            <div className="w-2 h-2 rounded-full bg-atlas-green pulse-live" />
            <span>Markets Live</span>
          </div>
          <p className="text-[10px] text-atlas-muted/50 mt-1 font-mono">v1.0.0 · Pro Plan</p>
        </div>
      )}

      {/* Toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-atlas-card border border-atlas-border flex items-center justify-center text-atlas-muted hover:text-atlas-text transition-colors"
      >
        {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
    </aside>
  );
}
