"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ShieldCheck, Loader2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

// --- FIREBASE IMPORTS ---
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// Global variable para hindi pabalik-balik ang loading screen sa iisang session
let hasBeenVerifiedThisSession = false;

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
            : "https://connecx.devtech-erp-solutions.cloud";

        const headers: HeadersInit = { "x-device-id": deviceId };
        if (finalUserId) headers["x-delegated-user-id"] = finalUserId;

        const res = await fetch(`${API_BASE}/api/check-session`, {
          method: "GET",
          headers
        });

        // Kung invalid ang session, kick out sa login
        if (res.status !== 200) {
          router.push("/login");
          return;
        }

        // 2. ROLE & BYPASS LOGIC (FIRESTORE)
        // Kung IT o PROCUREMENT ang department, bypass na ang checking ng Role
        if (userDept !== "IT" && userDept !== "PROCUREMENT" && finalUserId) {
          const userDoc = await getDoc(doc(db, "users", finalUserId));

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const userRole = userData.Role?.toUpperCase() || "GUEST";

            // PROTECTION LOGIC: I-block ang GUEST kapag sinusubukang pumasok sa /dashboard
            if (userRole === "GUEST" && pathname.startsWith("/dashboard")) {
              setAccessDenied(true);
              setLoading(false);
              clearInterval(progressInterval);
              return;
            }
          } else {
            // Kung wala sa Firestore at HINDI IT/PROCUREMENT, ituring na GUEST
            if (pathname.startsWith("/dashboard")) {
              setAccessDenied(true);
              setLoading(false);
              clearInterval(progressInterval);
              return;
            }
          }
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
    return (
      <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="size-24 bg-red-50 rounded-[2.5rem] flex items-center justify-center mb-8 relative">
          <div className="absolute inset-0 bg-red-100/50 animate-ping rounded-[2.5rem] duration-[3000ms]" />
          <XCircle className="size-12 text-red-600 relative" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tighter">Access Restricted</h2>
          <p className="max-w-[300px] text-zinc-500 text-sm font-medium leading-relaxed">
            Your current role does not have permission to access the Dashboard portal. Please contact IT for authorization.
          </p>
        </div>
        <div className="flex flex-col gap-3 mt-10 w-full max-w-[240px]">
          <Button
            onClick={() => router.push("/")}
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
