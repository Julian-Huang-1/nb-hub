export function formatDate(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}
