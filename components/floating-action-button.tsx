"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Plus, CalendarCheck, FileText, Monitor, ClipboardCheck,
  Package, Wrench, ThumbsUp, MoreHorizontal, X, Zap
} from "lucide-react"

type Department = "ENGINEERING" | "SALES" | "PROCUREMENT" | "WAREHOUSE OPERATIONS" | "IT" | string

interface FloatingActionButtonProps {
  department: Department
  userId?: string | null
}

export function FloatingActionButton({ department, userId }: FloatingActionButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(false)
  const dept = (department || "").toUpperCase()

  const appendId = (url: string) => userId
    ? url.includes("?") ? `${url}&userId=${userId}` : `${url}?userId=${userId}`
    : url

  // Department-specific quick actions
  const quickActions = React.useMemo(() => {
    // Admin dept — only meeting room actions
    if (dept === "ADMIN") {
      return [
        {
          icon: CalendarCheck,
          label: "Book a Room",
          href: appendId("/appointments/meeting-rooms/add"),
          color: "bg-zinc-900",
          show: () => true
        },
        {
          icon: MoreHorizontal,
          label: "All Bookings",
          href: appendId("/appointments/meeting-rooms"),
          color: "bg-blue-600",
          show: () => true
        },
      ]
    }

    const base = [
      { 
        icon: CalendarCheck, 
        label: "Site Visit", 
        href: appendId("/appointments/site-visit/add"),
        color: "bg-blue-500",
        show: () => ["ENGINEERING", "SALES", "IT"].includes(dept)
      },
      { 
        icon: FileText, 
        label: "Job Request", 
        href: appendId("/request/job/add"),
        color: "bg-orange-500",
        show: () => ["SALES", "ENGINEERING", "IT"].includes(dept)
      },
      { 
        icon: Monitor, 
        label: "DIAlux", 
        href: appendId("/request/dialux/add"),
        color: "bg-indigo-500",
        show: () => ["SALES", "IT"].includes(dept)
      },
      { 
        icon: Package, 
        label: "Product SPF", 
        href: appendId("/request/product/add"),
        color: "bg-emerald-500",
        show: () => ["SALES", "PROCUREMENT", "IT"].includes(dept)
      },
      { 
        icon: Wrench, 
        label: "Shop Drawing", 
        href: appendId("/request/shop-drawing/add"),
        color: "bg-violet-500",
        show: () => ["ENGINEERING", "IT"].includes(dept)
      },
      { 
        icon: ClipboardCheck, 
        label: "Testing", 
        href: appendId("/request/testing/add"),
        color: "bg-red-500",
        show: () => ["ENGINEERING", "PROCUREMENT", "IT"].includes(dept)
      },
      { 
        icon: ThumbsUp, 
        label: "Recommendation", 
        href: appendId("/requests/recommendation/add"),
        color: "bg-amber-500",
        show: () => ["SALES", "IT"].includes(dept)
      },
      { 
        icon: MoreHorizontal, 
        label: "Other Request", 
        href: appendId("/request/other/add"),
        color: "bg-gray-500",
        show: () => true
      },
    ]
    return base.filter(a => a.show())
  }, [dept, userId])

  // Keyboard shortcut: Press 'N' to open
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === "Escape") {
        setIsOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Quick Actions Menu */}
      {isOpen && (
        <div className="flex flex-col items-end gap-2 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                router.push(action.href)
                setIsOpen(false)
              }}
              className="flex items-center gap-3 group"
            >
              <span className="text-[11px] font-bold text-gray-600 bg-white px-3 py-1.5 rounded-lg shadow-md border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {action.label}
              </span>
              <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95", action.color)}>
                <action.icon className="w-5 h-5" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95",
          isOpen ? "bg-gray-800 rotate-45" : "bg-[#E33636]"
        )}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <div className="flex items-center gap-1">
            <Plus className="w-6 h-6" />
            <Zap className="w-3 h-3" />
          </div>
        )}
      </button>

      {/* Keyboard hint - compact */}
      {!isOpen && (
        <div className="absolute -top-6 right-0 bg-zinc-800 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg border border-zinc-700">
          N
        </div>
      )}
    </div>
  )
}
