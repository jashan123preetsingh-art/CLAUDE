import { NextResponse } from "next/server";

// In production, these would interact with database
export async function GET() {
  return NextResponse.json({
    alerts: [],
    message: "Connect to database for persistent alert storage",
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { type, asset, condition, value, channels } = body;

  if (!type || !condition || !value) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // In production: save to database, set up webhook/cron monitoring
  return NextResponse.json({
    id: `alert_${Date.now()}`,
    type,
    asset,
    condition,
    value,
    channels: channels || ["email"],
    isActive: true,
    createdAt: new Date().toISOString(),
  });
}
