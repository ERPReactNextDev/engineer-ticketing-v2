"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { 
  Plus, 
  Copy, 
  Calendar, 
  Clock, 
  FileText,
  History,
  ArrowUpRight,
  Sparkles
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface Visit {
  id: string
  site: string
  type: string
  date: string
  status: string
}

interface QuickActionsProps {
  recentVisits: Visit[]
  userRole: string
  userDept: string
  onCreateNew?: () => void
  onDuplicate?: (visit: Visit) => void
}

export function QuickActions({ 
  recentVisits, 
  userRole, 
  userDept, 
  onCreateNew, 
  onDuplicate 
}: QuickActionsProps) {
  const router = useRouter()

  // Only show for TSAs and Sales team members
  if (!["TSA", "MEMBER", "TSM", "MANAGER", "SUPER ADMIN"].includes(userRole) ||
      (!["SALES", "IT"].includes(userDept) && userDept !== "IT")) {
    return null
  }

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew()
    } else {
      router.push("/appointments/site-visit/new")
    }
  }

  const handleDuplicate = (visit: Visit) => {
    if (onDuplicate) {
      onDuplicate(visit)
    }
  }

  const handleViewHistory = () => {
    router.push("/appointments/site-visit?view=history")
  }

  // Get 3 most recent visits for quick duplicate
  const recentForDuplicate = recentVisits.slice(0, 3)

  return (
    <TooltipProvider delayDuration={100}>
      <Card className="border-emerald-200/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-[11px] font-black uppercase tracking-wider text-zinc-700 flex items-center gap-2">
            <Sparkles className="size-3.5 text-emerald-500" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Primary Action */}
          <Button 
            onClick={handleCreateNew}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-wider group"
          >
            <Plus className="size-4 mr-2 group-hover:scale-110 transition-transform" />
            Request New Site Visit
          </Button>

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  onClick={handleViewHistory}
                  className="h-9 text-[9px] font-bold text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                >
                  <History className="size-3.5 mr-1.5" />
                  My History
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-[10px]">View all your past site visits</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  onClick={() => router.push("/appointments/site-visit?view=calendar")}
                  className="h-9 text-[9px] font-bold text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                >
                  <Calendar className="size-3.5 mr-1.5" />
                  Calendar
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-[10px]">View visits in calendar view</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Duplicate Recent */}
          {recentForDuplicate.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <div className="flex items-center gap-2">
                <Copy className="size-3 text-zinc-400" />
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">
                  Duplicate Recent
                </span>
              </div>
              <div className="space-y-1.5">
                {recentForDuplicate.map(visit => (
                  <Tooltip key={visit.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleDuplicate(visit)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors text-left group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-bold text-zinc-700 truncate">
                            {visit.site}
                          </p>
                          <p className="text-[8px] text-zinc-500">
                            {visit.type}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[7px] font-black h-4",
                              visit.status === "completed" ? "text-emerald-600 border-emerald-200" :
                              visit.status === "confirmed" ? "text-blue-600 border-blue-200" :
                              "text-amber-600 border-amber-200"
                            )}
                          >
                            {visit.status}
                          </Badge>
                          <ArrowUpRight className="size-3.5 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p className="text-[10px]">Duplicate this visit</p>
                      <p className="text-[9px] text-zinc-500">Pre-fill form with same client details</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
            <div className="flex items-start gap-2">
              <FileText className="size-3.5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[8px] font-black text-blue-700 uppercase tracking-wider">
                  Pro Tip
                </p>
                <p className="text-[8px] text-blue-600 leading-relaxed">
                  Use "Duplicate" to quickly create similar visits for the same client. 
                  It copies all details except the date.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
