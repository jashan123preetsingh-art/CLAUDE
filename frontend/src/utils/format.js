export function formatCurrency(value, compact = false) {
  if (value == null || isNaN(value)) return '---';
  if (compact) {
    if (Math.abs(value) >= 1e7) return `${value < 0 ? '-' : ''}${String.fromCharCode(8377)}${(Math.abs(value) / 1e7).toFixed(2)} Cr`;
    if (Math.abs(value) >= 1e5) return `${value < 0 ? '-' : ''}${String.fromCharCode(8377)}${(Math.abs(value) / 1e5).toFixed(2)} L`;
    if (Math.abs(value) >= 1e3) return `${value < 0 ? '-' : ''}${String.fromCharCode(8377)}${(Math.abs(value) / 1e3).toFixed(1)}K`;
  }
  return `${String.fromCharCode(8377)}${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatNumber(value) {
  if (value == null || isNaN(value)) return '---';
  return Number(value).toLocaleString('en-IN');
}

export function formatPercent(value) {
  if (value == null || isNaN(value)) return '---';
  const num = Number(value);
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

export function formatVolume(value) {
  if (!value) return '---';
  const num = Number(value);
  if (num >= 1e7) return `${(num / 1e7).toFixed(2)} Cr`;
  if (num >= 1e5) return `${(num / 1e5).toFixed(2)} L`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
}

export function formatMarketCap(value) {
  if (!value) return '---';
  const crores = Number(value);
  if (crores >= 100000) return `${String.fromCharCode(8377)}${(crores / 100000).toFixed(2)}L Cr`;
  if (crores >= 1000) return `${String.fromCharCode(8377)}${(crores / 1000).toFixed(2)}K Cr`;
  return `${String.fromCharCode(8377)}${crores.toFixed(0)} Cr`;
}

export function getChangeColor(value) {
  if (value > 0) return 'text-terminal-green';
  if (value < 0) return 'text-terminal-red';
  return 'text-terminal-muted';
}

export function getChangeBg(value) {
  if (value > 0) return 'bg-terminal-green/10 text-terminal-green';
  if (value < 0) return 'bg-terminal-red/10 text-terminal-red';
  return 'bg-terminal-card text-terminal-muted';
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
