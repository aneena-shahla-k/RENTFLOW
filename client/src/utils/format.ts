export function formatMoney(
  smallestUnitAmount: number,
  currencyCode = 'INR',
  currencySymbol = '₹'
): string {
  const major = Math.round(smallestUnitAmount || 0) / 100;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currencySymbol}${major.toFixed(2)}`;
  }
}

export function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDateTime(dateStr?: string | Date | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function resolveImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const apiBase = import.meta.env.VITE_API_URL || '';
  if (apiBase.startsWith('http')) {
    const origin = apiBase.replace(/\/api\/?$/, '');
    return `${origin}${url}`;
  }
  return url;
}
