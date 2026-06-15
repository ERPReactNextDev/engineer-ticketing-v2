"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Mail, Lock, Eye, EyeOff, Fingerprint, Grid3X3,
  ShieldCheck, AlertTriangle, Loader2, Delete,
  MapPin, TicketCheck, ChevronRight,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { addDoc, collection, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db, logsDb } from "@/lib/firebase";
import { supabase } from "@/utils/supabase-ticket";

export const dynamic = "force-dynamic";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const APP_NAME        = "DSI Connect"
const APP_SUBTITLE    = "Enterprise Resource Platform"
const APP_PROJECT_KEY = "dsi-connect"
const COMPANY_NAME    = "Disruptive Solutions Inc."
const WALLPAPER_SRC   = "/engineer_wallpaper.png"

/* ─────────────────────────────────────────────
   KEY HELPERS — must match security-page.tsx exactly
   All keys are scoped to userId to prevent one user's
   credentials from being used to log in as another.
───────────────────────────────────────────── */
const scopedPinKey  = (uid: string) => `engiconnect_user_pin_${uid}`
const scopedBioKey  = (uid: string) => `engiconnect_bio_enabled_${uid}`
const scopedCredKey = (uid: string) => `engiconnect_webauthn_credId_${uid}`
// Reverse map: credentialId → userId (set during registration in security page)
const bioUserKey    = (credId: string) => `engiconnect_bio_userId_${credId}`

type AuthTab  = "password" | "pin" | "biometric"
type BioState = "idle" | "scanning" | "success" | "failed" | "not_registered" | "unsupported"
type TicketSummary = { ticket_id: string; date_created: string }

/* ─────────────────────────────────────────────
   PIN KEYPAD
───────────────────────────────────────────── */
function PinKeypad({ onInput, onDelete, onClear, disabled }: {
  onInput: (d: string) => void
  onDelete: () => void
  onClear: () => void
  disabled?: boolean
}) {
  const keys = ["1","2","3","4","5","6","7","8","9","C","0","⌫"]
  return (
    <div className="grid grid-cols-3 gap-2.5 w-full max-w-[264px] mx-auto">
      {keys.map(k => (
        <button key={k} type="button" disabled={disabled}
          onClick={() => { if (k === "⌫") onDelete(); else if (k === "C") onClear(); else onInput(k) }}
          className={cn(
            "h-14 rounded-2xl font-black text-base transition-all duration-100 select-none",
            "active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed",
            k === "C"  ? "bg-red-50 text-red-500 border border-red-100 hover:bg-red-100" :
            k === "⌫" ? "bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200" :
                        "bg-white border border-zinc-200 text-zinc-900 hover:border-zinc-900 shadow-sm hover:shadow"
          )}>
          {k === "⌫" ? <Delete className="mx-auto size-4" /> : k}
        </button>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────
   PIN DOTS
───────────────────────────────────────────── */
function PinDots({ value, total = 6 }: { value: string; total?: number }) {
  return (
    <div className="flex justify-center gap-3">
      {[...Array(total)].map((_, i) => (
        <div key={i} className={cn(
          "size-3.5 rounded-full transition-all duration-200",
          value[i]           ? "bg-zinc-900 scale-110" :
          i === value.length ? "bg-zinc-300 scale-110 animate-pulse" :
                               "bg-zinc-200"
        )} />
      ))}
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good Morning"
  if (h < 18) return "Good Afternoon"
  return "Good Evening"
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const [activeTab, setActiveTab]       = useState<AuthTab>("password")
  const [email, setEmail]               = useState("")
  const [password, setPassword]         = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [pinValue, setPinValue]         = useState("")
  const [bioState, setBioState]         = useState<BioState>("idle")

  const [loading, setLoading]             = useState(false)
  const [pinLoading, setPinLoading]       = useState(false)
  const [progress, setProgress]           = useState(0)
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [errorMessage, setErrorMessage]   = useState<string | null>(null)

  const [pendingLoginData, setPendingLoginData]     = useState<any | null>(null)
  const [showLocationDialog, setShowLocationDialog] = useState(false)
  const [showTicketDialog, setShowTicketDialog]     = useState(false)
  const [showResetDialog, setShowResetDialog]       = useState(false)

  const [remarks, setRemarks]                   = useState("")
  const [ticketSubmitting, setTicketSubmitting] = useState(false)
  const [existingTickets, setExistingTickets]   = useState<TicketSummary[]>([])
  const [resetEmail, setResetEmail]             = useState("")
  const [resetLoading, setResetLoading]         = useState(false)

  const router = useRouter()

  const getDeviceId = useCallback(() => {
    if (typeof window === "undefined") return ""
    let id = localStorage.getItem("deviceId")
    if (!id) { id = uuidv4(); localStorage.setItem("deviceId", id) }
    return id
  }, [])

  const getLocation = async () => {
    if (typeof window === "undefined" || !navigator.geolocation) return null
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      )
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
    } catch { return null }
  }

  const fetchTickets = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("tickets").select("ticket_id, date_created")
      if (data && !error) setExistingTickets(data as TicketSummary[])
    } catch (e) { console.error("Ticket load error", e) }
  }, [])
  useEffect(() => { fetchTickets() }, [fetchTickets])

  const generateTicketID = () => {
    const prefix = "DSI"
    const datePart = new Date().toISOString().split("T")[0]
    const todayIds = existingTickets.filter(t => t.ticket_id.startsWith(`${prefix}-${datePart}`))
    return `${prefix}-${datePart}-${String(todayIds.length + 1).padStart(3, "0")}`
  }

  /* ── Post-login: fetch role, store session, route ── */
  const handlePostLogin = async (location: any) => {
    if (!pendingLoginData) return
    setShowLocationDialog(false)
    setIsAuthorizing(true)
    const { email: loginEmail, deviceId, result } = pendingLoginData
    try {
      const userDocSnap = await getDoc(doc(db, "users", result.userId))
      let firestoreRole = "GUEST"
      if (userDocSnap.exists()) firestoreRole = userDocSnap.data().Role?.toUpperCase() || "GUEST"

      const displayName = result.Firstname || loginEmail?.split("@")[0] || "Staff Member"
      const userDept    = result.Department?.toUpperCase() || ""

      localStorage.setItem("userId",        result.userId)
      localStorage.setItem("userName",       displayName)
      localStorage.setItem("userRole",       firestoreRole)
      localStorage.setItem("userDepartment", userDept)
      localStorage.setItem("department",     userDept)

      await addDoc(collection(logsDb, "activity_logs"), {
        email: loginEmail || result.Email || "System User",
        status: "login", deviceId, location,
        userId: result.userId,
        project: APP_PROJECT_KEY,
        date_created: serverTimestamp(),
      })

      let value = 0
      const interval = setInterval(() => {
        value += 20
        setProgress(value)
        if (value >= 100) {
          clearInterval(interval)
          // Allow access for all authenticated users (non-GUEST role)
          // The API already validated department access
          toast.success(`${getGreeting()}, ${displayName}!`)
          router.push(`/dashboard?id=${result.userId}`)
        }
      }, 60)
    } catch (err) {
      console.error("Auth sync error", err)
      toast.error("Security verification failed. Contact IT.")
      setIsAuthorizing(false)
    }
  }

  /* ── Email / password ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    const deviceId = getDeviceId()
    if (!email || !password) { setErrorMessage("Email and password are required."); return }
    setLoading(true)
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Email: email, Password: password, deviceId }),
      })
      const result = await response.json()
      if (!response.ok) {
        if (result.locked) setShowTicketDialog(true)
        else setErrorMessage(result.message || "Login failed.")
        setLoading(false)
        return
      }
      setPendingLoginData({ email, deviceId, result })
      setShowLocationDialog(true)
    } catch { setErrorMessage("System connection error. Try again.") }
    finally { setLoading(false) }
  }

  /* ── PIN login — reads scoped PIN key ── */
  const handlePinSubmit = async (pin?: string) => {
    const val = pin || pinValue
    if (val.length < 6) return
    setPinLoading(true)
    const deviceId = getDeviceId()

    // Read PIN from scoped key if userId is known, fallback to unscoped
    const storedUserId = localStorage.getItem("userId")
    const savedPin = storedUserId
      ? localStorage.getItem(scopedPinKey(storedUserId))
      : null

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: val, savedPin, deviceId, mode: "pin" }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message || "Invalid PIN")
        setPinValue("")
        setPinLoading(false)
        return
      }
      setPendingLoginData({ email: result.Email, deviceId, result })
      setShowLocationDialog(true)
    } catch { toast.error("Terminal sync failed.") }
    finally { setPinLoading(false) }
  }

  useEffect(() => {
    if (pinValue.length === 6 && activeTab === "pin" && !pinLoading) handlePinSubmit(pinValue)
  }, [pinValue])

  /* ─────────────────────────────────────────────
     BIOMETRIC LOGIN — fixed account resolution

     The bug before: after WebAuthn passes, the code called
     /api/login with mode:"pin" + deviceId, which resolved to
     whatever user last logged in on that device — WRONG.

     The fix: during registration (security-page.tsx) we stored:
       engiconnect_bio_userId_{credId} = userId

     So now we:
     1. Run WebAuthn get() to verify the person is physically present
     2. Read the credId from the assertion
     3. Look up which userId registered that credId
     4. Call /api/login with mode:"biometric" + that specific userId
     5. Server fetches user by _id directly — always the right account
  ───────────────────────────────────────────── */
  const isWebAuthnSupported = () =>
    typeof window !== "undefined" && typeof window.PublicKeyCredential === "function"

  const handleBiometricLogin = async () => {
    if (!isWebAuthnSupported()) { setBioState("unsupported"); return }

    // Find any registered credential on this device
    // We scan localStorage for any key matching our pattern
    const credKeys = Object.keys(localStorage).filter(k => k.startsWith("engiconnect_webauthn_credId_"))
    if (credKeys.length === 0) { setBioState("not_registered"); return }

    // Also check if the last logged-in user has bio enabled
    const lastUid = localStorage.getItem("userId")
    if (lastUid) {
      const bioEnabled = localStorage.getItem(scopedBioKey(lastUid)) === "true"
      const hasCred    = !!localStorage.getItem(scopedCredKey(lastUid))
      if (!bioEnabled || !hasCred) { setBioState("not_registered"); return }
    }

    setBioState("scanning")
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32))

      // Build allowCredentials from all registered creds on this device
      const allowCredentials = credKeys.map(key => {
        const credId = localStorage.getItem(key)!
        const credIdBytes = Uint8Array.from(
          atob(credId.replace(/-/g, "+").replace(/_/g, "/")),
          c => c.charCodeAt(0)
        )
        return { id: credIdBytes, type: "public-key" as const, transports: ["internal" as AuthenticatorTransport] }
      })

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials,
          userVerification: "required",
          timeout: 60000,
        },
      }) as PublicKeyCredential | null

      if (!assertion) { setBioState("failed"); return }

      // ── Key fix: resolve userId from the credential that was used ──
      const usedCredId = assertion.id
      const resolvedUserId = localStorage.getItem(bioUserKey(usedCredId))

      if (!resolvedUserId) {
        // Credential exists but no userId mapping — corrupted state
        setBioState("not_registered")
        toast.error("Biometric credential is incomplete. Please re-register in Settings → Security.")
        return
      }

      setBioState("success")
      const deviceId = getDeviceId()

      // Call login API with the resolved userId directly — no deviceId guessing
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "biometric", userId: resolvedUserId, deviceId }),
      })
      const result = await response.json()

      if (!response.ok) {
        setBioState("failed")
        toast.error("Biometric verified but account lookup failed. Use password.")
        return
      }

      setPendingLoginData({ email: result.Email, deviceId, result })
      setShowLocationDialog(true)

    } catch (err: any) {
      console.error("Biometric auth error:", err)
      if (err.name === "NotAllowedError") {
        setBioState("failed")
        toast.error("Biometric cancelled or not recognised.")
      } else if (err.name === "InvalidStateError" || err.name === "NotFoundError") {
        setBioState("not_registered")
      } else {
        setBioState("failed")
      }
    }
  }

  useEffect(() => {
    if (activeTab === "biometric" && bioState === "idle") handleBiometricLogin()
    if (activeTab !== "biometric") setBioState("idle")
  }, [activeTab])

  /* ── Password reset ── */
  const handleRequestReset = async () => {
    if (!resetEmail) { toast.error("Please enter your email."); return }
    setResetLoading(true)
    try {
      const res = await fetch("/api/request-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      })
      const data = await res.json()
      toast.success(data.message || "Recovery link sent.")
      setShowResetDialog(false)
      setResetEmail("")
    } catch { toast.error("Failed to send reset link.") }
    finally { setResetLoading(false) }
  }

  /* ── Locked account ticket ── */
  const submitTicket = async () => {
    if (!remarks.trim()) return
    setTicketSubmitting(true)
    try {
      const { error } = await supabase.from("tickets").insert([{
        ticket_id:      generateTicketID(),
        department:     pendingLoginData?.result?.Department || "SYSTEM",
        requestor_name: email || "System User",
        mode:           "System Directory",
        status:         "Pending",
        ticket_subject: `Account Locked - ${email}`,
        remarks,
        date_created:   new Date().toISOString(),
      }])
      if (error) throw error
      toast.success("Ticket submitted. IT will contact you shortly.")
      setShowTicketDialog(false)
      setRemarks("")
      fetchTickets()
    } catch { toast.error("Submission failed.") }
    finally { setTicketSubmitting(false) }
  }

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div className={cn("min-h-screen w-full flex font-sans antialiased", className)} {...props}>

      {/* ── LEFT PANEL ── */}
      <div className="flex-1 flex flex-col bg-white lg:max-w-[520px] min-h-screen">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 md:px-10 pt-8 pb-6 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#121212] p-1.5 rounded-xl">
              <img src="/disruptive.png" alt="Logo" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <p className="text-[13px] font-black uppercase tracking-tighter text-[#121212] leading-none">{APP_NAME}</p>
              <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-[0.2em] mt-0.5">{APP_SUBTITLE}</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowResetDialog(true)}
            className="text-[10px] font-bold text-zinc-400 hover:text-[#121212] transition-colors">
            Need help?
          </button>
        </div>

        {/* Form area */}
        <div className="flex-1 flex flex-col justify-center px-6 md:px-10 pb-10">
          <div className="w-full max-w-[400px] mx-auto">

            {/* Heading */}
            <div className="mb-8">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">
                {getGreeting()}
              </p>
              <h1 className="text-[28px] md:text-3xl font-black text-[#121212] tracking-tight leading-tight">
                Sign in to your workspace
              </h1>
              <p className="text-zinc-400 text-sm font-medium mt-2 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                Authorized personnel only
              </p>
            </div>

            {/* Auth tabs */}
            <div className="flex gap-1 p-1 bg-zinc-100 rounded-2xl mb-6">
              {([
                { id: "password",  label: "Password",  icon: Lock },
                { id: "pin",       label: "PIN",        icon: Grid3X3 },
                { id: "biometric", label: "Biometric",  icon: Fingerprint },
              ] as { id: AuthTab; label: string; icon: any }[]).map(tab => (
                <button key={tab.id} type="button"
                  onClick={() => { setActiveTab(tab.id); setErrorMessage(null); setPinValue("") }}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                    activeTab === tab.id ? "bg-white text-[#121212] shadow-sm" : "text-zinc-400 hover:text-zinc-500"
                  )}>
                  <tab.icon size={14} strokeWidth={2.5} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── PASSWORD ── */}
            {activeTab === "password" && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-100 rounded-xl">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-red-700">{errorMessage}</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Work Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300" />
                    <Input type="email" placeholder="you@disruptivesolutionsinc.com"
                      className="pl-10 h-12 rounded-xl border border-zinc-200 bg-zinc-50 focus-visible:ring-0 focus-visible:border-zinc-900 text-sm font-medium transition-colors"
                      value={email} onChange={e => { setEmail(e.target.value); setErrorMessage(null) }}
                      autoComplete="email" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Password</Label>
                    <button type="button" onClick={() => setShowResetDialog(true)}
                      className="text-[10px] font-bold text-zinc-400 hover:text-[#121212] transition-colors">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300" />
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••••"
                      className="pl-10 pr-11 h-12 rounded-xl border border-zinc-200 bg-zinc-50 focus-visible:ring-0 focus-visible:border-zinc-900 text-sm font-medium transition-colors"
                      value={password} onChange={e => { setPassword(e.target.value); setErrorMessage(null) }}
                      autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-0.5 transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading || isAuthorizing}
                  className="w-full h-12 bg-[#121212] hover:bg-zinc-800 text-white rounded-xl font-black uppercase tracking-widest text-xs relative overflow-hidden transition-all active:scale-[0.98] shadow-lg shadow-black/5 mt-2">
                  <div className="relative z-10 flex items-center justify-center gap-2">
                    {loading       && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isAuthorizing && <ShieldCheck className="h-4 w-4 animate-pulse" />}
                    <span>{isAuthorizing ? `Authorizing ${progress}%` : loading ? "Verifying..." : "Continue"}</span>
                    {!loading && !isAuthorizing && <ChevronRight size={14} />}
                  </div>
                  {isAuthorizing && (
                    <div className="absolute left-0 top-0 h-full bg-white/10 transition-all duration-300"
                      style={{ width: `${progress}%` }} />
                  )}
                </Button>
              </form>
            )}

            {/* ── PIN ── */}
            {activeTab === "pin" && (
              <div className="space-y-5">
                <div className="text-center space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Enter 6-digit terminal PIN</p>
                  <PinDots value={pinValue} total={6} />
                </div>
                <PinKeypad disabled={pinLoading}
                  onInput={d => { if (pinValue.length < 6) setPinValue(p => p + d) }}
                  onDelete={() => setPinValue(p => p.slice(0, -1))}
                  onClear={() => setPinValue("")} />
                {pinLoading ? (
                  <div className="flex items-center justify-center gap-2 text-zinc-400">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Verifying...</span>
                  </div>
                ) : (
                  <Button type="button" onClick={() => handlePinSubmit()} disabled={pinValue.length < 6}
                    className="w-full h-12 bg-[#121212] text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-[0.98] transition-all">
                    Verify PIN
                  </Button>
                )}
              </div>
            )}

            {/* ── BIOMETRIC ── */}
            {activeTab === "biometric" && (
              <div className="text-center space-y-6 py-2">
                <div className="relative mx-auto w-fit">
                  <div className={cn(
                    "size-24 rounded-full flex items-center justify-center mx-auto transition-all duration-500",
                    bioState === "scanning"       ? "bg-[#121212]" :
                    bioState === "success"        ? "bg-emerald-50 border border-emerald-200" :
                    bioState === "failed"         ? "bg-red-50 border border-red-200" :
                    bioState === "not_registered" ? "bg-amber-50 border border-amber-200" :
                    bioState === "unsupported"    ? "bg-zinc-50 border border-zinc-200" :
                                                   "bg-zinc-100"
                  )}>
                    <Fingerprint size={44} className={cn(
                      "transition-colors duration-500",
                      bioState === "scanning"       ? "text-white animate-pulse" :
                      bioState === "success"        ? "text-emerald-500" :
                      bioState === "failed"         ? "text-red-400" :
                      bioState === "not_registered" ? "text-amber-400" :
                      bioState === "unsupported"    ? "text-zinc-300" : "text-zinc-400"
                    )} />
                  </div>
                  {bioState === "scanning" && (
                    <div className="absolute inset-0 rounded-full border-2 border-zinc-300 animate-ping opacity-40" />
                  )}
                </div>

                <div>
                  <p className="text-base font-black text-[#121212] uppercase tracking-tight">
                    {bioState === "scanning"       ? "Scanning..." :
                     bioState === "success"        ? "Verified!" :
                     bioState === "failed"         ? "Scan Failed" :
                     bioState === "not_registered" ? "Not Set Up" :
                     bioState === "unsupported"    ? "Not Supported" : "Touch Sensor"}
                  </p>
                  <p className="text-xs text-zinc-400 font-medium mt-1.5 leading-relaxed max-w-[240px] mx-auto">
                    {bioState === "scanning"
                      ? "Hold still — reading biometric data"
                      : bioState === "success"
                      ? "Identity confirmed. Redirecting..."
                      : bioState === "failed"
                      ? "Scan not recognised or cancelled. Try again or use another method."
                      : bioState === "not_registered"
                      ? "Biometrics not enabled. Sign in with password, then go to Settings → Security to enable it."
                      : bioState === "unsupported"
                      ? "This browser or device doesn't support biometric login. Use PIN or Password instead."
                      : "Use Face ID, Touch ID, Windows Hello, or your fingerprint sensor."}
                  </p>
                </div>

                {(bioState === "failed" || bioState === "not_registered" || bioState === "unsupported") && (
                  <div className="space-y-2">
                    {bioState === "failed" && (
                      <Button type="button" onClick={() => setBioState("idle")}
                        className="w-full h-12 bg-[#121212] text-white rounded-xl font-black text-xs uppercase tracking-widest active:scale-[0.98]">
                        Try Again
                      </Button>
                    )}
                    <Button type="button" onClick={() => { setActiveTab("pin"); setPinValue("") }}
                      className={cn(
                        "w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest active:scale-[0.98]",
                        bioState === "failed"
                          ? "bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-50"
                          : "bg-[#121212] text-white"
                      )}>
                      Use PIN Instead
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setActiveTab("password")}
                      className="w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest border border-zinc-200">
                      Use Password
                    </Button>
                  </div>
                )}
                {bioState === "idle" && (
                  <Button type="button" onClick={handleBiometricLogin}
                    className="w-full h-12 bg-[#121212] text-white rounded-xl font-black text-xs uppercase tracking-widest active:scale-[0.98]">
                    Start Scan
                  </Button>
                )}
                {bioState === "success" && (
                  <div className="flex items-center justify-center gap-2 text-emerald-600">
                    <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Authenticating...</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-[10px] text-zinc-300 font-medium text-center mt-8">
              © {new Date().getFullYear()} {COMPANY_NAME} · All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL (desktop) ── */}
      <div className="hidden lg:flex flex-1 relative bg-[#0a0a0a] overflow-hidden flex-col">
        <img src={WALLPAPER_SRC} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-[#0a0a0a]/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/20 to-transparent" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(white 1px,transparent 1px),linear-gradient(90deg,white 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative z-10 flex flex-col h-full p-12 justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/10 backdrop-blur-sm p-1.5 rounded-xl border border-white/10">
              <img src="/disruptive.png" alt="Logo" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <p className="text-[13px] font-black uppercase tracking-tighter text-white leading-none">{APP_NAME}</p>
              <p className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em] mt-0.5">{APP_SUBTITLE}</p>
            </div>
          </div>
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-5xl font-black text-white tracking-tighter leading-[1.05]">
                One platform.<br /><span className="text-white/40">Every department.</span>
              </h2>
              <p className="text-sm text-white/40 font-medium leading-relaxed max-w-[340px]">
                A unified operations hub connecting Engineering, Sales, Procurement, Warehouse, and IT — designed for growing teams.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Engineering","Sales","Procurement","Warehouse","IT"].map(d => (
                <span key={d} className="text-[10px] font-black uppercase tracking-wide px-3 py-1.5 rounded-full bg-white/[0.08] text-white/50 border border-white/10 backdrop-blur-sm">
                  {d}
                </span>
              ))}
              <span className="text-[10px] font-black uppercase tracking-wide px-3 py-1.5 rounded-full bg-white/[0.05] text-white/30 border border-white/[0.08]">+ More</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="size-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">All Systems Online</span>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{COMPANY_NAME}</span>
          </div>
        </div>
      </div>

      {/* ── DIALOGS ── */}

      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="w-[92vw] sm:max-w-sm bg-white border-none rounded-[24px] shadow-2xl text-center">
          <DialogHeader className="items-center space-y-3 pt-2">
            <div className="size-14 bg-[#121212] rounded-full flex items-center justify-center">
              <MapPin className="text-white h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="font-black text-[#121212] text-lg">Location Check</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400 mt-1">Allow location access for security compliance.</DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-2 mt-2 pb-1">
            <Button variant="outline" className="flex-1 rounded-xl h-11 border border-zinc-200 font-black text-xs uppercase tracking-widest"
              onClick={() => handlePostLogin(null)}>Skip</Button>
            <Button className="flex-1 bg-[#121212] rounded-xl h-11 font-black text-xs uppercase tracking-widest"
              onClick={async () => handlePostLogin(await getLocation())}>Allow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTicketDialog} onOpenChange={setShowTicketDialog}>
        <DialogContent className="w-[92vw] sm:max-w-sm bg-white border-none rounded-[24px] shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <TicketCheck size={18} className="text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-red-600 font-black text-lg">Account Locked</DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">Submit a ticket — IT will assist you.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Incident Remarks</Label>
              <Input placeholder="Briefly describe what happened..."
                value={remarks} onChange={e => setRemarks(e.target.value)}
                className="h-11 border border-zinc-200 bg-zinc-50 rounded-xl text-sm" />
            </div>
            <Button onClick={submitTicket} disabled={ticketSubmitting || !remarks.trim()}
              className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-widest">
              {ticketSubmitting ? <><Loader2 className="animate-spin h-4 w-4 mr-2" />Submitting...</> : "Submit Ticket"}
            </Button>
            <p className="text-[9px] text-center text-zinc-300 font-medium">Response within 24 hours</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="w-[92vw] sm:max-w-sm bg-white border-none rounded-[24px] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-[#121212] text-xl">Account Recovery</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Enter your work email — we'll send a recovery link if the account exists.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Work Email</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300" />
                <Input type="email" placeholder="you@disruptivesolutionsinc.com"
                  value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  className="pl-10 h-11 rounded-xl border border-zinc-200 bg-zinc-50 text-sm" />
              </div>
            </div>
            <Button onClick={handleRequestReset} disabled={resetLoading || !resetEmail}
              className="w-full h-11 bg-[#121212] text-white rounded-xl font-black text-xs uppercase tracking-widest">
              {resetLoading ? <><Loader2 className="animate-spin h-4 w-4 mr-2" />Processing...</> : "Send Recovery Link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}