"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useBookingData } from "./layout"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import {
  Search, Users, Wifi, Monitor, Coffee, Wind, Mic,
  Projector, ArrowRight, Loader2, CheckCircle2,
  Building2, Layers, Star, Zap, ChevronRight
} from "lucide-react"
import { toast } from "sonner"

const AMENITY_ICONS: Record<string, any> = {
  "WiFi": Wifi,
  "Projector": Projector,
  "TV Screen": Monitor,
  "Whiteboard": Layers,
  "Video Conference": Monitor,
  "Air Conditioning": Wind,
  "Coffee Station": Coffee,
  "Microphone": Mic,
}

function AmenityBadge({ name }: { name: string }) {
  const Icon = AMENITY_ICONS[name] || Star
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[9px] font-bold uppercase tracking-wide">
      <Icon className="size-2.5" />
      {name}
    </span>
  )
}

export default function SelectRoomPage() {
  const router = useRouter()
  const { formData, setFormData, isHydrated } = useBookingData()
  const [userId, setUserId] = React.useState("")
  const [rooms, setRooms] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [filterCapacity, setFilterCapacity] = React.useState<number | null>(null)
  const [filterAmenity, setFilterAmenity] = React.useState("")
  const [todayBookings, setTodayBookings] = React.useState<any[]>([])

  React.useEffect(() => {
    setUserId(localStorage.getItem("userId") || "")
    const fetchRooms = async () => {
      try {
        const snap = await getDocs(collection(db, "meeting_rooms"))
        const data = snap.docs
          .map((d: any) => ({ id: d.id, ...d.data() }))
          .filter((r: any) => r.isActive !== false)
          .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))
        setRooms(data)

        // Fetch today's bookings for availability at-a-glance
        const today = new Date(); today.setHours(0,0,0,0)
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
        const { query: q, where: w, Timestamp: T } = await import("firebase/firestore")
        const bookSnap = await getDocs(q(
          collection(db, "room_bookings"),
          w("status", "in", ["PENDING", "CONFIRMED"])
        ))
        const todayBookings = bookSnap.docs
          .map((d: any) => ({ id: d.id, ...d.data() }))
          .filter((b: any) => {
            const bd = b.bookingDate?.toDate ? b.bookingDate.toDate() : null
            return bd && bd >= today && bd < tomorrow
          })
        setTodayBookings(todayBookings)
      } catch (e: any) {
        console.error("Rooms fetch error:", e)
        toast.error("Failed to load rooms")
      } finally {
        setLoading(false)
      }
    }
    fetchRooms()
  }, [])

  const filtered = React.useMemo(() => {
    return rooms.filter(r => {
      const matchSearch = (r.name + r.floor + r.building).toLowerCase().includes(search.toLowerCase())
      const matchCap = filterCapacity === null || r.capacity >= filterCapacity
      const matchAmenity = !filterAmenity || (r.amenities || []).includes(filterAmenity)
      return matchSearch && matchCap && matchAmenity
    })
  }, [rooms, search, filterCapacity, filterAmenity])

  const allAmenities = React.useMemo(() => {
    const set = new Set<string>()
    rooms.forEach(r => (r.amenities || []).forEach((a: string) => set.add(a)))
    return Array.from(set).sort()
  }, [rooms])

  const handleSelect = (room: any) => {
    setFormData(prev => ({
      ...prev,
      roomId: room.id,
      roomName: room.name,
      floor: room.floor || "",
      building: room.building || "",
      capacity: room.capacity || 0,
      amenities: room.amenities || [],
    }))
    router.push("/appointments/meeting-rooms/add/schedule")
  }

  return (
    <ProtectedPageWrapper>
      <AppSidebar userId={userId} />
      <SidebarInset className="bg-[#F8FAFA] min-h-screen">
        <PageHeader
          title="MEETING ROOMS / SELECT ROOM"
          version="V1.0"
          showBackButton
          trigger={<SidebarTrigger className="mr-2" />}
        />

        <main className="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-5 pb-24">

          {/* Search & Filters */}
          <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
              <Input
                placeholder="Search rooms by name, floor, or building..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-11 rounded-xl border-zinc-200 bg-zinc-50/50"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 self-center">Capacity:</span>
              {[null, 5, 10, 20, 30].map(cap => (
                <button
                  key={cap ?? "all"}
                  onClick={() => setFilterCapacity(cap)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wide border transition-all",
                    filterCapacity === cap
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                  )}
                >
                  {cap === null ? "All" : `${cap}+`}
                </button>
              ))}
              {allAmenities.length > 0 && (
                <>
                  <div className="w-px h-5 bg-zinc-200 self-center mx-1" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 self-center">Amenity:</span>
                  {allAmenities.slice(0, 5).map(a => (
                    <button
                      key={a}
                      onClick={() => setFilterAmenity(filterAmenity === a ? "" : a)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wide border transition-all",
                        filterAmenity === a
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Room Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-[24px] border border-zinc-100 p-5 animate-pulse space-y-3">
                  <div className="h-4 w-32 bg-zinc-100 rounded-full" />
                  <div className="h-3 w-20 bg-zinc-100 rounded-full" />
                  <div className="h-8 w-full bg-zinc-100 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Building2 className="size-12 text-zinc-200 mb-3" />
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">No rooms found</p>
              <p className="text-[10px] text-zinc-300 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(room => {
                const isSelected = formData.roomId === room.id
                const roomTodayBookings = todayBookings
                  .filter((b: any) => b.roomId === room.id)
                  .sort((a: any, b: any) => (a.startTime || "").localeCompare(b.startTime || ""))
                const now = new Date()
                const nowMins = now.getHours() * 60 + now.getMinutes()
                const isOccupiedNow = roomTodayBookings.some((b: any) => {
                  const [sh, sm] = (b.startTime || "0:0").split(":").map(Number)
                  const [eh, em] = (b.endTime || "0:0").split(":").map(Number)
                  return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em
                })
                const nextBooking = roomTodayBookings.find((b: any) => {
                  const [sh, sm] = (b.startTime || "0:0").split(":").map(Number)
                  return sh * 60 + sm > nowMins
                })
                return (
                  <button
                    key={room.id}
                    onClick={() => handleSelect(room)}
                    className={cn(
                      "group text-left bg-white rounded-[24px] border p-5 shadow-sm transition-all active:scale-[0.98] hover:shadow-md relative overflow-hidden",
                      isSelected
                        ? "border-zinc-900 ring-2 ring-zinc-900/10"
                        : "border-zinc-200/60 hover:border-zinc-300"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle2 className="size-5 text-zinc-900" />
                      </div>
                    )}

                    {/* Room color accent */}
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center mb-3 text-white font-black text-sm shadow-sm",
                      room.color || "bg-zinc-900"
                    )}>
                      {room.name?.charAt(0)?.toUpperCase() || "R"}
                    </div>

                    <h3 className="text-[13px] font-black text-zinc-900 uppercase tracking-tight leading-none mb-1">
                      {room.name}
                    </h3>
                    <div className="flex items-center gap-2 mb-3">
                      {room.floor && (
                        <span className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                          <Layers className="size-2.5" /> {room.floor}
                        </span>
                      )}
                      {room.building && (
                        <span className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                          <Building2 className="size-2.5" /> {room.building}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-100 rounded-lg px-2 py-1">
                        <Users className="size-3 text-zinc-500" />
                        <span className="text-[10px] font-black text-zinc-700">{room.capacity} pax</span>
                      </div>
                      {room.isVip && (
                        <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                          <Star className="size-3 text-amber-500" />
                          <span className="text-[9px] font-black text-amber-600">VIP</span>
                        </div>
                      )}
                      {/* Availability indicator */}
                      <div className={cn(
                        "flex items-center gap-1 rounded-lg px-2 py-1 ml-auto",
                        isOccupiedNow ? "bg-red-50 border border-red-100" : "bg-emerald-50 border border-emerald-100"
                      )}>
                        <span className={cn("size-1.5 rounded-full", isOccupiedNow ? "bg-red-500" : "bg-emerald-500 animate-pulse")} />
                        <span className={cn("text-[8px] font-black uppercase", isOccupiedNow ? "text-red-600" : "text-emerald-600")}>
                          {isOccupiedNow ? "In Use" : "Free"}
                        </span>
                      </div>
                    </div>
                    {/* Today's schedule */}
                    {roomTodayBookings.length > 0 && (
                      <div className="mb-3 space-y-1">
                        <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Today</p>
                        {roomTodayBookings.slice(0, 2).map((b: any, bi: number) => (
                          <div key={bi} className="flex items-center gap-1.5 text-[8px] font-bold text-zinc-500">
                            <span className={cn("size-1.5 rounded-full shrink-0",
                              b.status === "CONFIRMED" ? "bg-blue-500" : "bg-amber-400"
                            )} />
                            {b.startTime}–{b.endTime}
                            <span className="truncate text-zinc-400">{b.title}</span>
                          </div>
                        ))}
                        {roomTodayBookings.length > 2 && (
                          <p className="text-[8px] text-zinc-400">+{roomTodayBookings.length - 2} more</p>
                        )}
                      </div>
                    )}
                    {!isOccupiedNow && nextBooking && (
                      <p className="text-[8px] font-bold text-zinc-400 mb-2">
                        Next: {nextBooking.startTime} · {nextBooking.title}
                      </p>
                    )}

                    {room.amenities?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {room.amenities.slice(0, 3).map((a: string) => (
                          <AmenityBadge key={a} name={a} />
                        ))}
                        {room.amenities.length > 3 && (
                          <span className="text-[9px] font-bold text-zinc-400">+{room.amenities.length - 3}</span>
                        )}
                      </div>
                    )}

                    {room.description && (
                      <p className="text-[10px] text-zinc-400 leading-relaxed line-clamp-2 mb-3">
                        {room.description}
                      </p>
                    )}

                    <div className={cn(
                      "flex items-center justify-between pt-3 border-t border-zinc-100",
                    )}>
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                        Select Room
                      </span>
                      <ChevronRight className="size-4 text-zinc-300 group-hover:text-zinc-900 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </main>
      </SidebarInset>
    </ProtectedPageWrapper>
  )
}
