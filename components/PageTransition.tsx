'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'

type NavigateFn = (href: string) => void
type RunCurtainFn = (onSwap: () => void) => void

interface TransitionApi {
  navigate: NavigateFn
  runCurtain: RunCurtainFn
}

const TransitionContext = createContext<TransitionApi | null>(null)

export function useTransitionNavigate(): NavigateFn {
  const api = useContext(TransitionContext)
  if (!api) {
    throw new Error('useTransitionNavigate must be used inside <PageTransition>')
  }
  return api.navigate
}

export function useRunCurtain(): RunCurtainFn {
  const api = useContext(TransitionContext)
  if (!api) {
    throw new Error('useRunCurtain must be used inside <PageTransition>')
  }
  return api.runCurtain
}

type Phase = 'idle' | 'cover' | 'reveal'

const COVER_MS = 520
const REVEAL_MS = 520

export function PageTransition({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [phase, setPhase] = useState<Phase>('idle')
  const pendingHrefRef = useRef<string | null>(null)
  const prevPathRef = useRef(pathname)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Once the route actually changes, slide the curtain off the top.
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname
      if (pendingHrefRef.current) {
        pendingHrefRef.current = null
        requestAnimationFrame(() => setPhase('reveal'))
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
        revealTimerRef.current = setTimeout(() => setPhase('idle'), REVEAL_MS + 40)
      }
    }
  }, [pathname])

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    }
  }, [])

  const navigate = useCallback<NavigateFn>(
    (href) => {
      if (href === pathname) return
      pendingHrefRef.current = href
      setPhase('cover')
      setTimeout(() => router.push(href), COVER_MS)
    },
    [pathname, router],
  )

  // Same-route curtain: cover → swap state → reveal. Used to make in-page view
  // changes feel like a route transition.
  const runCurtain = useCallback<RunCurtainFn>((onSwap) => {
    setPhase('cover')
    setTimeout(() => {
      try {
        onSwap()
      } catch {
        // never let a caller's swap blow up the curtain
      }
      requestAnimationFrame(() => setPhase('reveal'))
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
      revealTimerRef.current = setTimeout(() => setPhase('idle'), REVEAL_MS + 40)
    }, COVER_MS)
  }, [])

  return (
    <TransitionContext.Provider value={{ navigate, runCurtain }}>
      {children}
      <div className={`page-transition ${phase}`} aria-hidden="true">
        <div className="page-transition__panel">
          <span className="page-transition__mark">VERITAS</span>
        </div>
      </div>
    </TransitionContext.Provider>
  )
}
