"use client"

import React from "react"
import { Users, Briefcase, AlertCircle, ArrowRightLeft, TrendingDown, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface Visit {
  id: string
  site: string
  tech: string
  status: string
  date: string
  type: string
}

interface StaffMember {
  _id: string
  ReferenceID: string
  Firstname: string
  Lastname: string
  Department: string
  Role: string
}

interface WorkloadBalancerProps {
  visits: Visit[]
  staff: StaffMember[]
  staffNames: Record<string, string>
  userDept: string
  userRole: string
  onReassign?: (visitId: string, newTech: string) => void
}

const MAX_WORKLOAD = 10 // Suggested max visits per engineer

export function WorkloadBalancer({ 
  visits, 
  staff, 
  staffNames, 
  userDept, 
  userRole,
  onReassign 
}: WorkloadBalancerProps) {
  // Get engineering staff only (PICs/Engineers who can be assigned to visits)
  const engineeringStaff = React.useMemo(() => {
    return staff.filter(s => 
      s.Department === "ENGINEERING" || 
      s.Department === "Engineering"
    )
  }, [staff])

  // Calculate workload for each engineer
  const workloadData = React.useMemo(() => {
    const activeVisits = visits.filter(v => 
      v.status === "PENDING" || v.status === "CONFIRMED"
    )

    const workload = engineeringStaff.map(engineer => {
      const assignedVisits = activeVisits.filter(v => v.tech === engineer.ReferenceID)
      const visitCount = assignedVisits.length
      const utilization = Math.min((visitCount / MAX_WORKLOAD) * 100, 100)
      
      return {
        id: engineer.ReferenceID,
        name: `${engineer.Firstname} ${engineer.Lastname}`.trim() || staffNames[engineer.ReferenceID] || engineer.ReferenceID,
        role: engineer.Role,
        visitCount,
        visits: assignedVisits,
        utilization,
        isOverloaded: visitCount > MAX_WORKLOAD,
        isAvailable: visitCount < 3 // Under 3 is considered available
      }
    }).sort((a, b) => b.visitCount - a.visitCount)

    const totalAssigned = workload.reduce((sum, w) => sum + w.visitCount, 0)
    const overloadedCount = workload.filter(w => w.isOverloaded).length
    const availableCount = workload.filter(w => w.isAvailable && w.visitCount > 0).length

    return { workload, totalAssigned, overloadedCount, availableCount }
  }, [engineeringStaff, visits, staffNames])

  // Only show for Engineering/IT
  if (!["IT", "ENGINEERING", "Engineering"].includes(userDept) && userRole !== "SUPER ADMIN") {
    return null
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Card className="border-blue-200/60 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-black uppercase tracking-wider text-zinc-700 flex items-center gap-2">
              <Users className="size-3.5 text-blue-500" />
              Workload Balancer
            </CardTitle>
            <div className="flex items-center gap-2">
              {workloadData.overloadedCount > 0 && (
                <Badge variant="destructive" className="text-[9px] font-black">
                  {workloadData.overloadedCount} Overloaded
                </Badge>
              )}
              <Badge variant="outline" className="text-[9px] font-black text-zinc-600">
                {workloadData.totalAssigned} Active
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-[16px] font-black text-blue-600">
                {workloadData.workload.length}
              </p>
              <p className="text-[7px] font-black text-blue-500 uppercase tracking-wider">
                Engineers
              </p>
            </div>
            <div className={cn(
              "rounded-lg p-2 text-center",
              workloadData.overloadedCount > 0 ? "bg-red-50" : "bg-emerald-50"
            )}>
              <p className={cn(
                "text-[16px] font-black",
                workloadData.overloadedCount > 0 ? "text-red-600" : "text-emerald-600"
              )}>
                {workloadData.overloadedCount}
              </p>
              <p className={cn(
                "text-[7px] font-black uppercase tracking-wider",
                workloadData.overloadedCount > 0 ? "text-red-500" : "text-emerald-500"
              )}>
                Overloaded
              </p>
            </div>
            <div className="bg-violet-50 rounded-lg p-2 text-center">
              <p className="text-[16px] font-black text-violet-600">
                {workloadData.availableCount}
              </p>
              <p className="text-[7px] font-black text-violet-500 uppercase tracking-wider">
                Available
              </p>
            </div>
          </div>

          {/* Recommendation */}
          {workloadData.overloadedCount > 0 && workloadData.availableCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2">
              <AlertCircle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[9px] font-black text-amber-700">
                  Workload Imbalance Detected
                </p>
                <p className="text-[8px] text-amber-600">
                  Consider reassigning visits from overloaded engineers to available ones
                </p>
              </div>
            </div>
          )}

          {/* Engineer Workload List */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">
              Engineer Capacity
            </p>
            {workloadData.workload.map(engineer => (
              <Tooltip key={engineer.id}>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-2 p-2 rounded-lg cursor-help transition-colors",
                    engineer.isOverloaded ? "bg-red-50 hover:bg-red-100" : 
                    engineer.isAvailable ? "bg-emerald-50 hover:bg-emerald-100" : 
                    "bg-zinc-50 hover:bg-zinc-100"
                  )}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-zinc-700 truncate">
                          {engineer.name}
                        </span>
                        <span className={cn(
                          "text-[9px] font-black shrink-0",
                          engineer.isOverloaded ? "text-red-600" : 
                          engineer.isAvailable ? "text-emerald-600" : "text-zinc-600"
                        )}>
                          {engineer.visitCount} visits
                        </span>
                      </div>
                      <Progress 
                        value={engineer.utilization} 
                        className="h-1.5"
                      />
                    </div>
                    {engineer.isOverloaded ? (
                      <TrendingUp className="size-3.5 text-red-500 shrink-0" />
                    ) : engineer.isAvailable ? (
                      <TrendingDown className="size-3.5 text-emerald-500 shrink-0" />
                    ) : null}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px]">
                  <p className="text-[10px] font-bold mb-1">{engineer.name} ({engineer.role})</p>
                  {engineer.visits.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-[9px] text-zinc-500 font-bold">Assigned Visits:</p>
                      {engineer.visits.map(v => (
                        <div key={v.id} className="text-[9px] text-zinc-700 truncate">
                          • {v.site} ({v.date})
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[9px] text-zinc-500">No active visits assigned</p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Unassigned Visits Alert */}
          {visits.filter(v => v.tech === "UNASSIGNED" && (v.status === "pending" || v.status === "confirmed")).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="size-3.5 text-amber-500" />
                  <span className="text-[9px] font-black text-amber-700">
                    {visits.filter(v => v.tech === "UNASSIGNED" && (v.status === "pending" || v.status === "confirmed")).length} Unassigned
                  </span>
                </div>
                <span className="text-[8px] text-amber-600">
                  Awaiting PIC assignment
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
