/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      'assemblyai',
      'langsmith',
      'rss-parser',
      'pdf-parse',
      'pdfjs-dist',
      'mammoth',
      '@napi-rs/canvas',
    ],
  },
  async headers() {
    // Phase 2E — defence-in-depth security headers on every response.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://generativelanguage.googleapis.com https://api.tavily.com https://api.groq.com https://api.assemblyai.com https://*.supabase.co wss://*.supabase.co wss://*.assemblyai.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')

    // API routes intentionally have no `Access-Control-Allow-Origin` header.
    // Same-origin (the Next app itself) is the only allowed caller. Adding
    // `*` would let any website POST to /api/* from a victim's browser,
    // burning paid LLM/search quotas and flipping verdict approvals.
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
