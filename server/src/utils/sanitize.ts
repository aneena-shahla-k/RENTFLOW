/**
 * Recursively strips MongoDB operator keys ($ and .) from untrusted input objects
 * to prevent NoSQL operator injection.
 */
export function sanitizeObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObject(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith('$') || k.includes('.')) {
        continue;
      }
      clean[k] = sanitizeObject(v);
    }
    return clean as T;
  }
  if (typeof value === 'string') {
    return value.trim() as unknown as T;
  }
  return value;
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
