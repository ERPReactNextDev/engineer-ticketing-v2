"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { db } from "@/lib/firebase"
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, getDocs, Timestamp } from "firebase/firestore"
import { format, isSameDay, startOfDay } from "date-fns"
import {
  Clock, Users, Building2, Layers, Calendar, CheckCircle2,
  XCircle, Loader2, AlertCircle, Paperclip, ExternalLink,
  Star, Activity, Copy, Check, RefreshCw, ChevronLeft, ChevronRight,
  Download, Repeat, History, LogIn, LogOut, Bell, UserPlus
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  PENDING:   { label: "Pending Approval", color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-400" },
  CONFIRMED: { label: "Confirmed",        color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500" },
  COMPLETED: { label: "Completed",        color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  CANCELLED: { label: "Cancelled",        color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-400" },
  REJECTED:  { label: "Rejected",         color: "text-zinc-600",    bg: "bg-zinc-50",    border: "border-zinc-200",    dot: "bg-zinc-400" },
  RESCHEDULED: { label: "Rescheduled",    color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200",  dot: "bg-violet-500" },
}

const TIME_SLOTS = [
  "07:00","07:30","08:00","08:30","09:00","09:30",
  "10:00","10:30","11:00","11:30","12:00","12:30",
  "13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00","18:30",
  "19:00","19:30","20:00",
]
function timeToMinutes(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m }
function hasTimeConflict(bookings: any[], date: Date, start: string, end: string, excludeId: string) {
  return bookings
    .filter(b => {
      if (b.id === excludeId) return false
      if (!["PENDING","CONFIRMED"].includes(b.status)) return false
      const bd = b.bookingDate?.toDate ? b.bookingDate.toDate() : new Date(b.bookingDate)
      return isSameDay(bd, date)
    })
    .some(b => timeToMinutes(start) < timeToMinutes(b.endTime) && timeToMinutes(end) > timeToMinutes(b.startTime))
}

export default function BookingDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [userId, setUserId] = React.useState("")
  const [userRole, setUserRole] = React.useState("")
  const [userDept, setUserDept] = React.useState("")
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [note, setNote] = React.useState("")
  const [copied, setCopied] = React.useState(false)

  // Reschedule state
  const [showReschedule, setShowReschedule] = React.useState(false)
  const [rescheduleDate, setRescheduleDate] = React.useState<Date | null>(null)
  const [rescheduleStart, setRescheduleStart] = React.useState("")
  const [rescheduleEnd, setRescheduleEnd] = React.useState("")
  const [rescheduleNote, setRescheduleNote] = React.useState("")
  const [rescheduleLoading, setRescheduleLoading] = React.useState(false)
  const [roomBookings, setRoomBookings] = React.useState<any[]>([])
  const [calMonth, setCalMonth] = React.useState(new Date())
  const today = startOfDay(new Date())

  React.useEffect(() => {
    setUserId(localStorage.getItem("userId") || "")
    setUserRole((localStorage.getItem("userRole") || "MEMBER").toUpperCase())
    setUserDept((localStorage.getItem("userDepartment") || "").toUpperCase())
  }, [])

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, "room_bookings", id), snap => {
      if (snap.exists()) setData({ id: snap.id, ...snap.data() })
      setLoading(false)
    })
    return () => unsub()
  }, [id])

  // Fetch all active bookings for this room when reschedule dialog opens
  React.useEffect(() => {
    if (!showReschedule || !data?.roomId) return
    getDocs(query(
      collection(db, "room_bookings"),
      where("roomId", "==", data.roomId),
      where("status", "in", ["PENDING", "CONFIRMED"])
    )).then(snap => {
      setRoomBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }).catch(console.error)
  }, [showReschedule, data?.roomId])

  const canManage = userDept === "IT" || userDept === "ADMIN" || ["SUPER ADMIN", "MANAGER", "LEADER"].includes(userRole)
  const isOwner = data?.submittedBy === userId
  const canReschedule = (isOwner || canManage) && ["PENDING", "CONFIRMED"].includes(data?.status)
  const meta = data ? (STATUS_META[data.status] || STATUS_META.PENDING) : STATUS_META.PENDING
  const bDate = data?.bookingDate?.toDate ? data.bookingDate.toDate() : null

  const handleAction = async (action: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "REJECTED") => {
    if (!data) return
    setActionLoading(true)
    const toastId = toast.loading("Processing...")
    try {
      const updates: any = { status: action, updatedAt: serverTimestamp(), lastModifiedBy: userId }
      if (action === "CONFIRMED") { updates.confirmedAt = serverTimestamp(); updates.reminderSent = false }
      if (action === "CANCELLED") { updates.cancelledAt = serverTimestamp(); updates.cancelReason = note }
      if (action === "COMPLETED") updates.completedAt = serverTimestamp()
      if (action === "REJECTED") { updates.rejectedAt = serverTimestamp(); updates.rejectReason = note }
      await updateDoc(doc(db, "room_bookings", id), updates)
      toast.success(`Booking ${action.toLowerCase()}`, { id: toastId })
      setNote("")
    } catch (e: any) {
      toast.error(e.message || "Failed", { id: toastId })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleStart || !rescheduleEnd) return
    if (hasTimeConflict(roomBookings, rescheduleDate, rescheduleStart, rescheduleEnd, id)) {
      toast.error("That time slot conflicts with another booking")
      return
    }
    setRescheduleLoading(true)
    const toastId = toast.loading("Rescheduling...")
    try {
      await updateDoc(doc(db, "room_bookings", id), {
        bookingDate: Timestamp.fromDate(rescheduleDate),
        startTime: rescheduleStart,
        endTime: rescheduleEnd,
        duration: (() => {
          const mins = timeToMinutes(rescheduleEnd) - timeToMinutes(rescheduleStart)
          const h = Math.floor(mins / 60); const m = mins % 60
          return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`
        })(),
        status: "PENDING", // Reset to pending after reschedule — needs re-approval
        rescheduledAt: serverTimestamp(),
        rescheduledBy: userId,
        rescheduleNote: rescheduleNote.trim(),
        previousDate: data.bookingDate,
        previousStartTime: data.startTime,
        previousEndTime: data.endTime,
        updatedAt: serverTimestamp(),
      })
      toast.success("Booking rescheduled — pending re-approval", { id: toastId })
      setShowReschedule(false)
      setRescheduleDate(null); setRescheduleStart(""); setRescheduleEnd(""); setRescheduleNote("")
    } catch (e: any) {
      toast.error(e.message || "Reschedule failed", { id: toastId })
    } finally {
      setRescheduleLoading(false) }
  }

  // Calendar helpers
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate()
  const firstDay = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay()
  const availableEndTimes = React.useMemo(() => {
    if (!rescheduleStart) return []
    return TIME_SLOTS.filter(t => timeToMinutes(t) > timeToMinutes(rescheduleStart))
  }, [rescheduleStart])
  const rescheduleConflict = React.useMemo(() => {
    if (!rescheduleDate || !rescheduleStart || !rescheduleEnd) return false
    return hasTimeConflict(roomBookings, rescheduleDate, rescheduleStart, rescheduleEnd, id)
  }, [rescheduleDate, rescheduleStart, rescheduleEnd, roomBookings, id])

  const copyBookingNo = () => {
    if (!data?.bookingNo) return
    navigator.clipboard.writeText(data.bookingNo)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <ProtectedPageWrapper>
        <SidebarProvider defaultOpen={false}>
          <AppSidebar userId={userId} />
          <SidebarInset className="bg-[#F8FAFA] min-h-screen flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-zinc-300" />
          </SidebarInset>
        </SidebarProvider>
      </ProtectedPageWrapper>
    )
  }

  if (!data) {
    return (
      <ProtectedPageWrapper>
        <SidebarProvider defaultOpen={false}>
          <AppSidebar userId={userId} />
          <SidebarInset className="bg-[#F8FAFA] min-h-screen flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="size-10 text-zinc-200 mx-auto mb-3" />
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Booking not found</p>
              <Button variant="outline" onClick={() => router.back()} className="mt-4 rounded-xl text-[10px] font-black uppercase">Go Back</Button>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </ProtectedPageWrapper>
    )
  }

  return (
    <ProtectedPageWrapper>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar userId={userId} />
        <SidebarInset className="bg-[#F8FAFA] min-h-screen">
          <PageHeader
            title="MEETING ROOMS / BOOKING DETAIL"
            version="V1.0"
            showBackButton
            trigger={<SidebarTrigger className="mr-2" />}
          />

          <main className="p-4 md:p-6 max-w-4xl mx-auto w-full space-y-4 pb-24">

            {/* Status Banner */}
            <div className={cn("rounded-[24px] border p-5 flex items-center gap-4", meta.bg, meta.border)}>
              <div className={cn("size-12 rounded-2xl flex items-center justify-center", meta.bg)}>
                <span className={cn("size-3 rounded-full", meta.dot)} />
              </div>
              <div className="flex-1">
                <p className={cn("text-[14px] font-black uppercase tracking-tight", meta.color)}>{meta.label}</p>
                <p className="text-[10px] font-bold text-zinc-500 mt-0.5">
                  {data.status === "CONFIRMED" && data.confirmedAt ? `Confirmed · ${format(data.confirmedAt.toDate(), "MMM d, h:mm a")}` :
                   data.status === "CANCELLED" && data.cancelReason ? `Reason: ${data.cancelReason}` :
                   data.status === "REJECTED" && data.rejectReason ? `Reason: ${data.rejectReason}` :
                   "Awaiting admin approval"}
                </p>
              </div>
              <button onClick={copyBookingNo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/60 border border-white/80 text-[9px] font-black uppercase tracking-wide hover:bg-white transition-colors">
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {data.bookingNo}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Main Details */}
              <div className="md:col-span-8 space-y-4">

                {/* Booking Info */}
                <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5 space-y-4">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Booking Information</h3>
                  <div>
                    <p className="text-[20px] font-black text-zinc-900 uppercase tracking-tight">{data.title}</p>
                    {data.description && <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">{data.description}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <DetailItem icon={Calendar} label="Date" value={bDate ? format(bDate, "EEEE, MMMM d, yyyy") : "—"} />
                    <DetailItem icon={Clock} label="Time" value={`${data.startTime} – ${data.endTime} (${data.duration})`} />
                    <DetailItem icon={Users} label="Attendees" value={`${data.attendeeCount} person${data.attendeeCount !== 1 ? "s" : ""}`} />
                    <DetailItem icon={Activity} label="Priority" value={data.priority || "NORMAL"} highlight={data.priority === "URGENT"} />
                  </div>
                  {/* Tagged attendees */}
                  {data.attendees?.length > 0 && (
                    <div className="pt-3 border-t border-zinc-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Invited Attendees</p>
                      <div className="flex flex-wrap gap-1.5">
                        {data.attendees.map((a: any, i: number) => (
                          <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 rounded-full text-[9px] font-bold text-zinc-700">
                            <span className="size-4 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[7px] font-black">{a.name?.charAt(0)}</span>
                            {a.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Recurring info */}
                  {data.isRecurring && (
                    <div className="flex items-center gap-2 pt-3 border-t border-zinc-100">
                      <Repeat className="size-3.5 text-violet-500" />
                      <span className="text-[10px] font-bold text-violet-700 uppercase">Recurring · {data.recurringType}</span>
                    </div>
                  )}
                  {/* iCal export */}
                  <button onClick={() => {
                    if (!bDate) return
                    const start = new Date(bDate)
                    const [sh, sm] = data.startTime.split(":").map(Number)
                    const [eh, em] = data.endTime.split(":").map(Number)
                    start.setHours(sh, sm, 0)
                    const end = new Date(bDate)
                    end.setHours(eh, em, 0)
                    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g,"").split(".")[0] + "Z"
                    const ics = [
                      "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//DSI Connect//Meeting Rooms//EN",
                      "BEGIN:VEVENT",
                      `UID:${data.bookingNo}@dsiconnect`,
                      `DTSTART:${fmt(start)}`,
                      `DTEND:${fmt(end)}`,
                      `SUMMARY:${data.title}`,
                      `DESCRIPTION:${data.description || ""}`,
                      `LOCATION:${data.roomName}${data.floor ? ` - ${data.floor}` : ""}`,
                      "END:VEVENT","END:VCALENDAR"
                    ].join("\r\n")
                    const blob = new Blob([ics], { type: "text/calendar" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a"); a.href = url; a.download = `${data.bookingNo}.ics`; a.click()
                    URL.revokeObjectURL(url)
                    toast.success("Calendar file downloaded")
                  }} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-zinc-200 text-[9px] font-black uppercase text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-all">
                    <Download className="size-3.5" /> Export to Calendar (.ics)
                  </button>
                </div>

                {/* Room Info */}
                <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5 space-y-3">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Room Details</h3>
                  <div className="flex items-center gap-4">
                    <div className="size-14 rounded-2xl bg-zinc-900 flex items-center justify-center text-white font-black text-xl shadow-sm">
                      {data.roomName?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[15px] font-black text-zinc-900 uppercase">{data.roomName}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {data.floor && <span className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-1"><Layers className="size-2.5" />{data.floor}</span>}
                        {data.building && <span className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-1"><Building2 className="size-2.5" />{data.building}</span>}
                        <span className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-1"><Users className="size-2.5" />{data.capacity} max</span>
                      </div>
                    </div>
                  </div>
                  {data.amenities?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-100">
                      {data.amenities.map((a: string) => (
                        <span key={a} className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 text-[9px] font-bold uppercase">{a}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── AUDIT TRAIL ── */}
                <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5 space-y-3">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                    <History className="size-3.5" /> Activity History
                  </h3>
                  <div className="space-y-0">
                    {[
                      { label: "Submitted", at: data.createdAt, by: data.submittedByName, color: "bg-zinc-400" },
                      { label: "Confirmed", at: data.confirmedAt, by: null, color: "bg-blue-500" },
                      { label: "Rescheduled", at: data.rescheduledAt, by: null, note: data.rescheduleNote, color: "bg-violet-500" },
                      { label: "Checked In", at: data.checkedInAt, by: null, color: "bg-emerald-500" },
                      { label: "Checked Out", at: data.checkedOutAt, by: null, color: "bg-zinc-600" },
                      { label: "Completed", at: data.completedAt, by: null, color: "bg-emerald-600" },
                      { label: "Cancelled", at: data.cancelledAt, by: null, note: data.cancelReason, color: "bg-red-500" },
                      { label: "Rejected", at: data.rejectedAt, by: null, note: data.rejectReason, color: "bg-zinc-500" },
                    ].filter(e => e.at).map((event, i, arr) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`size-2.5 rounded-full mt-1 shrink-0 ${event.color}`} />
                          {i < arr.length - 1 && <div className="w-px flex-1 bg-zinc-100 my-1" />}
                        </div>
                        <div className="pb-3 min-w-0">
                          <p className="text-[10px] font-black text-zinc-900 uppercase">{event.label}</p>
                          <p className="text-[9px] text-zinc-400">{format(event.at.toDate(), "MMM d, yyyy · h:mm a")}{event.by ? ` · ${event.by}` : ""}</p>
                          {event.note && <p className="text-[9px] text-zinc-500 italic mt-0.5">"{event.note}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                  {data.fileUrl && (
                  <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-3">Attachment</h3>
                    <a href={data.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200 hover:bg-zinc-100 transition-colors">
                      <Paperclip className="size-4 text-zinc-500" />
                      <span className="text-[11px] font-bold text-zinc-700 flex-1 truncate">View Attachment</span>
                      <ExternalLink className="size-3.5 text-zinc-400" />
                    </a>
                  </div>
                )}
              </div>

              {/* Right Panel */}
              <div className="md:col-span-4 space-y-4">

                {/* Submitted By */}
                <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5 space-y-3">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Submitted By</h3>
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-2xl bg-zinc-900 flex items-center justify-center text-white font-black text-sm">
                      {data.submittedByName?.charAt(0) || "U"}
                    </div>
                    <div>
                      <p className="text-[12px] font-black text-zinc-900">{data.submittedByName || "—"}</p>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase">{data.submittedByDept}</p>
                    </div>
                  </div>
                  {data.createdAt && (
                    <p className="text-[9px] font-bold text-zinc-400 pt-2 border-t border-zinc-100">
                      Submitted {format(data.createdAt.toDate(), "MMM d, yyyy · h:mm a")}
                    </p>
                  )}
                </div>

                {/* Admin Actions */}
                {canManage && data.status === "PENDING" && (
                  <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5 space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Admin Actions</h3>
                    <Button onClick={() => handleAction("CONFIRMED")} disabled={actionLoading}
                      className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest gap-2">
                      {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      Confirm Booking
                    </Button>
                    <div className="space-y-2">
                      <Textarea placeholder="Reason for rejection (required)..." value={note} onChange={e => setNote(e.target.value)}
                        className="rounded-xl border-zinc-200 min-h-[70px] resize-none text-[11px]" />
                      <Button onClick={() => handleAction("REJECTED")} disabled={actionLoading || !note.trim()} variant="outline"
                        className="w-full h-10 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 font-black text-[10px] uppercase tracking-widest gap-2">
                        <XCircle className="size-4" /> Reject
                      </Button>
                    </div>
                  </div>
                )}

                {/* Mark Complete */}
                {canManage && data.status === "CONFIRMED" && (
                  <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5 space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Update Status</h3>
                    <Button onClick={() => handleAction("COMPLETED")} disabled={actionLoading}
                      className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest gap-2">
                      {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Star className="size-4" />}
                      Mark as Completed
                    </Button>
                  </div>
                )}

                {/* ── CHECK-IN / CHECK-OUT (owner or admin, confirmed bookings) ── */}
                {(isOwner || canManage) && data.status === "CONFIRMED" && (
                  <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5 space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                      <LogIn className="size-3.5" /> Check-In / Check-Out
                    </h3>
                    {!data.checkedInAt ? (
                      <Button onClick={async () => {
                        const toastId = toast.loading("Checking in...")
                        try {
                          await updateDoc(doc(db, "room_bookings", id), { checkedInAt: serverTimestamp(), checkedInBy: userId, updatedAt: serverTimestamp() })
                          toast.success("Checked in!", { id: toastId })
                        } catch { toast.error("Failed", { id: toastId }) }
                      }} className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest gap-2">
                        <LogIn className="size-4" /> Check In Now
                      </Button>
                    ) : !data.checkedOutAt ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <LogIn className="size-3.5 text-emerald-600" />
                          <span className="text-[10px] font-bold text-emerald-700">Checked in · {format(data.checkedInAt.toDate(), "h:mm a")}</span>
                        </div>
                        <Button onClick={async () => {
                          const toastId = toast.loading("Checking out...")
                          try {
                            await updateDoc(doc(db, "room_bookings", id), { checkedOutAt: serverTimestamp(), checkedOutBy: userId, status: "COMPLETED", completedAt: serverTimestamp(), updatedAt: serverTimestamp() })
                            toast.success("Checked out — booking completed!", { id: toastId })
                          } catch { toast.error("Failed", { id: toastId }) }
                        }} className="w-full h-11 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-[10px] uppercase tracking-widest gap-2">
                          <LogOut className="size-4" /> Check Out
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <LogIn className="size-3.5 text-emerald-600" />
                          <span className="text-[10px] font-bold text-emerald-700">In · {format(data.checkedInAt.toDate(), "h:mm a")}</span>
                        </div>
                        <div className="flex items-center gap-2 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                          <LogOut className="size-3.5 text-zinc-600" />
                          <span className="text-[10px] font-bold text-zinc-700">Out · {format(data.checkedOutAt.toDate(), "h:mm a")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── WAITLIST (non-owners when room is fully booked on that day) ── */}
                {!isOwner && data.status === "CONFIRMED" && (
                  <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5 space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                      <Bell className="size-3.5" /> Waitlist
                    </h3>
                    {data.waitlist?.includes(userId) ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                          <Bell className="size-3.5 text-amber-600" />
                          <span className="text-[10px] font-bold text-amber-700">You're on the waitlist — we'll notify you if this slot opens</span>
                        </div>
                        <Button variant="outline" onClick={async () => {
                          const newList = (data.waitlist || []).filter((w: string) => w !== userId)
                          await updateDoc(doc(db, "room_bookings", id), { waitlist: newList })
                          toast.success("Removed from waitlist")
                        }} className="w-full h-9 rounded-xl border-zinc-200 text-[9px] font-black uppercase">
                          Leave Waitlist
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={async () => {
                        const newList = [...(data.waitlist || []), userId]
                        await updateDoc(doc(db, "room_bookings", id), { waitlist: newList })
                        toast.success("Added to waitlist — you'll be notified if this slot opens")
                      }} variant="outline" className="w-full h-11 rounded-2xl border-amber-200 text-amber-700 hover:bg-amber-50 font-black text-[10px] uppercase tracking-widest gap-2">
                        <Bell className="size-4" /> Join Waitlist
                      </Button>
                    )}
                  </div>
                )}

                {/* Reschedule (owner or admin) */}
                {canReschedule && (
                  <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5 space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Reschedule</h3>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      Change the date or time of this booking. It will return to Pending and require re-approval.
                    </p>
                    <Button onClick={() => { setShowReschedule(true); setCalMonth(bDate || new Date()) }}
                      className="w-full h-11 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-[10px] uppercase tracking-widest gap-2">
                      <RefreshCw className="size-4" /> Reschedule Booking
                    </Button>
                  </div>
                )}

                {/* Cancel (owner or admin) */}
                {(isOwner || canManage) && ["PENDING", "CONFIRMED"].includes(data.status) && (
                  <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5 space-y-3">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Cancel Booking</h3>
                    <Textarea placeholder="Reason for cancellation..." value={note} onChange={e => setNote(e.target.value)}
                      className="rounded-xl border-zinc-200 min-h-[70px] resize-none text-[11px]" />
                    <Button onClick={() => handleAction("CANCELLED")} disabled={actionLoading || !note.trim()} variant="outline"
                      className="w-full h-10 rounded-2xl border-zinc-200 text-zinc-600 hover:bg-zinc-50 font-black text-[10px] uppercase tracking-widest gap-2">
                      {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                      Cancel Booking
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* ── RESCHEDULE DIALOG ── */}
      <Dialog open={showReschedule} onOpenChange={open => { if (!open) { setShowReschedule(false); setRescheduleDate(null); setRescheduleStart(""); setRescheduleEnd("") } }}>
        <DialogContent className="max-w-lg rounded-[28px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[13px] font-black uppercase tracking-tight flex items-center gap-2">
              <RefreshCw className="size-4 text-violet-600" /> Reschedule Booking
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Current booking info */}
            <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Current Schedule</p>
              <p className="text-[12px] font-black text-zinc-900">{data?.title}</p>
              <p className="text-[10px] text-zinc-500">{bDate ? format(bDate, "EEEE, MMMM d, yyyy") : "—"} · {data?.startTime} – {data?.endTime}</p>
            </div>

            {/* Mini Calendar */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                <p className="text-[11px] font-black text-zinc-900 uppercase">{format(calMonth, "MMMM yyyy")}</p>
                <div className="flex gap-1">
                  <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    className="size-7 flex items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-50">
                    <ChevronLeft className="size-3.5 text-zinc-400" />
                  </button>
                  <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                    className="size-7 flex items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-50">
                    <ChevronRight className="size-3.5 text-zinc-400" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 bg-zinc-50/50">
                {["S","M","T","W","T","F","S"].map((d,i) => (
                  <div key={i} className="py-1.5 text-center text-[8px] font-black text-zinc-400 uppercase">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 p-1 gap-0.5">
                {[...Array(firstDay)].map((_,i) => <div key={`e${i}`} />)}
                {[...Array(daysInMonth)].map((_,i) => {
                  const day = i + 1
                  const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), day)
                  const isPast = date < today
                  const isWknd = date.getDay() === 0 || date.getDay() === 6
                  const isSel = rescheduleDate && isSameDay(date, rescheduleDate)
                  const isTod = isSameDay(date, today)
                  return (
                    <button key={day} disabled={isPast || isWknd}
                      onClick={() => { setRescheduleDate(date); setRescheduleStart(""); setRescheduleEnd("") }}
                      className={cn(
                        "h-8 rounded-lg text-[10px] font-black transition-all",
                        isPast || isWknd ? "text-zinc-300 cursor-not-allowed" :
                        isSel ? "bg-violet-600 text-white shadow-sm" :
                        isTod ? "bg-zinc-900 text-white" :
                        "text-zinc-700 hover:bg-zinc-100"
                      )}>{day}</button>
                  )
                })}
              </div>
            </div>

            {/* Time pickers */}
            {rescheduleDate && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <p className="text-[10px] font-black text-zinc-700 uppercase tracking-wide">
                  {format(rescheduleDate, "EEEE, MMMM d")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Start Time</label>
                    <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                      {TIME_SLOTS.slice(0,-1).map(t => {
                        const blocked = roomBookings.some(b => {
                          if (b.id === id) return false
                          if (!["PENDING","CONFIRMED"].includes(b.status)) return false
                          const bd = b.bookingDate?.toDate ? b.bookingDate.toDate() : new Date(b.bookingDate)
                          if (!isSameDay(bd, rescheduleDate)) return false
                          return timeToMinutes(t) >= timeToMinutes(b.startTime) && timeToMinutes(t) < timeToMinutes(b.endTime)
                        })
                        return (
                          <button key={t} disabled={blocked}
                            onClick={() => { setRescheduleStart(t); setRescheduleEnd("") }}
                            className={cn("py-1.5 rounded-lg text-[9px] font-black border transition-all",
                              rescheduleStart === t ? "bg-violet-600 text-white border-violet-600" :
                              blocked ? "bg-red-50 text-red-300 border-red-100 cursor-not-allowed line-through" :
                              "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                            )}>{t}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">End Time</label>
                    {!rescheduleStart ? <p className="text-[9px] text-zinc-300 italic pt-2">Pick start first</p> : (
                      <div className="grid grid-cols-3 gap-1 max-h-[120px] overflow-y-auto">
                        {availableEndTimes.map(t => {
                          const conflict = hasTimeConflict(roomBookings, rescheduleDate, rescheduleStart, t, id)
                          return (
                            <button key={t} disabled={conflict}
                              onClick={() => setRescheduleEnd(t)}
                              className={cn("py-1.5 rounded-lg text-[9px] font-black border transition-all",
                                rescheduleEnd === t ? "bg-violet-600 text-white border-violet-600" :
                                conflict ? "bg-red-50 text-red-300 border-red-100 cursor-not-allowed line-through" :
                                "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                              )}>{t}</button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {rescheduleConflict && (
                  <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-[10px] font-bold text-red-600">
                    <AlertCircle className="size-3.5 shrink-0" /> Time conflict with another booking
                  </div>
                )}
              </div>
            )}

            {/* Note */}
            <Textarea placeholder="Reason for rescheduling (optional)..." value={rescheduleNote}
              onChange={e => setRescheduleNote(e.target.value)}
              className="rounded-xl border-zinc-200 min-h-[60px] resize-none text-[11px]" />

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowReschedule(false)} className="flex-1 rounded-xl h-11 text-[10px] font-black uppercase">Cancel</Button>
              <Button onClick={handleReschedule}
                disabled={rescheduleLoading || !rescheduleDate || !rescheduleStart || !rescheduleEnd || rescheduleConflict}
                className="flex-1 rounded-xl h-11 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase gap-2">
                {rescheduleLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Confirm Reschedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedPageWrapper>
  )
}

function DetailItem({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="size-8 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0">
        <Icon className="size-3.5 text-zinc-400" />
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
        <p className={cn("text-[12px] font-bold mt-0.5", highlight ? "text-red-600" : "text-zinc-900")}>{value}</p>
      </div>
    </div>
  )
}
