"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import {
  BadgeCheck, Bell, ChevronsUpDown, LogOut,
  Loader2, User, Shield, ChevronRight,
} from "lucide-react"
import {
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { conxStorage } from "@/utils/storage-helper"

interface NavUserProps {
  user: {
    id?: string
    name: string
    email: string
    avatar: string
  }
}

/* ─────────────────────────────────────────────
   LOGOUT — clears session but keeps device keys
   Preserved: deviceId, engiconnect_user_pin_{uid},
              engiconnect_bio_enabled_{uid},
              engiconnect_webauthn_credId_{uid}
   Removed:   session identity + role/dept keys
───────────────────────────────────────────── */
function clearSession(userId?: string) {
  sessionStorage.clear()

  // Identity - use conxStorage to handle iframe isolation
  conxStorage.removeItem("userId")
  conxStorage.removeItem("userName")
  conxStorage.removeItem("userRole")
  conxStorage.removeItem("userDepartment")
  conxStorage.removeItem("department")    // legacy compat key

  // Note: we intentionally keep:
  //   deviceId                                — device identification
  //   engiconnect_user_pin_{userId}           — scoped PIN
  //   engiconnect_bio_enabled_{userId}        — scoped bio toggle
  //   engiconnect_webauthn_credId_{userId}    — scoped WebAuthn cred
  //   engiconnect_bio_userId_{credId}         — reverse bio mapping
  // These are scoped to userId so they are safe across users and
  // allow PIN / biometric login on the next session.
}

export function NavUser({ user }: NavUserProps) {
  const router              = useRouter()
  const { isMobile, setOpenMobile } = useSidebar()
  const [status, setStatus] = useState<"idle" | "logging-out" | "redirecting">("idle")
  const [progress, setProgress] = useState(0)

  const startTransition = (message: string, type: "logging-out" | "redirecting") => {
    if (isMobile) setOpenMobile(false)
    setStatus(type)
    setProgress(0)
    toast.info(message)
    let value = 0
    const interval = setInterval(() => {
      value += type === "logging-out" ? 15 : 30
      setProgress(Math.min(value, 100))
      if (value >= 100) clearInterval(interval)
    }, 80)
  }

  const handleLogout = async () => {
    startTransition("Signing out...", "logging-out")
    await new Promise(r => setTimeout(r, 900))
    clearSession(user.id)
    router.replace("/login")
  }

  const handleAccountClick = async () => {
    if (!user.id) return toast.error("User ID missing — please re-login.")
    startTransition("Loading profile...", "redirecting")
    await new Promise(r => setTimeout(r, 500))
    router.push(`/account/profile?userId=${user.id}`)
  }

  const handleSecurityClick = async () => {
    if (!user.id) return toast.error("User ID missing — please re-login.")
    startTransition("Loading security...", "redirecting")
    await new Promise(r => setTimeout(r, 500))
    router.push(`/account/security?userId=${user.id}`)
  }

  const initials = user.name
    ?.split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U"

  return (
    <>
      {/* ── Loading overlay ── */}
      {status !== "idle" && (
        <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-white/95 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-56 text-center space-y-5">
            <Loader2 className="size-7 text-[#E33636] animate-spin mx-auto" />
            <p className="text-zinc-800 font-black text-[11px] uppercase tracking-widest">
              {status === "logging-out" ? "Signing Out" : "Loading..."}
            </p>
            <Progress value={progress} className="h-1 bg-zinc-100" />
          </div>
        </div>
      )}

      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="h-11 px-2.5 hover:bg-zinc-100 active:scale-[0.97] transition-all rounded-xl"
              >
                <Avatar className="h-8 w-8 rounded-xl border border-zinc-100 shadow-sm flex-shrink-0">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="bg-zinc-900 text-white text-[10px] font-black rounded-xl">
                    {initials || <User size={12} />}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight ml-2 overflow-hidden">
                  <span className="truncate font-bold text-[12px] text-zinc-900">{user.name}</span>
                  <span className="truncate text-[9px] text-zinc-400 font-medium">{user.email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-3 text-zinc-300 flex-shrink-0" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              className={cn(
                "p-1.5 shadow-2xl border-zinc-100 bg-white rounded-2xl",
                "w-[calc(100vw-32px)] max-w-[240px]",
                "animate-in fade-in zoom-in-95 duration-150"
              )}
              align={isMobile ? "center" : "start"}
              side={isMobile ? "bottom" : "right"}
              sideOffset={8}
            >
              {/* User info header */}
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 m-0.5">
                  <Avatar className="h-10 w-10 rounded-xl border border-zinc-100 shadow-sm flex-shrink-0">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-zinc-900 text-white font-black text-sm rounded-xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-black text-[12px] text-zinc-900 truncate leading-none mb-1">{user.name}</p>
                    <p className="text-[9px] text-zinc-400 font-medium truncate">{user.email}</p>
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="bg-zinc-50 mx-0.5 my-1" />

              <DropdownMenuGroup className="space-y-0.5">
                <DropdownMenuItem
                  onSelect={handleAccountClick}
                  className="rounded-xl py-2.5 px-3 cursor-pointer hover:bg-zinc-50 focus:bg-zinc-50 group"
                >
                  <BadgeCheck className="mr-2.5 h-4 w-4 text-zinc-400 group-hover:text-zinc-700" />
                  <span className="text-[11px] font-bold text-zinc-700 flex-1">My Profile</span>
                  <ChevronRight className="size-3 text-zinc-300 group-hover:translate-x-0.5 transition-transform" />
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={handleSecurityClick}
                  className="rounded-xl py-2.5 px-3 cursor-pointer hover:bg-zinc-50 focus:bg-zinc-50 group"
                >
                  <Shield className="mr-2.5 h-4 w-4 text-zinc-400 group-hover:text-zinc-700" />
                  <span className="text-[11px] font-bold text-zinc-700 flex-1">Security</span>
                  <ChevronRight className="size-3 text-zinc-300 group-hover:translate-x-0.5 transition-transform" />
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => router.push("/settings/notifications")}
                  className="rounded-xl py-2.5 px-3 cursor-pointer hover:bg-zinc-50 focus:bg-zinc-50 group"
                >
                  <Bell className="mr-2.5 h-4 w-4 text-zinc-400 group-hover:text-zinc-700" />
                  <span className="text-[11px] font-bold text-zinc-700 flex-1">Notifications</span>
                  <ChevronRight className="size-3 text-zinc-300 group-hover:translate-x-0.5 transition-transform" />
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator className="bg-zinc-50 mx-0.5 my-1" />

              <DropdownMenuItem
                onSelect={handleLogout}
                className="rounded-xl py-2.5 px-3 text-red-600 focus:text-red-700 focus:bg-red-50 hover:bg-red-50 cursor-pointer"
              >
                <LogOut className="mr-2.5 h-4 w-4" />
                <span className="text-[11px] font-black">Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  )
}