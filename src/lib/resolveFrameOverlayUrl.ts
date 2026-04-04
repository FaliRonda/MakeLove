import venetianMaskBundled from '@/assets/shop/venetian-mask.png?url'

/**
 * La BD puede guardar `/shop/venetian-mask.svg` o `.png`. Siempre servimos el PNG
 * empaquetado por Vite (`?url`) para que dev/prod no dependan de rutas estáticas
 * `/shop/*` que en SPA suelen devolver HTML.
 */

function normalizeRelativePath(raw: string): string {
  let t = raw.trim().replace(/\\/g, '/')
  try {
    t = decodeURIComponent(t)
  } catch {
    /* mantener t si hay secuencias % inválidas */
  }
  if (t.startsWith('http://') || t.startsWith('https://')) {
    try {
      const u = new URL(t)
      return u.pathname + (u.search || '')
    } catch {
      return t
    }
  }
  return t
}

function isBundledVenetianMaskPath(pathForMatch: string): boolean {
  const p = pathForMatch.replace(/\\/g, '/').trim().toLowerCase()
  if (!p || p.startsWith('data:')) return false
  return p.includes('venetian-mask.')
}

export function resolveFrameOverlayUrl(url: string | null | undefined): string | undefined {
  if (url == null) return undefined
  const t = url.trim()
  if (t === '') return undefined
  if (t.startsWith('data:')) return t

  const rel = normalizeRelativePath(t)

  if (rel.startsWith('http://') || rel.startsWith('https://')) {
    if (isBundledVenetianMaskPath(rel)) return venetianMaskBundled
    return rel
  }

  const normalized = rel.startsWith('/') ? rel : `/${rel}`

  if (isBundledVenetianMaskPath(normalized) || isBundledVenetianMaskPath(normalized.replace(/^\//, ''))) {
    return venetianMaskBundled
  }

  const path = normalized.startsWith('/') ? normalized.slice(1) : normalized
  const base = import.meta.env.BASE_URL
  return `${base}${path}`
}
