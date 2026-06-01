"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Sparkles, Zap, Keyboard, LayoutDashboard, Users,
  X, ChevronRight, MousePointerClick, Bell, Clock,
  Filter, BarChart3, Target, ArrowRight, Lightbulb
} from "lucide-react"

interface DashboardGuideProps {
  department: string
  role: string
}

export function DashboardGuide({ department, role }: DashboardGuideProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [currentPage, setCurrentPage] = React.useState(0)
  const isAdmin = (department || "").toUpperCase() === "ADMIN"

  const adminFeatures = [
    {
      icon: LayoutDashboard,
      title: "Your Admin Command Center",
      description: "Your dashboard is tailored for room management. See pending approvals, room status, and today's schedule at a glance.",
      tip: "💡 Pending approvals are highlighted in amber — act on them first",
      color: "bg-zinc-900 text-white"
    },
    {
      icon: Bell,
      title: "Pending Approvals",
      description: "When staff book a meeting room, it appears here for your approval. Confirm or reject with a reason. Approved bookings notify the requester automatically.",
      tip: "🔔 Your bell icon only shows meeting room pending counts",
      color: "bg-amber-50 text-amber-600"
    },
    {
      icon: Target,
      title: "Room Status — Live",
      description: "See which rooms are occupied right now and which are free. Green pulse = available, red = in use. Tap any room to see its full schedule.",
      tip: "🟢 Green rooms are available · 🔴 Red rooms are currently in use",
      color: "bg-emerald-50 text-emerald-600"
    },
    {
      icon: BarChart3,
      title: "Room Analytics",
      description: "Track utilization rates, peak booking hours, and which departments use rooms most. Use this to optimize room availability and plan capacity.",
      tip: "📊 Go to Admin → Room Analytics for detailed reports",
      color: "bg-blue-50 text-blue-600"
    },
    {
      icon: Zap,
      title: "Quick Book (+ Button)",
      description: "Tap the + button at the bottom right to quickly book a room or view all bookings. You can also book on behalf of other staff.",
      tip: "⚡ Press N on keyboard to open quick actions instantly",
      color: "bg-violet-50 text-violet-600"
    },
  ]

  const features = isAdmin ? adminFeatures : [
    {
      icon: LayoutDashboard,
      title: "Services at Your Fingertips",
      description: "All your work tools are right at the top. Click any service tile to jump in, or check the badge counts for pending items.",
      tip: "💡 Click service tiles to quickly access your work tools",
      color: "bg-blue-50 text-blue-600"
    },
    {
      icon: Zap,
      title: "Quick Create (Press N)",
      description: "Need to create something fast? Press 'N' anywhere on the dashboard to open the quick create menu. Select your service type and go!",
      tip: "⌨️ Keyboard shortcut: Press N to create new items instantly",
      color: "bg-amber-50 text-amber-600"
    },
    {
      icon: Keyboard,
      title: "Keyboard Shortcuts",
      description: "Navigate faster with shortcuts! Press '?' anytime to see all available shortcuts. Common ones: S (Site Visits), J (Job Requests), T (Testing), M (Messages)",
      tip: "⌨️ Press ? for the full shortcuts help menu",
      color: "bg-violet-50 text-violet-600"
    },
    {
      icon: BarChart3,
      title: "Department Hub",
      description: "Your personalized dashboard shows metrics relevant to your role. Managers see team stats, members see their tasks, and everyone gets productivity tips.",
      tip: "📊 Role-specific widgets adapt to your department and position",
      color: "bg-emerald-50 text-emerald-600"
    },
    {
      icon: Filter,
      title: "Smart Task Filtering",
      description: "Use the filter pills to quickly find what matters: tasks due today, overdue items, or everything assigned to you.",
      tip: "🔍 Filter by: All, Today, This Week, Overdue, or Assigned to Me",
      color: "bg-cyan-50 text-cyan-600"
    },
    {
      icon: Target,
      title: "Workflow Pipeline",
      description: "Visualize your work moving through stages. See what's pending, in progress, completed, or needs attention - all in one view.",
      tip: "🎯 Track items from Pending → In Progress → Completed",
      color: "bg-pink-50 text-pink-600"
    },
    {
      icon: Users,
      title: "Team Availability (Managers)",
      description: "Managers and leaders can see team status in real-time. Know who's online, busy, or available for new assignments.",
      tip: "👥 Only visible to MANAGER, LEADER, and SUPER ADMIN roles",
      color: "bg-indigo-50 text-indigo-600"
    },
    {
      icon: Bell,
      title: "Smart Notifications",
      description: "Critical alerts appear automatically. Testing overdue? Site visit pending? You'll see it right away with action buttons.",
      tip: "🔔 Red badges and alerts prioritize what needs attention",
      color: "bg-red-50 text-red-600"
    },
    {
      icon: Clock,
      title: "Upcoming Next",
      description: "Your next scheduled task is prominently displayed. Never miss an appointment with the upcoming summary card.",
      tip: "⏰ Click the card to jump directly to the task details",
      color: "bg-orange-50 text-orange-600"
    },
  ]

  // Auto-show on first visit
  React.useEffect(() => {
    const hasSeenGuide = localStorage.getItem("dsi-dashboard-guide-seen")
    if (!hasSeenGuide) {
      setIsOpen(true)
    }
  }, [])

  const handleClose = () => {
    localStorage.setItem("dsi-dashboard-guide-seen", "true")
    setIsOpen(false)
  }

  if (!isOpen) {
    // Show mini button when closed
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-40 bg-gradient-to-r from-amber-500 to-amber-600 text-white p-2.5 rounded-full shadow-xl flex items-center gap-1.5 hover:scale-105 transition-all group"
        title="Dashboard Guide"
      >
        <Lightbulb className="w-4 h-4" />
        <span className="text-[10px] font-bold pr-0.5">Guide</span>
      </button>
    )
  }

  const currentFeature = features[currentPage]
  const Icon = currentFeature.icon

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-zinc-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-white">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900">{isAdmin ? "Admin Guide" : "Dashboard Features"}</h3>
              <p className="text-[10px] font-bold text-gray-400">
                Page {currentPage + 1} of {features.length}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-4", currentFeature.color)}>
            <Icon className="w-8 h-8" />
          </div>
          
          <h4 className="text-lg font-black text-gray-900 mb-2">
            {currentFeature.title}
          </h4>
          <p className="text-[13px] font-medium text-gray-600 leading-relaxed mb-4">
            {currentFeature.description}
          </p>
          
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-[11px] font-bold text-gray-700">
              {currentFeature.tip}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between">
            {/* Dots */}
            <div className="flex items-center gap-1.5">
              {features.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={cn(
                    "h-2 rounded-full transition-all duration-200",
                    currentPage === i ? "w-6 bg-zinc-900" : "w-2 bg-gray-300 hover:bg-gray-400"
                  )}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              {currentPage > 0 && (
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="px-4 py-2 rounded-xl text-[11px] font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Previous
                </button>
              )}
              {currentPage < features.length - 1 ? (
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-[11px] font-bold hover:bg-zinc-800 transition-colors flex items-center gap-1"
                >
                  Next <ArrowRight className="w-3 h-3" />
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl bg-[#E33636] text-white text-[11px] font-bold hover:bg-red-700 transition-colors"
                >
                  Got it!
                </button>
              )}
            </div>
          </div>

          {/* Skip option */}
          <button
            onClick={handleClose}
            className="w-full mt-3 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
          >
            Don't show this guide again
          </button>
        </div>

        {/* Your context */}
        <div className="px-5 py-3 bg-zinc-900 text-white">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Your Context: <span className="text-white">{department || "General"}</span> · <span className="text-white">{role || "Member"}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// Compact feature cards for inline display
export function QuickFeaturesList({ department, role }: DashboardGuideProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const quickFeatures = [
    { icon: Zap, text: "Press N for quick create", color: "text-amber-500" },
    { icon: Keyboard, text: "Press ? for shortcuts", color: "text-violet-500" },
    { icon: LayoutDashboard, text: "Services at top", color: "text-blue-500" },
    { icon: Filter, text: "Filter tasks easily", color: "text-cyan-500" },
  ]

  return (
    <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-2xl p-4 text-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h4 className="text-[11px] font-black uppercase tracking-wider">Pro Tips</h4>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[9px] font-bold text-zinc-400 hover:text-white transition-colors"
        >
          {isExpanded ? "Show Less" : "Show All"}
        </button>
      </div>

      <div className={cn("grid gap-2 transition-all", isExpanded ? "grid-cols-1" : "grid-cols-2")}>
        {(isExpanded ? quickFeatures : quickFeatures.slice(0, 4)).map((feature, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px] font-medium text-zinc-300">
            <feature.icon className={cn("w-3.5 h-3.5", feature.color)} />
            <span>{feature.text}</span>
          </div>
        ))}
      </div>

      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full mt-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-[10px] font-bold"
        >
          View Full Dashboard Guide
        </button>
      )}
    </div>
  )
}
