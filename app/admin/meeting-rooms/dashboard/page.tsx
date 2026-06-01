"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfDay, subDays } from "date-fns"
import {
  BarChart3, Calendar, Clock, Users, Building2,
  TrendingUp, CheckCircle2, XCircle, Star, Activity,
  DoorOpen, AlertTriangle, Loader2
} from "lucide-react"
import { toast } from "sonner"

export default function MeetingRoomDashboardPage() {
  const router = useRouter()
  const [userId, setUserId] = React.useState("")
  const [bookings, setBookings] = React.useState<any[]>([])
  const [rooms, setRooms] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setUserId(localStorage.getItem("userId") || "")
    const fetchAll = async () => {
      try {
        const [bookSnap, roomSnap] = await Promise.all([
          getDocs(collection(db, "room_bookings")),
          getDocs(collection(db, "meeting_rooms")),
        ])
        setBookings(bookSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setRooms(roomSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        toast.error("Failed to load data")
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const today = startOfDay(new Date())
  const weekStart = startOfWeek(today)
  const weekEnd = endOfWeek(today)
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const last30 = subDays(today, 30)

  // Stats
  const totalBookings = bookings.length
  const confirmed = bookings.filter(b => b.status === "CONFIRMED").length
  const completed = bookings.filter(b => b.status === "COMPLETED").length
  const cancelled = bookings.filter(b => b.status === "CANCELLED").length
  const pending = bookings.filter(b => b.status === "PENDING").length
  const todayBookings = bookings.filter(b => {
    const d = b.bookingDate?.toDate ? b.bookingDate.toDate() : null
    return d && isSameDay(d, today) && ["CONFIRMED", "PENDING"].includes(b.status)
  })

  // Room utilization — bookings per room (last 30 days)
  const roomUtilization = rooms.map(r => {
    const roomBookings = bookings.filter(b => {
      const d = b.bookingDate?.toDate ? b.bookingDate.toDate() : null
      return b.roomId === r.id && d && d >= last30 && ["CONFIRMED", "COMPLETED"].includes(b.status)
    })
    return { ...r, bookingCount: roomBookings.length, totalHours: roomBookings.reduce((s, b) => {
      const [sh, sm] = (b.startTime || "0:0").split(":").map(Number)
      const [eh, em] = (b.endTime || "0:0").split(":").map(Number)
      return s + ((eh * 60 + em) - (sh * 60 + sm)) / 60
    }, 0) }
  }).sort((a, b) => b.bookingCount - a.bookingCount)

  // Peak hours — count bookings per hour slot
  const hourCounts: Record<string, number> = {}
  bookings.filter(b => ["CONFIRMED", "COMPLETED"].includes(b.status)).forEach(b => {
    const h = b.startTime?.split(":")?.[0]
    if (h) hourCounts[h] = (hourCounts[h] || 0) + 1
  })
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]

  // Weekly heatmap — bookings per day this week
  const weeklyData = weekDays.map(day => ({
    day: format(day, "EEE"),
    date: day,
    count: bookings.filter(b => {
      const d = b.bookingDate?.toDate ? b.bookingDate.toDate() : null
      return d && isSameDay(d, day)
    }).length,
    isToday: isSameDay(day, today),
  }))
  const maxWeekCount = Math.max(...weeklyData.map(d => d.count), 1)

  // Department breakdown
  const deptCounts: Record<string, number> = {}
  bookings.forEach(b => { if (b.submittedByDept) deptCounts[b.submittedByDept] = (deptCounts[b.submittedByDept] || 0) + 1 })
  const deptBreakdown = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

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

  return (
    <ProtectedPageWrapper>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar userId={userId} />
        <SidebarInset className="bg-[#F8FAFA] min-h-screen">
          <PageHeader
            title="ADMIN / ROOM ANALYTICS"
            version="V1.0"
            showBackButton
            trigger={<SidebarTrigger className="mr-2" />}
            actions={
              <button onClick={() => router.push("/admin/meeting-rooms")}
                className="h-8 px-3 rounded-xl border border-zinc-200 bg-white text-[9px] font-black uppercase text-zinc-600 hover:bg-zinc-50 transition-all">
                Manage Rooms
              </button>
            }
          />

          <main className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-5 pb-24">

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Bookings", value: totalBookings, icon: Calendar, color: "bg-zinc-900 text-white" },
                { label: "Confirmed", value: confirmed, icon: CheckCircle2, color: "bg-blue-50 text-blue-600" },
                { label: "Completed", value: completed, icon: Star, color: "bg-emerald-50 text-emerald-600" },
                { label: "Pending", value: pending, icon: Clock, color: "bg-amber-50 text-amber-600" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-[20px] border border-zinc-200/60 shadow-sm p-4 flex items-center gap-3">
                  <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", color)}>
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-[22px] font-black text-zinc-900 leading-none">{value}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Today's Schedule */}
            {todayBookings.length > 0 && (
              <div className="bg-zinc-900 rounded-[24px] p-5 text-white">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="size-4 text-zinc-400" />
                  <h3 className="text-[11px] font-black uppercase tracking-widest">Today's Schedule — {format(today, "MMMM d")}</h3>
                  <span className="ml-auto text-[9px] font-black bg-white/10 px-2 py-0.5 rounded-full">{todayBookings.length} bookings</span>
                </div>
                <div className="space-y-2">
                  {todayBookings.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")).map(b => (
                    <div key={b.id} onClick={() => router.push(`/appointments/meeting-rooms/${b.id}`)}
                      className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-2xl cursor-pointer transition-colors">
                      <div className="size-8 rounded-xl bg-white/10 flex items-center justify-center text-white font-black text-sm shrink-0">
                        {b.roomName?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black truncate">{b.title}</p>
                        <p className="text-[9px] text-zinc-400">{b.roomName} · {b.startTime}–{b.endTime}</p>
                      </div>
                      <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                        b.status === "CONFIRMED" ? "bg-blue-500/20 text-blue-300" : "bg-amber-500/20 text-amber-300"
                      )}>{b.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Weekly Heatmap */}
              <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                  <BarChart3 className="size-3.5" /> This Week
                </h3>
                <div className="flex items-end gap-2 h-24">
                  {weeklyData.map(({ day, count, isToday }) => (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center" style={{ height: "72px" }}>
                        <div
                          className={cn("w-full rounded-t-lg transition-all", isToday ? "bg-zinc-900" : "bg-zinc-200")}
                          style={{ height: `${Math.max(4, (count / maxWeekCount) * 72)}px` }}
                        />
                      </div>
                      <p className={cn("text-[8px] font-black uppercase", isToday ? "text-zinc-900" : "text-zinc-400")}>{day}</p>
                      <p className="text-[9px] font-black text-zinc-600">{count}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room Utilization */}
              <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                  <DoorOpen className="size-3.5" /> Room Utilization (30 days)
                </h3>
                {roomUtilization.length === 0 ? (
                  <p className="text-[10px] text-zinc-300 italic">No rooms configured yet</p>
                ) : (
                  <div className="space-y-3">
                    {roomUtilization.slice(0, 5).map(r => (
                      <div key={r.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-zinc-700 uppercase">{r.name}</span>
                          <span className="text-[9px] font-bold text-zinc-400">{r.bookingCount} bookings · {r.totalHours.toFixed(1)}h</span>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-zinc-900 rounded-full transition-all"
                            style={{ width: `${roomUtilization[0].bookingCount > 0 ? (r.bookingCount / roomUtilization[0].bookingCount) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Peak Hours */}
              <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                  <TrendingUp className="size-3.5" /> Peak Hours
                </h3>
                <div className="grid grid-cols-6 gap-1">
                  {Array.from({ length: 14 }, (_, i) => {
                    const h = String(i + 7).padStart(2, "0")
                    const count = hourCounts[h] || 0
                    const maxCount = Math.max(...Object.values(hourCounts), 1)
                    const intensity = count / maxCount
                    return (
                      <div key={h} className="flex flex-col items-center gap-1">
                        <div className={cn("w-full h-8 rounded-lg transition-all",
                          intensity > 0.7 ? "bg-zinc-900" : intensity > 0.4 ? "bg-zinc-500" : intensity > 0 ? "bg-zinc-200" : "bg-zinc-50"
                        )} title={`${h}:00 — ${count} bookings`} />
                        <p className="text-[7px] font-black text-zinc-400">{h}</p>
                      </div>
                    )
                  })}
                </div>
                {peakHour && (
                  <p className="text-[10px] font-bold text-zinc-500 mt-3">
                    Peak: <span className="text-zinc-900 font-black">{peakHour[0]}:00</span> with {peakHour[1]} bookings
                  </p>
                )}
              </div>

              {/* Department Breakdown */}
              <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                  <Users className="size-3.5" /> By Department
                </h3>
                {deptBreakdown.length === 0 ? (
                  <p className="text-[10px] text-zinc-300 italic">No bookings yet</p>
                ) : (
                  <div className="space-y-3">
                    {deptBreakdown.map(([dept, count]) => (
                      <div key={dept} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-zinc-700 uppercase">{dept}</span>
                          <span className="text-[9px] font-bold text-zinc-400">{count} bookings</span>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-zinc-900 rounded-full"
                            style={{ width: `${(count / (deptBreakdown[0]?.[1] || 1)) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cancellation Rate */}
            <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                <AlertTriangle className="size-3.5" /> Booking Health
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Completion Rate", value: totalBookings > 0 ? `${Math.round((completed / totalBookings) * 100)}%` : "—", good: true },
                  { label: "Cancellation Rate", value: totalBookings > 0 ? `${Math.round((cancelled / totalBookings) * 100)}%` : "—", good: false },
                  { label: "Avg Attendees", value: bookings.length > 0 ? Math.round(bookings.reduce((s, b) => s + (b.attendeeCount || 1), 0) / bookings.length) : "—", good: true },
                  { label: "Active Rooms", value: rooms.filter(r => r.isActive).length, good: true },
                ].map(({ label, value, good }) => (
                  <div key={label} className="text-center p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <p className={cn("text-[22px] font-black leading-none", good ? "text-zinc-900" : "text-red-600")}>{value}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  )
}
