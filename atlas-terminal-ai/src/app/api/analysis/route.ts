import { NextResponse } from "next/server";
import { getAIAnalysis } from "@/services/marketData";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Symbol parameter required" }, { status: 400 });
  }

  const analysis = getAIAnalysis(symbol);
  return NextResponse.json(analysis);
}

// POST endpoint for custom AI analysis (production would call LLM API)
export async function POST(request: Request) {
  const body = await request.json();
  const { symbol, prompt } = body;

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  // In production, this would call Claude/OpenAI API with market context
  const analysis = getAIAnalysis(symbol);
  return NextResponse.json({
    ...analysis,
    customPrompt: prompt,
    note: "In production, this endpoint integrates with Claude API for custom analysis queries.",
  });
}
