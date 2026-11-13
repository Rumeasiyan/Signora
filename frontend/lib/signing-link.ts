export function signingLink(token: string): string {
  if (typeof window === 'undefined') return '';

  return `${window.location.origin}/sign/${encodeURIComponent(token)}`;
}
