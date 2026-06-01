"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Bell, X, CheckCircle2, AlertTriangle, CalendarCheck, FileText,
  Monitor, Package, Wrench, ClipboardCheck, MoreHorizontal, Clock,
  Check, Trash2, Settings, Filter, ExternalLink, Sparkles,
  TrendingUp, TrendingDown, Minus, ChevronRight
} from "lucide-react"

interface NotificationItem {
  id: string
  type: string
  title: string
  description?: string
  status: "critical" | "pending" | "completed" | "info"
  timestamp: Date
  count?: number
  path: string
  icon?: any
  isRead?: boolean
}

interface EnhancedNotificationsProps {
  notifications: {
    siteVisit: number
    jobRequest: number
    shopDrawing: number
    testingActive: number
    testingOverdue: number
    otherRequest: number
    dialuxRequest: number
    dialuxInProgress: number
    dialuxCompleted: number
    productRequest: number
    unreadMessages: number
    unreadByService: Record<string, number>
    meetingRoomPending?: number
  }
  userId?: string | null
  userDept?: string | null
  onClose: () => void
}

const STATUS_CONFIG = {
  critical: { 
    bg: "bg-red-50", 
    text: "text-red-600", 
    border: "border-red-100",
    label: "Critical",
    icon: AlertTriangle
  },
  pending: { 
    bg: "bg-amber-50", 
    text: "text-amber-600", 
    border: "border-amber-100",
    label: "Pending",
    icon: Clock
  },
  completed: { 
    bg: "bg-emerald-50", 
    text: "text-emerald-600", 
    border: "border-emerald-100",
    label: "Completed",
    icon: CheckCircle2
  },
  info: { 
    bg: "bg-blue-50", 
    text: "text-blue-600", 
    border: "border-blue-100",
    label: "Info",
    icon: Bell
  }
}

export function EnhancedNotifications({ notifications, userId, userDept, onClose }: EnhancedNotificationsProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState<"all" | "critical" | "pending">("all")
  const [showSettings, setShowSettings] = React.useState(false)
  const isAdmin = (userDept || "").toUpperCase() === "ADMIN"

  const appendId = (url: string) => userId
    ? url.includes("?") ? `${url}&userId=${userId}` : `${url}?userId=${userId}`
    : url

  // Build notification items array
  const allItems: NotificationItem[] = React.useMemo(() => {
    const items: NotificationItem[] = []

    // Admin dept — only show meeting room notifications
    if (isAdmin) {
      const pending = notifications.meetingRoomPending || notifications.siteVisit || 0
      if (pending > 0) {
        items.push({
          id: "meeting-room-pending",
          type: "Meeting Rooms",
          title: "Pending Room Approvals",
          description: `${pending} booking${pending !== 1 ? "s" : ""} awaiting your approval`,
          status: "pending",
          timestamp: new Date(),
          count: pending,
          path: "/appointments/meeting-rooms",
          icon: CalendarCheck,
        })
      }
      return items
    }

    if (notifications.testingOverdue > 0) {
      items.push({
        id: "testing-critical",
        type: "Testing",
        title: "Testing Items Overdue",
        description: `${notifications.testingOverdue} testing items require immediate attention`,
        status: "critical",
        timestamp: new Date(),
        count: notifications.testingOverdue,
        path: "/request/testing",
        icon: AlertTriangle
      })
    }
    
    if (notifications.testingActive > 0) {
      items.push({
        id: "testing-active",
        type: "Testing",
        title: "Active Testing",
        description: `${notifications.testingActive} items currently in testing phase`,
        status: "pending",
        timestamp: new Date(),
        count: notifications.testingActive,
        path: "/request/testing",
        icon: ClipboardCheck
      })
    }
    
    if (notifications.siteVisit > 0) {
      items.push({
        id: "site-visit",
        type: "Site Visit",
        title: "Pending Site Visits",
        description: `${notifications.siteVisit} appointments awaiting confirmation`,
        status: "pending",
        timestamp: new Date(),
        count: notifications.siteVisit,
        path: "/appointments/site-visit",
        icon: CalendarCheck
      })
    }
    
    if (notifications.jobRequest > 0) {
      items.push({
        id: "job-request",
        type: "Job Request",
        title: "New Job Requests",
        description: `${notifications.jobRequest} requests need review`,
        status: "pending",
        timestamp: new Date(),
        count: notifications.jobRequest,
        path: "/request/job",
        icon: FileText
      })
    }
    
    if (notifications.dialuxRequest > 0) {
      items.push({
        id: "dialux-queue",
        type: "DIAlux",
        title: "DIAlux Queue",
        description: `${notifications.dialuxRequest} simulations pending`,
        status: "pending",
        timestamp: new Date(),
        count: notifications.dialuxRequest,
        path: "/request/dialux",
        icon: Monitor
      })
    }
    
    if (notifications.shopDrawing > 0) {
      items.push({
        id: "shop-drawing",
        type: "Shop Drawing",
        title: "Shop Drawing Review",
        description: `${notifications.shopDrawing} drawings pending review`,
        status: "pending",
        timestamp: new Date(),
        count: notifications.shopDrawing,
        path: "/request/shop-drawing",
        icon: Wrench
      })
    }
    
    if (notifications.productRequest > 0) {
      items.push({
        id: "product-request",
        type: "SPF Product",
        title: "Product Requests",
        description: `${notifications.productRequest} product orders pending`,
        status: "pending",
        timestamp: new Date(),
        count: notifications.productRequest,
        path: "/request/product",
        icon: Package
      })
    }
    
    if (notifications.dialuxCompleted > 0) {
      items.push({
        id: "dialux-completed",
        type: "DIAlux",
        title: "Completed Simulations",
        description: `${notifications.dialuxCompleted} simulations finished`,
        status: "completed",
        timestamp: new Date(),
        count: notifications.dialuxCompleted,
        path: "/request/dialux",
        icon: CheckCircle2
      })
    }
    
    return items.sort((a, b) => {
      const statusOrder = { critical: 0, pending: 1, info: 2, completed: 3 }
      return statusOrder[a.status] - statusOrder[b.status]
    })
  }, [notifications])

  const filteredItems = React.useMemo(() => {
    if (activeTab === "all") return allItems
    if (activeTab === "critical") return allItems.filter(i => i.status === "critical")
    if (activeTab === "pending") return allItems.filter(i => i.status === "pending")
    return allItems
  }, [allItems, activeTab])

  const totalCount = allItems.reduce((sum, item) => sum + (item.count || 0), 0)
  const criticalCount = allItems.filter(i => i.status === "critical").reduce((sum, i) => sum + (i.count || 0), 0)
  const pendingCount = allItems.filter(i => i.status === "pending").reduce((sum, i) => sum + (i.count || 0), 0)

  const handleItemClick = (path: string) => {
    router.push(appendId(path))
    onClose()
  }

  return (
    <>
      {/* Mobile: fixed bottom sheet overlay */}
      <div className="sm:hidden fixed inset-0 z-[200] flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}>
        <div className="bg-white rounded-t-[28px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[80vh] flex flex-col"
          onClick={e => e.stopPropagation()}>
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-zinc-200 rounded-full" />
          </div>
          <NotifInner allItems={allItems} filteredItems={filteredItems} activeTab={activeTab} setActiveTab={setActiveTab} totalCount={totalCount} criticalCount={criticalCount} pendingCount={pendingCount} handleItemClick={handleItemClick} onClose={onClose} router={router} showSettings={showSettings} setShowSettings={setShowSettings} />
        </div>
      </div>

      {/* Desktop: dropdown */}
      <div className="hidden sm:block w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        onClick={e => e.stopPropagation()}>
        <NotifInner allItems={allItems} filteredItems={filteredItems} activeTab={activeTab} setActiveTab={setActiveTab} totalCount={totalCount} criticalCount={criticalCount} pendingCount={pendingCount} handleItemClick={handleItemClick} onClose={onClose} router={router} showSettings={showSettings} setShowSettings={setShowSettings} />
      </div>
    </>
  )
}

function NotifInner({ allItems, filteredItems, activeTab, setActiveTab, totalCount, criticalCount, pendingCount, handleItemClick, onClose, router, showSettings, setShowSettings }: any) {
  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-zinc-50 to-white shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#E33636]">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-black text-gray-900 text-[13px]">Notifications</h3>
              <p className="text-[9px] text-gray-400 font-medium">Real-time updates</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <Settings className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); setActiveTab("all") }} type="button"
            className={cn("flex-1 py-1.5 px-2 rounded-lg text-[9px] font-bold transition-all", activeTab === "all" ? "bg-zinc-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            All ({totalCount})
          </button>
          <button onClick={(e) => { e.stopPropagation(); setActiveTab("critical") }} type="button"
            className={cn("flex-1 py-1.5 px-2 rounded-lg text-[9px] font-bold transition-all flex items-center justify-center gap-1", activeTab === "critical" ? "bg-red-500 text-white" : "bg-red-50 text-red-600 hover:bg-red-100")}>
            <AlertTriangle className="w-3 h-3" />{criticalCount}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setActiveTab("pending") }} type="button"
            className={cn("flex-1 py-1.5 px-2 rounded-lg text-[9px] font-bold transition-all flex items-center justify-center gap-1", activeTab === "pending" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-600 hover:bg-amber-100")}>
            <Clock className="w-3 h-3" />{pendingCount}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[360px] overflow-y-auto flex-1">
        {filteredItems.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-[11px] font-black text-gray-900 mb-1">All Caught Up!</p>
            <p className="text-[9px] text-gray-400">No notifications in this category</p>
          </div>
        ) : (
          <div className="py-2">
            {filteredItems.map((item: any) => {
              const status = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending
              const Icon = item.icon || status.icon
              return (
                <div key={item.id} onClick={() => handleItemClick(item.path)}
                  className="mx-2 mb-2 p-3 rounded-xl border hover:shadow-md transition-all cursor-pointer group"
                  style={{ borderColor: item.status === "critical" ? "#fee2e2" : item.status === "pending" ? "#fef3c7" : "#e5e7eb" }}>
                  <div className="flex items-start gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", status.bg, status.text)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded uppercase", status.bg, status.text)}>{item.type}</span>
                        {item.status === "critical" && <span className="text-[8px] font-bold text-red-500 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />URGENT</span>}
                      </div>
                      <p className="text-[11px] font-bold text-gray-900 leading-tight mb-0.5">{item.title}</p>
                      <p className="text-[9px] text-gray-500 leading-relaxed">{item.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-2 group-hover:text-gray-500 transition-colors" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 bg-gray-50/50 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => { router.push("/notifications"); onClose() }}
            className="flex-1 py-2 rounded-lg bg-zinc-900 text-white text-[10px] font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1">
            View All <ExternalLink className="w-3 h-3" />
          </button>
          <button onClick={() => {}} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors" title="Mark all as read">
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  )
}
