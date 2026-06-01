"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  version?: string
  trigger?: React.ReactNode
  actions?: React.ReactNode
  showBackButton?: boolean
  className?: string
}

export function PageHeader({
  title,
  version = "V1.0",
  trigger,
  actions,
  showBackButton = true,
  className,
}: PageHeaderProps) {
  const router = useRouter()

  /* Split title on "/" for breadcrumb-style rendering */
  const parts = title.split("/").map(p => p.trim()).filter(Boolean)

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-14 md:h-16 shrink-0 items-center",
        "border-b border-zinc-200 bg-white",
        "px-3 md:px-6 justify-between shadow-xl transition-all duration-200",
        className
      )}
    >
      {/* ── LEFT: trigger + back + breadcrumb ── */}
      <div className="flex items-center gap-1.5 md:gap-2 min-w-0">

        {/* Sidebar trigger — rendered as-is (SidebarTrigger from shadcn) */}
        {trigger && (
          <div className="shrink-0 flex items-center">
            {trigger}
          </div>
        )}

        {/* Thin separator */}
        {trigger && (
          <div className="h-5 w-px bg-zinc-200 mx-1 shrink-0" />
        )}

        {/* Back button */}
        {showBackButton && (
          <button
            onClick={() => router.back()}
            className={cn(
              "group shrink-0 flex items-center justify-center",
              "size-8 rounded-lg",
              "border border-zinc-200 bg-white hover:bg-zinc-50",
              "text-zinc-400 hover:text-zinc-700",
              "transition-all duration-150 active:scale-95",
              "shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
            )}
            aria-label="Go back"
          >
            <ChevronLeft
              className="size-4 transition-transform duration-150 group-hover:-translate-x-0.5"
              strokeWidth={2.5}
            />
          </button>
        )}

        {/* Divider line */}
        <div className="h-6 w-px bg-zinc-200 mx-1.5 shrink-0" />

        {/* Breadcrumb title */}
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {parts.length > 1 ? (
              <>
                {/* Parent crumbs */}
                {parts.slice(0, -1).map((part, i) => (
                  <React.Fragment key={i}>
                    <span className="text-[10px] md:text-[11px] font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap hidden sm:block">
                      {part}
                    </span>
                    <span className="text-zinc-300 text-[10px] hidden sm:block">/</span>
                  </React.Fragment>
                ))}
                {/* Current page */}
                <span className="text-[11px] md:text-[12px] font-black text-zinc-800 uppercase tracking-widest truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
                  {parts[parts.length - 1]}
                </span>
              </>
            ) : (
              <span className="text-[11px] md:text-[12px] font-black text-zinc-800 uppercase tracking-widest truncate max-w-[160px] md:max-w-none">
                {title}
              </span>
            )}
          </div>

          {/* Sub-label */}
          <div className="hidden md:flex items-center gap-1.5 mt-0.5">
            <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-400">
              Engiconnect System
            </span>
            <span className="text-zinc-200 text-[8px]">·</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-300">
              {version}
            </span>
          </div>
        </div>
      </div>

      {/* ── RIGHT: actions ── */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  )
}