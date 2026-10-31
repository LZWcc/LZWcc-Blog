/** A comment thread belongs to a pathname, independent of host, query and trailing slash. */
export function commentPath(value: string): string {
  let path = new URL(value, 'https://lzwcc.xyz').pathname
  try {
    path = decodeURIComponent(path)
  } catch {
    // Preserve malformed escaped paths rather than breaking the comment component.
  }
  path = `/${path.replace(/^\/+|\/+$/g, '')}`
  if (path === '/blog/oop-course/oop-course') path = '/blog/oop-course'
  return path === '/' ? path : `${path}/`
}
