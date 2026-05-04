"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { 
  Plus, Search, ChevronRight, Activity, RotateCcw,
  Ticket, Wrench, User2, Loader2, CheckCircle2, ShieldCheck,
  Calendar as CalendarIcon, Clock, LayoutGrid, XCircle, ArrowRight,
  User, Building2, MapPin, ClipboardList, Info, Sparkles,
  ChevronLeft, ChevronDown, ListFilter, CalendarDays,
  Target, TrendingUp, AlertCircle, CheckCircle, BarChart3,
  HelpCircle, Lightbulb, Bell, ListChecks, Users, ChevronUp
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  addDays,
  isWithinInterval
} from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// FIREBASE
import { db } from "@/lib/firebase"
import { collection, onSnapshot, query, orderBy, where, getDoc, getDocs, doc } from "firebase/firestore"

// CUSTOM COMPONENTS
import { PageHeader } from "@/components/page-header"
import { SiteVisitCounterAdmin } from "@/components/site-visit-counter-admin"
import { SLATracker } from "@/components/sla-tracker"
import { WorkloadBalancer } from "@/components/workload-balancer"
import { TeamPerformance } from "@/components/team-performance"
import { QuickActions } from "@/components/quick-actions"

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  PENDING: {
    label: "Pending Request",
    color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400",
  },
  CONFIRMED: {
    label: "Request Completed",
    color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500",
  },
  COMPLETED: {
    label: "Request Acknowledge",
    color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500",
  },
}

const FILTERS = [
  { key: null,        label: "All Visits", icon: LayoutGrid,    variant: "default" },
  { key: "PENDING",   label: "Pending",    icon: Clock,         variant: "warning" },
  { key: "CONFIRMED", label: "Confirmed",  icon: ClipboardList, variant: "blue"    },
  { key: "COMPLETED", label: "Completed",  icon: CheckCircle2,  variant: "emerald" },
]

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function getStatusMeta(status: string) {
  const s = (status || "").toUpperCase().trim()
  return STATUS_META[s] || { label: status, color: "text-zinc-500", bg: "bg-zinc-50", border: "border-zinc-200", dot: "bg-zinc-300" }
}

function DashboardCard({ label, value, subValue, icon: Icon, colorClass, loading }: any) {
  return (
    <div className="flex-1 bg-white rounded-xl md:rounded-2xl p-3 md:p-4 border border-zinc-200/60 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all min-w-0">
      <div className={cn("p-2.5 rounded-xl flex-shrink-0", colorClass)}>
        <Icon className="size-4 md:size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          {loading ? (
            <div className="h-4 w-12 bg-zinc-100 rounded animate-pulse" />
          ) : (
            <p className="text-[14px] md:text-[16px] font-black text-zinc-900 leading-none truncate tracking-tight">{value}</p>
          )}
        </div>
        <p className="text-[8px] font-black uppercase text-zinc-400 tracking-[0.1em] truncate">{label}</p>
      </div>
    </div>
  )
}

function StatPill({ label, count, isActive, onClick, loading }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all flex-shrink-0 active:scale-95",
        isActive 
          ? "bg-zinc-900 border-zinc-900 text-white shadow-md shadow-zinc-200" 
          : "bg-white border-zinc-200/60 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"
      )}
    >
      <div className="text-left">
        {loading ? (
          <div className="h-3 w-3 bg-zinc-100 rounded animate-pulse" />
        ) : (
          <p className={cn("text-[13px] font-black leading-none", isActive ? "text-white" : "text-zinc-900")}>{count}</p>
        )}
        <p className={cn("text-[7px] font-black uppercase tracking-widest mt-1 whitespace-nowrap", isActive ? "text-zinc-400" : "text-zinc-400")}>{label}</p>
      </div>
    </button>
  )
}

function GuideItem({ icon: Icon, title, description, colorClass }: any) {
  return (
    <div className="flex gap-4 p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 hover:bg-white hover:shadow-sm transition-all group">
      <div className={cn("p-2.5 rounded-xl flex-shrink-0 self-start", colorClass)}>
        <Icon size={18} />
      </div>
      <div>
        <h4 className="text-[13px] font-black text-zinc-900 uppercase tracking-tight mb-1">{title}</h4>
        <p className="text-[11px] font-bold text-zinc-500 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

function UserGuideDialog({ open, onOpenChange }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] border-none shadow-2xl p-0 bg-white scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent">
        <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-10 px-8 py-6 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-lg">
              <HelpCircle size={22} />
            </div>
            <div>
              <h2 className="text-[20px] font-black text-zinc-900 tracking-tight">
                Quick Help Guide
              </h2>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Simple ways to manage your visits</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Basics */}
          <section>
            <div className="mb-4">
              <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-wide">The Basics</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <GuideItem 
                icon={Plus} 
                title="Create New Visit" 
                description="Click the '+ New Visit' button to schedule a technician. Fill in the client name and the date you need them."
                colorClass="bg-zinc-900 text-white"
              />
              <GuideItem 
                icon={Search} 
                title="Find Records Fast" 
                description="Use the search bar to find any client or technician name instantly. No more scrolling through long lists!"
                colorClass="bg-blue-50 text-blue-600"
              />
            </div>
          </section>

          {/* Views */}
          <section>
            <div className="mb-4">
              <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-wide">Better Views</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <GuideItem 
                icon={CalendarDays} 
                title="Calendar View" 
                description="Switch to the Calendar to see visits plotted on dates. It's like your personal work calendar!"
                colorClass="bg-emerald-50 text-emerald-600"
              />
              <GuideItem 
                icon={ListFilter} 
                title="Easy Filtering" 
                description="Click the status pills (like 'Pending' or 'Closed') to only see the visits you care about right now."
                colorClass="bg-amber-50 text-amber-600"
              />
            </div>
          </section>

          {/* Tips */}
          <div className="bg-zinc-900 rounded-2xl p-6 text-white flex items-center justify-between gap-6 overflow-hidden relative">
            <div className="relative z-10">
              <h4 className="text-[15px] font-black mb-1">Quick Reminders!</h4>
              <ul className="text-[11px] font-medium text-zinc-400 space-y-2 list-disc pl-4">
                <li><span className="text-white">Red Dots</span> mean the visit is still waiting for action.</li>
                <li><span className="text-white">Blue Dots</span> mean the schedule is already confirmed.</li>
                <li><span className="text-white">Green Dots</span> mean the job is successfully finished!</li>
              </ul>
            </div>
            <Lightbulb className="text-amber-400 flex-shrink-0 relative z-10" size={40} />
            <div className="absolute -right-10 -bottom-10 size-40 bg-white/5 rounded-full blur-3xl" />
          </div>
        </div>

        <div className="p-8 pt-0 flex justify-end">
          <Button 
            onClick={() => onOpenChange(false)}
            className="h-12 px-8 rounded-2xl bg-zinc-900 text-white font-black text-[12px] uppercase tracking-widest hover:bg-zinc-800 transition-all"
          >
            Got it, thanks!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SkeletonRow() {
  return (
    <div className="px-6 py-5 animate-pulse">
      <div className="hidden md:grid grid-cols-[1fr_2fr_1fr_1.5fr_1fr_44px] gap-6 items-center">
        <div className="h-4 w-16 bg-zinc-100 rounded-full" />
        <div className="h-4 w-32 bg-zinc-100 rounded-full" />
        <div className="h-4 w-24 bg-zinc-100 rounded-full" />
        <div className="h-4 w-28 bg-zinc-100 rounded-full" />
        <div className="h-6 w-20 bg-zinc-100 rounded-lg" />
        <div className="size-8 rounded-xl bg-zinc-100" />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   CALENDAR VIEW COMPONENTS
───────────────────────────────────────────── */
function CalendarView({ visits, currentMonth, onMonthChange, router, staffNames }: any) {
  const firstDay = startOfMonth(currentMonth)
  const lastDay = endOfMonth(currentMonth)
  const startDate = startOfWeek(firstDay)
  const endDate = endOfWeek(lastDay)
  
  const days = eachDayOfInterval({ start: startDate, end: endDate })

  return (
    <div className="bg-white rounded-[32px] border border-zinc-200/60 shadow-sm overflow-hidden animate-in fade-in zoom-in duration-300">
      <div className="flex items-center justify-between p-6 border-b border-zinc-100">
        <div>
          <h3 className="text-[15px] font-black text-zinc-900 uppercase tracking-tight">{format(currentMonth, 'MMMM yyyy')}</h3>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Operational Schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onMonthChange(subMonths(currentMonth, 1))} className="size-9 p-0 rounded-xl"><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())} className="px-3 h-9 rounded-xl font-black text-[10px] uppercase tracking-wider">Today</Button>
          <Button variant="outline" size="sm" onClick={() => onMonthChange(addMonths(currentMonth, 1))} className="size-9 p-0 rounded-xl"><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-zinc-100">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="py-3 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-50/50">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayVisits = visits.filter((v: any) => isSameDay(new Date(v.date), day))
          const isToday = isSameDay(day, new Date())
          const isSelectedMonth = isSameMonth(day, firstDay)

          return (
            <div key={i} className={cn(
              "min-h-[120px] p-2 border-r border-b border-zinc-100 transition-colors hover:bg-zinc-50/30",
              !isSelectedMonth && "bg-zinc-50/50 opacity-40",
              i % 7 === 6 && "border-r-0"
            )}>
              <div className="flex justify-between items-center mb-2">
                <span className={cn(
                  "text-[11px] font-black size-6 flex items-center justify-center rounded-lg",
                  isToday ? "bg-zinc-900 text-white shadow-md shadow-zinc-200" : "text-zinc-500"
                )}>{format(day, 'd')}</span>
                {dayVisits.length > 0 && <span className="text-[9px] font-black text-zinc-400">{dayVisits.length}</span>}
              </div>
              
              <div className="space-y-1.5">
                {dayVisits.slice(0, 3).map((v: any) => {
                  const meta = getStatusMeta(v.status)
                  return (
                    <div 
                      key={v.fullId} 
                      onClick={() => router.push(`/appointments/site-visit/${v.fullId}`)}
                      className={cn(
                        "p-1.5 rounded-lg border cursor-pointer transition-all active:scale-95",
                        meta.bg, meta.border
                      )}
                    >
                      <p className={cn("text-[9px] font-black uppercase truncate leading-none", meta.color)}>{v.site}</p>
                      <p className="text-[7px] font-bold text-zinc-400 truncate mt-1">
                        {v.tech === "UNASSIGNED" ? "TBD" : (staffNames[v.tech] || v.tech)}
                      </p>
                    </div>
                  )
                })}
                {dayVisits.length > 3 && (
                  <p className="text-[8px] font-black text-zinc-300 uppercase tracking-widest text-center mt-1">+{dayVisits.length - 3} More</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   INSIGHTS COMPONENTS
───────────────────────────────────────────── */
function RoleInsights({ user, visits, staffNames, setShowGuide, subordinateIds }: any) {
  const isManager = user.role === "MANAGER"
  const isTSM = user.role === "TSM"
  const isIT = user.dept === "IT"
  const isSales = user.dept === "SALES"
  const hasSubordinates = subordinateIds && subordinateIds.length > 0

  const next48Hours = visits.filter((v: any) => {
    const d = new Date(v.date)
    return isWithinInterval(d, { start: new Date(), end: addDays(new Date(), 2) }) && v.status !== "COMPLETED"
  })

  const myPending = visits.filter((v: any) => v.status === "PENDING" && v.submittedBy === user.id)
  const teamPending = visits.filter((v: any) => v.status === "PENDING" && subordinateIds?.includes(v.submittedBy))

  const completionRate = visits.length > 0 
    ? (visits.filter((v: any) => v.status === "COMPLETED").length / visits.length) * 100 
    : 0

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
      {/* Dynamic Widget 1: Personal Agenda / Team Pipeline */}
      <div className="bg-white rounded-xl p-3 border border-zinc-200/60 shadow-sm flex items-center justify-between group overflow-hidden relative">
        <div className="flex items-center gap-2.5">
          <div className="size-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0">
            {isSales ? <TrendingUp size={16} /> : <Target size={16} />}
          </div>
          <div>
            <h4 className="text-[10px] font-black text-zinc-900 uppercase tracking-tight leading-none">
              {hasSubordinates ? "Team Pipeline" : (isSales ? "Sales Pipeline" : "Work Agenda")}
            </h4>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base font-black text-zinc-900 leading-none">
                {hasSubordinates ? teamPending.length + myPending.length : (isSales ? myPending.length : next48Hours.length)}
              </span>
              <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Active</span>
            </div>
          </div>
        </div>
        <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter text-right leading-tight max-w-[70px]">
          {hasSubordinates ? "Team pending" : (isSales ? "Pending" : "Next 48h")}
        </p>
      </div>

      {/* Dynamic Widget 2: Operational Health - Compact */}
      <div className="bg-white rounded-xl p-3 border border-zinc-200/60 shadow-sm flex items-center justify-between group">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="size-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 border border-emerald-100 flex-shrink-0">
            <CheckCircle size={16} />
          </div>
          <div className="flex-1 pr-2">
            <h4 className="text-[10px] font-black text-zinc-900 uppercase tracking-tight leading-none">
              {hasSubordinates ? "Team Closure" : "Closure Rate"}
            </h4>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-zinc-50 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${completionRate}%` }} />
              </div>
              <span className="text-[10px] font-black text-emerald-600">{completionRate.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Widget 3: Personnel Load or Quick Tips */}
      {(isManager || isTSM || isIT) ? (
        <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 shadow-sm flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="size-8 bg-white/10 rounded-lg flex items-center justify-center text-white flex-shrink-0">
              {hasSubordinates ? <Users size={16} /> : <BarChart3 size={16} />}
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-tight leading-none">
                {hasSubordinates ? "Team Capacity" : "Active Load"}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base font-black leading-none">
                  {hasSubordinates ? subordinateIds.length : Object.keys(staffNames).length}
                </span>
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                  {hasSubordinates ? "Members" : "PICs"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center -space-x-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="size-5 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[7px] font-black text-zinc-500">
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div 
          onClick={() => setShowGuide(true)}
          className="bg-white rounded-xl p-3 border border-zinc-200/60 shadow-sm flex items-center gap-2.5 cursor-pointer hover:bg-zinc-50 transition-all group"
        >
          <div className="size-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 border border-blue-100 flex-shrink-0 group-hover:scale-110 transition-transform">
            <HelpCircle size={16} />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-zinc-900 uppercase tracking-tight leading-none">Need Help?</h4>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5 leading-tight">
              Click for guide
            </p>
          </div>
          <div className="ml-auto">
            <ChevronRight size={12} className="text-zinc-300 group-hover:text-zinc-900 transition-colors" />
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * @name SiteVisitListPage
 * @protocol Shared Engineering/IT Pool / Filtered Sales View
 * @version 2.8.0-ProductivityPlus
 */
export default function SiteVisitListPage() {
  const router = useRouter()
  const [user, setUser] = React.useState<{ id: string | null; dept: string; role: string; refId: string; name: string }>({ id: null, dept: "", role: "", refId: "", name: "" })
  const [isUserLoading, setIsUserLoading] = React.useState(true)
  const [visits, setVisits] = React.useState<any[]>([])
  const [subordinateIds, setSubordinateIds] = React.useState<string[]>([])
  const [subordinateDetails, setSubordinateDetails] = React.useState<{id: string, name: string, role: string}[]>([])
  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null)
  const [isDataLoading, setIsDataLoading] = React.useState(true)
  const [selectedStatus, setSelectedStatus] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [staffNames, setStaffNames] = React.useState<Record<string, string>>({})
  const [allStaff, setAllStaff] = React.useState<any[]>([])
  const [allProtocols, setAllProtocols] = React.useState<Record<string, string>>({})
  
  // Helper to resolve protocol ID to name
  const resolveProtocolNames = React.useCallback((protocolIds: string[] | string): string => {
    if (!protocolIds) return "Standard Engagement"
    const ids = Array.isArray(protocolIds) ? protocolIds : [protocolIds]
    const names = ids.map(id => allProtocols[id] || id)
    return names.join(" + ") || "Standard Engagement"
  }, [allProtocols])
  
  // Helper to resolve user name from ID (handles both MongoDB _id and ReferenceID)
  const resolveUserName = React.useCallback((userId: string): string => {
    if (!userId) return "—"
    // Check staffNames first (PIC names)
    if (staffNames[userId]) return staffNames[userId]
    // Check subordinate details
    const subordinate = subordinateDetails.find(s => s.id === userId)
    if (subordinate) return subordinate.name
    // Check all staff from MongoDB by _id
    const staffById = allStaff.find(s => s._id === userId)
    if (staffById) return `${staffById.Firstname || ""} ${staffById.Lastname || ""}`.trim()
    // Check all staff by ReferenceID (for TSM/Manager fields)
    const staffByRef = allStaff.find(s => s.ReferenceID === userId)
    if (staffByRef) return `${staffByRef.Firstname || ""} ${staffByRef.Lastname || ""}`.trim()
    return userId.slice(0, 8) + "..." // Fallback to truncated ID
  }, [staffNames, subordinateDetails, allStaff])
  
  // New Productivity States
  const [view, setView] = React.useState<"list" | "calendar">("list")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [showGuide, setShowGuide] = React.useState(false)
  const [showManagementDashboard, setShowManagementDashboard] = React.useState(false)
  const PAGE_SIZE = 10

  // 1. IDENTITY & DEPARTMENT RETRIEVAL
  React.useEffect(() => {
    const storedId = localStorage.getItem("userId")
    if (!storedId) { setIsUserLoading(false); return; }

    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(storedId)}`)
        const data = await res.json()
        
        // Get role from firestore for accuracy
        const userDoc = await getDoc(doc(db, "users", storedId))
        const firestoreRole = (userDoc.exists() ? (userDoc.data().Role || userDoc.data().role || "MEMBER") : "MEMBER").toUpperCase()

        const name = `${data.Firstname || ""} ${data.Lastname || ""}`.trim()
        const referenceId = (data.ReferenceID || "").toUpperCase()
        
        /**
         * ROLE DETECTION STRATEGY:
         * - For SALES dept: Use MongoDB Position as primary (supports TSM/TSA hierarchy)
         * - For other depts: Use Firebase Role as primary (IT, Engineering, etc.)
         * - Fallback to Firebase Role if Position is empty/generic
         */
        const dept = (data.Department || "").toUpperCase()
        const position = (data.Position || "").toUpperCase()
        const isSalesDept = dept === "SALES"
        
        // Sales-specific role detection based on Position
        const isTSM = isSalesDept 
            ? (position.includes("TERRITORY SALES MANAGER") && !position.includes("ASSOCIATE"))
            : (firestoreRole === "TSM" || firestoreRole === "TERRITORY SALES MANAGER")
        
        const isTSA = isSalesDept && position.includes("TERRITORY SALES ASSOCIATE")
        
        const isManager = isSalesDept
            ? (position.includes("SALES HEAD") || position.includes("MANAGER"))
            : (firestoreRole === "MANAGER" || firestoreRole === "SALES HEAD")
        
        // Determine final role priority: Manager > TSM > TSA > Firestore Role
        let finalRole = firestoreRole
        if (isManager) finalRole = "MANAGER"
        else if (isTSM) finalRole = "TSM"
        else if (isTSA) finalRole = "TSA"

        setUser({ 
          id: storedId, 
          dept: data.Department?.toUpperCase() || "SALES",
          role: finalRole,
          refId: referenceId,
          name
        })

        // Fetch subordinates if role is TSM or MANAGER
        if (isTSM || isManager) {
          const usersRes = await fetch('/api/user')
          const allUsers: any[] = await usersRes.json()
          let subs: any[] = []
          
          const clean = (n: string) => (n || "").replace(/,/g, "").replace(/\s+/g, " ").trim().toUpperCase()
          const myCleanName = clean(name)

          if (isTSM) {
            // TSM can only see TSAs (MEMBER role) that have THIS TSM assigned
            // Exclude other TSMs and users with empty TSM field
            subs = allUsers.filter(u => {
              // Skip if this user is also a TSM (prevent cross-visibility)
              const uRole = (u.Role || u.role || "MEMBER").toUpperCase()
              const uPosition = (u.Position || "").toUpperCase()
              if (uRole === "TSM" || uPosition.includes("TERRITORY SALES MANAGER")) return false

              // Check if this user has the current TSM assigned to them
              const uTSM = clean(u.TSM)
              const uTSMName = clean(u.TSMName)
              const uTSM_low = clean(u.tsm)
              const uTSMName_low = clean(u.tsmName)
              
              // Must have a non-empty TSM field that matches current user
              const hasTSMAssigned = (uTSM && uTSM === myCleanName) || 
                                     (uTSM && uTSM === referenceId) ||
                                     (uTSMName && uTSMName === myCleanName) || 
                                     (uTSM_low && uTSM_low === myCleanName) ||
                                     (uTSM_low && uTSM_low === referenceId) || 
                                     (uTSMName_low && uTSMName_low === myCleanName)
              return hasTSMAssigned
            })
          } else if (isManager) {
            // Manager can see all TSMs and TSAs under them
            subs = allUsers.filter(u => {
              const uMan = clean(u.Manager)
              const uManName = clean(u.ManagerName)
              const uMan_low = clean(u.manager)
              const uManName_low = clean(u.managerName)
              const hasManagerAssigned = (uMan && uMan === myCleanName) || 
                                         (uMan && uMan === referenceId) ||
                                         (uManName && uManName === myCleanName) || 
                                         (uMan_low && uMan_low === myCleanName) ||
                                         (uMan_low && uMan_low === referenceId) || 
                                         (uManName_low && uManName_low === myCleanName)
              return hasManagerAssigned
            })
          }
          setSubordinateIds(subs.map(u => u._id))
          setSubordinateDetails(subs.map(u => ({ 
            id: u._id, 
            name: `${u.Firstname || ""} ${u.Lastname || ""}`.trim(),
            role: u.Role || "TSA"
          })))
        }
      } catch (error) { 
        console.error("Profile Retrieval Error:", error) 
      } finally { 
        setIsUserLoading(false) 
      }
    }
    fetchUser()

    const fetchStaff = async () => {
      try {
        const res = await fetch('/api/user')
        const allUsers = await res.json()
        
        // Create a map of ReferenceID to name for quick lookup
        const names: Record<string, string> = {}
        allUsers.forEach((user: any) => {
          const fullName = `${user.Firstname || ''} ${user.Lastname || ''}`.trim()
          if (user.ReferenceID) {
            names[user.ReferenceID] = fullName
          }
        })
        setStaffNames(names)
        setAllStaff(allUsers)
      } catch (e) { console.error(e) }
    }
    fetchStaff()
    
    // Fetch protocols from Firestore for ID to name resolution
    const fetchProtocols = async () => {
      try {
        const protocolsRef = collection(db, 'protocols')
        const protocolsSnap = await getDocs(protocolsRef)
        const protocolsMap: Record<string, string> = {}
        protocolsSnap.docs.forEach(doc => {
          const data = doc.data()
          protocolsMap[doc.id] = data.label || data.name || data.protocolName || doc.id
        })
        console.log('[Protocols] Loaded:', Object.keys(protocolsMap).length, 'protocols')
        console.log('[Protocols] Sample:', Object.entries(protocolsMap).slice(0, 3))
        setAllProtocols(protocolsMap)
      } catch (e) { console.error('Error fetching protocols:', e) }
    }
    fetchProtocols()
  }, [])

  // 2. LIVE DATA SYNC WITH ROLE-BASED FILTERING
  React.useEffect(() => {
    if (isUserLoading || !user.id) return;

    setIsDataLoading(true)
    const baseCollection = collection(db, "appointments")
    let q;

    const userDept = user.dept.toUpperCase();
    const userRole = user.role.toUpperCase();
    
    /**
     * VISIBILITY PROTOCOL:
     * - IT, ENGINEERING, SUPER ADMIN, MANAGER, LEADER: Global visibility
     * - TSM (SALES): Can see their own AND all TSA visits
     * - TSA (SALES): Restricted to personal records (submittedBy matches userId)
     * - OTHERS (MEMBER): Restricted to personal records (submittedBy matches userId)
     */
    const hasGlobalAccess = userDept === "IT" || userDept === "ENGINEERING" || ["SUPER ADMIN", "LEADER"].includes(userRole);
    const isTSM = userRole === "TSM" || userRole.includes("TERRITORY SALES MANAGER");
    const isManager = userRole === "MANAGER";

    if (hasGlobalAccess) {
      q = query(baseCollection, orderBy("createdAt", "desc"));
    } else {
      q = query(baseCollection, orderBy("createdAt", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let liveData = snapshot.docs.map(doc => {
        const data = doc.data()
        const rawDate = data.appointmentDate?.toDate ? data.appointmentDate.toDate() : new Date()
        
        // Look up TSA in allStaff to get their details including TSM and Manager
        const tsaUser = allStaff.find(u => u._id === data.submittedBy || u.UserId === data.submittedBy)
        const tsaName = tsaUser ? `${tsaUser.Firstname || ""} ${tsaUser.Lastname || ""}`.trim() : (data.submittedByName || data.tsaName)
        
        // Get TSM and Manager ReferenceIDs from TSA's record
        const tsmRefId = tsaUser?.TSM || data.tsm
        const managerRefId = tsaUser?.Manager || data.Manager || data.salesHead
        
        // Filter out placeholder values
        const isValidRef = (ref: string) => ref && !ref.includes("NOT_SET") && !ref.includes("---") && ref.length > 2
        const validTsmRef = isValidRef(tsmRefId) ? tsmRefId : null
        const validManagerRef = isValidRef(managerRefId) ? managerRefId : null
        
        // Look up TSM and Manager names by their ReferenceIDs
        const tsmUser = validTsmRef ? allStaff.find(u => u.ReferenceID === validTsmRef) : null
        const managerUser = validManagerRef ? allStaff.find(u => u.ReferenceID === validManagerRef) : null
        
        const tsmName = tsmUser ? `${tsmUser.Firstname || ""} ${tsmUser.Lastname || ""}`.trim() : (validTsmRef || null)
        const managerName = managerUser ? `${managerUser.Firstname || ""} ${managerUser.Lastname || ""}`.trim() : (validManagerRef || null)
        
        return {
          id: doc.id.slice(-6).toUpperCase(),
          fullId: doc.id,
          ...data,
          site: data.client || "Client Not Specified",
          date: rawDate.toLocaleDateString('en-CA'), 
          status: data.status?.toUpperCase() || "PENDING",
          tech: data.pic || "UNASSIGNED",
          rawProtocols: data.protocols,
          type: resolveProtocolNames(data.protocols),
          submittedBy: data.submittedBy,
          submittedByRole: data.submittedByRole,
          submittedByName: tsaName,
          tsaName: tsaName,
          tsmName: tsmName,
          tsm: tsmRefId,
          managerName: managerName,
          salesHead: managerRefId,
          pic: data.pic
        }
      })

      // DEBUG: Log ID information to diagnose filtering issues
      console.log("[SiteVisit Debug] User ID:", user.id);
      console.log("[SiteVisit Debug] Subordinate IDs:", subordinateIds);
      console.log("[SiteVisit Debug] Total records from Firestore:", liveData.length);
      console.log("[SiteVisit Debug] Sample data:", liveData.slice(0, 3).map(v => ({ 
        id: v.id, 
        site: v.site, 
        type: v.type
      })));
      
      // DEBUG: Log TSA/TSM/Manager lookup results
      console.log("[SiteVisit Debug] allStaff count:", allStaff.length);
      console.log("[SiteVisit Debug] Sample lookups:", liveData.slice(0, 3).map(v => ({
        submittedBy: v.submittedBy,
        tsaName: v.tsaName,
        tsm: v.tsm,
        tsmName: v.tsmName,
        manager: v.salesHead,
        managerName: v.managerName
      })));
      
      // Client-side filtering for non-admin users
      if (!hasGlobalAccess) {
        if (isTSM || isManager) {
            // TSM and MANAGER can see their own AND all their subordinate visits
            liveData = liveData.filter(v => {
                const match = v.submittedBy === user.id || subordinateIds.includes(v.submittedBy);
                if (!match) {
                    console.log(`[SiteVisit Debug] Filtered out - submittedBy: "${v.submittedBy}" !== user.id: "${user.id}", not in subordinates`);
                }
                return match;
            });
        } else {
            // TSA and other Members ONLY see their own visits
            liveData = liveData.filter(v => v.submittedBy === user.id);
        }
      }
      
      console.log("[SiteVisit Debug] Records after filtering:", liveData.length);
      setVisits(liveData)
      setIsDataLoading(false)
    }, (error) => {
      console.error("Firestore Sync Error:", error)
      setIsDataLoading(false)
    })

    return () => unsubscribe()
  }, [user, isUserLoading, subordinateIds])

  const filteredVisits = React.useMemo(() => {
    return visits.filter(v => {
      const s = `${v.site} ${v.id} ${v.tech} ${v.type} ${v.siteVisitNo || ""}`.toLowerCase()
      const matchesSearch = s.includes(searchQuery.toLowerCase())
      const matchesStatus = selectedStatus ? v.status === selectedStatus : true
      const matchesMember = selectedMemberId ? v.submittedBy === selectedMemberId : true
      return matchesSearch && matchesStatus && matchesMember
    })
  }, [visits, searchQuery, selectedStatus, selectedMemberId])

  // Re-resolve protocol names when allProtocols is loaded/updated
  React.useEffect(() => {
    if (visits.length > 0 && Object.keys(allProtocols).length > 0) {
      setVisits(prevVisits => prevVisits.map(v => ({
        ...v,
        type: resolveProtocolNames(v.rawProtocols || v.protocols)
      })))
    }
  }, [allProtocols])

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / PAGE_SIZE))
  const paginatedVisits = React.useMemo(() => {
    return filteredVisits.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  }, [filteredVisits, currentPage])

  const handleAddNew = () => router.push('/appointments/site-visit/add')
  const handleReset = () => { setSelectedStatus(null); setSelectedMemberId(null); setSearchQuery(""); setCurrentPage(1); }

  const counts = {
    all: visits.length,
    pending: visits.filter(v => v.status === "PENDING").length,
    confirmed: visits.filter(v => v.status === "CONFIRMED").length,
    completed: visits.filter(v => v.status === "COMPLETED").length,
  }

  return (
    <ProtectedPageWrapper>
      <TooltipProvider delayDuration={100}>
        <SidebarProvider defaultOpen={false}>
          <AppSidebar userId={user.id} />
          <SidebarInset className="bg-[#F8FAFA] pb-24 md:pb-10 min-h-screen m-0 rounded-none border-none shadow-none overflow-visible">
          
          <PageHeader 
            title="SITE VISIT ENGAGEMENTS" 
            version="V2.8" 
            showBackButton={true}
            trigger={<SidebarTrigger className="mr-2" />}
            actions={
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1">
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Dept:</span>
                  <span className="text-[10px] font-black text-zinc-900 uppercase">{user.dept || "—"}</span>
                </div>
                <Button 
                  onClick={() => setShowGuide(true)}
                  variant="outline"
                  className="h-8 w-8 p-0 rounded-lg bg-white border-zinc-200 text-zinc-400 hover:text-zinc-900 transition-all"
                >
                  <HelpCircle className="size-4" />
                </Button>
                <Button 
                  onClick={handleAddNew}
                  className="h-8 rounded-lg bg-zinc-900 text-white font-black uppercase text-[10px] tracking-wider px-4 hover:bg-zinc-800 transition-all shadow-sm flex items-center gap-2"
                >
                  <Plus className="size-3.5" /> 
                  <span className="hidden sm:inline">New Visit</span>
                </Button>
              </div>
            }
          />

          <main className="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
            
            {/* ── ROLE-SPECIFIC INSIGHTS ── */}
            {!isUserLoading && (
              <RoleInsights user={user} visits={visits} staffNames={staffNames} setShowGuide={setShowGuide} subordinateIds={subordinateIds} />
            )}

            {/* ── MANAGEMENT DASHBOARD (Collapsible) ── */}
            {!isUserLoading && (user.dept === "IT" || user.dept === "ENGINEERING" || ["TSM", "MANAGER", "LEADER", "SUPER ADMIN"].includes(user.role)) && (
              <div className="border border-zinc-200/60 rounded-xl bg-white overflow-hidden">
                <button
                  onClick={() => setShowManagementDashboard(!showManagementDashboard)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-50/80 hover:bg-zinc-100/80 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="size-3.5 text-zinc-500" />
                    <span className="text-[10px] font-black text-zinc-700 uppercase tracking-wider">Management Dashboard</span>
                    <span className="text-[9px] font-bold text-zinc-400">({visits.length} records)</span>
                  </div>
                  <ChevronDown className={cn("size-4 text-zinc-400 transition-transform", showManagementDashboard && "rotate-180")} />
                </button>
                
                {showManagementDashboard && (
                  <div className="p-3 space-y-3 border-t border-zinc-100">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {/* IT/ENGINEERING: SLA Tracker + Workload Balancer */}
                      {(user.dept === "IT" || user.dept === "ENGINEERING" || user.dept === "Engineering") && (
                        <>
                          <SLATracker 
                            visits={visits} 
                            userRole={user.role} 
                            userDept={user.dept} 
                          />
                          <WorkloadBalancer 
                            visits={visits} 
                            staff={allStaff} 
                            staffNames={staffNames}
                            userDept={user.dept}
                            userRole={user.role}
                          />
                        </>
                      )}

                      {/* TSM/MANAGER: Team Performance */}
                      {["TSM", "MANAGER", "LEADER", "SUPER ADMIN"].includes(user.role) && user.dept !== "IT" && user.dept !== "ENGINEERING" && (
                        <TeamPerformance 
                          visits={visits} 
                          teamMembers={subordinateDetails}
                          userRole={user.role}
                          userDept={user.dept}
                        />
                      )}

                      {/* TSA/MEMBER: Quick Actions - Compact */}
                      {["TSA", "MEMBER"].includes(user.role) && (
                        <QuickActions 
                          recentVisits={visits.slice(0, 3)}
                          userRole={user.role}
                          userDept={user.dept}
                          onCreateNew={() => router.push("/appointments/site-visit/new")}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── IT/ENGINEERING ADMIN BANNER ── */}
            {!isUserLoading && (user.dept === "IT" || user.dept === "ENGINEERING" || user.dept === "Engineering") && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                <ShieldCheck className="size-4 text-blue-500 flex-shrink-0" />
                <p className="text-[11px] font-black text-blue-700">
                  Administrative Access — viewing all records for {user.dept} and related personnel.
                </p>
              </div>
            )}

            {/* ── DASHBOARD STATS - Compact Horizontal ── */}
            <section className="flex flex-wrap md:flex-nowrap items-center gap-2">
              <div className="flex-1 min-w-[120px] bg-white rounded-xl p-2.5 border border-zinc-200/60 shadow-sm flex items-center gap-3">
                <div className="size-8 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-500 flex-shrink-0">
                  <Activity size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-zinc-900 leading-none">{counts.all}</p>
                  <p className="text-[7px] font-black uppercase text-zinc-400 tracking-widest mt-1 truncate">Total</p>
                </div>
              </div>
              <div className="flex-1 min-w-[120px] bg-white rounded-xl p-2.5 border border-zinc-200/60 shadow-sm flex items-center gap-3">
                <div className="size-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 flex-shrink-0">
                  <Clock size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-zinc-900 leading-none">{counts.pending}</p>
                  <p className="text-[7px] font-black uppercase text-zinc-400 tracking-widest mt-1 truncate">Pending</p>
                </div>
              </div>
              <div className="flex-1 min-w-[120px] bg-white rounded-xl p-2.5 border border-zinc-200/60 shadow-sm flex items-center gap-3">
                <div className="size-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
                  <CalendarIcon size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-zinc-900 leading-none">{counts.confirmed}</p>
                  <p className="text-[7px] font-black uppercase text-zinc-400 tracking-widest mt-1 truncate">Scheduled</p>
                </div>
              </div>
              <div className="flex-1 min-w-[120px] bg-white rounded-xl p-2.5 border border-zinc-200/60 shadow-sm flex items-center gap-3">
                <div className="size-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <CheckCircle2 size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-zinc-900 leading-none">{counts.completed}</p>
                  <p className="text-[7px] font-black uppercase text-zinc-400 tracking-widest mt-1 truncate">Closed</p>
                </div>
              </div>
            </section>

            {/* ── VIEW SWITCHER & FILTERS - Compact Header ── */}
            <div className="sticky top-[56px] md:top-[64px] z-[45] flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-3 bg-white/80 backdrop-blur-md px-3 py-2 rounded-2xl border border-zinc-200/40 shadow-sm transition-all">
              <div className="flex flex-wrap items-center gap-2 md:gap-4">
                {/* View Tabs - Ultra Compact */}
                <div className="flex p-1 bg-zinc-100 rounded-xl">
                  <button 
                    onClick={() => setView("list")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                      view === "list" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                    )}
                  >
                    <LayoutGrid size={12} /> List
                  </button>
                  <button 
                    onClick={() => setView("calendar")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                      view === "calendar" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                    )}
                  >
                    <CalendarDays size={12} /> Calendar
                  </button>
                </div>

                {/* Vertical Divider */}
                <div className="h-6 w-px bg-zinc-200 hidden md:block" />

                {/* Status Filters - Minimal */}
                <div className="hidden lg:flex items-center gap-1">
                  {FILTERS.map(f => (
                    <button
                      key={String(f.key)}
                      onClick={() => { setSelectedStatus(f.key); setCurrentPage(1); }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                        selectedStatus === f.key 
                          ? "bg-zinc-900 text-white shadow-sm" 
                          : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
                      )}
                    >
                      {f.label} ({String(f.key === null ? counts.all : counts[f.key.toLowerCase() as keyof typeof counts])})
                    </button>
                  ))}
                </div>

                {/* Team Member Filter - For TSM/Managers */}
                {subordinateDetails.length > 0 && (
                  <>
                    <div className="h-5 w-px bg-zinc-200 hidden md:block" />
                    <Select 
                      value={selectedMemberId || "all"} 
                      onValueChange={(val) => { setSelectedMemberId(val === "all" ? null : val); setCurrentPage(1); }}
                    >
                      <SelectTrigger className="w-[130px] md:w-[160px] h-8 bg-zinc-100 border-none text-[9px] font-black uppercase tracking-widest text-zinc-600 rounded-lg focus:ring-1 focus:ring-zinc-900">
                        <User2 size={10} className="text-zinc-400 mr-1" />
                        <SelectValue placeholder="All Members" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-[10px] font-bold">All Members</SelectItem>
                        {subordinateDetails.map(sub => (
                          <SelectItem key={sub.id} value={sub.id} className="text-[10px] font-bold">{sub.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 flex-1 w-full md:max-w-[320px]">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-zinc-300 group-focus-within:text-zinc-800 transition-colors" />
                  <Input 
                    placeholder="Quick Search..." 
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-8 pr-8 h-8 rounded-lg bg-zinc-50 border-none outline-none focus:ring-1 focus:ring-zinc-900 transition-all text-[10px] font-bold"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-600">
                      <XCircle className="size-3" />
                    </button>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleReset} 
                  className="h-8 w-8 rounded-lg bg-white border-zinc-200 hover:bg-zinc-50 flex items-center justify-center p-0 flex-shrink-0"
                >
                  <RotateCcw className="size-3 text-zinc-400" />
                </Button>
              </div>
            </div>

            {/* ── MAIN CONTENT (LIST OR CALENDAR) ── */}
            {view === "list" ? (
              <div className="space-y-4">
                <div className="bg-white rounded-[28px] shadow-sm border border-zinc-200/60 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="hidden md:grid grid-cols-[70px_140px_1fr_90px_90px_90px_110px_32px] bg-zinc-50/80 px-4 py-2 border-b gap-3 items-center">
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-400">Ref_ID</span>
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-400">Client</span>
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-400">Support Category</span>
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-400">Schedule</span>
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-400">TSA</span>
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-400">PIC</span>
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-400">Status</span>
                    <span />
                  </div>

                  <div className="md:divide-y md:divide-zinc-50/80">
                    {isDataLoading ? (
                      Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                    ) : paginatedVisits.length === 0 ? (
                      <div className="py-24 flex flex-col items-center gap-3">
                        <div className="size-16 rounded-3xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                          <MapPin className="size-7 text-zinc-200" />
                        </div>
                        <p className="text-[11px] font-black uppercase text-zinc-300 tracking-widest text-center px-4">
                          {searchQuery ? `No visits matching "${searchQuery}"` : "No engagement records found"}
                        </p>
                        {(searchQuery || selectedStatus) && (
                          <button onClick={handleReset} className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1 hover:text-blue-700">
                            Clear all filters
                          </button>
                        )}
                      </div>
                    ) : (
                      paginatedVisits.map((item) => {
                        const meta = getStatusMeta(item.status)
                        return (
                          <div 
                            key={item.fullId}
                            onClick={() => router.push(`/appointments/site-visit/${item.fullId}`)}
                            className="group flex flex-col md:grid md:grid-cols-[70px_140px_1fr_90px_90px_90px_110px_32px] gap-3 md:gap-3 px-4 md:px-4 py-2.5 md:hover:bg-zinc-50/80 cursor-pointer transition-all md:border-b md:border-zinc-100 md:last:border-b-0 md:items-center"
                          >
                            {/* MOBILE VIEW - Card Layout */}
                            <Card className="md:hidden mb-2 cursor-pointer hover:shadow-md transition-shadow">
                              <CardContent className="p-3 space-y-2">
                                {/* Row 1: ID, Client, Status */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-[11px] font-black text-emerald-600 tracking-tight uppercase truncate">
                                      {item.siteVisitNo || `#${item.id}`}
                                    </span>
                                    <span className="text-[11px] font-black text-zinc-900 uppercase leading-tight truncate">{item.site}</span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className={cn("size-2 rounded-full", meta.dot)} />
                                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-wide border-0 bg-transparent", meta.color)}>
                                      {meta.label}
                                    </Badge>
                                  </div>
                                </div>
                                
                                {/* Row 2: Support Category */}
                                <div className="flex items-start gap-1">
                                  <span className="text-[8px] font-black text-blue-500 uppercase tracking-wider shrink-0 mt-0.5">Job:</span>
                                  <span className="text-[10px] font-bold text-zinc-700 leading-tight">{item.type}</span>
                                </div>
                                
                                {/* Row 2: Schedule */}
                                <div className="flex items-center gap-2 text-zinc-600">
                                  <CalendarIcon className="size-3 text-zinc-400" />
                                  <span className="text-[10px] font-bold">{item.date}</span>
                                </div>
                                
                                {/* Row 3: TSA + PIC */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="flex flex-col bg-zinc-50 rounded-lg p-2">
                                    <span className="text-[7px] font-black text-zinc-400 uppercase tracking-wider">TSA</span>
                                    <span className="text-[10px] font-bold text-zinc-700 truncate">{item.tsaName || item.submittedByName || resolveUserName(item.submittedBy) || "—"}</span>
                                  </div>
                                  <div className="flex flex-col bg-zinc-50 rounded-lg p-2">
                                    <span className="text-[7px] font-black text-zinc-400 uppercase tracking-wider">PIC</span>
                                    <span className="text-[10px] font-bold text-zinc-700 truncate">{item.tech === "UNASSIGNED" ? "TBD" : (staffNames[item.tech] || item.tech)}</span>
                                  </div>
                                </div>
                                
                              </CardContent>
                            </Card>

                            {/* DESKTOP VIEW - Table Layout */}
                            {/* SITE VISIT NUMBER */}
                            <div className="hidden md:flex items-center overflow-hidden">
                              <span className="text-[10px] font-black text-emerald-600 tracking-tight uppercase truncate">
                                {item.siteVisitNo || `#${item.id}`}
                              </span>
                            </div>

                            {/* Client */}
                            <div className="hidden md:flex items-center overflow-hidden" title={item.site}>
                              <p className="text-[10px] font-black text-zinc-900 uppercase tracking-tight leading-tight truncate">{item.site}</p>
                            </div>

                            {/* Support Category / Protocol */}
                            <div className="hidden md:flex items-start py-1">
                              <p className="text-[9px] font-bold text-blue-600 leading-tight">{item.type}</p>
                            </div>

                            {/* Schedule */}
                            <div className="hidden md:flex items-center gap-1.5 overflow-hidden">
                              <CalendarIcon className="size-3 text-zinc-400 flex-shrink-0" />
                              <span className="text-[10px] font-bold text-zinc-700 truncate">{item.date}</span>
                            </div>

                            {/* TSA */}
                            <div className="hidden md:flex flex-col overflow-hidden" title={item.tsaName || item.submittedByName || resolveUserName(item.submittedBy) || "—"}>
                              <p className="text-[9px] font-bold text-zinc-700 leading-tight truncate">
                                {item.tsaName || item.submittedByName || resolveUserName(item.submittedBy) || "—"}
                              </p>
                              {item.submittedByRole && (
                                <span className="text-[7px] font-black text-zinc-400 uppercase tracking-wider truncate">{item.submittedByRole}</span>
                              )}
                            </div>

                            {/* PIC */}
                            <div className="hidden md:flex items-center overflow-hidden" title={item.tech === "UNASSIGNED" ? "TBD" : (staffNames[item.tech] || item.tech)}>
                              <p className={cn("text-[9px] font-bold leading-tight truncate", item.tech === "UNASSIGNED" ? "text-zinc-400 italic" : "text-zinc-800")}>
                                {item.tech === "UNASSIGNED" ? "TBD" : (staffNames[item.tech] || item.tech)}
                              </p>
                            </div>

                            {/* Status */}
                            <div className="hidden md:flex items-center overflow-hidden">
                              <Badge variant="outline" className={cn("text-[8px] font-black uppercase tracking-wide border-0 bg-transparent whitespace-nowrap", meta.color)}>
                                <span className={cn("size-1.5 rounded-full mr-1.5 flex-shrink-0", meta.dot)} />
                                <span className="truncate">{meta.label}</span>
                              </Badge>
                            </div>

                            {/* Arrow */}
                            <div className="hidden md:flex items-center justify-center">
                              <ChevronRight className="size-4 text-zinc-300 group-hover:text-zinc-800 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Pagination Controls */}
                {!isDataLoading && totalPages > 1 && (
                  <div className="flex items-center justify-between px-2 py-4">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      Showing Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="rounded-xl h-9 px-4 font-black text-[10px] uppercase tracking-wider"
                      >
                        Prev
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className="rounded-xl h-9 px-4 font-black text-[10px] uppercase tracking-wider"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <CalendarView 
                visits={filteredVisits} 
                currentMonth={currentMonth} 
                onMonthChange={setCurrentMonth}
                router={router}
                staffNames={staffNames}
              />
            )}
          </main>

          {/* USER GUIDE DIALOG */}
          <UserGuideDialog open={showGuide} onOpenChange={setShowGuide} />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
    </ProtectedPageWrapper>
  )
}
