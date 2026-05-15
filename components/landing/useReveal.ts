'use client'
import { useEffect, useRef } from 'react'

export function useReveal<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('visible')
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            io.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.1 },
    )
    const targets = el.querySelectorAll('.reveal')
    targets.forEach((t) => io.observe(t))
    return () => io.disconnect()
  }, [])
  return ref
}
