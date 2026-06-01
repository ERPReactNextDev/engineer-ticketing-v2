"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { db } from "@/lib/firebase"
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import {
  format, isSameDay, startOfDay,
  eachDayOfInterval, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, isSameMonth, addMonths, subMonths
} from "date-fns"
import {
  Plus, Search, RotateCcw, Calendar, Clock, Users,
  CheckCircle2, XCircle, LayoutGrid, ChevronRight, ChevronLeft,
  Loader2, CalendarDays, ListFilter, Activity, ShieldCheck,
  Star, DoorOpen, Sparkles, ArrowRight
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  PENDING:   { label: "Pending",   color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-400" },
  CONFIRMED: { label: "Confirmed", color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500" },
  COMPLETED: { label: "Completed", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  CANCELLED: { label: "Cancelled", color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-400" },
  REJECTED:  { label: "Rejected",  color: "text-zinc-600",    bg: "bg-zinc-50",    border: "border-zinc-200",    dot: "bg-zinc-400" },
}
function getStatusMeta(s: string) {
  return STATUS_META[s?.toUpperCase()] || STATUS_META.PENDING
}

function SkeletonRow() {
  return (
    <div className="p-4 border-b border-zinc-50 animate-pulse flex items-center gap-3">
      <div className="size-10 rounded-2xl bg-zinc-100 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-40 bg-zinc-100 rounded-full" />
        <div className="h-2 w-24 bg-zinc-100 rounded-full" />
      </div>
      <div className="h-6 w-20 bg-zinc-100 rounded-full hidden md:block" />
      <div className="h-6 w-16 bg-zinc-100 rounded-full" />
    </div>
  )
}

export default function MeetingRoomsPage() {
  const router = useRouter()
  const [userId, setUserId] = React.useState<string | null>(null)
  const [userRole, setUserRole] = React.useState("")
  const [userDept, setUserDept] = React.useState("")
  const [bookings, setBookings] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [filterStatus, setFilterStatus] = React.useState<string | null>(null)
  const [view, setView] = React.useState<"list" | "calendar">("list")
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [actionBooking, setActionBooking] = React.useState<any | null>(null)
  const [actionType, setActionType] = React.useState<"confirm" | "cancel" | "complete" | "reject" | null>(null)
  const [actionNote, setActionNote] = React.useState("")
  const [actionLoading, setActionLoading] = React.useState(false)

  React.useEffect(() => {
    const id = localStorage.getItem("userId") || ""
    const role = (localStorage.getItem("userRole") || "MEMBER").toUpperCase()
    const dept = (localStorage.getItem("userDepartment") || "").toUpperCase()
    setUserId(id); setUserRole(role); setUserDept(dept)
  }, [])

  React.useEffect(() => {
    // If userId not loaded yet, wait — but set a timeout fallback to avoid infinite skeleton
    if (!userId) {
      const t = setTimeout(() => setIsLoading(false), 3000)
      return () => clearTimeout(t)
    }
    setIsLoading(true)
    const hasGlobalAccess = userDept === "IT" || userDept === "ADMIN" ||
      ["SUPER ADMIN", "MANAGER", "LEADER"].includes(userRole)

    // Use simple queries without orderBy to avoid composite index requirements
    // Sort client-side instead
    const q = hasGlobalAccess
      ? query(collection(db, "room_bookings"))
      : query(collection(db, "room_bookings"), where("submittedBy", "==", userId))

    const unsub = onSnapshot(q,
      snap => {
        const data = snap.docs
          .map((d: any) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => {
            const ta = a.createdAt?.toMillis?.() || 0
            const tb = b.createdAt?.toMillis?.() || 0
            return tb - ta
          })
        setBookings(data)
        setIsLoading(false)
      },
      err => {
        console.error("room_bookings onSnapshot error:", err)
        setIsLoading(false)
      }
    )
    return () => unsub()
  }, [userId, userRole, userDept])

  const canManage = userDept === "IT" || userDept === "ADMIN" || ["SUPER ADMIN", "MANAGER", "LEADER"].includes(userRole)

  const filtered = React.useMemo(() => bookings.filter(b => {
    const matchSearch = (b.title + b.roomName + b.submittedByName + b.bookingNo).toLowerCase().includes(search.toLowerCase())
    return matchSearch && (!filterStatus || b.status === filterStatus)
  }), [bookings, search, filterStatus])

  const counts = {
    all: bookings.length,
    pending: bookings.filter(b => b.status === "PENDING").length,
    confirmed: bookings.filter(b => b.status === "CONFIRMED").length,
    completed: bookings.filter(b => b.status === "COMPLETED").length,
    cancelled: bookings.filter(b => b.status === "CANCELLED").length,
  }

  const today = startOfDay(new Date())
  const todayBookings = bookings.filter(b => {
    const d = b.bookingDate?.toDate ? b.bookingDate.toDate() : null
    return d && isSameDay(d, today) && b.status === "CONFIRMED"
  })

  const handleAction = async () => {
    if (!actionBooking || !actionType) return
    setActionLoading(true)
    const toastId = toast.loading("Processing...")
    try {
      const statusMap: Record<string, string> = { confirm: "CONFIRMED", cancel: "CANCELLED", complete: "COMPLETED", reject: "REJECTED" }
      const updates: any = { status: statusMap[actionType], updatedAt: serverTimestamp(), lastModifiedBy: userId }
      if (actionType === "confirm") { updates.confirmedAt = serverTimestamp(); updates.confirmedBy = userId }
      if (actionType === "cancel") { updates.cancelledAt = serverTimestamp(); updates.cancelReason = actionNote }
      if (actionType === "complete") updates.completedAt = serverTimestamp()
      if (actionType === "reject") { updates.rejectedAt = serverTimestamp(); updates.rejectReason = actionNote }
      await updateDoc(doc(db, "room_bookings", actionBooking.id), updates)
      toast.success(`Booking ${statusMap[actionType].toLowerCase()}`, { id: toastId })
      setActionBooking(null); setActionType(null); setActionNote("")
    } catch (e: any) {
      toast.error(e.message || "Action failed", { id: toastId })
    } finally { setActionLoading(false) }
  }

  const isEmpty = !isLoading && bookings.length === 0

  return (
    <ProtectedPageWrapper>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar userId={userId} />
        <SidebarInset className="bg-[#F8FAFA] min-h-screen">
          <PageHeader
            title="MEETING ROOMS"
            version="V1.0"
            showBackButton={true}
            trigger={<SidebarTrigger className="mr-2" />}
            actions={
              <div className="flex items-center gap-2">
                {canManage && (
                  <Button variant="outline" size="sm" onClick={() => router.push("/admin/meeting-rooms")}
                    className="h-8 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest border-zinc-200 hidden sm:flex items-center gap-1.5">
                    <ShieldCheck className="size-3" /> Manage Rooms
                  </Button>
                )}
                <Button size="sm" onClick={() => router.push("/appointments/meeting-rooms/add")}
                  className="h-8 px-4 rounded-xl bg-zinc-900 text-white text-[9px] font-black uppercase tracking-widest gap-1.5">
                  <Plus className="size-3" /> Book Room
                </Button>
              </div>
            }
          />

          <main className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-4 pb-24">

            {/* ── TODAY BANNER ── */}
            {todayBookings.length > 0 && (
              <div className="bg-zinc-900 rounded-[20px] p-4 text-white flex items-center gap-3">
                <div className="size-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <Activity className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Today</p>
                  <p className="text-[12px] font-black truncate">{todayBookings.length} meeting{todayBookings.length !== 1 ? "s" : ""} confirmed today</p>
                </div>
                <button onClick={() => router.push("/appointments/meeting-rooms/add")}
                  className="shrink-0 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all">
                  <Plus className="size-3" /> Book
                </button>
              </div>
            )}

            {/* ── EMPTY STATE ── */}
            {isEmpty ? (
              <div className="bg-white rounded-[28px] border border-zinc-200/60 shadow-sm overflow-hidden">
                {/* Hero empty state */}
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-zinc-900/5 blur-3xl rounded-full scale-150" />
                    <div className="relative size-20 bg-zinc-900 rounded-[24px] flex items-center justify-center shadow-xl shadow-zinc-900/20">
                      <DoorOpen className="size-9 text-white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 size-7 bg-[#E33636] rounded-xl flex items-center justify-center shadow-lg border-2 border-white">
                      <Sparkles className="size-3.5 text-white" />
                    </div>
                  </div>
                  <h2 className="text-[18px] font-black text-zinc-900 uppercase tracking-tight mb-2">No Bookings Yet</h2>
                  <p className="text-[12px] text-zinc-400 font-medium leading-relaxed max-w-[280px] mb-8">
                    Reserve a meeting room for your next team discussion, client presentation, or planning session.
                  </p>

                  {/* Feature highlights */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg mb-8">
                    {[
                      { icon: Calendar, label: "Pick a Date", desc: "Choose from available slots on the calendar" },
                      { icon: Clock, label: "Set Time", desc: "Book by the hour with conflict detection" },
                      { icon: Users, label: "Invite Team", desc: "Specify attendee count for the right room" },
                    ].map(({ icon: Icon, label, desc }) => (
                      <div key={label} className="flex flex-col items-center p-4 bg-zinc-50 rounded-2xl border border-zinc-100 text-center">
                        <div className="size-9 bg-white rounded-xl border border-zinc-200 flex items-center justify-center mb-2 shadow-sm">
                          <Icon className="size-4 text-zinc-600" />
                        </div>
                        <p className="text-[10px] font-black text-zinc-900 uppercase tracking-wide mb-1">{label}</p>
                        <p className="text-[9px] text-zinc-400 leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                    <Button onClick={() => router.push("/appointments/meeting-rooms/add")}
                      className="flex-1 h-12 rounded-2xl bg-zinc-900 text-white font-black text-[11px] uppercase tracking-widest gap-2 shadow-lg shadow-zinc-900/20 hover:bg-zinc-800 active:scale-[0.98] transition-all">
                      <Plus className="size-4" /> Book a Room
                    </Button>
                    {canManage && (
                      <Button variant="outline" onClick={() => router.push("/admin/meeting-rooms")}
                        className="flex-1 h-12 rounded-2xl border-zinc-200 font-black text-[11px] uppercase tracking-widest gap-2 hover:bg-zinc-50 active:scale-[0.98] transition-all">
                        <ShieldCheck className="size-4" /> Manage Rooms
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* ── FILTER PILLS ── */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {[
                    { key: null,        label: "All",       count: counts.all,       icon: LayoutGrid  },
                    { key: "PENDING",   label: "Pending",   count: counts.pending,   icon: Clock       },
                    { key: "CONFIRMED", label: "Confirmed", count: counts.confirmed, icon: CheckCircle2},
                    { key: "COMPLETED", label: "Completed", count: counts.completed, icon: Star        },
                    { key: "CANCELLED", label: "Cancelled", count: counts.cancelled, icon: XCircle     },
                  ].map(({ key, label, count, icon: Icon }) => (
                    <button key={key ?? "all"} onClick={() => setFilterStatus(key)}
                      className={cn(
                        "flex items-center gap-2 px-3.5 py-2 rounded-2xl border transition-all shrink-0",
                        filterStatus === key
                          ? "bg-zinc-900 border-zinc-900 text-white shadow-md"
                          : "bg-white border-zinc-200/60 text-zinc-500 hover:border-zinc-300"
                      )}>
                      <Icon className="size-3.5" />
                      <div className="text-left">
                        <p className={cn("text-[13px] font-black leading-none", filterStatus === key ? "text-white" : "text-zinc-900")}>{count}</p>
                        <p className="text-[7px] font-black uppercase tracking-widest mt-0.5">{label}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* ── SEARCH + VIEW TOGGLE ── */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                    <input
                      placeholder="Search by title, room, or booking ID..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 h-10 rounded-2xl border border-zinc-200 bg-white outline-none focus:border-zinc-400 transition-all text-[12px] font-medium"
                    />
                  </div>
                  <div className="flex gap-1 bg-white border border-zinc-200 rounded-2xl p-1 shrink-0">
                    <button onClick={() => setView("list")} className={cn("px-2.5 py-1.5 rounded-xl transition-all", view === "list" ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-zinc-700")}>
                      <ListFilter className="size-3.5" />
                    </button>
                    <button onClick={() => setView("calendar")} className={cn("px-2.5 py-1.5 rounded-xl transition-all", view === "calendar" ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-zinc-700")}>
                      <CalendarDays className="size-3.5" />
                    </button>
                  </div>
                  {(search || filterStatus) && (
                    <button onClick={() => { setSearch(""); setFilterStatus(null) }}
                      className="h-10 px-3 rounded-2xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 transition-all shrink-0 flex items-center gap-1.5 text-[9px] font-black uppercase">
                      <RotateCcw className="size-3" /> Reset
                    </button>
                  )}
                </div>

                {/* ── LIST VIEW ── */}
                {view === "list" && (
                  <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm overflow-hidden">
                    {/* Desktop header */}
                    <div className="hidden md:grid grid-cols-12 bg-zinc-50/80 px-5 py-3 border-b border-zinc-100 gap-3">
                      {[["Booking", "col-span-3"], ["Room", "col-span-2"], ["Date & Time", "col-span-2"], ["Booked By", "col-span-2"], ["Status", "col-span-2"], ["", "col-span-1"]].map(([h, cls]) => (
                        <div key={h} className={cn("text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400", cls)}>{h}</div>
                      ))}
                    </div>
                    <div className="divide-y divide-zinc-50">
                      {isLoading ? [...Array(4)].map((_, i) => <SkeletonRow key={i} />) :
                       filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Search className="size-8 text-zinc-200 mb-2" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">No results found</p>
                          <button onClick={() => { setSearch(""); setFilterStatus(null) }} className="mt-3 text-[9px] font-black uppercase text-zinc-500 underline">Clear filters</button>
                        </div>
                       ) : filtered.map(b => {
                        const meta = getStatusMeta(b.status)
                        const bDate = b.bookingDate?.toDate ? b.bookingDate.toDate() : null
                        return (
                          <div key={b.id} onClick={() => router.push(`/appointments/meeting-rooms/${b.id}`)}
                            className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 md:px-5 py-3.5 hover:bg-zinc-50/60 transition-colors cursor-pointer group">
                            {/* Mobile: compact single row */}
                            <div className="md:hidden flex items-center gap-3">
                              <div className={cn("size-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0", b.priority === "URGENT" ? "bg-red-600" : "bg-zinc-900")}>
                                {b.roomName?.charAt(0) || "M"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-black text-zinc-900 uppercase truncate">{b.title}</p>
                                <p className="text-[9px] text-zinc-400">{b.roomName} · {bDate ? format(bDate, "MMM d") : "—"} · {b.startTime}–{b.endTime}</p>
                              </div>
                              <span className={cn("shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black border", meta.color, meta.bg, meta.border)}>
                                <span className={cn("size-1.5 rounded-full", meta.dot)} />{meta.label}
                              </span>
                            </div>
                            {/* Desktop: grid columns */}
                            <div className="hidden md:flex md:col-span-3 items-center gap-3">
                              <div className={cn("size-9 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0", b.priority === "URGENT" ? "bg-red-600" : "bg-zinc-900")}>
                                {b.roomName?.charAt(0) || "M"}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-black text-zinc-900 uppercase truncate">{b.title}</p>
                                <p className="text-[9px] font-mono text-zinc-400">{b.bookingNo}</p>
                              </div>
                            </div>
                            <div className="hidden md:flex md:col-span-2 items-center">
                              <div>
                                <p className="text-[11px] font-bold text-zinc-700 uppercase">{b.roomName}</p>
                                {b.floor && <p className="text-[9px] text-zinc-400">{b.floor}{b.building ? ` · ${b.building}` : ""}</p>}
                              </div>
                            </div>
                            <div className="hidden md:flex md:col-span-2 items-center">
                              <div>
                                <p className="text-[11px] font-bold text-zinc-700">{bDate ? format(bDate, "MMM d, yyyy") : "—"}</p>
                                <p className="text-[9px] text-zinc-400">{b.startTime} – {b.endTime}</p>
                              </div>
                            </div>
                            <div className="hidden md:flex md:col-span-2 items-center">
                              <div>
                                <p className="text-[11px] font-bold text-zinc-700 truncate">{b.submittedByName || "—"}</p>
                                <p className="text-[9px] text-zinc-400 uppercase">{b.submittedByDept}</p>
                              </div>
                            </div>
                            <div className="hidden md:flex md:col-span-2 items-center">
                              <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black border", meta.color, meta.bg, meta.border)}>
                                <span className={cn("size-1.5 rounded-full", meta.dot)} />{meta.label}
                              </span>
                            </div>
                            <div className="hidden md:flex md:col-span-1 items-center justify-end">
                              <ChevronRight className="size-4 text-zinc-300 group-hover:text-zinc-900 group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── CALENDAR VIEW ── */}
                {view === "calendar" && (
                  <CalendarView bookings={bookings} currentMonth={currentMonth} onMonthChange={setCurrentMonth} router={router} />
                )}
              </>
            )}
          </main>

          {/* Mobile FAB */}
          <button
            onClick={() => router.push("/appointments/meeting-rooms/add")}
            className="md:hidden fixed bottom-6 right-5 z-50 size-14 rounded-full bg-zinc-900 text-white shadow-2xl flex items-center justify-center border-4 border-white active:scale-90 transition-transform">
            <Plus className="size-6" />
          </button>
        </SidebarInset>
      </SidebarProvider>

      {/* Action Dialog */}
      <Dialog open={!!actionBooking} onOpenChange={open => { if (!open) { setActionBooking(null); setActionType(null); setActionNote("") } }}>
        <DialogContent className="max-w-sm rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="text-[13px] font-black uppercase tracking-tight">
              {actionType === "confirm" ? "Confirm Booking" : actionType === "cancel" ? "Cancel Booking" : actionType === "complete" ? "Mark Complete" : "Reject Booking"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {actionBooking && (
              <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[11px] font-black text-zinc-900">{actionBooking.title}</p>
                <p className="text-[9px] text-zinc-400 mt-0.5">{actionBooking.roomName} · {actionBooking.startTime}–{actionBooking.endTime}</p>
              </div>
            )}
            {(actionType === "cancel" || actionType === "reject") && (
              <Textarea placeholder={actionType === "cancel" ? "Reason for cancellation..." : "Reason for rejection..."}
                value={actionNote} onChange={e => setActionNote(e.target.value)}
                className="rounded-xl border-zinc-200 min-h-[80px] resize-none" />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setActionBooking(null); setActionType(null) }} className="flex-1 rounded-xl h-11 text-[10px] font-black uppercase">Cancel</Button>
              <Button onClick={handleAction}
                disabled={actionLoading || ((actionType === "cancel" || actionType === "reject") && !actionNote.trim())}
                className={cn("flex-1 rounded-xl h-11 text-[10px] font-black uppercase gap-2",
                  actionType === "confirm" ? "bg-blue-600 hover:bg-blue-700" :
                  actionType === "complete" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700")}>
                {actionLoading ? <Loader2 className="size-4 animate-spin" /> : null} Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedPageWrapper>
  )
}

function CalendarView({ bookings, currentMonth, onMonthChange, router }: any) {
  const firstDay = startOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: startOfWeek(firstDay), end: endOfWeek(endOfMonth(currentMonth)) })
  const today = startOfDay(new Date())
  return (
    <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-zinc-100">
        <h3 className="text-[12px] font-black text-zinc-900 uppercase tracking-tight">{format(currentMonth, "MMMM yyyy")}</h3>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onMonthChange(subMonths(currentMonth, 1))} className="size-8 flex items-center justify-center rounded-xl border border-zinc-200 hover:bg-zinc-50">
            <ChevronLeft className="size-4 text-zinc-400" />
          </button>
          <button onClick={() => onMonthChange(new Date())} className="px-3 h-8 rounded-xl border border-zinc-200 text-[9px] font-black uppercase hover:bg-zinc-50">Today</button>
          <button onClick={() => onMonthChange(addMonths(currentMonth, 1))} className="size-8 flex items-center justify-center rounded-xl border border-zinc-200 hover:bg-zinc-50">
            <ChevronRight className="size-4 text-zinc-400" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50/50">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d: any) => (
          <div key={d} className="py-2 text-center text-[9px] font-black text-zinc-400 uppercase tracking-widest">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day: Date, i: number) => {
          const dayBookings = bookings.filter((b: any) => {
            const d = b.bookingDate?.toDate ? b.bookingDate.toDate() : null
            return d && isSameDay(d, day) && b.status !== "CANCELLED"
          })
          const isToday = isSameDay(day, today)
          const isCurrentMonth = isSameMonth(day, firstDay)
          return (
            <div key={i} className={cn("min-h-[80px] p-1.5 border-r border-b border-zinc-50", !isCurrentMonth && "opacity-30 bg-zinc-50/30", i % 7 === 6 && "border-r-0")}>
              <span className={cn("size-6 flex items-center justify-center rounded-lg text-[11px] font-black", isToday ? "bg-zinc-900 text-white" : "text-zinc-500")}>{format(day, "d")}</span>
              <div className="mt-1 space-y-0.5">
                {dayBookings.slice(0, 2).map((b: any, bi: number) => {
                  const meta = getStatusMeta(b.status)
                  return (
                    <div key={bi} onClick={() => router.push(`/appointments/meeting-rooms/${b.id}`)}
                      className={cn("px-1.5 py-0.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity border", meta.bg, meta.border)}>
                      <p className={cn("text-[8px] font-black truncate", meta.color)}>{b.startTime} {b.title}</p>
                    </div>
                  )
                })}
                {dayBookings.length > 2 && <p className="text-[7px] font-black text-zinc-400 pl-1">+{dayBookings.length - 2}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
