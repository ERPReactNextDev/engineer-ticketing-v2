
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// We define the paths that need the dynamic CSP header
const PROTECTED_PATHS = ['/dashboard', '/request', '/appointments']

// Default origins from next.config.ts as fallback
const defaultOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://taskflow-project-five-gamma.vercel.app",
  "https://taskflow-demo-v2.vercel.app/",
  "https://taskflow-crm.vercel.app/",
  "https://taskflow.devtech-erp-solutions.cloud/"
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Only apply to protected dashboard/request paths
  const isProtectedPath = PROTECTED_PATHS.some(path => pathname.startsWith(path))

  if (isProtectedPath) {
    const response = NextResponse.next()
    
    try {
      // Use static CSP policy in middleware (async fetch is not reliable in middleware)
      const cspValue = `frame-ancestors 'self' ${defaultOrigins.join(' ')}`
      response.headers.set('Content-Security-Policy', cspValue)
    } catch (error) {
      console.error("MIDDLEWARE_CSP_ERROR:", error)
      // Fallback to static policy if anything fails
    }
    
    return response
  }

  return NextResponse.next()
}

// Optimization: only run middleware on specific routes
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/request/:path*',
    '/appointments/:path*',
  ],
}
