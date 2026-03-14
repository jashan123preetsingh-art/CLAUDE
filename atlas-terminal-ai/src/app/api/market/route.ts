import { NextResponse } from "next/server";
import { getAllAssets, getAssetsByClass, getTopMovers } from "@/services/marketData";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetClass = searchParams.get("class");
  const action = searchParams.get("action");

  if (action === "top-movers") {
    return NextResponse.json(getTopMovers());
  }

  const assets = assetClass ? getAssetsByClass(assetClass) : getAllAssets();
  return NextResponse.json({ assets, timestamp: new Date().toISOString() });
}
