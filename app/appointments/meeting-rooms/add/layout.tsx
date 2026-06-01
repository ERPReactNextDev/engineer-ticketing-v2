"use client"

import * as React from "react"
import { SidebarProvider } from "@/components/ui/sidebar"

interface BookingFormData {
  roomId: string
  roomName: string
  floor: string
  building: string
  capacity: number
  amenities: string[]
  title: string
  description: string
  attendees: string[]
  attendeeCount: number
  isRecurring: boolean
  recurringType: "daily" | "weekly" | "monthly" | ""
  recurringEnd: string
  priority: "NORMAL" | "URGENT"
  attachmentUrl: string
}

interface BookingContextType {
  formData: BookingFormData
  setFormData: React.Dispatch<React.SetStateAction<BookingFormData>>
  isHydrated: boolean
}

const DEFAULT_FORM: BookingFormData = {
  roomId: "",
  roomName: "",
  floor: "",
  building: "",
  capacity: 0,
  amenities: [],
  title: "",
  description: "",
  attendees: [],
  attendeeCount: 1,
  isRecurring: false,
  recurringType: "",
  recurringEnd: "",
  priority: "NORMAL",
  attachmentUrl: "",
}

const STORAGE_KEY = "meeting_room_booking_draft"

const BookingContext = React.createContext<BookingContextType>({
  formData: DEFAULT_FORM,
  setFormData: () => {},
  isHydrated: false,
})

export function useBookingData() {
  return React.useContext(BookingContext)
}

export default function MeetingRoomAddLayout({ children }: { children: React.ReactNode }) {
  const [formData, setFormData] = React.useState<BookingFormData>(DEFAULT_FORM)
  const [isHydrated, setIsHydrated] = React.useState(false)

  // Hydrate from localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setFormData(prev => ({ ...prev, ...parsed }))
      }
    } catch {}
    setIsHydrated(true)
  }, [])

  // Persist to localStorage on change
  React.useEffect(() => {
    if (!isHydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData))
    } catch {}
  }, [formData, isHydrated])

  return (
    <BookingContext.Provider value={{ formData, setFormData, isHydrated }}>
      <SidebarProvider defaultOpen={false}>
        {children}
      </SidebarProvider>
    </BookingContext.Provider>
  )
}
