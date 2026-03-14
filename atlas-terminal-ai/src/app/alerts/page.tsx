"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Bell, Plus, Trash2, ToggleLeft, ToggleRight,
  DollarSign, Fish, Activity, Zap,
  Mail, MessageCircle, Send,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

export default function AlertsPage() {
  const { alerts, toggleAlert, removeAlert } = useStore();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "price": return <DollarSign className="w-4 h-4 text-atlas-accent" />;
      case "whale": return <Fish className="w-4 h-4 text-atlas-cyan" />;
      case "sector": return <Activity className="w-4 h-4 text-atlas-purple" />;
      case "volatility": return <Zap className="w-4 h-4 text-atlas-yellow" />;
      default: return <Bell className="w-4 h-4 text-atlas-muted" />;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="w-3 h-3" />;
      case "telegram": return <Send className="w-3 h-3" />;
      case "discord": return <MessageCircle className="w-3 h-3" />;
      default: return <Bell className="w-3 h-3" />;
    }
  };

  const formatCondition = (alert: typeof alerts[0]) => {
    switch (alert.type) {
      case "price": return `${alert.asset} ${alert.condition} $${alert.value.toLocaleString()}`;
      case "whale": return `${alert.asset} ${alert.condition.toString().replace("_", " ")} ${alert.value.toLocaleString()}`;
      default: return `${alert.condition} ${alert.value}`;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bell className="w-6 h-6 text-atlas-accent" />
              Smart Alerts
            </h1>
            <p className="text-sm text-atlas-muted mt-0.5">
              Configure alerts for price levels, whale activity, sector shifts, and volatility
            </p>
          </div>
          <button className="flex items-center gap-2 bg-atlas-accent hover:bg-atlas-accent/80 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            New Alert
          </button>
        </div>

        {/* Alert Types */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { type: "Price Alert", desc: "Trigger when asset hits a price level", icon: DollarSign, color: "text-atlas-accent", count: alerts.filter(a => a.type === "price").length },
            { type: "Whale Alert", desc: "Large blockchain transactions", icon: Fish, color: "text-atlas-cyan", count: alerts.filter(a => a.type === "whale").length },
            { type: "Sector Alert", desc: "Sector momentum shifts", icon: Activity, color: "text-atlas-purple", count: alerts.filter(a => a.type === "sector").length },
            { type: "Volatility Alert", desc: "Unusual volatility detected", icon: Zap, color: "text-atlas-yellow", count: alerts.filter(a => a.type === "volatility").length },
          ].map((item) => (
            <div key={item.type} className="bg-atlas-card border border-atlas-border rounded-xl p-4 hover:border-atlas-accent/30 transition-colors cursor-pointer">
              <item.icon className={cn("w-8 h-8 mb-2", item.color)} />
              <h3 className="text-sm font-medium text-white">{item.type}</h3>
              <p className="text-xs text-atlas-muted mt-1">{item.desc}</p>
              <p className="text-xs text-atlas-muted mt-2">{item.count} active</p>
            </div>
          ))}
        </div>

        {/* Active Alerts */}
        <div className="bg-atlas-card border border-atlas-border rounded-xl">
          <div className="px-4 py-3 border-b border-atlas-border">
            <h2 className="text-sm font-semibold text-white">Active Alerts ({alerts.length})</h2>
          </div>
          <div className="divide-y divide-atlas-border/50">
            {alerts.map((alert) => (
              <div key={alert.id} className="px-4 py-4 flex items-center justify-between hover:bg-atlas-surface/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-atlas-surface flex items-center justify-center">
                    {getTypeIcon(alert.type)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{formatCondition(alert)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-atlas-muted capitalize">{alert.type} alert</span>
                      <span className="text-atlas-border">·</span>
                      <div className="flex items-center gap-1.5">
                        {alert.channels.map((ch) => (
                          <span key={ch} className="text-xs text-atlas-muted flex items-center gap-1 bg-atlas-surface px-1.5 py-0.5 rounded">
                            {getChannelIcon(ch)} {ch}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className="text-atlas-muted hover:text-atlas-text transition-colors"
                  >
                    {alert.isActive ? (
                      <ToggleRight className="w-6 h-6 text-atlas-green" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                  <button
                    onClick={() => removeAlert(alert.id)}
                    className="text-atlas-muted hover:text-atlas-red transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
