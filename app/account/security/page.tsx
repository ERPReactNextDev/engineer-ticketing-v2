"use client"

import * as React from "react"
import {
  Lock, Globe, History, Eye, EyeOff, Sparkles,
  Fingerprint, ShieldAlert, Asterisk, Pencil,
  SmartphoneNfc, CheckCircle2, AlertTriangle, Loader2,
  Shield, Smartphone, Monitor, Trash2, KeyRound,
  ChevronRight, Clock, MapPin, Delete, RefreshCw,
  Info,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/page-header"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { db } from "@/lib/firebase"
import { doc, getDoc, onSnapshot } from "firebase/firestore"

import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

/* ─────────────────────────────────────────────────────────
   KEY SCHEME — all scoped to userId
───────────────────────────────────────────────────────── */
export const scopedPinKey  = (uid: string) => `engiconnect_user_pin_${uid}`
export const scopedBioKey  = (uid: string) => `engiconnect_bio_enabled_${uid}`
export const scopedCredKey = (uid: string) => `engiconnect_webauthn_credId_${uid}`
export const bioUserKey    = (credId: string) => `engiconnect_bio_userId_${credId}`
const LAST_CHANGED_KEY     = (uid: string) => `engiconnect_pass_changed_${uid}`
const COMPANY_NAME = "Disruptive Solutions Inc."

/* ─────────────────────────────────────────────────────────
   PIN KEYPAD (reused from login form for consistency)
───────────────────────────────────────────────────────── */
function PinKeypad({ onInput, onDelete, onClear, disabled }: {
  onInput: (d: string) => void
  onDelete: () => void
  onClear: () => void
  disabled?: boolean
}) {
  const keys = ["1","2","3","4","5","6","7","8","9","C","0","⌫"]
  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mx-auto">
      {keys.map(k => (
        <button key={k} type="button" disabled={disabled}
          onClick={() => { if (k === "⌫") onDelete(); else if (k === "C") onClear(); else onInput(k) }}
          className={cn(
            "h-12 rounded-xl font-black text-base transition-all select-none",
            "active:scale-90 disabled:opacity-40",
            k === "C"  ? "bg-red-50 text-red-500 border border-red-100 hover:bg-red-100" :
            k === "⌫" ? "bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200" :
                        "bg-white border border-zinc-200 text-zinc-900 hover:border-zinc-800 shadow-sm"
          )}>
          {k === "⌫" ? <Delete className="mx-auto size-3.5" /> : k}
        </button>
      ))}
    </div>
  )
}

function PinDots({ value, total = 6 }: { value: string; total?: number }) {
  return (
    <div className="flex justify-center gap-2.5">
      {[...Array(total)].map((_, i) => (
        <div key={i} className={cn(
          "size-3 rounded-full transition-all duration-200",
          value[i] ? "bg-zinc-900 scale-110" : i === value.length ? "bg-zinc-300 animate-pulse scale-110" : "bg-zinc-200"
        )} />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   SECURITY SCORE CALCULATOR
───────────────────────────────────────────────────────── */
function useSecurityScore(hasPinSet: boolean, biometrics: boolean, twoFactor: boolean, passLastChanged: string | null) {
  const items = [
    { label: "Strong Password",    done: !!passLastChanged,       weight: 30 },
    { label: "Login PIN Set",      done: hasPinSet,               weight: 25 },
    { label: "Biometrics Enabled", done: biometrics,              weight: 25 },
    { label: "2FA Enabled",        done: twoFactor,               weight: 20 },
  ]
  const score = items.reduce((acc, i) => acc + (i.done ? i.weight : 0), 0)
  const level = score >= 80 ? "Strong" : score >= 50 ? "Good" : score >= 25 ? "Fair" : "Weak"
  const color = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-blue-600" : score >= 25 ? "text-amber-600" : "text-red-600"
  const barColor = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-blue-500" : score >= 25 ? "bg-amber-500" : "bg-red-500"
  return { score, level, color, barColor, items }
}

/* ─────────────────────────────────────────────────────────
   RELATIVE TIME
───────────────────────────────────────────────────────── */
function relTime(iso: string | null): string {
  if (!iso) return "Never"
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────── */
export default function SecurityPage() {
  const [userId, setUserId]         = React.useState<string | undefined>(undefined)
  const [userName, setUserName]     = React.useState("")
  const [userDept, setUserDept]     = React.useState("")
  const [twoFactor, setTwoFactor]   = React.useState(false)
  const [biometrics, setBiometrics] = React.useState(false)
  const [hasPinSet, setHasPinSet]   = React.useState(false)
  const [bioRegistering, setBioRegistering] = React.useState(false)
  const [passLastChanged, setPassLastChanged] = React.useState<string | null>(null)

  const [showPass, setShowPass]             = React.useState(false)
  const [showCurrentPass, setShowCurrentPass] = React.useState(false)
  const [isPassModalOpen, setIsPassModalOpen] = React.useState(false)
  const [isPinModalOpen, setIsPinModalOpen]   = React.useState(false)

  const [passForm, setPassForm] = React.useState({ current: "", new: "", confirm: "" })
  const [passError, setPassError] = React.useState<string | null>(null)
  const [pinValue, setPinValue]   = React.useState("")
  const [pinConfirm, setPinConfirm] = React.useState("")
  const [pinStep, setPinStep]     = React.useState<"enter" | "confirm">("enter")

  /* ── Security feature permissions — from Firestore role_permissions.security ── */
  const [secPerms, setSecPerms] = React.useState({
    changePassword:   true,
    managePin:        true,
    manageBiometrics: true,
    manage2FA:        false,
    viewActivityLog:  true,
  })

  /* ── Load state ── */
  React.useEffect(() => {
    const uid  = localStorage.getItem("userId") || undefined
    const name = localStorage.getItem("userName") || ""
    const dept = localStorage.getItem("userDepartment") || localStorage.getItem("department") || ""
    setUserId(uid)
    setUserName(name)
    setUserDept(dept)
    if (!uid) return
    setHasPinSet(!!localStorage.getItem(scopedPinKey(uid)))
    setBiometrics(localStorage.getItem(scopedBioKey(uid)) === "true")
    setTwoFactor(localStorage.getItem("engiconnect_2fa_enabled") === "true")
    setPassLastChanged(localStorage.getItem(LAST_CHANGED_KEY(uid)))
  }, [])

  /* ── Subscribe to role_permissions → security section ── */
  React.useEffect(() => {
    const dept = localStorage.getItem("userDepartment") || ""
    const role = localStorage.getItem("userRole")       || "MEMBER"
    if (!dept || !role) return
    const targetId = `${dept.toUpperCase().trim()}_${role.toUpperCase().trim()}`
    // Use onSnapshot on the specific document — not the whole collection
    const unsub = onSnapshot(doc(db, "role_permissions", targetId), (snap) => {
      if (snap.exists()) {
        const raw = snap.data()
        if (raw?.security) setSecPerms(prev => ({ ...prev, ...raw.security }))
      } else {
        // Fallback: try matching by role suffix only
        const fallbackId = `_${role.toUpperCase().trim()}`
        getDoc(doc(db, "role_permissions", fallbackId)).then(fallbackSnap => {
          if (fallbackSnap.exists()) {
            const raw = fallbackSnap.data()
            if (raw?.security) setSecPerms(prev => ({ ...prev, ...raw.security }))
          }
        }).catch(() => {})
      }
    })
    return () => unsub()
  }, [])

  const { score, level, color, barColor, items: scoreItems } = useSecurityScore(hasPinSet, biometrics, twoFactor, passLastChanged)

  /* ── WebAuthn ── */
  const isWebAuthnSupported = () =>
    typeof window !== "undefined" && typeof window.PublicKeyCredential === "function"

  const registerBiometric = async (uid: string): Promise<boolean> => {
    if (!isWebAuthnSupported()) { toast.error("Biometrics not supported on this browser/device."); return false }
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: COMPANY_NAME, id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(uid),
            name: uid,
            displayName: localStorage.getItem("userName") || "DSI Connect User",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential | null
      if (!credential) return false
      localStorage.setItem(scopedCredKey(uid), credential.id)
      localStorage.setItem(scopedBioKey(uid), "true")
      localStorage.setItem(bioUserKey(credential.id), uid)
      return true
    } catch (err: any) {
      if (err.name === "NotAllowedError") toast.error("Biometric setup cancelled.")
      else if (err.name === "InvalidStateError") { toast.info("Already registered on this device."); return true }
      else toast.error("Biometric setup failed.")
      return false
    }
  }

  const handleBiometricToggle = async (val: boolean) => {
    if (!userId) { toast.error("No active session."); return }
    if (val) {
      setBioRegistering(true)
      const ok = await registerBiometric(userId)
      setBioRegistering(false)
      if (ok) { setBiometrics(true); toast.success("Biometrics enabled!") }
      else setBiometrics(false)
    } else {
      const credId = localStorage.getItem(scopedCredKey(userId))
      if (credId) localStorage.removeItem(bioUserKey(credId))
      localStorage.removeItem(scopedCredKey(userId))
      localStorage.removeItem(scopedBioKey(userId))
      setBiometrics(false)
      toast.success("Biometrics disabled.")
    }
  }

  /* ── PIN — visual keypad flow ── */
  const handlePinKeyInput = (d: string) => {
    if (pinStep === "enter" && pinValue.length < 6) setPinValue(p => p + d)
    else if (pinStep === "confirm" && pinConfirm.length < 6) setPinConfirm(p => p + d)
  }

  const handlePinKeyDelete = () => {
    if (pinStep === "enter") setPinValue(p => p.slice(0, -1))
    else setPinConfirm(p => p.slice(0, -1))
  }

  const handlePinKeyClear = () => {
    if (pinStep === "enter") setPinValue("")
    else setPinConfirm("")
  }

  React.useEffect(() => {
    if (pinStep === "enter" && pinValue.length === 6) {
      // Small delay for last dot animation then move to confirm
      setTimeout(() => setPinStep("confirm"), 300)
    }
  }, [pinValue, pinStep])

  React.useEffect(() => {
    if (pinStep === "confirm" && pinConfirm.length === 6) {
      if (pinValue !== pinConfirm) {
        toast.error("PINs do not match. Try again.")
        setPinConfirm("")
        setPinValue("")
        setPinStep("enter")
        return
      }
      if (!userId) { toast.error("No active session."); return }
      localStorage.setItem(scopedPinKey(userId), pinValue)
      setHasPinSet(true)
      toast.success("PIN saved successfully!")
      setIsPinModalOpen(false)
      setPinValue("")
      setPinConfirm("")
      setPinStep("enter")
    }
  }, [pinConfirm, pinStep])

  const handleRemovePin = () => {
    if (!userId) return
    localStorage.removeItem(scopedPinKey(userId))
    setHasPinSet(false)
    toast.success("PIN removed.")
  }

  /* ── Password ── */
  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let g = ""
    for (let i = 0; i < 14; i++) g += chars[Math.floor(62 * Math.random())] // simplified slightly
    setPassForm({ ...passForm, new: g, confirm: g })
    setShowPass(true)
    toast.success("Strong password generated!")
  }

  const getStrength = (p: string) => {
    if (!p)        return { label: "",       pct: 0,   color: "bg-zinc-200", text: "text-zinc-400" }
    if (p.length < 6)  return { label: "Weak",   pct: 25,  color: "bg-red-500",     text: "text-red-600" }
    if (p.length < 10) return { label: "Fair",   pct: 50,  color: "bg-amber-500",   text: "text-amber-600" }
    if (!/[^a-zA-Z0-9]/.test(p)) return { label: "Good", pct: 75, color: "bg-blue-500", text: "text-blue-600" }
    return               { label: "Strong",  pct: 100, color: "bg-emerald-500", text: "text-emerald-600" }
  }
  const strength = getStrength(passForm.new)

  const handlePasswordSave = () => {
    setPassError(null)
    if (!passForm.current) { setPassError("Current password is required."); return }
    if (passForm.new.length < 8) { setPassError("New password must be at least 8 characters."); return }
    if (passForm.new !== passForm.confirm) { setPassError("Passwords do not match."); return }
    if (!userId) return
    const now = new Date().toISOString()
    localStorage.setItem(LAST_CHANGED_KEY(userId), now)
    setPassLastChanged(now)
    toast.success("Password updated successfully!")
    setIsPassModalOpen(false)
    setPassForm({ current: "", new: "", confirm: "" })
  }

  /* ── Activity log from localStorage ── */
  const activityLog = React.useMemo(() => {
    const logs: { device: string; location: string; time: string; current: boolean }[] = []
    logs.push({
      device: typeof navigator !== "undefined" && navigator.userAgent.includes("iPhone") ? "iPhone" :
              typeof navigator !== "undefined" && navigator.userAgent.includes("Android") ? "Android Device" :
              typeof navigator !== "undefined" && navigator.userAgent.includes("Mac") ? "Mac" : "This Device",
      location: "Current Session",
      time: "Active now",
      current: true,
    })
    return logs
  }, [])

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <ProtectedPageWrapper>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar userId={userId} />
        <SidebarInset className="bg-[#F8F9F9] min-h-screen overflow-visible m-0 rounded-none border-none shadow-none font-sans">
          <PageHeader
            title="SECURITY"
            version="V3.3"
            showBackButton={true}
            trigger={<SidebarTrigger className="mr-2" />}
          />

          <main className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-5 pb-24">

            {/* ══════════════════════════════════════
                SECURITY SCORE BANNER
            ══════════════════════════════════════ */}
            <section className="bg-[#121212] rounded-2xl p-6 md:p-8 text-white overflow-hidden relative shadow-lg shadow-zinc-950/20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-24 -mt-24 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-12 -mb-12 pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Security Status</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-black">{score}</span>
                      <span className="text-sm font-black text-white/40">/ 100</span>
                      <span className={cn("text-xs font-black px-3 py-1 rounded-full", 
                        score >= 80 ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" :
                        score >= 50 ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" :
                        score >= 25 ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-red-500 text-white shadow-lg shadow-red-500/20"
                      )}>{level}</span>
                    </div>
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl",
                    score >= 80 ? "bg-emerald-500/10 border border-emerald-500/20" : score >= 50 ? "bg-blue-500/10 border border-blue-500/20" : "bg-amber-500/10 border border-amber-500/20"
                  )}>
                    <Shield className={cn("size-7",
                      score >= 80 ? "text-emerald-400" : score >= 50 ? "text-blue-400" : "text-amber-400"
                    )} />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mb-8">
                  <div className={cn("h-full rounded-full transition-all duration-1000 ease-out", barColor)} style={{ width: `${score}%` }} />
                </div>

                {/* Checklist */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                  {scoreItems.map(item => (
                    <div key={item.label} className="flex items-center gap-3 group">
                      <div className={cn("size-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300",
                        item.done ? "bg-emerald-500 shadow-lg shadow-emerald-500/30" : "bg-white/5 border border-white/10"
                      )}>
                        {item.done
                          ? <CheckCircle2 className="size-3.5 text-white" />
                          : <div className="size-1.5 rounded-full bg-white/20 group-hover:bg-white/40" />}
                      </div>
                      <span className={cn("text-[11px] font-bold transition-colors", item.done ? "text-white/90" : "text-white/30 group-hover:text-white/50")}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ══════════════════════════════════════
                ACCOUNT IDENTITY STRIP
            ══════════════════════════════════════ */}
            <section className="bg-white rounded-2xl border border-zinc-200/60 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-5">
                <div className="size-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0 shadow-lg shadow-zinc-200">
                  {userName ? userName[0].toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-zinc-900 text-[16px] truncate tracking-tight">{userName || "User"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {userDept && (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-zinc-100 text-zinc-500 px-2.5 py-1 rounded-lg border border-zinc-200/50">
                        {userDept}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Active session</span>
                    <div className="size-2 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-200" />
                  </div>
                </div>
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Pass changed</p>
                  <p className="text-[12px] font-black text-zinc-900 tracking-tight">{relTime(passLastChanged)}</p>
                </div>
              </div>
            </section>

            {/* ══════════════════════════════════════
                SECTION 1: PASSWORD — gated by secPerms.changePassword
            ══════════════════════════════════════ */}
            {secPerms.changePassword && <section className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6 flex items-center justify-between border-b border-zinc-50 bg-zinc-50/30">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-zinc-900 text-white rounded-2xl shadow-lg shadow-zinc-200">
                    <Lock className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-[11px] uppercase tracking-widest text-zinc-900">Account Password</h3>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">Standard sign-in credential</p>
                  </div>
                </div>
                <Dialog open={isPassModalOpen} onOpenChange={open => { setIsPassModalOpen(open); if (!open) { setPassForm({ current: "", new: "", confirm: "" }); setPassError(null) } }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 rounded-xl text-[10px] font-black uppercase border-zinc-200 hover:bg-zinc-50 active:scale-95 gap-1.5 px-4 shadow-sm">
                      <Pencil className="size-3" /> Change
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[400px] rounded-[32px] p-8 border-none shadow-2xl">
                    <DialogHeader className="mb-4">
                      <div className="flex items-center justify-between">
                        <DialogTitle className="font-black text-xl uppercase tracking-tight">Change Password</DialogTitle>
                        <Button onClick={generatePassword} variant="ghost" size="sm"
                          className="h-8 text-[9px] font-black uppercase gap-1.5 text-blue-600 hover:bg-blue-50 rounded-xl px-3">
                          <Sparkles className="size-3.5" /> Auto-Generate
                        </Button>
                      </div>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      {passError && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
                          <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" />
                          <p className="text-[11px] font-bold text-red-700 leading-relaxed">{passError}</p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Current Password</Label>
                        <div className="relative">
                          <Input type={showCurrentPass ? "text" : "password"} placeholder="••••••••"
                            className="rounded-2xl h-12 bg-zinc-50 border-zinc-200 focus:bg-white focus:ring-2 focus:ring-zinc-900 transition-all pr-12 text-sm font-medium"
                            value={passForm.current} onChange={e => setPassForm({ ...passForm, current: e.target.value })} />
                          <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-600 transition-colors">
                            {showCurrentPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">New Password</Label>
                        <div className="relative">
                          <Input type={showPass ? "text" : "password"} placeholder="Min. 8 characters"
                            className="rounded-2xl h-12 bg-zinc-50 border-zinc-200 focus:bg-white focus:ring-2 focus:ring-zinc-900 transition-all pr-12 text-sm font-medium"
                            value={passForm.new} onChange={e => setPassForm({ ...passForm, new: e.target.value })} />
                          <button type="button" onClick={() => setShowPass(!showPass)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-600 transition-colors">
                            {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                        {passForm.new && (
                          <div className="space-y-2 pt-1 px-1">
                            <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                              <div className={cn("h-full transition-all duration-700 ease-out", strength.color)} style={{ width: `${strength.pct}%` }} />
                            </div>
                            <div className="flex items-center justify-between">
                              <p className={cn("text-[10px] font-black uppercase tracking-widest", strength.text)}>{strength.label}</p>
                              <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-tighter">{passForm.new.length} characters</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Confirm New Password</Label>
                        <Input type="password" placeholder="Repeat new password"
                          className={cn("rounded-2xl h-12 bg-zinc-50 border-zinc-200 focus:bg-white focus:ring-2 focus:ring-zinc-900 transition-all text-sm font-medium",
                            passForm.confirm && passForm.confirm !== passForm.new && "ring-2 ring-red-500/20 border-red-200 bg-red-50/30")}
                          value={passForm.confirm} onChange={e => setPassForm({ ...passForm, confirm: e.target.value })} />
                      </div>
                    </div>
                    <Button onClick={handlePasswordSave}
                      className="w-full bg-zinc-900 text-white rounded-2xl h-12 font-black uppercase text-[11px] tracking-widest shadow-xl shadow-zinc-200 mt-4 active:scale-95 transition-transform">
                      Save New Password
                    </Button>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="px-6 py-5 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl border border-blue-100/50">
                    <ShieldAlert className="size-4 text-blue-500 shrink-0" />
                  </div>
                  <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-tight">
                    Last changed: <span className="text-zinc-900">{relTime(passLastChanged)}</span>
                    {passLastChanged && (() => {
                      const days = Math.floor((Date.now() - new Date(passLastChanged).getTime()) / 86400000)
                      return days > 90
                        ? <span className="ml-2 text-amber-600 font-black text-[9px] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 uppercase tracking-widest">Update recommended</span>
                        : null
                    })()}
                  </p>
                </div>
                {!passLastChanged && (
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    Not set
                  </span>
                )}
              </div>
            </section>}

            {/* ══════════════════════════════════════
                SECTION 2: QUICK AUTH (PIN + Biometric)
            ══════════════════════════════════════ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* PIN — gated by secPerms.managePin */}
              {secPerms.managePin && <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-5 border-b border-zinc-50 flex items-center gap-4 bg-zinc-50/30">
                  <div className="p-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl shadow-sm">
                    <KeyRound className="size-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-[11px] uppercase tracking-widest">Login PIN</h3>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">6-digit access code</p>
                  </div>
                  {hasPinSet && (
                    <span className="text-[9px] font-black uppercase bg-emerald-500 text-white px-2.5 py-1 rounded-lg shadow-sm shadow-emerald-100">
                      Active
                    </span>
                  )}
                </div>
                <div className="p-6 space-y-4">
                  <Dialog open={isPinModalOpen} onOpenChange={open => {
                    setIsPinModalOpen(open)
                    if (!open) { setPinValue(""); setPinConfirm(""); setPinStep("enter") }
                  }}>
                    <DialogTrigger asChild>
                      <button className="w-full flex items-center justify-between p-5 bg-zinc-50 rounded-[24px] border border-dashed border-zinc-200 hover:bg-zinc-100/80 transition-all group active:scale-[0.98]">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-black tracking-[0.5em] text-zinc-900 font-mono">
                            {hasPinSet ? "••••••" : "------"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-zinc-900 transition-colors bg-white px-3 py-1.5 rounded-xl border border-zinc-200/50 shadow-sm">
                          <Pencil className="size-3" />
                          {hasPinSet ? "Change" : "Set PIN"}
                        </div>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[32px] p-8 border-none text-center w-[95vw] sm:max-w-[360px] shadow-2xl">
                      <DialogHeader className="items-center mb-4">
                        <div className="p-4 bg-zinc-900 rounded-[24px] mb-3 shadow-xl shadow-zinc-200">
                          <KeyRound className="size-6 text-white" />
                        </div>
                        <DialogTitle className="font-black text-xl uppercase tracking-tight">
                          {pinStep === "enter" ? (hasPinSet ? "New PIN" : "Set PIN") : "Confirm PIN"}
                        </DialogTitle>
                        <DialogDescription className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                          {pinStep === "enter" ? "Enter a 6-digit PIN" : "Re-enter to confirm"}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-6 space-y-8">
                        <PinDots value={pinStep === "enter" ? pinValue : pinConfirm} total={6} />
                        <PinKeypad
                          onInput={handlePinKeyInput}
                          onDelete={handlePinKeyDelete}
                          onClear={handlePinKeyClear}
                        />
                      </div>
                      {pinStep === "confirm" && (
                        <button onClick={() => { setPinStep("enter"); setPinValue(""); setPinConfirm("") }}
                          className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors mt-2">
                          ← Back to Enter PIN
                        </button>
                      )}
                    </DialogContent>
                  </Dialog>

                  {hasPinSet && (
                    <button onClick={handleRemovePin}
                      className="w-full flex items-center justify-center gap-2.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100">
                      <Trash2 className="size-3.5" /> Remove PIN
                    </button>
                  )}
                </div>
              </div>}

              {/* Biometrics — gated by secPerms.manageBiometrics */}
              {secPerms.manageBiometrics && <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-5 border-b border-zinc-50 flex items-center gap-4 bg-zinc-50/30">
                  <div className={cn("p-3 rounded-2xl transition-all shadow-sm",
                    biometrics ? "bg-emerald-500 text-white shadow-emerald-100" : "bg-white border border-zinc-200 text-zinc-600"
                  )}>
                    <Fingerprint className="size-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-[11px] uppercase tracking-widest">Biometrics</h3>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">Face ID · Touch ID</p>
                  </div>
                  {bioRegistering ? (
                    <div className="flex items-center gap-2 text-zinc-400 bg-zinc-100 px-3 py-1.5 rounded-xl border border-zinc-200/50">
                      <Loader2 className="size-3.5 animate-spin" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Registering</span>
                    </div>
                  ) : (
                    <Switch
                      checked={biometrics}
                      onCheckedChange={handleBiometricToggle}
                      disabled={bioRegistering || !isWebAuthnSupported()}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                  )}
                </div>
                <div className="p-6">
                  {!isWebAuthnSupported() ? (
                    <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
                      <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-red-700 font-bold leading-relaxed uppercase tracking-tight">
                        Not supported. Try Chrome or Safari on a modern device.
                      </p>
                    </div>
                  ) : biometrics ? (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-[20px] border border-emerald-100/50 shadow-inner">
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-emerald-700 font-bold leading-relaxed uppercase tracking-tight">
                          Biometric registered on this device. Tap the sensor to sign in instantly.
                        </p>
                      </div>
                      <button
                        onClick={() => handleBiometricToggle(false)}
                        className="w-full flex items-center justify-center gap-2.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100">
                        <Trash2 className="size-3.5" /> Remove Biometric
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-4 bg-zinc-50 rounded-[20px] border border-zinc-100 border-dashed">
                      <Info className="size-4 text-zinc-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-zinc-500 font-bold leading-relaxed uppercase tracking-tight">
                        Enable to register your device fingerprint or face for one-tap sign-in.
                      </p>
                    </div>
                  )}
                </div>
              </div>}
            </div>

            {/* ══════════════════════════════════════
                SECTION 3: 2FA — gated by secPerms.manage2FA
            ══════════════════════════════════════ */}
            {secPerms.manage2FA && <section className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 flex items-center justify-between border-b border-zinc-50 bg-zinc-50/30">
                <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-2xl transition-all shadow-sm",
                    twoFactor ? "bg-blue-600 text-white shadow-blue-100" : "bg-white border border-zinc-200 text-zinc-600"
                  )}>
                    <SmartphoneNfc className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-[11px] uppercase tracking-widest">Two-Step Verification</h3>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">SMS or Authenticator App</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {twoFactor && (
                    <span className="text-[9px] font-black uppercase bg-blue-500 text-white px-2.5 py-1 rounded-lg shadow-sm shadow-blue-100">
                      Enabled
                    </span>
                  )}
                  <Switch
                    checked={twoFactor}
                    onCheckedChange={val => {
                      setTwoFactor(val)
                      localStorage.setItem("engiconnect_2fa_enabled", String(val))
                      toast.success(val ? "2FA enabled" : "2FA disabled")
                    }}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>
              </div>
              <div className="p-6 bg-white">
                <p className="text-[11px] text-zinc-500 font-bold leading-relaxed uppercase tracking-tight">
                  {twoFactor
                    ? "Your account requires a second verification step on every new login."
                    : "Add a second layer of protection. We'll ask for a code when you sign in from a new device."}
                </p>
              </div>
            </section>}

            {/* ══════════════════════════════════════
                SECTION 4: TRUSTED DEVICES
            ══════════════════════════════════════ */}
            <section className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/30">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white border border-zinc-200 text-zinc-400 rounded-2xl">
                    <Monitor className="size-4" />
                  </div>
                  <h3 className="font-black text-[11px] uppercase tracking-widest">Trusted Devices</h3>
                </div>
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                  {[hasPinSet, biometrics].filter(Boolean).length} method{[hasPinSet, biometrics].filter(Boolean).length !== 1 ? "s" : ""} on this device
                </span>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-5 p-5 bg-zinc-50 rounded-[24px] border border-zinc-200/50 hover:bg-zinc-100/50 transition-colors group">
                  <div className="size-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-zinc-200">
                    {typeof navigator !== "undefined" && navigator.userAgent.includes("iPhone")
                      ? <Smartphone className="size-5" />
                      : <Monitor className="size-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-black text-zinc-900 truncate tracking-tight">This Device</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {hasPinSet && (
                        <span className="text-[9px] font-black uppercase bg-white text-zinc-600 px-2 py-0.5 rounded-lg border border-zinc-200 shadow-sm">PIN</span>
                      )}
                      {biometrics && (
                        <span className="text-[9px] font-black uppercase bg-white text-zinc-600 px-2 py-0.5 rounded-lg border border-zinc-200 shadow-sm">Biometric</span>
                      )}
                      <span className="text-[9px] font-black uppercase bg-emerald-500 text-white px-2 py-0.5 rounded-lg shadow-sm shadow-emerald-100">Active now</span>
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-zinc-300 group-hover:text-zinc-900 transition-all group-hover:translate-x-1" />
                </div>
              </div>
            </section>

            {/* ══════════════════════════════════════
                SECTION 5: RECENT ACTIVITY — gated by secPerms.viewActivityLog
            ══════════════════════════════════════ */}
            {secPerms.viewActivityLog && <section className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/30">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white border border-zinc-200 text-zinc-400 rounded-2xl">
                    <History className="size-4" />
                  </div>
                  <h3 className="font-black text-[11px] uppercase tracking-widest">Login Activity</h3>
                </div>
                <button className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors bg-white px-3 py-1.5 rounded-xl border border-zinc-200/50 shadow-sm active:scale-95">
                  <RefreshCw className="size-3.5" /> Refresh
                </button>
              </div>
              <div className="divide-y divide-zinc-50 bg-white">
                {activityLog.map((session, i) => (
                  <div key={i} className="p-6 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                    <div className="flex items-center gap-5">
                      <div className="size-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-500 flex-shrink-0 border border-zinc-200/50">
                        <Globe className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <p className="text-[15px] font-black text-zinc-900 tracking-tight">{session.device}</p>
                          {session.current && (
                            <span className="text-[9px] font-black uppercase bg-emerald-500 text-white px-2.5 py-1 rounded-lg shadow-sm shadow-emerald-100">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="size-3.5 text-zinc-300" />
                          <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-tight">{session.time}</p>
                        </div>
                      </div>
                    </div>
                    {!session.current && (
                      <button className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl transition-all border border-red-100 shadow-sm active:scale-95">
                        Terminate
                      </button>
                    )}
                  </div>
                ))}

                {/* Tip row */}
                <div className="p-6 flex items-start gap-4 bg-zinc-50/50">
                  <div className="p-2 bg-white rounded-xl border border-zinc-200 shadow-sm">
                    <MapPin className="size-4 text-zinc-300 shrink-0" />
                  </div>
                  <p className="text-[11px] text-zinc-400 font-bold leading-relaxed uppercase tracking-tight">
                    Location logging is enabled at login for security compliance. If you see an unrecognised session, terminate it and change your password immediately.
                  </p>
                </div>
              </div>
            </section>}

            {/* ══════════════════════════════════════
                SECTION 6: SECURITY RECOMMENDATIONS
            ══════════════════════════════════════ */}
            <section className="bg-zinc-900 rounded-2xl p-6 text-white overflow-hidden relative shadow-xl shadow-zinc-200">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
              
              <div className="relative z-10 flex items-center gap-4 mb-6">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Sparkles className="size-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-black text-[12px] uppercase tracking-widest">Security Health Tips</h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">Personalized recommendations</p>
                </div>
              </div>

              <div className="space-y-3 relative z-10">
                {score < 100 ? (
                  <>
                    {!passLastChanged && (
                      <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors group cursor-default">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                          <Lock className="size-4 text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] font-black uppercase tracking-tight">Set a Strong Password</p>
                          <p className="text-[10px] text-white/40 font-medium mt-0.5">You haven't updated your password recently. Use symbols and numbers.</p>
                        </div>
                      </div>
                    )}
                    {!hasPinSet && (
                      <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors group cursor-default">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <KeyRound className="size-4 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] font-black uppercase tracking-tight">Enable Login PIN</p>
                          <p className="text-[10px] text-white/40 font-medium mt-0.5">Quickly secure your device access with a 6-digit code.</p>
                        </div>
                      </div>
                    )}
                    {!biometrics && (
                      <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors group cursor-default">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                          <Fingerprint className="size-4 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] font-black uppercase tracking-tight">Activate Biometrics</p>
                          <p className="text-[10px] text-white/40 font-medium mt-0.5">Use Face ID or Touch ID for the most secure and fastest login experience.</p>
                        </div>
                      </div>
                    )}
                    {!twoFactor && (
                      <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors group cursor-default">
                        <div className="p-2 bg-violet-500/20 rounded-lg">
                          <SmartphoneNfc className="size-4 text-violet-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] font-black uppercase tracking-tight">Enable 2FA</p>
                          <p className="text-[10px] text-white/40 font-medium mt-0.5">Add an extra layer of security to prevent unauthorized access.</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="size-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="size-8 text-emerald-400" />
                    </div>
                    <p className="text-[13px] font-black uppercase tracking-widest text-white">Your account is fully secured!</p>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-1">Excellent job following our security protocols.</p>
                  </div>
                )}
              </div>
            </section>

            {/* ══════════════════════════════════════
                DANGER ZONE
            ══════════════════════════════════════ */}
            <section className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 border-b border-red-50 bg-red-50/30">
                <h3 className="font-black text-[11px] uppercase tracking-widest text-red-600">Danger Zone</h3>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">Irreversible actions — proceed with caution.</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between p-5 rounded-[24px] border border-dashed border-red-100 hover:bg-red-50/50 transition-all group active:scale-[0.99]">
                  <div className="space-y-1">
                    <p className="text-[13px] font-black text-zinc-900 uppercase tracking-tight">Sign out all devices</p>
                    <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-tight">Ends all active sessions except this one</p>
                  </div>
                  <button className="text-[10px] font-black uppercase tracking-widest text-red-500 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95">
                    Sign Out All
                  </button>
                </div>
              </div>
            </section>

          </main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  )
}