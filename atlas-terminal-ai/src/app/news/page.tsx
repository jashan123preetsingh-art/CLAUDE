"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Newspaper, TrendingUp, TrendingDown, Minus, ExternalLink, Clock } from "lucide-react";
import { getNewsArticles } from "@/services/marketData";
import { timeAgo, cn } from "@/lib/utils";

export default function NewsPage() {
  const articles = getNewsArticles();

  const getSentimentStyle = (sentiment: string) => {
    switch (sentiment) {
      case "bullish": return { bg: "bg-atlas-green/10 text-atlas-green border-atlas-green/20", icon: TrendingUp };
      case "bearish": return { bg: "bg-atlas-red/10 text-atlas-red border-atlas-red/20", icon: TrendingDown };
      default: return { bg: "bg-atlas-yellow/10 text-atlas-yellow border-atlas-yellow/20", icon: Minus };
    }
  };

  // Sentiment distribution
  const bullish = articles.filter((a) => a.sentiment === "bullish").length;
  const bearish = articles.filter((a) => a.sentiment === "bearish").length;
  const neutral = articles.filter((a) => a.sentiment === "neutral").length;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-atlas-purple" />
            News Intelligence
          </h1>
          <p className="text-sm text-atlas-muted mt-0.5">
            AI-powered news aggregation with sentiment analysis
          </p>
        </div>

        {/* Sentiment Overview */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-atlas-card border border-atlas-green/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-atlas-green" />
              <span className="text-sm text-atlas-green font-medium">Bullish</span>
            </div>
            <p className="text-2xl font-bold text-white">{bullish}</p>
            <div className="w-full bg-atlas-surface rounded-full h-1.5 mt-2">
              <div className="bg-atlas-green h-1.5 rounded-full" style={{ width: `${(bullish / articles.length) * 100}%` }} />
            </div>
          </div>
          <div className="bg-atlas-card border border-atlas-red/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-atlas-red" />
              <span className="text-sm text-atlas-red font-medium">Bearish</span>
            </div>
            <p className="text-2xl font-bold text-white">{bearish}</p>
            <div className="w-full bg-atlas-surface rounded-full h-1.5 mt-2">
              <div className="bg-atlas-red h-1.5 rounded-full" style={{ width: `${(bearish / articles.length) * 100}%` }} />
            </div>
          </div>
          <div className="bg-atlas-card border border-atlas-yellow/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Minus className="w-4 h-4 text-atlas-yellow" />
              <span className="text-sm text-atlas-yellow font-medium">Neutral</span>
            </div>
            <p className="text-2xl font-bold text-white">{neutral}</p>
            <div className="w-full bg-atlas-surface rounded-full h-1.5 mt-2">
              <div className="bg-atlas-yellow h-1.5 rounded-full" style={{ width: `${(neutral / articles.length) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Articles */}
        <div className="space-y-3">
          {articles.map((article) => {
            const style = getSentimentStyle(article.sentiment);
            return (
              <div
                key={article.id}
                className="bg-atlas-card border border-atlas-border rounded-xl p-5 hover:border-atlas-accent/30 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={cn("px-2 py-1 rounded-lg border flex items-center gap-1.5 mt-0.5 flex-shrink-0", style.bg)}>
                    <style.icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium capitalize">{article.sentiment}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-white mb-2">{article.title}</h3>
                    <p className="text-sm text-atlas-muted leading-relaxed mb-3">{article.summary}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-atlas-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(article.publishedAt)}
                      </span>
                      <span className="text-xs text-atlas-muted">{article.source}</span>
                      <span className="text-xs bg-atlas-surface px-2 py-0.5 rounded text-atlas-muted">{article.category}</span>
                      <div className="flex gap-1 ml-auto">
                        {article.relatedAssets.map((a) => (
                          <span key={a} className="text-[10px] font-mono text-atlas-accent bg-atlas-accent/10 px-1.5 py-0.5 rounded">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
