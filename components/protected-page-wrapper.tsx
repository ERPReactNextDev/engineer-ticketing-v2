"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ShieldCheck, Loader2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

// Helper to make API calls
const fetchFromAPI = async (endpoint: string, options?: RequestInit) => {
  const API_BASE = process.env.NODE_ENV === 'production'
    ? 'https://engineer-ticketing-v2.vercel.app'
    : 'http://localhost:3000'
  const res = await fetch(`${API_BASE}${endpoint}`, options)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// Global variable para hindi pabalik-balik ang loading screen sa iisang session
let hasBeenVerifiedThisSession = false;

// Mapping of routes to required service permissions
const ROUTE_SERVICE_MAP: Record<string, string> = {
  "/appointments/site-visit": "siteVisit",
  "/request/dialux": "dialux",
  "/request/job": "jobRequest",
  "/request/other": "others",
  "/request/product": "productRequest",
  "/request/shop-drawing": "shopDrawing",
  "/request/testing": "testing",
  "/appointments/meeting-rooms": "meetingRoom",
  "/appointments/protocols": "recommendation",
};

// Helper to get required service from path
function getRequiredService(pathname: string): string | null {
  for (const [route, service] of Object.entries(ROUTE_SERVICE_MAP)) {
    if (pathname.startsWith(route)) {
      return service;
    }
  }
  return null;
}

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || ""; // Default to empty string to avoid null errors
  const [loading, setLoading] = useState(!hasBeenVerifiedThisSession);
  const [progress, setProgress] = useState(hasBeenVerifiedThisSession ? 100 : 0);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    // Kung verified na sa session na ito, huwag nang mag-loading
    if (hasBeenVerifiedThisSession) {
      setLoading(false);
      return;
    }

    // Progress bar animation logic
    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 95 ? 95 : prev + 5));
    }, 100);

    const checkSessionAndPermissions = async () => {
      try {
        const deviceId = localStorage.getItem("deviceId") || "";
        const userIdFromStorage = localStorage.getItem("userId");
        const userDept = localStorage.getItem("department")?.toUpperCase() || "";
        const userRole = localStorage.getItem("engiconnect_role")?.toUpperCase() || localStorage.getItem("userRole")?.toUpperCase() || "";
        const delegatedUserId = searchParams ? searchParams.get("userId") : null;

        const finalUserId = delegatedUserId || userIdFromStorage;

        // 1. ENVIRONMENT SELECTION & SESSION CHECK
        const hostname = window.location.hostname;
        const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
        const isVercel = hostname.includes("vercel.app");

        const API_BASE = isLocal
          ? "http://localhost:3000"
          : isVercel
            ? "https://engineer-ticketing-v2.vercel.app"
            : "https://conx.devtech-erp-solutions.cloud";

        const headers: HeadersInit = { "x-device-id": deviceId };
        if (finalUserId) headers["x-delegated-user-id"] = finalUserId;

        const res = await fetch(`${API_BASE}/api/check-session`, {
          method: "GET",
          headers
        });

        // Kung invalid ang session, check if may credentials sa localStorage
        if (res.status !== 200) {
          const data = await res.json();
          
          // If forceLogout is true (Resigned/Terminated), clear session and redirect
          if (data.forceLogout) {
            await fetch(`${API_BASE}/api/logout`, { method: "POST" });
            localStorage.clear();
            router.push("/login");
            return;
          }
          
          // Kung may userId sa localStorage pero session check failed,
          // baka device mismatch lang, pero allow pa rin (fail-safe)
          if (userIdFromStorage && userIdFromStorage !== "null") {
            console.log("Session check failed but userId exists in localStorage, allowing access");
            // Continue with permission checks
          } else {
            // Walang credentials, redirect to login
            router.push("/login");
            return;
          }
        }

        // 2. ROLE & BYPASS LOGIC (SUPABASE)
        // Kung IT o PROCUREMENT ang department, bypass na ang checking ng Role
        if (userDept !== "IT" && userDept !== "PROCUREMENT" && finalUserId) {
          try {
            const permissionCheck = await fetchFromAPI(`/api/permissions/check?userId=${finalUserId}`)
            const { isDashboardAllowed, bypass, forceLogout } = permissionCheck

            // If forceLogout is true (Resigned/Terminated), clear session and redirect
            if (forceLogout) {
              await fetch(`${API_BASE}/api/logout`, { method: "POST" });
              localStorage.clear();
              router.push("/login");
              return;
            }

            // If bypass is true (IT/PROCUREMENT), allow access
            if (bypass) {
              // Continue to allow access
            } else if (isDashboardAllowed === false && pathname.startsWith("/dashboard")) {
              // If isDashboardAllowed is false, deny access
              setAccessDenied(true);
              setLoading(false);
              clearInterval(progressInterval);
              return;
            }
          } catch (error) {
            console.error("Permission check error:", error);
            // On error, allow access (fail-safe)
          }
        }

        // 3. CHECK SERVICE PERMISSIONS (NEW)
        // For appointments and requests, check if user has service enabled
        const requiredService = getRequiredService(pathname)
        if (requiredService && userDept !== "IT" && userDept !== "PROCUREMENT") {
          try {
            const permissionCheck = await fetchFromAPI(`/api/permissions/check?userId=${finalUserId}`)
            const { services } = permissionCheck
            
            if (services && !services[requiredService]) {
              // User doesn't have permission for this service
              setAccessDenied(true);
              setLoading(false);
              clearInterval(progressInterval);
              return;
            }
          } catch (error) {
            console.warn("Service permission check error:", error);
            // On error, allow access (fail-safe)
          }
        }

        // 3. RESTRICT /admin/permissions TO SUPER ADMIN ONLY
        if (pathname === "/admin/permissions" && userRole !== "SUPER ADMIN") {
          setAccessDenied(true);
          setLoading(false);
          clearInterval(progressInterval);
          return;
        }

        // Sync userId kung galing sa URL
        if (delegatedUserId && delegatedUserId !== "null") {
          localStorage.setItem("userId", delegatedUserId);
        }

        // Success: Complete progress and show content
        hasBeenVerifiedThisSession = true;
        setProgress(100);
        setTimeout(() => setLoading(false), 400);

      } catch (error) {
        console.error("Security verification failed:", error);
        router.push("/login");
      }
    };

    checkSessionAndPermissions();
    return () => clearInterval(progressInterval);
  }, [router, searchParams, pathname]);

  // SCREEN 1: ACCESS DENIED UI
  if (accessDenied) {
    const isPermissionsPage = pathname === "/admin/permissions"
    const isDeniedByService = pathname.includes("/appointments/") || pathname.includes("/request/")
    
    // Check if user is logged in (has userId in localStorage)
    const userId = localStorage.getItem("userId")
    const isLoggedIn = userId && userId !== "null"
    
    // If logged in, go to dashboard with their ID; otherwise go to home
    const handleReturnHome = () => {
      if (isLoggedIn) {
        router.push(`/dashboard?id=${userId}`)
      } else {
        router.push("/")
      }
    }
    
    return (
      <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="size-24 bg-red-50 rounded-[2.5rem] flex items-center justify-center mb-8 relative">
          <div className="absolute inset-0 bg-red-100/50 animate-ping rounded-[2.5rem] duration-[3000ms]" />
          <XCircle className="size-12 text-red-600 relative" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tighter">Access Restricted</h2>
          <p className="max-w-[300px] text-zinc-500 text-sm font-medium leading-relaxed">
            {isPermissionsPage
              ? "Only SUPER ADMIN users can access the Permissions Management page. Please contact IT for authorization."
              : isDeniedByService
              ? "Your role does not have permission to access this feature. Please contact your manager or IT for authorization."
              : "Your current role does not have permission to access the Dashboard portal. Please contact IT for authorization."
            }
          </p>
        </div>
        <div className="flex flex-col gap-3 mt-10 w-full max-w-[240px]">
          <Button
            onClick={handleReturnHome}
            className="rounded-2xl h-14 bg-black text-white font-bold hover:scale-[1.02] transition-transform"
          >
            Return Home
          </Button>
          <Button
            onClick={() => window.location.href = "mailto:admin@mtechsolutions.cloud"}
            variant="ghost"
            className="text-[10px] font-black uppercase tracking-widest text-zinc-400"
          >
            Request Access
          </Button>
        </div>
      </div>
    );
  }

  // SCREEN 2: VERIFYING / LOADING UI
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-[340px] space-y-10 animate-in fade-in duration-500">
          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <div className="absolute -inset-4 bg-[#E33636]/5 rounded-full blur-2xl" />
              <div className="h-24 w-24 rounded-[2rem] border border-gray-100 flex items-center justify-center bg-white shadow-xl relative">
                <ShieldCheck className="h-10 w-10 text-[#0F172A]" />
                <Loader2 className="absolute h-full w-full p-1.5 text-[#E33636]/20 animate-spin" />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black uppercase tracking-tight text-[#0F172A]">Verifying Identity</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Checking system permissions</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Security Link</span>
              <span className="text-xs font-black text-[#0F172A]">{progress}%</span>
            </div>
            <div className="h-3 w-full bg-white border border-gray-100 rounded-full p-1 shadow-inner">
              <Progress value={progress} className="h-full rounded-full bg-gray-50 transition-all [&>div]:bg-[#E33636]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SCREEN 3: ACTUAL PAGE CONTENT
  return <>{children}</>;
}

export default function ProtectedPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC]" />}>
      <ProtectedContent>{children}</ProtectedContent>
    </Suspense>
  );
}
