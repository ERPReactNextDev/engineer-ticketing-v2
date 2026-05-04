"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Users, Briefcase, Target, Zap, TrendingUp, Clock,
  CalendarCheck, FileText, Package, Monitor, ClipboardCheck,
  AlertTriangle, CheckCircle2, ArrowRight, BarChart3, Star,
} from "lucide-react"

// ── TYPES ──
type Department = "ENGINEERING" | "SALES" | "PROCUREMENT" | "WAREHOUSE OPERATIONS" | "IT" | string

type UserRole = "SUPER ADMIN" | "MANAGER" | "LEADER" | "MEMBER" | "SALES HEAD" | "TERRITORY SALES MANAGER" | "TERRITORY SALES ASSOCIATE" | string

interface DepartmentWidgetsProps {
  department: Department
  role: UserRole
  userId?: string | null
  className?: string
}

interface WidgetCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  color: string
  href?: string
  trend?: "up" | "down" | "neutral"
}

// ── WIDGET CARD COMPONENT ──
function WidgetCard({ title, value, subtitle, icon: Icon, color, href, trend }: WidgetCardProps) {
  const content = (
    <div className={cn(
      "p-4 rounded-2xl border transition-all duration-200",
      href && "cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]",
      color
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-wider opacity-70">{title}</p>
          <p className="text-2xl font-black mt-1">{value}</p>
          {subtitle && (
            <p className="text-[10px] font-bold mt-1 opacity-80">{subtitle}</p>
          )}
        </div>
        <div className="p-2 rounded-xl bg-white/50">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          <TrendingUp className={cn(
            "w-3 h-3",
            trend === "up" && "text-emerald-500",
            trend === "down" && "text-red-500 rotate-180",
            trend === "neutral" && "text-zinc-400"
          )} />
          <span className="text-[9px] font-bold">
            {trend === "up" ? "+12%" : trend === "down" ? "-5%" : "0%"}
          </span>
        </div>
      )}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

// ── DEPARTMENT-SPECIFIC CONTENT ──
const DEPARTMENT_CONTENT: Record<string, {
  title: string
  description: string
  quickLinks: { label: string; href: string; icon: any }[]
  metrics: { label: string; key: string }[]
}> = {
  ENGINEERING: {
    title: "Engineering Hub",
    description: "Manage site visits, shop drawings, and testing workflows.",
    quickLinks: [
      { label: "Assignment Matrix", href: "/admin/assignment-matrix", icon: Users },
      { label: "Site Visits", href: "/appointments/site-visit", icon: CalendarCheck },
      { label: "Testing Monitor", href: "/request/testing", icon: ClipboardCheck },
      { label: "Shop Drawings", href: "/request/shop-drawing", icon: FileText },
    ],
    metrics: [
      { label: "Pending Reviews", key: "pendingReviews" },
      { label: "Active Tests", key: "activeTests" },
      { label: "Site Visits Today", key: "todayVisits" },
    ]
  },
  SALES: {
    title: "Sales Command Center",
    description: "Track opportunities, job requests, and client interactions.",
    quickLinks: [
      { label: "Job Requests", href: "/request/job", icon: FileText },
      { label: "DIAlux Queue", href: "/request/dialux", icon: Monitor },
      { label: "Site Visits", href: "/appointments/site-visit", icon: CalendarCheck },
      { label: "Products", href: "/request/product", icon: Package },
    ],
    metrics: [
      { label: "Open Opportunities", key: "openOpps" },
      { label: "Pending Quotes", key: "pendingQuotes" },
      { label: "Client Meetings", key: "clientMeetings" },
    ]
  },
  PROCUREMENT: {
    title: "Procurement Dashboard",
    description: "Monitor product requests, testing status, and vendor performance.",
    quickLinks: [
      { label: "Product Requests", href: "/request/product", icon: Package },
      { label: "Testing Status", href: "/request/testing", icon: ClipboardCheck },
      { label: "Job Requests", href: "/request/job", icon: FileText },
    ],
    metrics: [
      { label: "Pending Approvals", key: "pendingApprovals" },
      { label: "In Testing", key: "inTesting" },
      { label: "Overdue Items", key: "overdue" },
    ]
  },
  IT: {
    title: "IT Operations Center",
    description: "System health, user management, and platform administration.",
    quickLinks: [
      { label: "System Logs", href: "/admin/logs", icon: BarChart3 },
      { label: "Permissions", href: "/admin/permissions", icon: Users },
      { label: "Staff Directory", href: "/admin/staff", icon: Briefcase },
    ],
    metrics: [
      { label: "Active Users", key: "activeUsers" },
      { label: "System Alerts", key: "systemAlerts" },
      { label: "Pending Tickets", key: "pendingTickets" },
    ]
  },
}

// ── ROLE-SPECIFIC WIDGETS ──
const ROLE_WIDGETS: Record<string, { title: string; icon: any; color: string }[]> = {
  "SUPER ADMIN": [
    { title: "Total Users", icon: Users, color: "bg-blue-50 text-blue-600 border-blue-100" },
    { title: "Active Sessions", icon: Zap, color: "bg-amber-50 text-amber-600 border-amber-100" },
    { title: "System Health", icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  ],
  "SALES HEAD": [
    { title: "Sales Team", icon: Users, color: "bg-violet-50 text-violet-600 border-violet-100" },
    { title: "Territories", icon: Target, color: "bg-amber-50 text-amber-600 border-amber-100" },
    { title: "Revenue Pipeline", icon: TrendingUp, color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  ],
  "TERRITORY SALES MANAGER": [
    { title: "My TSAs", icon: Users, color: "bg-amber-50 text-amber-600 border-amber-100" },
    { title: "Territory Performance", icon: Target, color: "bg-indigo-50 text-indigo-600 border-indigo-100" },
    { title: "Active Deals", icon: Zap, color: "bg-cyan-50 text-cyan-600 border-cyan-100" },
  ],
  "TERRITORY SALES ASSOCIATE": [
    { title: "My Pipeline", icon: Briefcase, color: "bg-orange-50 text-orange-600 border-orange-100" },
    { title: "Client Meetings", icon: CalendarCheck, color: "bg-blue-50 text-blue-600 border-blue-100" },
    { title: "Monthly Target", icon: Target, color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  ],
  MANAGER: [
    { title: "Team Members", icon: Users, color: "bg-violet-50 text-violet-600 border-violet-100" },
    { title: "Pending Approvals", icon: Clock, color: "bg-orange-50 text-orange-600 border-orange-100" },
    { title: "Weekly Goals", icon: Target, color: "bg-indigo-50 text-indigo-600 border-indigo-100" },
  ],
  LEADER: [
    { title: "Squad Tasks", icon: Briefcase, color: "bg-cyan-50 text-cyan-600 border-cyan-100" },
    { title: "Completion Rate", icon: TrendingUp, color: "bg-pink-50 text-pink-600 border-pink-100" },
  ],
  MEMBER: [
    { title: "My Tasks", icon: Target, color: "bg-zinc-50 text-zinc-600 border-zinc-100" },
    { title: "Due Today", icon: Clock, color: "bg-red-50 text-red-600 border-red-100" },
  ],
}

// ── MAIN COMPONENT ──
export function DepartmentWidgets({ department, role, userId, className }: DepartmentWidgetsProps) {
  const dept = (department || "").toUpperCase()
  const r = (role || "MEMBER").toUpperCase()
  
  const content = DEPARTMENT_CONTENT[dept] || {
    title: "My Dashboard",
    description: "Access your tasks, schedule, and notifications.",
    quickLinks: [
      { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
      { label: "My Tasks", href: "/dashboard?tab=My Tasks", icon: Target },
      { label: "Schedule", href: "/appointments/slots", icon: CalendarCheck },
    ],
    metrics: [
      { label: "Pending Tasks", key: "pendingTasks" },
      { label: "Upcoming", key: "upcoming" },
    ]
  }

  const roleWidgets = ROLE_WIDGETS[r] || ROLE_WIDGETS.MEMBER
  
  const appendId = (url: string) => userId
    ? url.includes("?") ? `${url}&userId=${userId}` : `${url}?userId=${userId}`
    : url

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-zinc-900 tracking-tight">{content.title}</h2>
          <p className="text-[11px] font-bold text-zinc-500 mt-0.5">{content.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-zinc-100 text-zinc-600">
            {dept}
          </span>
          <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-zinc-900 text-white">
            {r}
          </span>
        </div>
      </div>

      {/* Role-specific Metrics */}
      <div className="grid grid-cols-3 gap-3">
        {roleWidgets.map((widget, i) => (
          <WidgetCard
            key={i}
            title={widget.title}
            value={i === 0 ? "12" : i === 1 ? "8" : "94%"}
            subtitle={i === 2 ? "On track" : undefined}
            icon={widget.icon}
            color={widget.color}
            trend={i === 0 ? "up" : i === 1 ? "neutral" : "up"}
          />
        ))}
      </div>

      {/* Department Quick Links */}
      <div className="bg-white rounded-2xl border border-zinc-200/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-500" />
          <h3 className="text-[11px] font-black uppercase tracking-wider text-zinc-700">
            Quick Access
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {content.quickLinks.map((link, i) => (
            <Link
              key={i}
              href={appendId(link.href)}
              className="flex items-center gap-2 p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-all group"
            >
              <link.icon className="w-4 h-4 text-zinc-500 group-hover:text-zinc-900" />
              <span className="text-[10px] font-bold text-zinc-600 group-hover:text-zinc-900">
                {link.label}
              </span>
              <ArrowRight className="w-3 h-3 ml-auto text-zinc-300 group-hover:text-zinc-500 group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      </div>

      {/* Productivity Tip */}
      <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-2xl p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white/10">
            <Star className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-300 mb-1">
              Productivity Tip
            </h4>
            <p className="text-[12px] font-medium text-white leading-relaxed">
              {dept === "ENGINEERING" && "Use keyboard shortcuts to speed up navigation. Press 'S' then Enter to create a new Site Visit."}
              {dept === "SALES" && "Keep your client pipeline updated. Schedule follow-ups immediately after each meeting."}
              {dept === "PROCUREMENT" && "Set up automated alerts for testing deadlines to avoid delays."}
              {dept === "IT" && "Monitor system logs daily to catch potential issues before they escalate."}
              {!["ENGINEERING", "SALES", "PROCUREMENT", "IT"].includes(dept) && "Organize your tasks by priority and tackle high-impact items first."}
            </p>
          </div>
        </div>
      </div>

      {/* Critical Alerts (conditional) */}
      {(r === "MANAGER" || r === "SUPER ADMIN") && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="text-[11px] font-black uppercase tracking-wider text-red-700">
              Attention Required
            </h3>
          </div>
          <p className="text-[11px] font-bold text-red-600">
            3 items require your immediate review. Check your notifications for details.
          </p>
          <Link 
            href={appendId("/notifications")}
            className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-red-600 hover:text-red-700"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  )
}

// ── MINI WIDGET FOR SIDEBAR ──
export function DepartmentMiniWidget({ department, role }: { department: Department; role: UserRole }) {
  const dept = (department || "").toUpperCase()
  const r = (role || "MEMBER").toUpperCase()
  
  const colors: Record<string, string> = {
    ENGINEERING: "bg-blue-50 text-blue-600 border-blue-100",
    SALES: "bg-red-50 text-red-600 border-red-100",
    PROCUREMENT: "bg-violet-50 text-violet-600 border-violet-100",
    IT: "bg-emerald-50 text-emerald-600 border-emerald-100",
  }
  
  const color = colors[dept] || "bg-zinc-50 text-zinc-600 border-zinc-100"
  
  return (
    <div className={cn("rounded-xl border p-3", color)}>
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-wider">{dept}</span>
      </div>
      <p className="text-[9px] font-bold mt-1 opacity-80">
        {r} access active
      </p>
    </div>
  )
}
