"use client";

import { Newspaper, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getNewsArticles } from "@/services/marketData";
import { timeAgo, cn } from "@/lib/utils";
import Link from "next/link";

export default function NewsFeed() {
  const articles = getNewsArticles().slice(0, 4);

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "bullish": return <TrendingUp className="w-3 h-3 text-atlas-green" />;
      case "bearish": return <TrendingDown className="w-3 h-3 text-atlas-red" />;
      default: return <Minus className="w-3 h-3 text-atlas-yellow" />;
    }
  };

  const getSentimentBg = (sentiment: string) => {
    switch (sentiment) {
      case "bullish": return "bg-atlas-green/10 text-atlas-green border-atlas-green/20";
      case "bearish": return "bg-atlas-red/10 text-atlas-red border-atlas-red/20";
      default: return "bg-atlas-yellow/10 text-atlas-yellow border-atlas-yellow/20";
    }
  };

  return (
    <div className="bg-atlas-card border border-atlas-border rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-atlas-border">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-atlas-purple" />
          <h3 className="text-sm font-semibold text-white">Market Intelligence</h3>
        </div>
        <Link href="/news" className="text-xs text-atlas-accent hover:underline">
          View all
        </Link>
      </div>
      <div className="divide-y divide-atlas-border/50">
        {articles.map((article) => (
          <div key={article.id} className="px-4 py-3 hover:bg-atlas-surface/50 transition-colors">
            <div className="flex items-start gap-3">
              <div className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium border mt-0.5 flex items-center gap-1", getSentimentBg(article.sentiment))}>
                {getSentimentIcon(article.sentiment)}
                {article.sentiment}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug line-clamp-2">{article.title}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-atlas-muted">{article.source}</span>
                  <span className="text-atlas-border">·</span>
                  <span className="text-xs text-atlas-muted">{timeAgo(article.publishedAt)}</span>
                  <span className="text-atlas-border">·</span>
                  <div className="flex gap-1">
                    {article.relatedAssets.slice(0, 2).map((a) => (
                      <span key={a} className="text-[10px] font-mono text-atlas-accent bg-atlas-accent/10 px-1.5 py-0.5 rounded">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
