export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

let refreshing: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(r => r.ok).finally(() => { setTimeout(() => (refreshing = null), 0) })
  }
  return refreshing
}

export async function api<T = unknown>(path: string, opts: RequestInit & { json?: unknown } = {}, retry = true): Promise<T> {
  const { json, ...init } = opts
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) }
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(json) }
  const res = await fetch(path, { ...init, headers, credentials: 'include' })
  if (res.status === 401 && retry && !path.startsWith('/api/auth/')) {
    if (await tryRefresh()) return api<T>(path, opts, false)
  }
  if (!res.ok) {
    let msg = res.statusText
    try {
      const body = await res.json()
      msg = typeof body.detail === 'string' ? body.detail
        : Array.isArray(body.detail) ? body.detail.map((d: { msg: string }) => d.msg).join('; ') : msg
    } catch { /* not json */ }
    throw new ApiError(res.status, msg)
  }
  return res.json() as Promise<T>
}
