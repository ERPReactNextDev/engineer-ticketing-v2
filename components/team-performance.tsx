"use client"

import React from "react"
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval, parseISO } from "date-fns"
import { 
  Users, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Award,
  Calendar,
  CheckCircle2,
  Clock
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface Visit {
  id: string
  site: string
  status: string
  submittedBy: string
  tsaName?: string
  date: string
  confirmedAt?: string
  completedAt?: string
}

interface TeamMember {
  id: string
  name: string
  role: string
}

interface TeamPerformanceProps {
  visits: Visit[]
  teamMembers: TeamMember[]
  userRole: string
  userDept: string
}

export function TeamPerformance({ visits, teamMembers, userRole, userDept }: TeamPerformanceProps) {
  // Only show for TSMs, Sales Heads, and Managers
  if (!["TSM", "MANAGER", "LEADER", "SUPER ADMIN"].includes(userRole) || 
      (!["SALES", "IT"].includes(userDept) && userDept !== "IT")) {
    return null
  }

  const now = new Date()
  const thisWeek = {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 })
  }

  const metrics = React.useMemo(() => {
    // Filter visits for this week
    const thisWeekVisits = visits.filter(v => {
      const visitDate = new Date(v.date)
      return isWithinInterval(visitDate, thisWeek)
    })

    // Team member stats
    const memberStats = teamMembers.map(member => {
      const memberVisits = visits.filter(v => v.submittedBy === member.id)
      const thisWeekMemberVisits = thisWeekVisits.filter(v => v.submittedBy === member.id)
      
      const totalVisits = memberVisits.length
      const thisWeekCount = thisWeekMemberVisits.length
      const completed = memberVisits.filter(v => v.status === "completed").length
      const pending = memberVisits.filter(v => v.status === "pending").length
      const confirmed = memberVisits.filter(v => v.status === "confirmed").length
      
      const closureRate = totalVisits > 0 ? (completed / totalVisits) * 100 : 0

      return {
        ...member,
        totalVisits,
        thisWeekCount,
        completed,
        pending,
        confirmed,
        closureRate
      }
    }).sort((a, b) => b.thisWeekCount - a.thisWeekCount)

    // Team totals
    const teamTotal = memberStats.reduce((sum, m) => sum + m.totalVisits, 0)
    const teamCompleted = memberStats.reduce((sum, m) => sum + m.completed, 0)
    const teamClosureRate = teamTotal > 0 ? (teamCompleted / teamTotal) * 100 : 0
    const teamThisWeek = memberStats.reduce((sum, m) => sum + m.thisWeekCount, 0)

    // Top performer
    const topPerformer = memberStats[0]

    return {
      memberStats,
      teamTotal,
      teamCompleted,
      teamClosureRate,
      teamThisWeek,
      topPerformer
    }
  }, [visits, teamMembers])

  return (
    <TooltipProvider delayDuration={100}>
      <Card className="border-violet-200/60 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-black uppercase tracking-wider text-zinc-700 flex items-center gap-2">
              <Users className="size-3.5 text-violet-500" />
              Team Performance
            </CardTitle>
            <Badge variant="outline" className="text-[9px] font-black text-violet-600 border-violet-200">
              This Week: {metrics.teamThisWeek}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Team Summary */}
          <div className="grid grid-cols-3 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-violet-50 rounded-lg p-2 text-center cursor-help">
                  <p className="text-[16px] font-black text-violet-600">
                    {metrics.teamTotal}
                  </p>
                  <p className="text-[7px] font-black text-violet-500 uppercase tracking-wider">
                    Total Visits
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-[10px]">All-time team visit count</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-emerald-50 rounded-lg p-2 text-center cursor-help">
                  <p className="text-[16px] font-black text-emerald-600">
                    {metrics.teamCompleted}
                  </p>
                  <p className="text-[7px] font-black text-emerald-500 uppercase tracking-wider">
                    Completed
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-[10px]">Successfully closed visits</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-blue-50 rounded-lg p-2 text-center cursor-help">
                  <p className="text-[16px] font-black text-blue-600">
                    {metrics.teamClosureRate.toFixed(0)}%
                  </p>
                  <p className="text-[7px] font-black text-blue-500 uppercase tracking-wider">
                    Closure Rate
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-[10px]">Percentage of visits completed</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Top Performer */}
          {metrics.topPerformer && metrics.topPerformer.thisWeekCount > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-2.5">
              <div className="flex items-center gap-2">
                <Award className="size-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-amber-700 uppercase tracking-wider">
                    Top Performer This Week
                  </p>
                  <p className="text-[11px] font-bold text-zinc-800 truncate">
                    {metrics.topPerformer.name}
                  </p>
                </div>
                <Badge className="bg-amber-100 text-amber-700 text-[9px] font-black shrink-0">
                  {metrics.topPerformer.thisWeekCount} visits
                </Badge>
              </div>
            </div>
          )}

          {/* Team Member List */}
          <div className="space-y-2">
            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">
              Team Member Activity
            </p>
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
              {metrics.memberStats.map(member => (
                <Tooltip key={member.id}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 cursor-help transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-zinc-700 truncate">
                            {member.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {member.thisWeekCount > 0 && (
                              <Badge variant="outline" className="text-[8px] font-black text-violet-600 border-violet-200 h-4">
                                <Calendar className="size-2.5 mr-1" />
                                {member.thisWeekCount}
                              </Badge>
                            )}
                            <span className={cn(
                              "text-[9px] font-black",
                              member.closureRate >= 80 ? "text-emerald-600" :
                              member.closureRate >= 50 ? "text-blue-600" : "text-zinc-500"
                            )}>
                              {member.closureRate.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[8px] text-zinc-500">
                          <span className="flex items-center gap-0.5">
                            <CheckCircle2 className="size-3 text-emerald-500" />
                            {member.completed}
                          </span>
                          <span className="mx-1">•</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="size-3 text-amber-500" />
                            {member.pending}
                          </span>
                          <span className="mx-1">•</span>
                          <span className="flex items-center gap-0.5">
                            <Target className="size-3 text-blue-500" />
                            {member.confirmed}
                          </span>
                        </div>
                      </div>
                      {member.thisWeekCount > 0 ? (
                        member.closureRate >= 80 ? (
                          <TrendingUp className="size-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <TrendingDown className="size-3.5 text-amber-500 shrink-0" />
                        )
                      ) : null}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="text-[10px] font-bold">{member.name}</p>
                    <p className="text-[9px] text-zinc-500">{member.role}</p>
                    <div className="mt-1 space-y-0.5 text-[9px]">
                      <p>Total: {member.totalVisits} visits</p>
                      <p>Completed: {member.completed}</p>
                      <p>Pending: {member.pending}</p>
                      <p>Confirmed: {member.confirmed}</p>
                      <p>Closure Rate: {member.closureRate.toFixed(1)}%</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Week Progress */}
          <div className="pt-2 border-t border-zinc-100">
            <div className="flex items-center justify-between text-[8px] font-bold text-zinc-600 mb-1">
              <span>Weekly Target Progress</span>
              <span>{metrics.teamThisWeek} / {teamMembers.length * 3} visits</span>
            </div>
            <Progress 
              value={Math.min((metrics.teamThisWeek / (teamMembers.length * 3)) * 100, 100)} 
              className="h-2"
            />
            <p className="text-[7px] text-zinc-400 mt-1">
              Target: 3 visits per team member per week
            </p>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
