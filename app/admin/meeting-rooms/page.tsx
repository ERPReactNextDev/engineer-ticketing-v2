"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { db } from "@/lib/firebase"
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, deleteDoc, serverTimestamp, getDocs, where
} from "firebase/firestore"
import {
  Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight,
  Loader2, Building2, Users, Layers, Star, Wifi,
  Monitor, Coffee, Wind, Mic, Projector, CheckSquare,
  Square, X, Save, AlertCircle, BarChart3, Calendar
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { format } from "date-fns"

const AMENITY_OPTIONS = [
  "WiFi", "Projector", "TV Screen", "Whiteboard",
  "Video Conference", "Air Conditioning", "Coffee Station",
  "Microphone", "HDMI Cable", "Laser Pointer", "Flip Chart",
]

const ROOM_COLORS = [
  { label: "Zinc",    value: "bg-zinc-900" },
  { label: "Blue",    value: "bg-blue-600" },
  { label: "Emerald", value: "bg-emerald-600" },
  { label: "Violet",  value: "bg-violet-600" },
  { label: "Rose",    value: "bg-rose-600" },
  { label: "Amber",   value: "bg-amber-500" },
  { label: "Indigo",  value: "bg-indigo-600" },
  { label: "Cyan",    value: "bg-cyan-600" },
]

const FLOOR_OPTIONS = ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor", "4th Floor", "5th Floor", "Rooftop"]

interface Room {
  id: string
  name: string
  floor: string
  building: string
  capacity: number
  amenities: string[]
  description: string
  color: string
  isActive: boolean
  isVip: boolean
  createdAt: any
}

const EMPTY_ROOM = {
  name: "", floor: "", building: "", capacity: 10,
  amenities: [] as string[], description: "", color: "bg-zinc-900",
  isActive: true, isVip: false,
}

export default function AdminMeetingRoomsPage() {
  const router = useRouter()
  const [userId, setUserId] = React.useState("")
  const [rooms, setRooms] = React.useState<Room[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [showDialog, setShowDialog] = React.useState(false)
  const [editRoom, setEditRoom] = React.useState<Room | null>(null)
  const [form, setForm] = React.useState({ ...EMPTY_ROOM })
  const [saving, setSaving] = React.useState(false)
  const [deleteConfirm, setDeleteConfirm] = React.useState<Room | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [roomStats, setRoomStats] = React.useState<Record<string, number>>({})

  React.useEffect(() => {
    setUserId(localStorage.getItem("userId") || "")
    const q = query(collection(db, "meeting_rooms"), orderBy("name", "asc"))
    const unsub = onSnapshot(q, snap => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as Room)))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Fetch booking counts per room
  React.useEffect(() => {
    if (rooms.length === 0) return
    const fetchStats = async () => {
      const stats: Record<string, number> = {}
      await Promise.all(rooms.map(async r => {
        const q = query(
          collection(db, "room_bookings"),
          where("roomId", "==", r.id),
          where("status", "in", ["PENDING", "CONFIRMED"])
        )
        const snap = await getDocs(q)
        stats[r.id] = snap.size
      }))
      setRoomStats(stats)
    }
    fetchStats()
  }, [rooms])

  const openAdd = () => {
    setEditRoom(null)
    setForm({ ...EMPTY_ROOM })
    setShowDialog(true)
  }

  const openEdit = (room: Room) => {
    setEditRoom(room)
    setForm({
      name: room.name, floor: room.floor, building: room.building,
      capacity: room.capacity, amenities: [...room.amenities],
      description: room.description, color: room.color,
      isActive: room.isActive, isVip: room.isVip,
    })
    setShowDialog(true)
  }

  const toggleAmenity = (a: string) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter(x => x !== a)
        : [...prev.amenities, a]
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Room name is required")
    if (form.capacity < 1) return toast.error("Capacity must be at least 1")
    setSaving(true)
    const toastId = toast.loading(editRoom ? "Updating room..." : "Creating room...")
    try {
      const payload = {
        name: form.name.trim(),
        floor: form.floor,
        building: form.building,
        capacity: Number(form.capacity),
        amenities: form.amenities,
        description: form.description.trim(),
        color: form.color,
        isActive: form.isActive,
        isVip: form.isVip,
        updatedAt: serverTimestamp(),
      }
      if (editRoom) {
        await updateDoc(doc(db, "meeting_rooms", editRoom.id), payload)
        toast.success("Room updated", { id: toastId })
      } else {
        await addDoc(collection(db, "meeting_rooms"), { ...payload, createdAt: serverTimestamp() })
        toast.success("Room created", { id: toastId })
      }
      setShowDialog(false)
    } catch (e: any) {
      toast.error(e.message || "Save failed", { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (room: Room) => {
    try {
      await updateDoc(doc(db, "meeting_rooms", room.id), { isActive: !room.isActive, updatedAt: serverTimestamp() })
      toast.success(`Room ${room.isActive ? "deactivated" : "activated"}`)
    } catch { toast.error("Failed to update") }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, "meeting_rooms", deleteConfirm.id))
      toast.success("Room deleted")
      setDeleteConfirm(null)
    } catch { toast.error("Delete failed") } finally { setDeleting(false) }
  }

  const filtered = rooms.filter(r =>
    (r.name + r.floor + r.building).toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: rooms.length,
    active: rooms.filter(r => r.isActive).length,
    vip: rooms.filter(r => r.isVip).length,
    totalCapacity: rooms.reduce((s, r) => s + (r.capacity || 0), 0),
  }

  return (
    <ProtectedPageWrapper>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar userId={userId} />
        <SidebarInset className="bg-[#F8FAFA] min-h-screen">
          <PageHeader
            title="ADMIN / MEETING ROOMS"
            version="V1.0"
            showBackButton
            trigger={<SidebarTrigger className="mr-2" />}
            actions={
              <div className="flex items-center gap-2">
                <button onClick={() => router.push("/admin/meeting-rooms/dashboard")}
                  className="h-8 px-3 rounded-xl border border-zinc-200 bg-white text-[9px] font-black uppercase text-zinc-600 hover:bg-zinc-50 transition-all flex items-center gap-1.5">
                  <BarChart3 className="size-3" /> Analytics
                </button>
                <Button onClick={openAdd} className="h-8 px-4 rounded-xl bg-zinc-900 text-white text-[9px] font-black uppercase tracking-widest gap-1.5">
                  <Plus className="size-3" /> Add Room
                </Button>
              </div>
            }
          />

          <main className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-5 pb-24">

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Rooms", value: stats.total, icon: Building2, color: "bg-zinc-50 text-zinc-600" },
                { label: "Active", value: stats.active, icon: ToggleRight, color: "bg-emerald-50 text-emerald-600" },
                { label: "VIP Rooms", value: stats.vip, icon: Star, color: "bg-amber-50 text-amber-600" },
                { label: "Total Capacity", value: stats.totalCapacity, icon: Users, color: "bg-blue-50 text-blue-600" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-[20px] border border-zinc-200/60 shadow-sm p-4 flex items-center gap-3">
                  <div className={cn("size-10 rounded-xl flex items-center justify-center", color)}>
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-[18px] font-black text-zinc-900 leading-none">{value}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
              <Input
                placeholder="Search rooms..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-11 rounded-2xl border-zinc-200 bg-white"
              />
            </div>

            {/* Room Cards */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-[24px] border border-zinc-100 p-5 animate-pulse space-y-3 h-48" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Building2 className="size-10 text-zinc-200 mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">No rooms found</p>
                <Button onClick={openAdd} className="mt-4 rounded-xl bg-zinc-900 text-white text-[10px] font-black uppercase gap-1.5">
                  <Plus className="size-3" /> Add First Room
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(room => (
                  <div key={room.id} className={cn(
                    "bg-white rounded-[24px] border shadow-sm p-5 space-y-3 transition-all",
                    room.isActive ? "border-zinc-200/60" : "border-zinc-100 opacity-60"
                  )}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("size-11 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm", room.color || "bg-zinc-900")}>
                          {room.name?.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13px] font-black text-zinc-900 uppercase">{room.name}</p>
                            {room.isVip && <Star className="size-3 text-amber-500 fill-amber-500" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {room.floor && <span className="text-[9px] font-bold text-zinc-400 uppercase">{room.floor}</span>}
                            {room.building && <span className="text-[9px] font-bold text-zinc-400 uppercase">· {room.building}</span>}
                          </div>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                        room.isActive ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-zinc-50 text-zinc-400 border-zinc-200"
                      )}>
                        {room.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-100 rounded-lg px-2 py-1">
                        <Users className="size-3 text-zinc-500" />
                        <span className="text-[10px] font-black text-zinc-700">{room.capacity} pax</span>
                      </div>
                      {roomStats[room.id] > 0 && (
                        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1">
                          <Calendar className="size-3 text-blue-500" />
                          <span className="text-[10px] font-black text-blue-700">{roomStats[room.id]} active</span>
                        </div>
                      )}
                    </div>

                    {room.amenities?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {room.amenities.slice(0, 4).map(a => (
                          <span key={a} className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[8px] font-bold uppercase">{a}</span>
                        ))}
                        {room.amenities.length > 4 && <span className="text-[8px] font-bold text-zinc-400">+{room.amenities.length - 4}</span>}
                      </div>
                    )}

                    {room.description && (
                      <p className="text-[10px] text-zinc-400 line-clamp-2">{room.description}</p>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                      <Button variant="outline" size="sm" onClick={() => openEdit(room)}
                        className="flex-1 h-8 rounded-xl text-[9px] font-black uppercase gap-1.5 border-zinc-200">
                        <Pencil className="size-3" /> Edit
                      </Button>
                      <button onClick={() => handleToggleActive(room)}
                        className={cn("size-8 rounded-xl border flex items-center justify-center transition-colors",
                          room.isActive ? "border-zinc-200 text-zinc-400 hover:bg-zinc-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        )}>
                        {room.isActive ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
                      </button>
                      <button onClick={() => setDeleteConfirm(room)}
                        className="size-8 rounded-xl border border-red-100 text-red-400 hover:bg-red-50 flex items-center justify-center transition-colors">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) setShowDialog(false) }}>
        <DialogContent className="max-w-lg rounded-[28px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[13px] font-black uppercase tracking-tight">
              {editRoom ? "Edit Room" : "Add New Room"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Room Name <span className="text-red-500">*</span></label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Boardroom A" className="h-11 rounded-xl border-zinc-200 bg-zinc-50/50 font-bold" />
            </div>

            {/* Floor + Building */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Floor</label>
                <select value={form.floor} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm font-bold outline-none">
                  <option value="">Select floor</option>
                  {FLOOR_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Building</label>
                <Input value={form.building} onChange={e => setForm(p => ({ ...p, building: e.target.value }))}
                  placeholder="e.g. Main Building" className="h-11 rounded-xl border-zinc-200 bg-zinc-50/50" />
              </div>
            </div>

            {/* Capacity */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Capacity (persons) <span className="text-red-500">*</span></label>
              <Input type="number" min={1} max={500} value={form.capacity}
                onChange={e => setForm(p => ({ ...p, capacity: Number(e.target.value) }))}
                className="h-11 rounded-xl border-zinc-200 bg-zinc-50/50 font-bold" />
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Room Color</label>
              <div className="flex flex-wrap gap-2">
                {ROOM_COLORS.map(c => (
                  <button key={c.value} onClick={() => setForm(p => ({ ...p, color: c.value }))}
                    className={cn("size-8 rounded-xl transition-all", c.value, form.color === c.value ? "ring-2 ring-offset-2 ring-zinc-900 scale-110" : "opacity-70 hover:opacity-100")} />
                ))}
              </div>
            </div>

            {/* Amenities */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Amenities</label>
              <div className="flex flex-wrap gap-1.5">
                {AMENITY_OPTIONS.map(a => (
                  <button key={a} onClick={() => toggleAmenity(a)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all",
                      form.amenities.includes(a)
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                    )}>
                    {form.amenities.includes(a) ? <CheckSquare className="size-3" /> : <Square className="size-3" />}
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Description</label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of the room..." className="rounded-xl border-zinc-200 min-h-[70px] resize-none" />
            </div>

            {/* Flags */}
            <div className="flex gap-3">
              <button onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[9px] font-black uppercase transition-all",
                  form.isActive ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-zinc-50 border-zinc-200 text-zinc-500")}>
                {form.isActive ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
                {form.isActive ? "Active" : "Inactive"}
              </button>
              <button onClick={() => setForm(p => ({ ...p, isVip: !p.isVip }))}
                className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[9px] font-black uppercase transition-all",
                  form.isVip ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-zinc-50 border-zinc-200 text-zinc-500")}>
                <Star className={cn("size-4", form.isVip && "fill-amber-500")} />
                {form.isVip ? "VIP Room" : "Standard"}
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1 rounded-xl h-11 text-[10px] font-black uppercase">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl h-11 bg-zinc-900 text-white text-[10px] font-black uppercase gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {editRoom ? "Update" : "Create Room"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => { if (!open) setDeleteConfirm(null) }}>
        <DialogContent className="max-w-sm rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="text-[13px] font-black uppercase tracking-tight text-red-600">Delete Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-2xl border border-red-100">
              <AlertCircle className="size-5 text-red-500 shrink-0" />
              <p className="text-[11px] font-bold text-red-700">
                Delete <strong>{deleteConfirm?.name}</strong>? This cannot be undone. Existing bookings will remain but the room won't be bookable.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1 rounded-xl h-11 text-[10px] font-black uppercase">Cancel</Button>
              <Button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-xl h-11 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase gap-2">
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedPageWrapper>
  )
}
