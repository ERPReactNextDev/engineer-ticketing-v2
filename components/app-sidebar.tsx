"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Sidebar, SidebarContent, SidebarFooter,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavMain }      from "./nav-main"
import { NavSecondary } from "./nav-secondary"
import { NavUser }      from "./nav-user"

import { db } from "@/lib/firebase"
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore"

import {
  LayoutDashboard, CalendarCheck, FileText, Monitor, ClipboardCheck,
  Package, MoreHorizontal, ThumbsUp, Wrench,
  Users, ShieldCheck, BarChart3, Settings2, BookOpen, CircleUser,
  Zap, Target, Briefcase, Clock, TrendingUp, Star, Plus, ArrowRight,
  Activity,
} from "lucide-react"

/* ─────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────── */
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userId: string | null | undefined
}

type NavItem = {
  title:     string
  url:       string
  icon?:     any
  isActive?: boolean
  badge?:    number
  items?:    { title: string; url: string }[]
}

type PermDoc = {
  services:  Record<string, boolean>
  nav:       Record<string, boolean>
  security:  Record<string, boolean>
  account:   Record<string, boolean>
  dashboard: Record<string, boolean>
}

/* ─────────────────────────────────────────────────────────
   SERVICE MAP
───────────────────────────────────────────────────────── */
const SERVICE_MAP: Record<string, { title: string; icon: any; path: string }> = {
  siteVisit:      { title: "Site Visit",        icon: CalendarCheck,  path: "/appointments/site-visit" },
  jobRequest:     { title: "Job Request",        icon: FileText,       path: "/request/job" },
  dialux:         { title: "DIAlux Simulation",  icon: Monitor,        path: "/request/dialux" },
  recommendation: { title: "Recommendation",     icon: ThumbsUp,       path: "/requests/recommendation" },
  shopDrawing:    { title: "Shop Drawing",        icon: Wrench,         path: "/request/shop-drawing" },
  testing:        { title: "Testing Monitor",     icon: ClipboardCheck, path: "/request/testing" },
  productRequest: { title: "SPF Product",         icon: Package,        path: "/request/product" },
  others:         { title: "Other Request",       icon: MoreHorizontal, path: "/request/other" },
}

const DEFAULT_PERMS: PermDoc = {
  services:  {},
  nav:       { team: false, admin: false, analytics: false, systemSettings: false, helpCenter: false },
  security:  { changePassword: true, managePin: true, manageBiometrics: true, manage2FA: false, viewActivityLog: true },
  account:   { viewProfile: true, editProfile: true, preferences: true },
  dashboard: { showStats: true, showRecentActivity: true, showOverviewTabs: true, showAlertBanner: true },
}

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
function getDeptStyle(dept: string) {
  const d = dept?.toUpperCase().trim()
  if (d === "IT")               return "bg-emerald-100 text-emerald-700"
  if (d === "ENGINEERING")      return "bg-blue-100 text-blue-700"
  if (d === "SALES")            return "bg-red-100 text-red-700"
  if (d === "PROCUREMENT")      return "bg-violet-100 text-violet-700"
  if (d?.includes("WAREHOUSE")) return "bg-amber-100 text-amber-700"
  return "bg-zinc-100 text-zinc-600"
}

function getRoleStyle(role: string) {
  const r = role?.toUpperCase()
  if (r === "SUPER ADMIN")              return "bg-zinc-900 text-white"
  if (r === "MANAGER" || r === "SALES HEAD") return "bg-blue-600 text-white"
  if (r === "TERRITORY SALES MANAGER")  return "bg-amber-100 text-amber-700"
  if (r === "TERRITORY SALES ASSOCIATE")return "bg-orange-100 text-orange-700"
  if (r === "LEADER")                   return "bg-violet-100 text-violet-700"
  return "bg-zinc-100 text-zinc-600"
}

function SidebarSkeleton() {
  return (
    <div className="px-3 space-y-1.5 pt-2">
      {[...Array(7)].map((_, i) => (
        <div
          key={i}
          className="h-9 bg-zinc-100 rounded-xl animate-pulse"
          style={{ opacity: Math.max(0.1, 1 - i * 0.12) }}
        />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
   
   collapsible="offcanvas"
   — slides fully in/out (no ugly icon-only strip)
   — on mobile: overlay drawer
   — on desktop: pushes content left/right
───────────────────────────────────────────────────────── */
export function AppSidebar({ userId, ...props }: AppSidebarProps) {
  const pathname = usePathname()

  const [isLoading, setIsLoading]     = React.useState(true)
  const [permsLoaded, setPermsLoaded] = React.useState(false)
  const [userDetails, setUserDetails] = React.useState({
    UserId: "", Firstname: "", Lastname: "", Email: "",
    profilePicture: "", Department: "", Role: "",
  })
  const [permDoc, setPermDoc] = React.useState<PermDoc>(DEFAULT_PERMS)

  /* ── 1. Fetch user profile ── */
  React.useEffect(() => {
    if (!userId) {
      setIsLoading(false)
      setPermsLoaded(true)
      return
    }
    const run = async () => {
      try {
        // Fetch both MongoDB and Firestore data
        const [mongoRes, firestoreDoc] = await Promise.all([
          fetch(`/api/user?id=${encodeURIComponent(userId)}`),
          getDoc(doc(db, "users", userId))
        ])
        const mongoData = await mongoRes.json()
        
        const dept = (mongoData.Department || "").toUpperCase()
        const position = (mongoData.Position || "").toUpperCase()
        
        // Get full role name from Firestore (for display)
        const firestoreRoleFull = firestoreDoc.exists() 
          ? (firestoreDoc.data().Role || firestoreDoc.data().role || "MEMBER").toUpperCase()
          : "MEMBER"
        
        /**
         * ROLE DETECTION:
         * - Display Role: Use full Firestore role name (TERRITORY SALES MANAGER, MANAGER, etc.)
         * - Logic Role: Use abbreviated for permissions (TSM, TSA, MANAGER)
         */
        const isSalesDept = dept === "SALES"
        
        // Sales-specific role detection based on Position
        const isTSM = isSalesDept 
          ? (position.includes("TERRITORY SALES MANAGER") && !position.includes("ASSOCIATE"))
          : (firestoreRoleFull === "TSM" || firestoreRoleFull === "TERRITORY SALES MANAGER")
        
        const isTSA = isSalesDept && position.includes("TERRITORY SALES ASSOCIATE")
        
        const isManager = isSalesDept
          ? (position.includes("SALES HEAD") || (position.includes("MANAGER") && !position.includes("TERRITORY")))
          : (firestoreRoleFull === "MANAGER" || firestoreRoleFull === "SALES HEAD")
        
        // Determine abbreviated role for logic/permissions
        let logicRole = firestoreRoleFull
        if (isManager) logicRole = "MANAGER"
        else if (isTSM) logicRole = "TSM"
        else if (isTSA) logicRole = "TSA"
        
        // Display role: Use Firestore full name or Position
        let displayRole = firestoreRoleFull
        if (isSalesDept && position && !position.includes("MEMBER")) {
          displayRole = position  // Use full Position for Sales
        }
        
        // Update localStorage for consistency with other components
        // Use full role name for permissions lookup (e.g., "TERRITORY SALES MANAGER" not "TSM")
        if (typeof window !== "undefined") {
          localStorage.setItem("userRole", displayRole)
          localStorage.setItem("userDepartment", dept)
          localStorage.setItem("userRoleShort", logicRole) // Keep abbreviated for logic checks
        }
        
        setUserDetails({
          UserId:         mongoData._id || userId,
          Firstname:      mongoData.Firstname      || "",
          Lastname:       mongoData.Lastname       || "",
          Email:          mongoData.Email          || "",
          profilePicture: mongoData.profilePicture || "/avatars/default.jpg",
          Department:     dept,
          Role:           displayRole,  // Full name for display
        })
      } catch (e) {
        console.error("Sidebar user fetch:", e)
      } finally {
        setIsLoading(false)
      }
    }
    run()
  }, [userId])

  /* ── 2. Subscribe to role_permissions ── */
  React.useEffect(() => {
    if (!userId) {
      setPermDoc(DEFAULT_PERMS)
      setPermsLoaded(true)
      return
    }
    if (!userDetails.Department || !userDetails.Role) return

    const deptKey  = userDetails.Department.toUpperCase().trim()
    const roleKey  = userDetails.Role.toUpperCase().trim()
    const targetId = `${deptKey}_${roleKey}`

    const unsub = onSnapshot(collection(db, "role_permissions"), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
      const raw  = docs.find((p: any) => p.id === targetId)
                || docs.find((p: any) => p.id.endsWith(`_${roleKey}`))

      setPermDoc(raw ? {
        services:  { ...DEFAULT_PERMS.services,  ...(raw.services  || {}) },
        nav:       { ...DEFAULT_PERMS.nav,        ...(raw.nav       || {}) },
        security:  { ...DEFAULT_PERMS.security,   ...(raw.security  || {}) },
        account:   { ...DEFAULT_PERMS.account,    ...(raw.account   || {}) },
        dashboard: { ...DEFAULT_PERMS.dashboard,  ...(raw.dashboard || {}) },
      } : DEFAULT_PERMS)
      setPermsLoaded(true)
    })

    return () => unsub()
  }, [userId, userDetails.Department, userDetails.Role])

  /* ── 3. Append userId to links ── */
  const appendId = React.useCallback((url: string) =>
    userId
      ? url.includes("?") ? `${url}&userId=${userId}` : `${url}?userId=${userId}`
      : url,
    [userId]
  )

  /* ── 4. Build nav ── */
  const { navMain, navSecondary } = React.useMemo(() => {
    if (!permsLoaded) return { navMain: [], navSecondary: [] }

    const p  = pathname ?? ""
    const sv = permDoc.services
    const nv = permDoc.nav
    const ac = permDoc.account

    const dashboard: NavItem = {
      title:    "Dashboard",
      url:      appendId("/dashboard"),
      icon:     LayoutDashboard,
      isActive: p === "/dashboard" || p.startsWith("/dashboard"),
    }

    const enabledServiceKeys = Object.keys(sv).filter(k => sv[k] && SERVICE_MAP[k])
    const serviceItems = enabledServiceKeys.map(k => ({
      title:    SERVICE_MAP[k].title,
      url:      appendId(SERVICE_MAP[k].path),
      icon:     SERVICE_MAP[k].icon,
      isActive: p.startsWith(SERVICE_MAP[k].path),
    }))

    const servicesEntry: NavItem[] = serviceItems.length === 0 ? [] : [{
      title:    "Services",
      url:      "#",
      icon:     LayoutDashboard,
      isActive: serviceItems.some(s => p.startsWith(s.url.split("?")[0])),
      items:    serviceItems.map(s => ({ title: s.title, url: s.url })),
    }]

    const teamItem: NavItem = {
      title: "Team", url: "#", icon: Users,
      isActive: p.startsWith("/admin/staff") || p.startsWith("/admin/logs"),
      items: [
        { title: "Staff Directory",   url: appendId("/admin/staff") },
        { title: "Activity Logs",     url: appendId("/admin/logs") },
        { title: "Service Schedules", url: appendId("/appointments/slots") },
      ],
    }

    const adminItem: NavItem = {
      title: "Admin", url: "#", icon: ShieldCheck,
      isActive: p.startsWith("/admin/permissions") || p.startsWith("/admin/protocols"),
      items: [
        { title: "Access Rights", url: appendId("/admin/permissions") },
        { title: "Protocols",     url: appendId("/admin/protocols") },
        { title: "Team Matrix",   url: appendId("/admin/assignment-matrix") },
      ],
    }

    const analyticsItem: NavItem = {
      title: "Analytics", url: appendId("/analytics"), icon: BarChart3,
      isActive: p.startsWith("/analytics"),
    }

    const accountSubItems = [
      ...(ac.viewProfile ? [{ title: "Profile",  url: appendId("/account/profile") }]    : []),
      { title: "Security", url: appendId("/account/security") },
      ...(ac.preferences  ? [{ title: "Settings", url: appendId("/account/preferences") }] : []),
    ]

    const accountItem: NavItem = {
      title: "My Account", url: "#", icon: CircleUser,
      isActive: p.startsWith("/account"),
      items: accountSubItems,
    }

    const main: NavItem[] = [
      dashboard,
      ...servicesEntry,
      ...(nv.team      ? [teamItem]      : []),
      ...(nv.admin     ? [adminItem]     : []),
      ...(nv.analytics ? [analyticsItem] : []),
      accountItem,
    ]

    const secondary: NavItem[] = [
      ...(nv.systemSettings ? [{ title: "System Settings", url: appendId("/admin/system-settings"), icon: Settings2 }] : []),
      ...(nv.helpCenter     ? [{ title: "Help Center",     url: appendId("/docs"),     icon: BookOpen  }] : []),
    ]

    return { navMain: main, navSecondary: secondary }
  }, [permsLoaded, permDoc, pathname, appendId])

  const dept            = userDetails.Department?.trim()
  const role            = userDetails.Role?.trim()
  const enabledServices = Object.values(permDoc.services).filter(Boolean).length
  const isGuest         = !userId

  return (
    <Sidebar
      variant="sidebar"
      collapsible="offcanvas"
      className="border-r border-zinc-200/80 bg-[#FAFAFA] z-40"
      {...props}
    >

      {/* ── HEADER ── */}
      <SidebarHeader className="p-0 bg-white border-b border-zinc-100 flex-shrink-0">
        <SidebarMenu className="p-3">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-transparent px-0 h-auto rounded-none"
            >
              <Link
                href={appendId("/dashboard")}
                className="flex flex-col items-start gap-3 w-full group text-left no-underline focus-visible:outline-none"
              >
                {/* Brand */}
                <div className="flex items-center gap-3 w-full">
                  <div className="size-10 rounded-xl bg-[#E33636] flex items-center justify-center shadow-md shadow-red-200/60 transition-all duration-200 group-hover:scale-95 flex-shrink-0">
                    <img src="/disruptive.png" className="w-6 h-6 invert" alt="DSI" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-black uppercase tracking-tighter text-zinc-900 leading-none">
                      DSI Connect
                    </span>
                    <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-[0.18em] mt-0.5">
                      Enterprise Platform
                    </span>
                  </div>
                </div>

                {/* User context card */}
                {isLoading ? (
                  <div className="w-full h-[58px] bg-zinc-50 border border-zinc-100 rounded-xl animate-pulse" />
                ) : isGuest ? (
                  <div className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-zinc-300" />
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Guest Session</p>
                    </div>
                  </div>
                ) : dept ? (
                  <div className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl group-hover:bg-zinc-100 transition-colors duration-150">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[7px] font-bold text-zinc-400 uppercase tracking-[0.18em] leading-none mb-1">Active Session</p>
                        <p className="text-[12px] font-black text-zinc-900 truncate leading-none">
                          {userDetails.Firstname || "User"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full ${getDeptStyle(dept)}`}>
                          {dept.length > 10 ? dept.slice(0, 8) + "…" : dept}
                        </span>
                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full ${getRoleStyle(role)}`}>
                          {role || "MEMBER"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-zinc-100">
                      <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[7px] font-bold text-emerald-600 uppercase tracking-[0.18em]">Live</span>
                      {permsLoaded && enabledServices > 0 && (
                        <>
                          <div className="h-2 w-px bg-zinc-200 mx-0.5" />
                          <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-[0.18em]">
                            {enabledServices} service{enabledServices !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Loading profile…</p>
                    </div>
                  </div>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── CONTENT ── */}
      <SidebarContent className="gap-0 py-2 overflow-y-auto scrollbar-hide flex-1">
        {!permsLoaded ? (
          <SidebarSkeleton />
        ) : (
          <>
            <NavMain items={navMain} />
            
            {/* ── DEPARTMENT QUICK ACTIONS ── */}
            {dept && !isGuest && (
              <>
                <div className="px-3 py-2">
                  <div className="h-px bg-zinc-100" />
                </div>
                <div className="px-3 space-y-2">
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.18em] px-2">
                    Quick Actions
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(() => {
                      const d = dept.toUpperCase()
                      const r = role?.toUpperCase() || "MEMBER"
                      
                      // Department-specific quick actions
                      const actions: { icon: any; label: string; href: string; color: string; show?: () => boolean }[] = [
                        { 
                          icon: Plus, label: "New Request", href: appendId("/request/job/add"), 
                          color: "bg-blue-50 text-blue-600 hover:bg-blue-100",
                          show: () => ["SALES", "ENGINEERING", "IT"].includes(d)
                        },
                        { 
                          icon: Package, label: "SPF Request", href: appendId("/request/product"), 
                          color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",
                          show: () => ["SALES", "PROCUREMENT", "IT"].includes(d)
                        },
                        { 
                          icon: CalendarCheck, label: "Schedule", href: appendId("/appointments/site-visit/add"), 
                          color: "bg-amber-50 text-amber-600 hover:bg-amber-100",
                          show: () => ["ENGINEERING", "SALES", "IT"].includes(d)
                        },
                        { 
                          icon: Target, label: "My Tasks", href: appendId("/dashboard?tab=My Tasks"), 
                          color: "bg-violet-50 text-violet-600 hover:bg-violet-100",
                          show: () => true
                        },
                        { 
                          icon: Users, label: "Staff Pulse", href: appendId("/admin/staff"), 
                          color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100",
                          show: () => ["MANAGER", "SUPER ADMIN"].includes(r)
                        },
                        { 
                          icon: Activity, label: "Analytics", href: appendId("/analytics"), 
                          color: "bg-rose-50 text-rose-600 hover:bg-rose-100",
                          show: () => ["MANAGER", "SUPER ADMIN", "LEADER"].includes(r)
                        },
                      ]
                      
                      return actions
                        .filter(a => !a.show || a.show())
                        .slice(0, 6)
                        .map((action, i) => (
                          <Link
                            key={i}
                            href={action.href}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-xl ${action.color} transition-all active:scale-95 group`}
                          >
                            <action.icon className="w-4 h-4 mb-1" />
                            <span className="text-[9px] font-bold">{action.label}</span>
                          </Link>
                        ))
                    })()}
                  </div>
                </div>
                
                {/* ── PRODUCTIVITY TIPS ── */}
                <div className="px-3 mt-3">
                  <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-3 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[9px] font-black uppercase tracking-wider text-zinc-300">
                        {dept.toUpperCase()} Tip
                      </span>
                    </div>
                    <p className="text-[10px] font-medium text-zinc-200 leading-relaxed">
                      {(() => {
                        const tips: Record<string, string> = {
                          ENGINEERING: "Use the Assignment Matrix to manage your PIC assignments efficiently.",
                          SALES: "Check client pipeline daily to stay on top of opportunities.",
                          PROCUREMENT: "Monitor testing schedules to ensure timely product releases.",
                          IT: "Review system logs regularly to maintain platform stability.",
                        }
                        return tips[dept.toUpperCase()] || "Stay organized with your daily task list."
                      })()}
                    </p>
                    <Link 
                      href={appendId("/docs")}
                      className="inline-flex items-center gap-1 mt-2 text-[9px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Learn more <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </>
            )}
            
            {navSecondary.length > 0 && (
              <>
                <div className="px-3 py-2">
                  <div className="h-px bg-zinc-100" />
                </div>
                <NavSecondary items={navSecondary} />
              </>
            )}
          </>
        )}
      </SidebarContent>

      {/* ── FOOTER ── */}
      <SidebarFooter className="border-t border-zinc-100 bg-white p-3 flex-shrink-0">
        <NavUser
          user={{
            id:     userDetails.UserId,
            name:   isLoading ? "Loading…" : isGuest ? "Guest"
              : `${userDetails.Firstname} ${userDetails.Lastname}`.trim() || "User",
            email:  userDetails.Email || (isGuest ? "guest@dsiconnect.com" : ""),
            avatar: userDetails.profilePicture || "/avatars/default.jpg",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}