import { NextResponse } from "next/server";
import { getWhaleTransactions } from "@/services/marketData";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asset = searchParams.get("asset");
  const type = searchParams.get("type");

  let transactions = getWhaleTransactions();

  if (asset) {
    transactions = transactions.filter((tx) => tx.asset.toLowerCase() === asset.toLowerCase());
  }

  if (type) {
    transactions = transactions.filter((tx) => tx.type === type);
  }

  return NextResponse.json({ transactions, timestamp: new Date().toISOString() });
}
