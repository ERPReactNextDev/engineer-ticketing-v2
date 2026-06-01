"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useBookingData } from "../layout"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { db } from "@/lib/firebase"
import {
  collection, addDoc, query, where, getDocs,
  serverTimestamp, Timestamp, orderBy
} from "firebase/firestore"
import { sendNotificationToHierarchy } from "@/lib/notification-service"
import { toast } from "sonner"
import { format, addDays, isSameDay, startOfDay } from "date-fns"
import {
  ChevronLeft, ChevronRight, Send, Loader2, Clock,
  Users, Calendar, AlertCircle, CheckCircle2,
  Building2, Layers, Paperclip, X, Info,
  Plus, Minus, Repeat
} from "lucide-react"

const TIME_SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00",
]

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function hasConflict(
  bookings: any[],
  date: Date,
  startTime: string,
  endTime: string,
  roomId: string,
  excludeId?: string
) {
  const dayBookings = bookings.filter(b => {
    if (excludeId && b.id === excludeId) return false
    if (!["PENDING", "CONFIRMED"].includes(b.status)) return false
    const bDate = b.bookingDate?.toDate ? b.bookingDate.toDate() : new Date(b.bookingDate)
    return isSameDay(bDate, date)
  })
  const newStart = timeToMinutes(startTime)
  const newEnd = timeToMinutes(endTime)
  return dayBookings.some(b => {
    const bStart = timeToMinutes(b.startTime)
    const bEnd = timeToMinutes(b.endTime)
    // Overlap: new booking starts before existing ends AND new booking ends after existing starts
    return newStart < bEnd && newEnd > bStart
  })
}

// Get all booked time ranges for a specific day
function getBookedRangesForDay(bookings: any[], date: Date) {
  return bookings
    .filter(b => {
      if (!["PENDING", "CONFIRMED"].includes(b.status)) return false
      const bDate = b.bookingDate?.toDate ? b.bookingDate.toDate() : new Date(b.bookingDate)
      return isSameDay(bDate, date)
    })
    .map(b => ({ start: b.startTime, end: b.endTime, title: b.title, status: b.status }))
}

// Check if a specific time slot is within any booked range
function isTimeSlotBooked(bookedRanges: { start: string; end: string }[], slotTime: string) {
  const slotMin = timeToMinutes(slotTime)
  return bookedRanges.some(r => {
    const rStart = timeToMinutes(r.start)
    const rEnd = timeToMinutes(r.end)
    return slotMin >= rStart && slotMin < rEnd
  })
}

export default function ScheduleBookingPage() {
  const router = useRouter()
  const { formData, setFormData, isHydrated } = useBookingData()
  const [userId, setUserId] = React.useState("")
  const [userName, setUserName] = React.useState("")
  const [userDept, setUserDept] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [existingBookings, setExistingBookings] = React.useState<any[]>([])
  const [loadingBookings, setLoadingBookings] = React.useState(false)
  const [allStaff, setAllStaff] = React.useState<any[]>([])

  // Calendar state
  const today = React.useMemo(() => startOfDay(new Date()), [])
  const [viewDate, setViewDate] = React.useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null)
  const [startTime, setStartTime] = React.useState("")
  const [endTime, setEndTime] = React.useState("")
  const [title, setTitle] = React.useState(formData.title || "")
  const [description, setDescription] = React.useState(formData.description || "")
  const [attendeeCount, setAttendeeCount] = React.useState(formData.attendeeCount || 1)
  const [attachedFile, setAttachedFile] = React.useState<File | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  // Recurring booking state
  const [isRecurring, setIsRecurring] = React.useState(false)
  const [recurringType, setRecurringType] = React.useState<"daily" | "weekly" | "monthly">("weekly")
  const [recurringCount, setRecurringCount] = React.useState(4)

  // Attendee state
  const [attendeeSearch, setAttendeeSearch] = React.useState("")
  const [selectedAttendees, setSelectedAttendees] = React.useState<any[]>([])
  const [showAttendeeSearch, setShowAttendeeSearch] = React.useState(false)

  React.useEffect(() => {
    const id = localStorage.getItem("userId") || ""
    const name = localStorage.getItem("userName") || ""
    const dept = localStorage.getItem("userDepartment") || ""
    setUserId(id)
    setUserName(name)
    setUserDept(dept)
    // Fetch staff for attendee picker
    fetch("/api/user").then(r => r.json()).then(data => setAllStaff(data || [])).catch(console.error)
  }, [])

  // Redirect if no room selected
  React.useEffect(() => {
    if (isHydrated && !formData.roomId) {
      router.replace("/appointments/meeting-rooms/add")
    }
  }, [isHydrated, formData.roomId, router])

  // Fetch existing bookings for this room — simple query, no composite index needed
  React.useEffect(() => {
    if (!formData.roomId) return
    setLoadingBookings(true)
    // Only filter by roomId + status — no date range to avoid composite index
    // We fetch all active bookings for this room and filter by month client-side
    getDocs(query(
      collection(db, "room_bookings"),
      where("roomId", "==", formData.roomId),
      where("status", "in", ["PENDING", "CONFIRMED"])
    )).then(snap => {
      setExistingBookings(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })))
    }).catch(err => {
      console.error("Bookings fetch error:", err)
      // Fallback: fetch all bookings for this room without status filter
      getDocs(query(collection(db, "room_bookings"), where("roomId", "==", formData.roomId)))
        .then(snap => {
          setExistingBookings(
            snap.docs
              .map((d: any) => ({ id: d.id, ...d.data() }))
              .filter((b: any) => ["PENDING", "CONFIRMED"].includes(b.status))
          )
        }).catch(console.error)
    }).finally(() => setLoadingBookings(false))
  }, [formData.roomId, viewDate])

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay()
  const monthLabel = format(viewDate, "MMMM yyyy").toUpperCase()

  const getBookingsForDay = (day: number) => {
    return existingBookings.filter(b => {
      const d = b.bookingDate?.toDate ? b.bookingDate.toDate() : new Date(b.bookingDate)
      return d.getDate() === day && d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear()
    })
  }

  const handleMonthChange = (offset: number) => {
    const newMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1)
    if (newMonth < new Date(today.getFullYear(), today.getMonth(), 1)) return
    setViewDate(newMonth)
    setSelectedDate(null)
  }

  const isDatePast = (day: number) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    return d < today
  }

  const isWeekend = (day: number) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    return d.getDay() === 0 || d.getDay() === 6
  }

  const availableEndTimes = React.useMemo(() => {
    if (!startTime) return []
    const startMin = timeToMinutes(startTime)
    return TIME_SLOTS.filter(t => timeToMinutes(t) > startMin)
  }, [startTime])

  const conflict = React.useMemo(() => {
    if (!selectedDate || !startTime || !endTime) return false
    return hasConflict(existingBookings, selectedDate, startTime, endTime, formData.roomId)
  }, [selectedDate, startTime, endTime, existingBookings, formData.roomId])

  const duration = React.useMemo(() => {
    if (!startTime || !endTime) return ""
    const mins = timeToMinutes(endTime) - timeToMinutes(startTime)
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`
  }, [startTime, endTime])

  const isComplete = selectedDate && startTime && endTime && title.trim() && !conflict

  const handleDirectUpload = async (file: File) => {
    const data = new FormData()
    data.append("file", file)
    data.append("upload_preset", "Xchire")
    try {
      const res = await fetch("https://api.cloudinary.com/v1_1/dhczsyzcz/image/upload", { method: "POST", body: data })
      const json = await res.json()
      return json.secure_url || ""
    } catch { return "" }
  }

  const handleSubmit = async () => {
    if (!isComplete || isSubmitting) return
    setIsSubmitting(true)
    const toastId = toast.loading(isRecurring ? `Creating ${recurringCount} recurring bookings...` : "Submitting booking...")
    try {
      let fileUrl = ""
      if (attachedFile) fileUrl = await handleDirectUpload(attachedFile)

      const dur = (() => {
        const mins = timeToMinutes(endTime) - timeToMinutes(startTime)
        const h = Math.floor(mins / 60); const m = mins % 60
        return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`
      })()

      const basePayload = {
        roomId: formData.roomId, roomName: formData.roomName,
        floor: formData.floor, building: formData.building,
        capacity: formData.capacity, amenities: formData.amenities,
        title: title.trim(), description: description.trim(),
        attendeeCount, startTime, endTime, duration: dur,
        status: "PENDING", priority: formData.priority, fileUrl,
        submittedBy: userId, submittedByName: userName, submittedByDept: userDept,
        attendees: selectedAttendees.map(a => ({ id: a._id, name: `${a.Firstname} ${a.Lastname}`.trim(), dept: a.Department })),
        isRecurring, recurringType: isRecurring ? recurringType : null,
        recurringGroupId: isRecurring ? `RG-${Date.now()}` : null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }

      // Generate dates for recurring bookings
      const dates: Date[] = [selectedDate!]
      if (isRecurring) {
        for (let i = 1; i < recurringCount; i++) {
          const prev = dates[dates.length - 1]
          let next: Date
          if (recurringType === "daily") next = addDays(prev, 1)
          else if (recurringType === "weekly") next = addDays(prev, 7)
          else next = new Date(prev.getFullYear(), prev.getMonth() + 1, prev.getDate())
          // Skip weekends for daily/weekly
          while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1)
          dates.push(next)
        }
      }

      // Submit all bookings
      const bookingNos: string[] = []
      for (const date of dates) {
        const bookingNo = `MR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
        bookingNos.push(bookingNo)
        await addDoc(collection(db, "room_bookings"), {
          ...basePayload, bookingDate: Timestamp.fromDate(date), bookingNo,
        })
        // Small delay to avoid duplicate timestamps
        if (dates.length > 1) await new Promise(r => setTimeout(r, 50))
      }

      // Clear draft
      try { localStorage.removeItem("meeting_room_booking_draft") } catch {}

      // Notify submitter's hierarchy
      await sendNotificationToHierarchy(
        {
          title: isRecurring ? `Recurring Meeting Room Booking (${recurringCount}×)` : "New Meeting Room Booking",
          body: `${userName} booked ${formData.roomName} on ${format(selectedDate!, "MMM d")} ${startTime}–${endTime}${isRecurring ? ` + ${recurringCount - 1} more` : ""}`,
          url: "/appointments/meeting-rooms",
        },
        userId, { triggeredBy: userId }
      )

      // Notify tagged attendees
      if (selectedAttendees.length > 0) {
        const { sendPushNotification } = await import("@/lib/notification-service")
        await sendPushNotification(
          { title: "You've been invited to a meeting", body: `${userName} invited you to "${title}" on ${format(selectedDate!, "MMM d")} ${startTime}–${endTime}`, url: "/appointments/meeting-rooms" },
          { targetUserIds: selectedAttendees.map(a => a._id), triggeredBy: userId, includeAdmins: false }
        )
      }

      toast.success(isRecurring ? `${recurringCount} bookings created!` : "Booking submitted!", { id: toastId })
      router.push("/appointments/meeting-rooms")
    } catch (e: any) {
      toast.error(e.message || "Submission failed", { id: toastId })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isHydrated) {
    return (
      <ProtectedPageWrapper>
        <AppSidebar userId={userId} />
        <SidebarInset className="bg-[#F8FAFA] min-h-screen flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-zinc-300" />
        </SidebarInset>
      </ProtectedPageWrapper>
    )
  }

  return (
    <ProtectedPageWrapper>
      <AppSidebar userId={userId} />
      <SidebarInset className="bg-[#F8FAFA] min-h-screen">
        <PageHeader
          title="MEETING ROOMS / SCHEDULE"
          version="V1.0"
          showBackButton
          trigger={<SidebarTrigger className="mr-2" />}
          actions={
            <Button
              onClick={handleSubmit}
              disabled={!isComplete || isSubmitting}
              className="h-9 px-5 rounded-xl bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest gap-2 disabled:opacity-40"
            >
              {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Submit
            </Button>
          }
        />

        <main className="p-4 md:p-6 max-w-6xl mx-auto w-full pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* LEFT — Calendar + Time */}
            <div className="lg:col-span-7 space-y-4">

              {/* Room Summary */}
              <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-4 flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-white font-black text-lg shadow-sm">
                  {formData.roomName?.charAt(0) || "R"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-zinc-900 uppercase tracking-tight">{formData.roomName}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {formData.floor && <span className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-1"><Layers className="size-2.5" />{formData.floor}</span>}
                    {formData.building && <span className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-1"><Building2 className="size-2.5" />{formData.building}</span>}
                    <span className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-1"><Users className="size-2.5" />{formData.capacity} pax</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.back()} className="text-[9px] font-black uppercase rounded-xl h-8 px-3">
                  Change
                </Button>
              </div>

              {/* Calendar */}
              <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-100">
                  <h3 className="text-[12px] font-black text-zinc-900 uppercase tracking-tight">{monthLabel}</h3>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleMonthChange(-1)} className="size-8 flex items-center justify-center rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors">
                      <ChevronLeft className="size-4 text-zinc-400" />
                    </button>
                    <button onClick={() => { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(null) }} className="px-3 h-8 rounded-xl border border-zinc-200 text-[9px] font-black uppercase tracking-wider hover:bg-zinc-50 transition-colors">
                      Today
                    </button>
                    <button onClick={() => handleMonthChange(1)} className="size-8 flex items-center justify-center rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors">
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
                  {[...Array(firstDayOfMonth)].map((_, i) => <div key={`e-${i}`} className="min-h-[70px] border-r border-b border-zinc-50" />)}
                  {[...Array(daysInMonth)].map((_, i) => {
                    const day = i + 1
                    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
                    const isPast = isDatePast(day)
                    const isWknd = isWeekend(day)
                    const isSelected = selectedDate && isSameDay(date, selectedDate)
                    const isToday = isSameDay(date, today)
                    const dayBookings = getBookingsForDay(day)
                    const bookedRanges = getBookedRangesForDay(existingBookings, date)
                    // Check if entire business day (07:00-20:00) is fully blocked
                    const allSlotsBooked = bookedRanges.length > 0 && TIME_SLOTS.slice(0, -1).every(t =>
                      isTimeSlotBooked(bookedRanges, t)
                    )
                    const col = (firstDayOfMonth + i) % 7
                    const isDisabled = isPast || isWknd || allSlotsBooked
                    return (
                      <div
                        key={day}
                        onClick={() => !isDisabled && setSelectedDate(date)}
                        className={cn(
                          "min-h-[70px] p-1.5 border-r border-b border-zinc-50 transition-colors relative",
                          col === 6 && "border-r-0",
                          isDisabled ? "bg-zinc-50/50 opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-zinc-50",
                          isSelected && "bg-zinc-900/5 ring-2 ring-inset ring-zinc-900",
                          allSlotsBooked && !isPast && !isWknd && "bg-red-50/40"
                        )}
                      >
                        <span className={cn(
                          "size-6 flex items-center justify-center rounded-lg text-[11px] font-black",
                          isToday ? "bg-zinc-900 text-white" : isSelected ? "text-zinc-900" : "text-zinc-500"
                        )}>{day}</span>
                        <div className="mt-1 space-y-0.5">
                          {allSlotsBooked && !isPast && !isWknd ? (
                            <p className="text-[7px] font-black text-red-400 uppercase tracking-wide">Full</p>
                          ) : (
                            <>
                              {dayBookings.slice(0, 2).map((b, bi) => (
                                <div key={bi} className={cn("h-1.5 rounded-full opacity-80",
                                  b.status === "CONFIRMED" ? "bg-blue-500" : "bg-amber-400"
                                )} title={`${b.title} ${b.startTime}–${b.endTime}`} />
                              ))}
                              {dayBookings.length > 2 && <p className="text-[7px] font-black text-zinc-400">+{dayBookings.length - 2}</p>}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Time Slot Picker */}
              {selectedDate && (
                <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-zinc-400" />
                    <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-tight">
                      Time Slot — {format(selectedDate, "EEEE, MMMM d")}
                    </h3>
                    {loadingBookings && <Loader2 className="size-3 animate-spin text-zinc-400" />}
                  </div>

                  {/* Show existing bookings for this day */}
                  {(() => {
                    const bookedRanges = getBookedRangesForDay(existingBookings, selectedDate)
                    if (bookedRanges.length === 0) return null
                    return (
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Already Booked</p>
                        {bookedRanges.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl">
                            <div className="size-1.5 rounded-full bg-red-500 shrink-0" />
                            <span className="text-[10px] font-black text-red-700">{r.start} – {r.end}</span>
                            <span className="text-[9px] text-red-500 truncate">{r.title}</span>
                            <span className={cn("ml-auto text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full",
                              r.status === "CONFIRMED" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                            )}>{r.status}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Start Time</label>
                      <div className="grid grid-cols-4 gap-1 max-h-[160px] overflow-y-auto pr-1">
                        {TIME_SLOTS.slice(0, -1).map(t => {
                          const bookedRanges = getBookedRangesForDay(existingBookings, selectedDate)
                          // A start time is blocked if it falls within any existing booking
                          const isBlocked = isTimeSlotBooked(bookedRanges, t)
                          return (
                            <button
                              key={t}
                              disabled={isBlocked}
                              onClick={() => { setStartTime(t); setEndTime("") }}
                              className={cn(
                                "py-1.5 rounded-lg text-[9px] font-black transition-all border",
                                startTime === t ? "bg-zinc-900 text-white border-zinc-900" :
                                isBlocked ? "bg-red-50 text-red-300 border-red-100 cursor-not-allowed line-through" :
                                "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                              )}
                              title={isBlocked ? "This time is already booked" : t}
                            >{t}</button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">End Time</label>
                      {!startTime ? (
                        <p className="text-[10px] text-zinc-300 italic pt-2">Select start time first</p>
                      ) : (
                        <div className="grid grid-cols-4 gap-1 max-h-[160px] overflow-y-auto pr-1">
                          {availableEndTimes.map(t => {
                            // End time is blocked if the range start→t would overlap any existing booking
                            const wouldConflict = hasConflict(existingBookings, selectedDate, startTime, t, formData.roomId)
                            return (
                              <button
                                key={t}
                                disabled={wouldConflict}
                                onClick={() => setEndTime(t)}
                                className={cn(
                                  "py-1.5 rounded-lg text-[9px] font-black transition-all border",
                                  endTime === t ? "bg-zinc-900 text-white border-zinc-900" :
                                  wouldConflict ? "bg-red-50 text-red-300 border-red-100 cursor-not-allowed line-through" :
                                  "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                                )}
                                title={wouldConflict ? "Would overlap an existing booking" : t}
                              >{t}</button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  {startTime && endTime && (
                    <div className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border text-[10px] font-bold",
                      conflict ? "bg-red-50 border-red-200 text-red-600" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    )}>
                      {conflict ? <AlertCircle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
                      {conflict ? "Time slot conflict — another booking exists" : `Available · Duration: ${duration}`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT — Booking Details */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5 space-y-5">
                <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-tight flex items-center gap-2">
                  <Calendar className="size-4 text-zinc-400" /> Booking Details
                </h3>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Meeting Title <span className="text-red-500">*</span></label>
                  <Input
                    placeholder="e.g. Q2 Sales Review"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="h-11 rounded-xl border-zinc-200 bg-zinc-50/50 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Agenda / Description</label>
                  <Textarea
                    placeholder="What will be discussed?"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="rounded-xl border-zinc-200 bg-zinc-50/50 min-h-[80px] resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Number of Attendees</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setAttendeeCount(Math.max(1, attendeeCount - 1))} className="size-9 rounded-xl border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 transition-colors">
                      <Minus className="size-4 text-zinc-500" />
                    </button>
                    <span className="text-[18px] font-black text-zinc-900 w-8 text-center">{attendeeCount}</span>
                    <button onClick={() => setAttendeeCount(Math.min(formData.capacity || 99, attendeeCount + 1))} className="size-9 rounded-xl border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 transition-colors">
                      <Plus className="size-4 text-zinc-500" />
                    </button>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase">/ {formData.capacity} max</span>
                  </div>
                  {attendeeCount > formData.capacity && (
                    <p className="text-[9px] font-bold text-red-500 flex items-center gap-1">
                      <AlertCircle className="size-3" /> Exceeds room capacity
                    </p>
                  )}
                </div>

                {/* Recurring */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                      <Repeat className="size-3" /> Recurring Booking
                    </label>
                    <button onClick={() => setIsRecurring(!isRecurring)}
                      className={cn("relative w-10 h-5 rounded-full transition-colors", isRecurring ? "bg-zinc-900" : "bg-zinc-200")}>
                      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform", isRecurring ? "translate-x-5" : "translate-x-0.5")} />
                    </button>
                  </div>
                  {isRecurring && (
                    <div className="space-y-2 animate-in fade-in duration-200">
                      <div className="flex gap-1.5">
                        {(["daily","weekly","monthly"] as const).map(t => (
                          <button key={t} onClick={() => setRecurringType(t)}
                            className={cn("flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all",
                              recurringType === t ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                            )}>{t}</button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase">Repeat</span>
                        <button onClick={() => setRecurringCount(Math.max(2, recurringCount - 1))} className="size-7 rounded-lg border border-zinc-200 flex items-center justify-center hover:bg-zinc-50">
                          <Minus className="size-3" />
                        </button>
                        <span className="text-[13px] font-black text-zinc-900 w-6 text-center">{recurringCount}</span>
                        <button onClick={() => setRecurringCount(Math.min(12, recurringCount + 1))} className="size-7 rounded-lg border border-zinc-200 flex items-center justify-center hover:bg-zinc-50">
                          <Plus className="size-3" />
                        </button>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase">times</span>
                      </div>
                      <p className="text-[9px] text-zinc-400 italic">Creates {recurringCount} bookings, every {recurringType === "daily" ? "day" : recurringType === "weekly" ? "week" : "month"}</p>
                    </div>
                  )}
                </div>

                {/* Attendees */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                    <Users className="size-3" /> Tag Attendees
                    <span className="text-zinc-300">(optional)</span>
                  </label>
                  {selectedAttendees.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAttendees.map(a => (
                        <span key={a._id} className="flex items-center gap-1 px-2 py-1 bg-zinc-900 text-white rounded-full text-[9px] font-bold">
                          {a.Firstname} {a.Lastname?.charAt(0)}.
                          <button onClick={() => setSelectedAttendees(prev => prev.filter(x => x._id !== a._id))} className="hover:text-red-300 transition-colors">
                            <X className="size-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <input
                      placeholder="Search staff to invite..."
                      value={attendeeSearch}
                      onChange={e => { setAttendeeSearch(e.target.value); setShowAttendeeSearch(true) }}
                      onFocus={() => setShowAttendeeSearch(true)}
                      className="w-full h-9 px-3 rounded-xl border border-zinc-200 bg-zinc-50/50 text-[11px] outline-none focus:border-zinc-400 transition-all"
                    />
                    {showAttendeeSearch && attendeeSearch && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                        {allStaff
                          .filter(s => {
                            const name = `${s.Firstname} ${s.Lastname}`.toLowerCase()
                            return name.includes(attendeeSearch.toLowerCase()) && s._id !== userId && !selectedAttendees.find(a => a._id === s._id)
                          })
                          .slice(0, 8)
                          .map(s => (
                            <button key={s._id} onClick={() => { setSelectedAttendees(prev => [...prev, s]); setAttendeeSearch(""); setShowAttendeeSearch(false) }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 transition-colors text-left">
                              <div className="size-6 rounded-full bg-zinc-900 flex items-center justify-center text-white text-[8px] font-black shrink-0">
                                {s.Firstname?.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold text-zinc-900 truncate">{s.Firstname} {s.Lastname}</p>
                                <p className="text-[8px] text-zinc-400 uppercase">{s.Department}</p>
                              </div>
                            </button>
                          ))}
                        {allStaff.filter(s => `${s.Firstname} ${s.Lastname}`.toLowerCase().includes(attendeeSearch.toLowerCase()) && s._id !== userId).length === 0 && (
                          <p className="px-3 py-2 text-[10px] text-zinc-400 italic">No staff found</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Priority</label>
                  <div className="flex gap-2">
                    {["NORMAL", "URGENT"].map(p => (
                      <button
                        key={p}
                        onClick={() => setFormData(prev => ({ ...prev, priority: p as any }))}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide border transition-all",
                          formData.priority === p
                            ? p === "URGENT" ? "bg-red-600 text-white border-red-600" : "bg-zinc-900 text-white border-zinc-900"
                            : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                        )}
                      >{p}</button>
                    ))}
                  </div>
                </div>

                {/* Attachment */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Attachment (optional)</label>
                  <input type="file" ref={fileRef} className="hidden" onChange={e => e.target.files?.[0] && setAttachedFile(e.target.files[0])} />
                  {!attachedFile ? (
                    <button onClick={() => fileRef.current?.click()} className="w-full h-10 border-2 border-dashed border-zinc-200 rounded-xl text-[9px] font-black uppercase text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-all flex items-center justify-center gap-2">
                      <Paperclip className="size-3.5" /> Attach File
                    </button>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-zinc-900 text-white rounded-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="size-3.5 shrink-0" />
                        <span className="text-[9px] font-bold truncate">{attachedFile.name}</span>
                      </div>
                      <button onClick={() => setAttachedFile(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Booking Summary */}
              <div className="bg-zinc-900 rounded-[24px] p-5 text-white space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Booking Summary</h3>
                <div className="space-y-2">
                  <SummaryRow label="Room" value={formData.roomName || "—"} />
                  <SummaryRow label="Date" value={selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "—"} />
                  <SummaryRow label="Time" value={startTime && endTime ? `${startTime} – ${endTime} (${duration})` : "—"} />
                  <SummaryRow label="Attendees" value={`${attendeeCount} person${attendeeCount !== 1 ? "s" : ""}`} />
                  <SummaryRow label="Title" value={title || "—"} />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={!isComplete || isSubmitting || attendeeCount > formData.capacity}
                  className="w-full h-12 rounded-2xl bg-white text-zinc-900 hover:bg-zinc-100 font-black text-[10px] uppercase tracking-widest gap-2 disabled:opacity-40 mt-2"
                >
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {isSubmitting ? "Submitting..." : "Confirm Booking"}
                </Button>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </ProtectedPageWrapper>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 shrink-0">{label}</span>
      <span className="text-[10px] font-bold text-zinc-200 text-right">{value}</span>
    </div>
  )
}
