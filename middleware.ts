
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// We define the paths that need the dynamic CSP header
const PROTECTED_PATHS = ['/dashboard', '/request', '/appointments']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Only apply to protected dashboard/request paths
  const isProtectedPath = PROTECTED_PATHS.some(path => pathname.startsWith(path))

  if (isProtectedPath) {
    const response = NextResponse.next()
    
    try {
      // Fetch allowed origins from our API
      // Using absolute URL for middleware fetch
      const origin = request.nextUrl.origin
      const configRes = await fetch(`${origin}/api/system-config`, {
        next: { revalidate: 60 } // Cache for 60 seconds
      })
      
      const config = await configRes.json()
      const allowedOrigins = config.allowedIframeOrigins || []
      
      // Default origins from next.config.ts as fallback
      const defaultOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://taskflow-project-five-gamma.vercel.app",
        "https://taskflow-demo-v2.vercel.app/",
        "https://taskflow-crm.vercel.app/",
        "https://taskflow.devtech-erp-solutions.cloud/",
        "https://conx.devtech-erp-solutions.cloud/login",
        "https://conx.devtech-erp-solutions.cloud"
      ]

      // Combine and unique
      const allOrigins = Array.from(new Set([...defaultOrigins, ...allowedOrigins]))
      const cspValue = `frame-ancestors 'self' ${allOrigins.join(' ')}`
      
      response.headers.set('Content-Security-Policy', cspValue)
    } catch (error) {
      console.error("MIDDLEWARE_CSP_ERROR:", error)
      // Fallback to static policy if fetch fails
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
