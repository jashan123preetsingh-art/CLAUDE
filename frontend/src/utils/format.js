export function formatCurrency(value, compact = false) {
  if (value == null || isNaN(value)) return '—';
  if (compact) {
    if (Math.abs(value) >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
    if (Math.abs(value) >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
    if (Math.abs(value) >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
  }
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatNumber(value) {
  if (value == null || isNaN(value)) return '—';
  return Number(value).toLocaleString('en-IN');
}

export function formatPercent(value) {
  if (value == null || isNaN(value)) return '—';
  const num = Number(value);
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

export function formatVolume(value) {
  if (!value) return '—';
  const num = Number(value);
  if (num >= 1e7) return `${(num / 1e7).toFixed(2)} Cr`;
  if (num >= 1e5) return `${(num / 1e5).toFixed(2)} L`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
}

export function formatMarketCap(value) {
  if (!value) return '—';
  const crores = Number(value);
  if (crores >= 100000) return `₹${(crores / 100000).toFixed(2)}L Cr`;
  if (crores >= 1000) return `₹${(crores / 1000).toFixed(2)}K Cr`;
  return `₹${crores.toFixed(0)} Cr`;
}

export function getChangeColor(value) {
  if (value > 0) return 'text-accent-green';
  if (value < 0) return 'text-accent-red';
  return 'text-dark-400';
}

export function getChangeBg(value) {
  if (value > 0) return 'bg-accent-green/10 text-accent-green';
  if (value < 0) return 'bg-accent-red/10 text-accent-red';
  return 'bg-dark-700 text-dark-400';
}

export function timeAgo(date) {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now - d) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
