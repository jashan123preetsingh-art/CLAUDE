import { NextResponse } from "next/server";
import { getNewsArticles } from "@/services/marketData";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sentiment = searchParams.get("sentiment");
  const category = searchParams.get("category");

  let articles = getNewsArticles();

  if (sentiment) {
    articles = articles.filter((a) => a.sentiment === sentiment);
  }

  if (category) {
    articles = articles.filter((a) => a.category.toLowerCase() === category.toLowerCase());
  }

  return NextResponse.json({ articles, timestamp: new Date().toISOString() });
}
