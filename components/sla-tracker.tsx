"use client"

import React from "react"
import { differenceInHours, differenceInDays, parseISO, format, isValid } from "date-fns"
import { 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp,
  Timer,
  CalendarClock,
  AlertTriangle
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface Visit {
  id: string
  site: string
  submittedAt?: string
  confirmedAt?: string
  completedAt?: string
  date: string
  time: string
  status: string
  tech: string
  submittedBy: string
}

interface SLATrackerProps {
  visits: Visit[]
  userRole: string
  userDept: string
}

const TARGET_RESPONSE_HOURS = 24 // Target: confirm within 24 hours
const TARGET_COMPLETION_DAYS = 7   // Target: complete within 7 days of scheduled date

// Helper to safely parse dates (handles both ISO strings and Firestore Timestamps)
const safeParseDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return isValid(dateValue) ? dateValue : null;
  if (typeof dateValue === 'string') {
    const parsed = parseISO(dateValue);
    return isValid(parsed) ? parsed : null;
  }
  // Handle Firestore Timestamp objects
  if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
    const date = dateValue.toDate();
    return isValid(date) ? date : null;
  }
  return null;
};

export function SLATracker({ visits, userRole, userDept }: SLATrackerProps) {
  // Calculate SLA metrics
  const metrics = React.useMemo(() => {
    const now = new Date()
    
    // Overdue visits (scheduled date passed but not completed)
    const overdue = visits.filter(v => {
      if (v.status === "completed" || v.status === "cancelled") return false
      const scheduledDate = new Date(`${v.date}T${v.time || "00:00"}`)
      return scheduledDate < now
    })

    // Calculate response times (submitted → confirmed)
    const responseTimes = visits
      .filter(v => v.submittedAt && v.confirmedAt)
      .map(v => {
        const submitted = safeParseDate(v.submittedAt)
        const confirmed = safeParseDate(v.confirmedAt)
        if (!submitted || !confirmed) return 0;
        return differenceInHours(confirmed, submitted)
      })

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0

    // Calculate completion times (confirmed → completed)
    const completionTimes = visits
      .filter(v => v.confirmedAt && v.completedAt)
      .map(v => {
        const confirmed = safeParseDate(v.confirmedAt)
        const completed = safeParseDate(v.completedAt)
        if (!confirmed || !completed) return 0;
        return differenceInDays(completed, confirmed)
      })

    const avgCompletionDays = completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0

    // Compliance rates
    const responseCompliant = visits.filter(v => {
      if (!v.submittedAt || !v.confirmedAt) return false
      const submitted = safeParseDate(v.submittedAt)
      const confirmed = safeParseDate(v.confirmedAt)
      if (!submitted || !confirmed) return false;
      return differenceInHours(confirmed, submitted) <= TARGET_RESPONSE_HOURS
    }).length

    const responseComplianceRate = visits.filter(v => v.submittedAt && v.confirmedAt).length > 0
      ? (responseCompliant / visits.filter(v => v.submittedAt && v.confirmedAt).length) * 100
      : 100

    // Status breakdown
    const pending = visits.filter(v => v.status === "pending").length
    const confirmed = visits.filter(v => v.status === "confirmed").length
    const completed = visits.filter(v => v.status === "completed").length

    return {
      overdue: overdue.length,
      overdueList: overdue.slice(0, 5), // Top 5 overdue
      avgResponseTime,
      avgCompletionDays,
      responseComplianceRate,
      pending,
      confirmed,
      completed,
      total: visits.length
    }
  }, [visits])

  // Only show for Engineering, IT, and Sales Heads/TSMs
  if (!["IT", "ENGINEERING", "Engineering"].includes(userDept) && 
      !["SUPER ADMIN", "MANAGER", "LEADER", "TSM"].includes(userRole)) {
    return null
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Card className="border-amber-200/60 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-black uppercase tracking-wider text-zinc-700 flex items-center gap-2">
              <Clock className="size-3.5 text-amber-500" />
              SLA Performance Tracker
            </CardTitle>
            {metrics.overdue > 0 && (
              <Badge variant="destructive" className="text-[9px] font-black animate-pulse">
                <AlertTriangle className="size-3 mr-1" />
                {metrics.overdue} Overdue
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Overdue Alerts */}
          {metrics.overdue > 0 && (
            <div className="space-y-1.5">
              <p className="text-[9px] font-black text-red-500 uppercase tracking-wider">
                <AlertCircle className="size-3 inline mr-1" />
                Critical: Overdue Visits Requiring Attention
              </p>
              <div className="space-y-1">
                {metrics.overdueList.map(visit => (
                  <Tooltip key={visit.id}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between text-[9px] bg-red-50 px-2 py-1.5 rounded cursor-help">
                        <span className="font-bold text-zinc-700 truncate flex-1 mr-2">{visit.site}</span>
                        <span className="text-red-600 font-black shrink-0">
                          {format(new Date(visit.date), "MMM d")}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-[10px] font-bold">Scheduled: {visit.date} at {visit.time}</p>
                      <p className="text-[9px] text-zinc-500">PIC: {visit.tech === "UNASSIGNED" ? "Not Assigned" : visit.tech}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {metrics.overdue > 5 && (
                  <p className="text-[9px] text-zinc-500 text-center italic">
                    +{metrics.overdue - 5} more overdue visits...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Response Time */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-blue-50 rounded-lg p-2 cursor-help">
                  <div className="flex items-center gap-1 mb-1">
                    <Timer className="size-3 text-blue-500" />
                    <span className="text-[8px] font-black text-blue-500 uppercase">Response</span>
                  </div>
                  <p className="text-[14px] font-black text-zinc-800">
                    {metrics.avgResponseTime.toFixed(1)}h
                  </p>
                  <p className="text-[7px] text-zinc-500">avg to confirm</p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-[10px]">Target: {TARGET_RESPONSE_HOURS} hours</p>
                <p className="text-[9px] text-zinc-500">
                  {metrics.responseComplianceRate.toFixed(0)}% within target
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Completion Time */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-emerald-50 rounded-lg p-2 cursor-help">
                  <div className="flex items-center gap-1 mb-1">
                    <CalendarClock className="size-3 text-emerald-500" />
                    <span className="text-[8px] font-black text-emerald-500 uppercase">Completion</span>
                  </div>
                  <p className="text-[14px] font-black text-zinc-800">
                    {metrics.avgCompletionDays.toFixed(1)}d
                  </p>
                  <p className="text-[7px] text-zinc-500">avg to close</p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-[10px]">Target: {TARGET_COMPLETION_DAYS} days</p>
                <p className="text-[9px] text-zinc-500">From confirmation to completion</p>
              </TooltipContent>
            </Tooltip>

            {/* Compliance Rate */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-violet-50 rounded-lg p-2 cursor-help">
                  <div className="flex items-center gap-1 mb-1">
                    <CheckCircle2 className="size-3 text-violet-500" />
                    <span className="text-[8px] font-black text-violet-500 uppercase">Compliance</span>
                  </div>
                  <p className="text-[14px] font-black text-zinc-800">
                    {metrics.responseComplianceRate.toFixed(0)}%
                  </p>
                  <p className="text-[7px] text-zinc-500">within SLA</p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-[10px]">Visits confirmed within {TARGET_RESPONSE_HOURS}h target</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[8px] font-bold text-zinc-600">
              <span>Status Distribution</span>
              <span className="text-zinc-400">{metrics.total} total</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden">
              {metrics.total > 0 && (
                <>
                  <div 
                    className="bg-amber-400" 
                    style={{ width: `${(metrics.pending / metrics.total) * 100}%` }}
                  />
                  <div 
                    className="bg-blue-400" 
                    style={{ width: `${(metrics.confirmed / metrics.total) * 100}%` }}
                  />
                  <div 
                    className="bg-emerald-400" 
                    style={{ width: `${(metrics.completed / metrics.total) * 100}%` }}
                  />
                </>
              )}
            </div>
            <div className="flex items-center gap-3 text-[8px]">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-amber-400" />
                <span className="text-zinc-600">Pending {metrics.pending}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-blue-400" />
                <span className="text-zinc-600">Confirmed {metrics.confirmed}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <span className="text-zinc-600">Completed {metrics.completed}</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
