import type { StreamEvent } from '@/lib/types'

export interface SSEStream {
  stream: ReadableStream<Uint8Array>
  send: (event: StreamEvent) => void
  close: () => void
  isClosed: () => boolean
}

export function createSSEStream(): SSEStream {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
    cancel() {
      closed = true
    },
  })

  const send = (event: StreamEvent) => {
    if (closed) return
    try {
      const data = `data: ${JSON.stringify(event)}\n\n`
      controller.enqueue(encoder.encode(data))
    } catch {
      closed = true
    }
  }

  const close = () => {
    if (closed) return
    closed = true
    try {
      controller.close()
    } catch {
      // already closed
    }
  }

  return { stream, send, close, isClosed: () => closed }
}
