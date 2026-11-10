'use client'

import * as React from 'react'

interface State<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Fetches an admin API path, aborting the previous request when the path changes.
 * Keeps the last successful payload visible while a new range loads so the page
 * never blanks out between date changes.
 */
export function useAdminData<T>(path: string | null): State<T> & { reload: () => void } {
  const [state, setState] = React.useState<State<T>>({ data: null, loading: Boolean(path), error: null })
  const [nonce, setNonce] = React.useState(0)

  React.useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    let cancelled = false

    setState((current) => ({ ...current, loading: true, error: null }))

    fetch(path, { credentials: 'include', signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(typeof body?.error === 'string' ? body.error : `Request failed (${response.status})`)
        }
        return (await response.json()) as T
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return
        setState((current) => ({
          data: current.data,
          loading: false,
          error: error instanceof Error ? error.message : 'Something went wrong',
        }))
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [path, nonce])

  return { ...state, reload: () => setNonce((value) => value + 1) }
}
