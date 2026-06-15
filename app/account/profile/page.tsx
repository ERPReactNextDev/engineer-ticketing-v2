"use client"

import * as React from "react"
import Image from "next/image"
import { 
  User, Mail, ShieldCheck, MapPin, 
  Camera, Save, Fingerprint, 
  Phone, PenTool, Eraser, CheckCircle2,
  Building2, Lock, Eye, EyeOff, Sparkles,
  Activity, Clock3
} from "lucide-react"
import SignatureCanvas from "react-signature-canvas"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/page-header"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { cn } from "@/lib/utils"

/* ─────────────────────────────────────────────
   DASHBOARD CARD
───────────────────────────────────────────── */
function DashboardCard({ label, value, subValue, icon: Icon, colorClass, loading }: {
  label: string; value: string; subValue?: string; icon: any; colorClass: string; loading?: boolean
}) {
  return (
    <div className="flex-1 bg-white rounded-xl md:rounded-2xl p-2.5 md:p-3 border border-zinc-200/60 shadow-sm flex items-center gap-3 group hover:shadow-md transition-all min-w-0">
      <div className={cn("p-2 rounded-lg md:rounded-xl flex-shrink-0", colorClass)}>
        <Icon className="size-3.5 md:size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          {loading ? (
            <div className="h-3.5 md:h-4 w-12 md:w-16 bg-zinc-100 rounded animate-pulse" />
          ) : (
            <p className="text-[13px] md:text-[14px] font-black text-zinc-900 leading-none truncate tracking-tight">{value}</p>
          )}
          {!loading && subValue && (
            <span className="hidden xl:inline-block text-[7px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-50 px-1 py-0.5 rounded border border-zinc-100 whitespace-nowrap flex-shrink-0">
              {subValue}
            </span>
          )}
        </div>
        <p className="text-[7px] font-black uppercase text-zinc-400 tracking-[0.1em] truncate">{label}</p>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const [userId, setUserId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const sigCanvas = React.useRef<SignatureCanvas>(null)

  const [userDetails, setUserDetails] = React.useState<any>({
    id: "",
    Firstname: "",
    Lastname: "",
    Email: "",
    ContactNumber: "",
    Address: "",
    Role: "",
    Department: "",
    Position: "",
    Company: "",
    Status: "",
    Birthday: "",
    Gender: "",
    profilePicture: "",
    signatureImage: "",
    Password: "",
    ConfirmPassword: "" 
  })

  React.useEffect(() => {
    const storedId = localStorage.getItem("userId")
    setUserId(storedId)
    if (storedId) fetchUserData(storedId)
  }, [])

  const getStrength = (pass: string) => {
    if (!pass) return { label: "", color: "bg-zinc-100", width: "0%" }
    if (pass.length < 6) return { label: "Weak", color: "bg-red-500", width: "33%" }
    if (pass.length < 10) return { label: "Medium", color: "bg-yellow-500", width: "66%" }
    return { label: "Strong", color: "bg-emerald-500", width: "100%" }
  }

  const calculateProfileCompletion = () => {
    const totalFields = 9 // Firstname, Lastname, Email, ContactNumber, Address, Position, Department, Company, profilePicture, signatureImage
    let filledFields = 0

    if (userDetails.Firstname) filledFields++
    if (userDetails.Lastname) filledFields++
    if (userDetails.Email) filledFields++
    if (userDetails.ContactNumber) filledFields++
    if (userDetails.Address) filledFields++
    if (userDetails.Position) filledFields++
    if (userDetails.Department) filledFields++
    if (userDetails.Company) filledFields++
    if (userDetails.profilePicture) filledFields++
    // if (userDetails.signatureImage) filledFields++ // Signature is optional

    return Math.round((filledFields / totalFields) * 100)
  }

  const profileCompletion = calculateProfileCompletion()

  const strength = getStrength(userDetails.Password)

  async function fetchUserData(id: string) {
    try {
      const res = await fetch(`/api/user?id=${encodeURIComponent(id)}`)
      const data = await res.json()
      setUserDetails({ ...data, Password: "", ConfirmPassword: "" })
    } catch (e) {
      toast.error("System could not sync your data.")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (userDetails.Password && userDetails.Password !== userDetails.ConfirmPassword) {
      toast.error("Passwords do not match!")
      return
    }

    if (!userDetails.id) {
      toast.error("User ID is required")
      return
    }

    setSaving(true)
    try {
      const payload = { ...userDetails, id: userDetails.id }
      delete payload.ConfirmPassword
      if (!payload.Password) delete payload.Password

      const res = await fetch("/api/profile-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      
      if (res.ok) {
        toast.success("Profile updated successfully.")
        setUserDetails((prev: any) => ({ ...prev, Password: "", ConfirmPassword: "" }))
      } else {
        const result = await res.json()
        toast.error(result.error || "Update failed.")
      }
    } catch (error) {
      toast.error("System connection error.")
    } finally {
      setSaving(false)
    }
  }

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let generated = ""
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setUserDetails({ ...userDetails, Password: generated, ConfirmPassword: generated })
    setShowPassword(true)
    toast.success("Secure password generated!")
  }

  const handleUpload = async (file: File | string, type: "profile" | "signature") => {
    const data = new FormData()
    data.append("file", file)
    data.append("upload_preset", "Xchire") 

    try {
      const res = await fetch("https://api.cloudinary.com/v1_1/dhczsyzcz/image/upload", {
        method: "POST",
        body: data,
      })
      const json = await res.json()
      const field = type === "profile" ? "profilePicture" : "signatureImage"
      setUserDetails((prev: any) => ({ ...prev, [field]: json.secure_url }))
      toast.success("Image synced.")
    } catch {
      toast.error("Upload failed.")
    }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center font-black text-[10px] tracking-[0.3em] uppercase opacity-40">
      Syncing Engiconnect...
    </div>
  )

  return (
    <ProtectedPageWrapper>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar userId={userId} />
        <SidebarInset className="bg-[#F4F7F7] min-h-screen overflow-visible m-0 rounded-none border-none shadow-none font-sans">
          
          <PageHeader 
            title="MY ACCOUNT" 
            version="V3.2" 
            showBackButton={true}
            trigger={<SidebarTrigger className="mr-2" />}
            actions={
              <Button 
                onClick={handleSave}
                disabled={saving}
                className="h-10 rounded-xl bg-black text-white font-bold text-[10px] tracking-widest uppercase px-6 gap-2"
              >
                <Save className={`size-4 ${saving ? "animate-spin" : ""}`} /> 
                {saving ? "Updating..." : "Save Changes"}
              </Button>
            }
          />

          <main className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6 pb-20">
            
            {/* PROFILE HEADER - 24px Radius */}
            <div className="bg-white rounded-2xl border border-zinc-200/60 p-8 flex flex-col md:flex-row items-center gap-8 shadow-sm">
              <div className="relative">
                <div className="size-32 bg-zinc-100 rounded-[24px] flex items-center justify-center border-4 border-white shadow-inner overflow-hidden relative">
                  {userDetails.profilePicture ? (
                    <Image src={userDetails.profilePicture} alt="User" fill className="object-cover" />
                  ) : (
                    <User className="size-16 text-zinc-300" />
                  )}
                </div>
                <button 
                  onClick={() => document.getElementById("profile-upload")?.click()}
                  className="absolute bottom-0 right-0 p-2.5 bg-black text-white rounded-[12px] shadow-lg"
                >
                  <Camera className="size-4" />
                </button>
                <input id="profile-upload" type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "profile")} />
              </div>
              
              <div className="text-center md:text-left">
                <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">{userDetails.Firstname} {userDetails.Lastname}</h2>
                <p className="text-sm font-medium text-zinc-400">{userDetails.Position} • {userDetails.Department}</p>
                <div className="pt-2 flex gap-2 justify-center md:justify-start">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-[8px] uppercase tracking-wider">{userDetails.Status}</span>
                  <span className="px-3 py-1 bg-zinc-100 text-zinc-500 text-[10px] font-bold rounded-[8px] uppercase tracking-wider">{userDetails.Role}</span>
                </div>
              </div>
            </div>

            {/* PROFILE STATS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DashboardCard
                label="Profile Completion"
                value={`${profileCompletion}%`}
                icon={CheckCircle2}
                colorClass="text-emerald-600 bg-emerald-50"
              />
              <DashboardCard
                label="Last Login"
                value="2024-04-08" // Placeholder
                subValue="10:30 AM"
                icon={Clock3}
                colorClass="text-blue-600 bg-blue-50"
              />
              <DashboardCard
                label="Total Requests"
                value="12" // Placeholder
                subValue="All Time"
                icon={Activity}
                colorClass="text-violet-600 bg-violet-50"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* PERSONAL DETAILS - 24px Radius */}
              <div className="bg-white rounded-2xl border border-zinc-200/60 p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-900 text-white rounded-[8px]"><Fingerprint className="size-4" /></div>
                  <h3 className="font-black text-[10px] uppercase tracking-widest">Personal Details</h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-1">First Name</Label>
                      <Input value={userDetails.Firstname} onChange={(e) => setUserDetails({...userDetails, Firstname: e.target.value})} className="h-12 rounded-xl border-zinc-100" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Last Name</Label>
                      <Input value={userDetails.Lastname} onChange={(e) => setUserDetails({...userDetails, Lastname: e.target.value})} className="h-12 rounded-xl border-zinc-100" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Contact Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-300" />
                      <Input value={userDetails.ContactNumber || ""} onChange={(e) => setUserDetails({...userDetails, ContactNumber: e.target.value})} className="pl-11 h-12 rounded-xl border-zinc-100" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Home Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-300" />
                      <Input value={userDetails.Address || ""} onChange={(e) => setUserDetails({...userDetails, Address: e.target.value})} className="pl-11 h-12 rounded-xl border-zinc-100" />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECURITY SECTION - 24px Radius */}
              <div className="bg-white rounded-2xl border border-zinc-200/60 p-8 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-900 text-white rounded-[8px]"><Lock className="size-4" /></div>
                    <h3 className="font-black text-[10px] uppercase tracking-widest">Security</h3>
                  </div>
                  <Button onClick={generatePassword} variant="ghost" className="h-8 text-[9px] font-bold uppercase gap-1.5 text-blue-600 hover:bg-blue-50 rounded-[8px]">
                    <Sparkles className="size-3" /> Auto-Generate
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-1">New Password</Label>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••"
                        value={userDetails.Password} 
                        onChange={(e) => setUserDetails({...userDetails, Password: e.target.value})} 
                        className="h-12 rounded-xl border-zinc-100 pr-12" 
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300">
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {userDetails.Password && (
                      <div className="mt-2 px-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[8px] uppercase font-bold text-zinc-400">Strength: {strength.label}</span>
                        </div>
                        <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${strength.color}`} style={{ width: strength.width }} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Confirm Password</Label>
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••"
                      value={userDetails.ConfirmPassword} 
                      onChange={(e) => setUserDetails({...userDetails, ConfirmPassword: e.target.value})} 
                      className={`h-12 rounded-xl border-zinc-100 ${userDetails.Password !== userDetails.ConfirmPassword && userDetails.ConfirmPassword ? "border-red-500 bg-red-50/10" : ""}`}
                    />
                    {userDetails.Password !== userDetails.ConfirmPassword && userDetails.ConfirmPassword && (
                      <p className="text-[8px] text-red-500 font-bold uppercase italic ml-1">Passwords do not match</p>
                    )}
                  </div>
                </div>
              </div>

              {/* SIGNATURE PAD - 24px Radius */}
              <div className="bg-white rounded-2xl border border-zinc-200/60 p-8 space-y-6 shadow-sm lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-900 text-white rounded-[8px]"><PenTool className="size-4" /></div>
                    <h3 className="font-black text-[10px] uppercase tracking-widest">E-Signature</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => sigCanvas.current?.clear()} className="text-[9px] font-bold uppercase"><Eraser className="size-3 mr-1" /> Clear</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-4">
                    <div className="h-32 border border-dashed border-zinc-200 rounded-[12px] bg-zinc-50/50 relative">
                      <SignatureCanvas ref={sigCanvas} penColor="black" canvasProps={{ className: "w-full h-full cursor-crosshair" }} />
                    </div>
                    <Button 
                      onClick={() => {
                        const data = sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png");
                        if (data) handleUpload(data, "signature");
                      }}
                      className="w-full bg-zinc-100 text-black border border-zinc-200 h-10 rounded-xl text-[9px] font-bold uppercase"
                    >
                      Sync Signature
                    </Button>
                  </div>

                  {userDetails.signatureImage && (
                    <div className="flex flex-col items-center justify-center gap-3 p-4 bg-zinc-50/50 rounded-[16px] border border-zinc-100 shadow-inner h-full min-h-[160px]">
                      <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Active E-Signature</p>
                      <div className="relative w-full h-20">
                        <Image src={userDetails.signatureImage} alt="Active Sign" fill className="object-contain" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ORGANIZATION INFO - 24px Radius */}
            <div className="bg-white rounded-2xl border border-zinc-200/60 p-8 shadow-sm">
               <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-zinc-900 text-white rounded-[8px]"><Building2 className="size-4" /></div>
                <h3 className="font-black text-[10px] uppercase tracking-widest">Organization</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                 <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Company</p>
                    <p className="text-sm font-bold">{userDetails.Company}</p>
                 </div>
                 <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Department</p>
                    <p className="text-sm font-bold">{userDetails.Department}</p>
                 </div>
                 <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Position</p>
                    <p className="text-sm font-bold">{userDetails.Position}</p>
                 </div>
                 <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Role</p>
                    <p className="text-sm font-bold">{userDetails.Role}</p>
                 </div>
              </div>
            </div>

          </main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  )
}