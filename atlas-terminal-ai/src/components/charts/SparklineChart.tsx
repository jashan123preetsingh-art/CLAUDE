"use client";

import { cn } from "@/lib/utils";

interface SparklineChartProps {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
}

export default function SparklineChart({ data, positive, width = 96, height = 32 }: SparklineChartProps) {
  if (!data || data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const color = positive ? "#22c55e" : "#ef4444";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn(positive ? "sparkline-up" : "sparkline-down")}
    >
      <defs>
        <linearGradient id={`grad-${positive}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
      <polygon
        fill={`url(#grad-${positive})`}
        points={`0,${height} ${points} ${width},${height}`}
      />
    </svg>
  );
}
