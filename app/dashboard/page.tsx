"use client"

import * as React from "react"
import { useEffect, useState, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import ProtectedPageWrapper from "../../components/protected-page-wrapper";

import {
    CalendarCheck, FileText, Monitor, ThumbsUp,
    ClipboardCheck, MoreHorizontal, Bell,
    Plus, Activity, CloudSun, CloudRain, Sun, CloudLightning, Cloud, Moon, CloudMoon,
    ArrowUpRight, Clock, CheckCircle2, AlertTriangle, Layers, MessageSquare, ChevronRight,
    LucideProps, LucideIcon, Package, TrendingUp, LayoutDashboard,
    Wrench, BarChart3, Zap,
    ChevronLeft, Users, MapPin, ShieldCheck, DoorOpen
} from "lucide-react";

import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, limit, orderBy, doc, getDoc, getDocs } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { 
    isAfter, 
    format, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    isSameMonth, 
    isSameDay, 
    addMonths, 
    subMonths 
} from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/utils/supabase";
import { FloatingActionButton } from "@/components/floating-action-button";
import { DashboardGuide } from "@/components/dashboard-guide";
import { EnhancedNotifications } from "@/components/enhanced-notifications";

/* ─────────────────────────────────────────────
   CUSTOM ICON
───────────────────────────────────────────── */
const StreetLightIcon = ({ size = 24, className = "", ...props }: LucideProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
        <path d="M7 22h3M9 22V7c0-2 1-3 3-3h5" />
        <path d="M15 4h5l1 2h-7l1-2z" />
        <path d="M17 9v1M14 8l-.5.5M20 8l.5.5" opacity="0.5" />
    </svg>
);

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function relativeTime(date?: Date | null): string {
    if (!date) return "N/A"
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // Handle future dates slightly
    if (diff < 0) return format(date, "MMM d")

    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days}d ago`
    return format(date, "MMM d")
}

/* ─────────────────────────────────────────────
   SKELETON COMPONENTS
───────────────────────────────────────────── */
function ServiceSkeleton() {
    return (
        <div className="flex flex-col items-center gap-2 animate-pulse">
            <div className="size-14 md:size-16 rounded-2xl bg-gray-100" />
            <div className="h-2 w-14 bg-gray-100 rounded-full" />
        </div>
    )
}

function ActivitySkeleton() {
    return (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 animate-pulse">
            <div className="size-10 rounded-xl bg-gray-100 flex-shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 bg-gray-100 rounded-full" />
                <div className="h-2 w-1/3 bg-gray-100 rounded-full" />
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────
   BONEYARD SKELETON - Premium skeleton loader with shimmer wave effect
───────────────────────────────────────────── */
function BoneyardSkeleton() {
    return (
        <section className="relative overflow-hidden bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
            {/* Shimmer wave overlay */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            
            {/* Header skeleton - matches WorkloadOverview exactly */}
            <div className="flex items-center justify-between mb-6">
                <div className="space-y-1">
                    <div className="h-4 w-40 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full animate-pulse" />
                    <div className="h-2.5 w-32 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full animate-pulse" />
                </div>
                <div className="size-8 bg-gray-100 rounded-lg animate-pulse" />
            </div>
            
            {/* Content grid skeleton - matches grid-cols-2 md:grid-cols-3 gap-4 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100">
                        <div className="size-10 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
                        <div className="min-w-0 space-y-1.5 flex-1">
                            <div className="h-3.5 w-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full animate-pulse" />
                            <div className="h-2 w-20 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}

function BoneyardCardSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-4">
            {[...Array(count)].map((_, i) => (
                <div key={i} className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent" style={{ animationDelay: `${i * 0.2}s` }} />
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-2/3 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full animate-pulse" />
                            <div className="h-2 w-1/2 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full animate-pulse" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

/* ─────────────────────────────────────────────
   PREMIUM TOP GRADE LOADING - Elite loading states
───────────────────────────────────────────── */
function PremiumLoading({ text = "Initializing premium experience..." }: { text?: string }) {
    const [progress, setProgress] = useState(0)
    
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(p => (p >= 100 ? 0 : p + 2))
        }, 80)
        return () => clearInterval(interval)
    }, [])
    
    return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-8">
            {/* Orbital spinner */}
            <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-gray-100" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#E33636] border-r-[#E33636] animate-spin" style={{ animationDuration: '1.5s' }} />
                <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-gray-300 border-l-gray-300 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
                <div className="absolute inset-4 rounded-full border-2 border-transparent border-b-[#E33636]/50 border-l-[#E33636]/50 animate-spin" style={{ animationDuration: '2.5s' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="size-3 rounded-full bg-[#E33636] animate-pulse" />
                </div>
            </div>
            
            {/* Progress bar */}
            <div className="w-full max-w-[280px] space-y-3">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span className="text-gray-400">Loading Assets</span>
                    <span className="text-[#E33636]">{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-[#E33636] to-[#ff6b6b] rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <p className="text-center text-[9px] font-bold text-gray-400 uppercase tracking-wide">{text}</p>
            </div>
        </div>
    )
}

function PremiumCardLoading() {
    return (
        <div className="bg-white rounded-[32px] border border-gray-100 p-6 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 opacity-50" />
            
            <div className="relative z-10">
                {/* Header - matches ProductivityHub exactly */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl animate-pulse" />
                        <div className="space-y-1.5">
                            <div className="h-4 w-32 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full animate-pulse" />
                            <div className="h-2.5 w-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full animate-pulse" />
                        </div>
                    </div>
                    <div className="h-6 w-28 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full animate-pulse" />
                </div>

                {/* Grid - matches grid-cols-1 md:grid-cols-3 gap-6 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Today's Agenda column */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="h-3 w-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full animate-pulse" />
                            <div className="h-4 w-4 bg-gradient-to-br from-gray-200 to-gray-300 rounded animate-pulse" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-12 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl animate-pulse" />
                            <div className="h-12 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl animate-pulse" />
                        </div>
                    </div>
                    
                    {/* Active Tasks column */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="h-3 w-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full animate-pulse" />
                            <div className="h-4 w-4 bg-gradient-to-br from-gray-200 to-gray-300 rounded animate-pulse" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-12 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl animate-pulse" />
                            <div className="h-12 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl animate-pulse" />
                        </div>
                    </div>
                    
                    {/* Weekly Status column */}
                    <div className="space-y-3">
                        <div className="h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl animate-pulse" />
                        <div className="h-2 w-full bg-gradient-to-r from-gray-100 to-gray-200 rounded-full animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */

function RecentCustomersWidget({ customers, loading, router }: { customers: any[], loading: boolean, router: any }) {
    if (loading && customers.length === 0) {
        return (
            <div className="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm animate-pulse space-y-4">
                <div className="h-4 w-32 bg-gray-100 rounded-full" />
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-gray-50" />
                            <div className="space-y-1.5 flex-1">
                                <div className="h-3 w-1/2 bg-gray-50 rounded-full" />
                                <div className="h-2 w-1/3 bg-gray-50 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (customers.length === 0 && !loading) return null

    return (
        <div className="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Users size={12} className="text-indigo-500" />
                    Recent Customers
                </h3>
                <button 
                    onClick={() => router.push("/appointments/site-visit/add/schedule")}
                    className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                >
                    View All
                </button>
            </div>
            <div className="space-y-3">
                {customers.map((customer: any) => (
                    <div 
                        key={customer.id} 
                        className="flex items-center gap-3 group cursor-pointer active:scale-[0.98] transition-all"
                        onClick={() => router.push("/appointments/site-visit/add/schedule")}
                    >
                        <div className="size-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-[10px] border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all uppercase">
                            {customer.company_name?.substring(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-gray-900 uppercase truncate leading-none mb-1">{customer.company_name}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight truncate">{customer.city || customer.address || "New Client"}</p>
                        </div>
                        <ChevronRight size={12} className="text-gray-300 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                ))}
            </div>
        </div>
    )
}

function QuickActionHub({ role, dept, router }: { role: string, dept: string, router: any }) {
    const isSales = dept === "SALES"
    const isManager = role === "MANAGER" || role === "TSM" || role === "SUPER ADMIN" || dept === "IT"

    const actions = [
        { label: "Site Visit", path: "/appointments/site-visit/add/schedule", icon: MapPin, color: "bg-rose-50 text-rose-600 border-rose-100", show: isSales },
        { label: "Job Request", path: "/request/job/add", icon: Wrench, color: "bg-amber-50 text-amber-600 border-amber-100", show: isSales },
        { label: "Team Report", path: "/appointments/site-visit", icon: BarChart3, color: "bg-indigo-50 text-indigo-600 border-indigo-100", show: isManager },
        { label: "User Matrix", path: "/admin/assignment-matrix", icon: ShieldCheck, color: "bg-emerald-50 text-emerald-600 border-emerald-100", show: role === "SUPER ADMIN" || dept === "IT" },
    ].filter(a => a.show)

    if (actions.length === 0) return null

    return (
        <div className="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm h-full">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Zap size={12} className="text-amber-500" />
                Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {actions.map((action, i) => (
                    <button 
                        key={i} 
                        onClick={() => router.push(action.path)}
                        className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 hover:shadow-sm",
                            action.color
                        )}
                    >
                        <action.icon size={18} className="mb-1.5" />
                        <span className="text-[9px] font-black uppercase tracking-tighter text-center leading-none">{action.label}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}

function StatCard({ label, value, icon: Icon, color, loading, onClick }: {
    label: string; value: any; icon: any; color: string; loading: boolean; onClick?: () => void
}) {
    return (
        <button
            onClick={onClick}
            disabled={!onClick || loading}
            className={cn(
                "bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col text-left w-full transition-all",
                onClick && !loading ? "hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer" : "cursor-default"
            )}
        >
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            <div className="flex items-baseline gap-1.5 mt-1.5">
                {loading
                    ? <div className="h-6 w-8 bg-gray-100 rounded animate-pulse" />
                    : <span className={cn("text-2xl font-black leading-none", color)}>{value}</span>}
                <Icon size={10} className="text-gray-200" />
            </div>
        </button>
    )
}

function ActivityCard({ label, value, icon: Icon, isAlert, loading, onClick }: {
    label: string; value: number; icon?: any; isAlert?: boolean; loading: boolean; onClick?: () => void
}) {
    return (
        <button
            onClick={onClick}
            disabled={!onClick || loading}
            className={cn(
                "bg-white p-4 rounded-2xl shadow-sm border flex flex-col gap-1 min-h-[90px] relative overflow-hidden transition-all text-left w-full",
                isAlert && value > 0 ? "border-red-200 bg-red-50/30" : "border-gray-100",
                onClick && !loading ? "hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer" : "cursor-default"
            )}
        >
            <p className={cn("text-[9px] font-black uppercase tracking-tight", isAlert && value > 0 ? "text-red-500" : "text-gray-400")}>{label}</p>
            {loading
                ? <div className="h-7 w-8 bg-gray-100 rounded animate-pulse mt-1" />
                : <p className={cn("text-2xl font-black text-gray-900 mt-0.5", isAlert && value > 0 && "text-red-600")}>{value}</p>}
            {Icon && <div className={cn("absolute bottom-2 right-2 opacity-[0.07]", isAlert && value > 0 ? "text-red-600" : "text-[#E33636]")}><Icon size={34} /></div>}
        </button>
    )
}

function WorkloadOverview({ notifications }: { notifications: any }) {
    const services = [
        { label: "Site Visits", count: notifications.siteVisit, icon: CalendarCheck, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "Job Requests", count: notifications.jobRequest, icon: FileText, color: "text-orange-600", bg: "bg-orange-50" },
        { label: "Shop Drawings", count: notifications.shopDrawing, icon: Wrench, color: "text-indigo-600", bg: "bg-indigo-50" },
        { label: "Testing", count: notifications.testingActive, icon: ClipboardCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "DIAlux", count: notifications.dialuxRequest, icon: Monitor, color: "text-cyan-600", bg: "bg-cyan-50" },
        { label: "SPF Product", count: notifications.productRequest, icon: Package, color: "text-rose-600", bg: "bg-rose-50" },
    ]

    return (
        <section className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-[14px] font-black text-gray-900 uppercase tracking-tight">Workload Distribution</h3>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">System-wide Pending Items</p>
                </div>
                <div className="size-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                    <BarChart3 size={16} />
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {services.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-colors group">
                        <div className={cn("size-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", s.bg, s.color)}>
                            <s.icon size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[13px] font-black text-gray-900 leading-none">{s.count}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight mt-1 truncate">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}

function ProductivityHub({ userDetails, tasks, schedule, router }: { userDetails: any; tasks: any; schedule: any; router: any }) {
    const totalTasks = (tasks.siteVisits?.length || 0) + (tasks.jobRequests?.length || 0) + (tasks.testingItems?.length || 0)
    const nextItem = schedule.next
    const todayItems = schedule.today || []

    return (
        <div className="bg-white rounded-[32px] border border-gray-100 p-6 shadow-sm overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500 opacity-50" />
            
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-200">
                            <Zap size={20} />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-black text-gray-900 uppercase tracking-tight">Productivity Hub</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Your Work Management</p>
                        </div>
                    </div>
                    {todayItems.length > 0 && (
                        <div className="hidden md:flex items-center gap-2 bg-zinc-900 text-white px-3 py-1.5 rounded-full animate-pulse">
                            <div className="size-1.5 bg-red-500 rounded-full" />
                            <span className="text-[9px] font-black uppercase tracking-wider">{todayItems.length} Items for Today</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-gray-500 uppercase">Today's Agenda</span>
                            <span className="text-[13px] font-black text-red-600">{todayItems.length}</span>
                        </div>
                        <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-100">
                            {todayItems.length > 0 ? (
                                todayItems.map((item: any) => (
                                    <div 
                                        key={item.id} 
                                        onClick={() => {
                                            const paths: Record<string, string> = {
                                                "Site Visit": `/appointments/site-visit/${item.id}`,
                                                "Testing": `/request/testing/${item.id}`,
                                                "Job Request": `/request/job/${item.id}`,
                                                "DIAlux": `/request/dialux/${item.id}`,
                                                "Shop": `/request/shop-drawing/${item.id}`
                                            }
                                            router.push(paths[item.type] || "#")
                                        }}
                                        className="flex items-center justify-between p-2 bg-zinc-50 rounded-xl border border-zinc-100/50 hover:bg-white hover:border-zinc-200 transition-all cursor-pointer group/item"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black text-zinc-900 truncate uppercase leading-none mb-1">{item.title}</p>
                                            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">{item.type}</p>
                                        </div>
                                        <ArrowUpRight size={12} className="text-zinc-300 group-hover/item:text-zinc-900 transition-colors" />
                                    </div>
                                ))
                            ) : (
                                <p className="text-[10px] font-bold text-gray-300 italic uppercase py-2">No tasks for today</p>
                            )}
                        </div>
                    </div>

                    <div className="md:border-x border-gray-100 md:px-6">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[11px] font-black text-gray-500 uppercase">Active Tasks</span>
                            <span className="text-[13px] font-black text-zinc-900">{totalTasks}</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden mb-3">
                            <div 
                                className="h-full bg-red-600 rounded-full transition-all duration-1000" 
                                style={{ width: `${Math.min(100, (totalTasks / 10) * 100)}%` }}
                            />
                        </div>
                        {nextItem && (
                            <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/50">
                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Coming Up Next</p>
                                <div className="flex items-start gap-2">
                                    <Clock size={12} className="text-blue-600 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black text-gray-900 truncate uppercase leading-none">{nextItem.title}</p>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">{format(nextItem.date, "MMM d · h:mm a")}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col justify-between">
                        <div className="flex items-center gap-4 bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50">
                            <div className="size-9 bg-white rounded-xl flex items-center justify-center shadow-sm text-emerald-500">
                                <TrendingUp size={18} />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-gray-900 leading-none">Weekly Status</p>
                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider mt-1.5">On Track (+12%)</p>
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-[9px] font-bold text-gray-400 italic uppercase leading-tight">
                                {totalTasks > 5 ? "Busy day ahead! Prioritize your top 3 tasks." : "Good pace! Check pending requests."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function AdminDashboard({ router, userId }: { router: any; userId: string | null }) {
    const [bookings, setBookings] = React.useState<any[]>([])
    const [rooms, setRooms] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        // Fetch rooms once (rarely changes)
        const fetchRooms = async () => {
            try {
                const { getDocs, collection } = await import("firebase/firestore")
                const { db } = await import("@/lib/firebase")
                const snap = await getDocs(collection(db, "meeting_rooms"))
                setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((r: any) => r.isActive !== false))
            } catch (e) { console.error(e) }
        }
        fetchRooms()
    }, [])

    React.useEffect(() => {
        // Real-time listener for bookings — updates instantly when new bookings arrive
        const setupListener = async () => {
            try {
                const { onSnapshot, collection, query, where } = await import("firebase/firestore")
                const { db } = await import("@/lib/firebase")
                const q = query(collection(db, "room_bookings"), where("status", "in", ["PENDING", "CONFIRMED"]))
                const unsub = onSnapshot(q, snap => {
                    setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
                    setLoading(false)
                }, err => {
                    console.error(err)
                    setLoading(false)
                })
                return unsub
            } catch (e) {
                console.error(e)
                setLoading(false)
                return () => {}
            }
        }
        let cleanup: (() => void) | undefined
        setupListener().then(unsub => { cleanup = unsub })
        return () => { if (cleanup) cleanup() }
    }, [])

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    const now = new Date()
    const nowMins = now.getHours() * 60 + now.getMinutes()

    const todayBookings = bookings.filter(b => {
        const d = b.bookingDate?.toDate ? b.bookingDate.toDate() : null
        return d && d >= today && d < tomorrow
    }).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))

    const pendingApprovals = bookings.filter(b => b.status === "PENDING")
    const confirmedToday = todayBookings.filter(b => b.status === "CONFIRMED")

    const getRoomStatus = (roomId: string) => {
        const roomBookings = todayBookings.filter(b => b.roomId === roomId && b.status === "CONFIRMED")
        const occupied = roomBookings.find(b => {
            const [sh, sm] = (b.startTime || "0:0").split(":").map(Number)
            const [eh, em] = (b.endTime || "0:0").split(":").map(Number)
            return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em
        })
        const next = roomBookings.find(b => {
            const [sh, sm] = (b.startTime || "0:0").split(":").map(Number)
            return sh * 60 + sm > nowMins
        })
        return { occupied, next }
    }

    if (loading) return (
        <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white rounded-[24px] border border-zinc-100 animate-pulse" />)}
        </div>
    )

    return (
        <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Pending Approvals", value: pendingApprovals.length, color: pendingApprovals.length > 0 ? "bg-amber-600" : "bg-zinc-900", onClick: () => router.push("/appointments/meeting-rooms?filter=PENDING") },
                    { label: "Confirmed Today", value: confirmedToday.length, color: "bg-blue-600", onClick: () => router.push("/appointments/meeting-rooms") },
                    { label: "Active Rooms", value: rooms.length, color: "bg-emerald-600", onClick: () => router.push("/admin/meeting-rooms") },
                ].map(({ label, value, color, onClick }) => (
                    <button key={label} onClick={onClick} className={`${color} text-white rounded-[20px] p-4 text-left active:scale-[0.97] transition-all hover:opacity-90`}>
                        <p className="text-[26px] font-black leading-none">{value}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-70 mt-1">{label}</p>
                    </button>
                ))}
            </div>

            {/* Pending approvals — most urgent */}
            {pendingApprovals.length > 0 && (
                <div className="bg-white rounded-[24px] border border-amber-200 shadow-sm p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-black text-amber-700 uppercase tracking-tight flex items-center gap-2">
                            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                            Pending Approvals
                        </h3>
                        <button onClick={() => router.push("/appointments/meeting-rooms")} className="text-[9px] font-black text-zinc-400 uppercase hover:text-zinc-900">View All</button>
                    </div>
                    <div className="space-y-2">
                        {pendingApprovals.slice(0, 3).map(b => {
                            const bDate = b.bookingDate?.toDate ? b.bookingDate.toDate() : null
                            return (
                                <button key={b.id} onClick={() => router.push(`/appointments/meeting-rooms/${b.id}`)}
                                    className="w-full flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-2xl hover:bg-amber-100 transition-all text-left active:scale-[0.98]">
                                    <div className="size-9 rounded-xl bg-amber-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                                        {b.roomName?.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-zinc-900 uppercase truncate">{b.title}</p>
                                        <p className="text-[9px] text-zinc-500">{b.roomName} · {bDate ? bDate.toLocaleDateString([], { month: "short", day: "numeric" }) : "—"} · {b.startTime}–{b.endTime}</p>
                                    </div>
                                    <ChevronRight size={14} className="text-zinc-300 shrink-0" />
                                </button>
                            )
                        })}
                        {pendingApprovals.length > 3 && (
                            <p className="text-[9px] font-black text-zinc-400 uppercase text-center">+{pendingApprovals.length - 3} more pending</p>
                        )}
                    </div>
                </div>
            )}

            {/* Room status grid */}
            <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-tight">Room Status — Now</h3>
                    <button onClick={() => router.push("/admin/meeting-rooms")} className="text-[9px] font-black text-zinc-400 uppercase hover:text-zinc-900">Manage</button>
                </div>
                {rooms.length === 0 ? (
                    <div className="text-center py-6">
                        <p className="text-[10px] text-zinc-300 font-black uppercase">No rooms configured</p>
                        <button onClick={() => router.push("/admin/meeting-rooms")} className="mt-2 text-[9px] font-black text-zinc-500 uppercase underline">Add rooms →</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {rooms.slice(0, 6).map(room => {
                            const { occupied, next } = getRoomStatus(room.id)
                            return (
                                <div key={room.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${occupied ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}`}>
                                    <div className={`size-9 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 ${room.color || "bg-zinc-900"}`}>
                                        {room.name?.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-zinc-900 uppercase truncate">{room.name}</p>
                                        {occupied ? (
                                            <p className="text-[8px] font-bold text-red-600">In use · until {occupied.endTime}</p>
                                        ) : next ? (
                                            <p className="text-[8px] font-bold text-zinc-400">Free · next at {next.startTime}</p>
                                        ) : (
                                            <p className="text-[8px] font-bold text-emerald-600">Available all day</p>
                                        )}
                                    </div>
                                    <span className={`size-2 rounded-full shrink-0 ${occupied ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`} />
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Today's schedule */}
            <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-tight">Today's Schedule</h3>
                    <button onClick={() => router.push("/appointments/meeting-rooms/add")} className="flex items-center gap-1 text-[9px] font-black text-zinc-900 uppercase bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1.5 rounded-xl transition-all">
                        <Plus size={10} /> Book
                    </button>
                </div>
                {todayBookings.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-zinc-100 rounded-2xl">
                        <p className="text-[10px] text-zinc-300 font-black uppercase">No bookings today</p>
                        <button onClick={() => router.push("/appointments/meeting-rooms/add")} className="mt-2 text-[9px] font-black text-zinc-500 uppercase underline">Book a room →</button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {todayBookings.map(b => {
                            const [sh, sm] = (b.startTime || "0:0").split(":").map(Number)
                            const [eh, em] = (b.endTime || "0:0").split(":").map(Number)
                            const isNow = nowMins >= sh * 60 + sm && nowMins < eh * 60 + em
                            const isPast = nowMins >= eh * 60 + em
                            return (
                                <button key={b.id} onClick={() => router.push(`/appointments/meeting-rooms/${b.id}`)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all active:scale-[0.98] ${isNow ? "bg-blue-50 border-blue-200" : isPast ? "opacity-40 bg-zinc-50 border-zinc-100" : "bg-white border-zinc-100 hover:bg-zinc-50"}`}>
                                    <div className="text-center shrink-0 w-10">
                                        <p className="text-[10px] font-black text-zinc-900">{b.startTime}</p>
                                        <p className="text-[8px] text-zinc-400">{b.endTime}</p>
                                    </div>
                                    <div className="w-px h-8 bg-zinc-200 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-zinc-900 uppercase truncate">{b.title}</p>
                                        <p className="text-[9px] text-zinc-400">{b.roomName} · {b.submittedByName}</p>
                                    </div>
                                    {isNow && <span className="text-[8px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full shrink-0">NOW</span>}
                                    <ChevronRight size={12} className="text-zinc-300 shrink-0" />
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "All Bookings", icon: CalendarCheck, path: "/appointments/meeting-rooms" },
                    { label: "Analytics", icon: BarChart3, path: "/admin/meeting-rooms/dashboard" },
                    { label: "Manage Rooms", icon: Zap, path: "/admin/meeting-rooms" },
                ].map(({ label, icon: Icon, path }) => (
                    <button key={label} onClick={() => router.push(path)}
                        className="bg-white border border-zinc-200/60 rounded-[20px] p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-zinc-300 transition-all active:scale-[0.97]">
                        <div className="size-9 bg-zinc-100 rounded-xl flex items-center justify-center">
                            <Icon size={16} className="text-zinc-600" />
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600 text-center">{label}</p>
                    </button>
                ))}
            </div>
        </div>
    )
}

function RecentActivityFeed({ activities, router }: { activities: any[]; router: any }) {
    return (
        <section className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-[14px] font-black text-gray-900 uppercase tracking-tight">Recent Updates</h3>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Latest status changes</p>
                </div>
                <div className="size-8 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-400">
                    <Activity size={16} />
                </div>
            </div>

            <div className="space-y-3">
                {activities.length > 0 ? (
                    activities.map((act) => (
                        <div 
                            key={act.id} 
                            onClick={() => {
                                const paths: Record<string, string> = {
                                    "Job": `/request/job/${act.id}`,
                                    "DIAlux": `/request/dialux/${act.id}`,
                                    "Shop": `/request/shop-drawing/${act.id}`,
                                    "Site Visit": `/appointments/site-visit/${act.id}`,
                                    "Testing": `/request/testing/${act.id}`
                                }
                                router.push(paths[act.type] || "#")
                            }}
                            className="flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-2xl transition-all cursor-pointer group border border-transparent hover:border-gray-100"
                        >
                            <div className={cn(
                                "size-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110",
                                act.type === "Job" ? "bg-orange-50 text-orange-600" : 
                                act.type === "DIAlux" ? "bg-indigo-50 text-indigo-600" : 
                                act.type === "Site Visit" ? "bg-blue-50 text-blue-600" :
                                act.type === "Testing" ? "bg-violet-50 text-violet-600" :
                                "bg-emerald-50 text-emerald-600"
                            )}>
                                {act.type === "Job" ? <FileText size={16} /> : 
                                 act.type === "DIAlux" ? <Monitor size={16} /> : 
                                 act.type === "Site Visit" ? <CalendarCheck size={16} /> :
                                 act.type === "Testing" ? <ClipboardCheck size={16} /> :
                                 <Wrench size={16} />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between mb-0.5">
                                    <p className="text-[11px] font-black text-gray-900 uppercase truncate pr-2">{act.client || act.projectName || act.site || act.productName || "Untitled"}</p>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase whitespace-nowrap">
                                        {act.createdAt?.toDate ? relativeTime(act.createdAt.toDate()) : 
                                         (act.arrivalDate?.toDate ? relativeTime(act.arrivalDate.toDate()) : "Recent")}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider",
                                        (act.status || "").toLowerCase().includes("pending") ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                                    )}>
                                        {act.status || "Status Update"}
                                    </span>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter truncate">
                                    {act.updatedByName || act.submittedByName || act.createdByName || act.submittedByRole || "System Update"}
                                </p>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-10 text-center opacity-30">
                        <Activity size={32} className="mx-auto mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No recent activity</p>
                    </div>
                )}
            </div>
        </section>
    )
}

function DashboardCalendar({ scheduleData, router }: { scheduleData: any; router: any }) {
    const [currentMonth, setCurrentMonth] = React.useState(new Date())
    const firstDay = startOfMonth(currentMonth)
    const lastDay = endOfMonth(currentMonth)
    const startDate = startOfWeek(firstDay)
    const endDate = endOfWeek(lastDay)
    const days = eachDayOfInterval({ start: startDate, end: endDate })
    const allTasks = [...scheduleData.today, ...scheduleData.upcoming]

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between p-4 border-b border-gray-50 bg-gray-50/30">
                <div>
                    <h4 className="text-[12px] font-black text-gray-900 uppercase tracking-tight">{format(currentMonth, 'MMMM yyyy')}</h4>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Quick Schedule</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="size-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                        <ChevronLeft size={14} className="text-gray-400" />
                    </button>
                    <button onClick={() => setCurrentMonth(new Date())} className="px-2 h-7 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-[9px] font-black uppercase tracking-wider text-gray-600">
                        Today
                    </button>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="size-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                        <ChevronRight size={14} className="text-gray-400" />
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-7 border-b border-gray-50 bg-gray-50/50">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                    <div key={d} className="py-2 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 text-[10px]">
                {days.map((day, i) => {
                    const dayTasks = allTasks.filter(t => isSameDay(new Date(t.date), day))
                    const isToday = isSameDay(day, new Date())
                    const isSelectedMonth = isSameMonth(day, firstDay)
                    return (
                        <div key={i} className={cn(
                            "min-h-[60px] p-1.5 border-r border-b border-gray-50 transition-colors hover:bg-gray-50/50 relative",
                            !isSelectedMonth && "bg-gray-50/30 opacity-40",
                            i % 7 === 6 && "border-r-0"
                        )}>
                            <span className={cn(
                                "size-5 flex items-center justify-center rounded-md font-black",
                                isToday ? "bg-red-600 text-white shadow-sm" : "text-gray-400"
                            )}>{format(day, 'd')}</span>
                            <div className="mt-1 space-y-0.5">
                                {dayTasks.slice(0, 2).map((t: any) => (
                                    <div 
                                        key={t.id} 
                                        onClick={() => {
                                            const paths: Record<string, string> = {
                                                "Site Visit": `/appointments/site-visit/${t.id}`,
                                                "Testing": `/request/testing/${t.id}`,
                                                "Job Request": `/request/job/${t.id}`
                                            }
                                            router.push(paths[t.type] || "#")
                                        }}
                                        className={cn(
                                            "h-1 rounded-full cursor-pointer transition-all hover:scale-110",
                                            t.type === "Site Visit" ? "bg-blue-400" : "bg-red-400"
                                        )}
                                        title={`${t.type}: ${t.title}`}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function DepartmentPulse({ userDept, myTasks }: { userDept: string | null; myTasks: any }) {
    const totalActive = (myTasks.siteVisits?.length || 0) + (myTasks.jobRequests?.length || 0) + (myTasks.testingItems?.length || 0)
    return (
        <section className="bg-zinc-900 rounded-[32px] p-6 shadow-lg text-white relative overflow-hidden group min-h-[180px]">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700" />
            <div className="relative z-10 flex flex-col justify-between">
                <div className="flex items-center gap-3 mb-6">
                    <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                        <BarChart3 size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-[14px] font-black uppercase tracking-tight">Department Pulse</h3>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">{userDept || "All Departments"}</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Your Active Load</span>
                        <span className="text-[18px] font-black">{totalActive}</span>
                    </div>
                    <div className="flex gap-1.5 h-8 items-end">
                        {[40, 70, 55, 90, 65, 80, 45].map((h, i) => (
                            <div key={i} className="flex-1 bg-white/10 rounded-t-sm group-hover:bg-red-500 transition-all duration-500" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-tight">Weekly Engagement Activity</p>
                </div>
            </div>
        </section>
    )
}

export default function EngiconnectDashboard() {
    const router = useRouter()
    const [userId, setUserId] = useState<string | null>(null)
    const [userRole, setUserRole] = useState<string | null>(() => {
        if (typeof window !== "undefined") {
            return (localStorage.getItem("userRole") || "").toUpperCase() || null
        }
        return null
    })
    const [subordinateIds, setSubordinateIds] = useState<string[]>([])
    const [isDataLoading, setIsDataLoading] = useState<boolean>(true)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [weather, setWeather] = useState({ temp: "--", condition: "Syncing...", code: 0 })
    const [dynamicPermissions, setDynamicPermissions] = useState<any[]>([])
    const [currentPage, setCurrentPage] = useState(0)
    const scrollRef = useRef<HTMLDivElement>(null)
    const notifRef = useRef<HTMLDivElement>(null)
    const [activeTab, setActiveTab] = useState("Monitoring")
    const [scheduleView, setScheduleView] = useState<"list" | "calendar">("list")
    const [showNotifDropdown, setShowNotifDropdown] = useState(false)
    const [userDept, setUserDept] = useState<string | null>(() => {
        // Initialize from localStorage immediately to avoid null flash
        if (typeof window !== "undefined") {
            return (localStorage.getItem("userDepartment") || "").toUpperCase() || null
        }
        return null
    })
    const [userDetails, setUserDetails] = useState({
        Firstname: "", Position: "", Department: "", profilePicture: ""
    })
    const [notifications, setNotifications] = useState({
        siteVisit: 0, jobRequest: 0, shopDrawing: 0,
        testingActive: 0, testingOverdue: 0, otherRequest: 0,
        dialuxRequest: 0, dialuxInProgress: 0, dialuxCompleted: 0,
        unreadMessages: 0,
        unreadByService: { dialux: 0, jobRequest: 0, siteVisit: 0, shopDrawing: 0, product: 0, others: 0 },
        productRequest: 0,
        meetingRoomPending: 0,
    })
    const [recentActivity, setRecentActivity] = useState<any[]>([])
    const [customerCount, setCustomerCount] = useState<number>(0)
    const [recentCustomers, setRecentCustomers] = useState<any[]>([])
    const [loadingCustomerCount, setLoadingCustomerCount] = useState<boolean>(false)
    const [scheduleData, setScheduleData] = useState<{ today: any[], upcoming: any[], next: any | null }>({
        today: [], upcoming: [], next: null
    })
    const [myTasks, setMyTasks] = useState<{ siteVisits: any[], jobRequests: any[], testingItems: any[] }>({
        siteVisits: [], jobRequests: [], testingItems: []
    })
    const [perms, setPerms] = useState<any>(null)

    useEffect(() => {
        const storedUserId = localStorage.getItem("userId")
        if (!storedUserId) { setIsDataLoading(false); return }
        setUserId(storedUserId)
        fetch(`/api/user?id=${encodeURIComponent(storedUserId)}`)
            .then(res => res.json())
            .then(async mongoData => {
                const dept = mongoData.Department || mongoData.department || ""
                const position = (mongoData.Position || "").toUpperCase()
                const userDoc = await getDoc(doc(db, "users", storedUserId))
                const firestoreRole = (userDoc.exists() ? (userDoc.data().Role || userDoc.data().role || "MEMBER") : "MEMBER").toUpperCase()
                const isSalesDept = dept === "SALES"
                const isAdminDept = dept === "ADMIN"
                const isManager = firestoreRole === "MANAGER" || firestoreRole === "SALES HEAD" || (isSalesDept && (position === "MANAGER" || position === "SALES HEAD" || position.includes("GENERAL MANAGER"))) || (isAdminDept && position.includes("MANAGER"))
                const isTSM = firestoreRole === "TSM" || firestoreRole === "TERRITORY SALES MANAGER" || (isSalesDept && position.includes("TERRITORY SALES MANAGER"))
                const isTSA = isSalesDept && position.includes("TERRITORY SALES ASSOCIATE")
                // Use full position name for Sales and Admin depts so permission lookup matches Firestore doc IDs
                // e.g. SALES_TERRITORY SALES ASSOCIATE, ADMIN_STAFF, ADMIN_MANAGER
                const finalRole = isManager ? "MANAGER" : isTSM ? "TSM" : ((isSalesDept || isAdminDept) && position ? position : firestoreRole)
                setUserDetails({ Firstname: mongoData.Firstname || "User", Position: mongoData.Position || "Member", Department: dept, profilePicture: mongoData.profilePicture || "" })
                setUserDept(dept); setUserRole(finalRole)
                // Set default dashboard tab based on department
                const deptUpper = (dept || "").toUpperCase()
                if (deptUpper === "ADMIN") setActiveTab("Overview")
                else if (deptUpper === "PROCUREMENT" || deptUpper === "WAREHOUSE OPERATIONS") setActiveTab("Product Requests")
                localStorage.setItem("userDepartment", dept); localStorage.setItem("userRole", finalRole); localStorage.setItem("userName", mongoData.Firstname || "User")
                if (isTSM || isManager) {
                    const usersRes = await fetch('/api/user')
                    const allUsers: any[] = await usersRes.json()
                    let subs: any[] = []
                    const name = `${mongoData.Firstname || ""} ${mongoData.Lastname || ""}`.trim()
                    const referenceId = (mongoData.ReferenceID || "").toUpperCase()
                    const clean = (n: string) => (n || "").replace(/,/g, "").replace(/\s+/g, " ").trim().toUpperCase()
                    const myCleanName = clean(name)
                    if (isTSM) {
                        subs = allUsers.filter(u => {
                            const uRole = (u.Role || u.role || "MEMBER").toUpperCase()
                            const uPosition = (u.Position || "").toUpperCase()
                            if (uRole === "TSM" || uPosition.includes("TERRITORY SALES MANAGER")) return false
                            const uTSM = clean(u.TSM); const uTSMName = clean(u.TSMName); const uTSM_low = clean(u.tsm); const uTSMName_low = clean(u.tsmName)
                            return (uTSM && uTSM === myCleanName) || (uTSM && uTSM === referenceId) || (uTSMName && uTSMName === myCleanName) || (uTSM_low && uTSM_low === myCleanName) || (uTSM_low && uTSM_low === referenceId) || (uTSMName_low && uTSMName_low === myCleanName)
                        })
                    } else if (isManager) {
                        subs = allUsers.filter(u => {
                            const uMan = clean(u.Manager); const uManName = clean(u.ManagerName); const uMan_low = clean(u.manager); const uManName_low = clean(u.managerName)
                            return uMan === myCleanName || uMan === referenceId || uManName === myCleanName || uMan_low === myCleanName || uMan_low === referenceId || uManName_low === myCleanName
                        })
                    }
                    setSubordinateIds(subs.map(u => u._id))
                }
                setLoadingCustomerCount(true)
                const params = new URLSearchParams({ referenceid: mongoData.ReferenceID || "", role: finalRole, name: `${mongoData.Firstname || ""} ${mongoData.Lastname || ""}`.trim(), department: dept, limit: "1" })
                fetch(`/api/com-fetch-cluster-account?${params.toString()}`).then(res => res.json()).then(result => { setCustomerCount(result.total || 0); setRecentCustomers(result.data?.slice(0, 5) || []) }).finally(() => setLoadingCustomerCount(false))
            })
        // FIX: One-time getDocs instead of onSnapshot on the entire role_permissions collection.
        // Permissions are stable during a session; a persistent listener was re-firing on every
        // permission change system-wide and downloading all docs to every connected client.
        getDocs(collection(db, "role_permissions")).then(snap => {
            const allPerms = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            setDynamicPermissions(allPerms)
            if (storedUserId) {
                const roleKey = localStorage.getItem("userRole")?.toUpperCase() || "MEMBER"
                const deptKey = localStorage.getItem("userDepartment")?.toUpperCase().trim() || ""
                const targetId = deptKey ? `${deptKey}_${roleKey}` : `_${roleKey}`
                let myPerms = allPerms.find(p => p.id === targetId)
                if (!myPerms && roleKey === "TSM") {
                    const altTargetId = deptKey ? `${deptKey}_TERRITORY SALES MANAGER` : `_TERRITORY SALES MANAGER`
                    myPerms = allPerms.find(p => p.id === altTargetId)
                }
                // Admin STAFF fallback
                if (!myPerms && deptKey === "ADMIN") {
                    myPerms = allPerms.find(p => p.id === "ADMIN_STAFF") || allPerms.find(p => p.id === "ADMIN_MANAGER")
                }
                // Sales TSA fallback
                if (!myPerms && deptKey === "SALES" && (roleKey === "MEMBER" || roleKey === "TSA")) {
                    myPerms = allPerms.find(p => p.id === "SALES_TERRITORY SALES ASSOCIATE")
                }
                if (!myPerms) myPerms = allPerms.find(p => p.id === targetId) || allPerms.find(p => p.id.endsWith(`_${roleKey}`))
                setPerms(myPerms)
            }
            setIsDataLoading(false)
        }).catch(() => setIsDataLoading(false))
    }, [])

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        const fetchWeather = async (lat: number, lon: number) => {
            try {
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
                const data = await res.json(); const code = data.current_weather.weathercode; let status = "Clear"
                if (code > 0 && code < 4) status = "Cloudy"
                else if (code >= 51 && code <= 67) status = "Rainy"
                else if (code >= 95) status = "Stormy"
                setWeather({ temp: `${Math.round(data.current_weather.temperature)}°`, condition: status, code })
            } catch { setWeather({ temp: "!!", condition: "Error", code: 0 }) }
        }
        if ("geolocation" in navigator) navigator.geolocation.getCurrentPosition(pos => fetchWeather(pos.coords.latitude, pos.coords.longitude))
    }, [])

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifDropdown(false) }
        document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler)
    }, [])

    useEffect(() => {
        if (!db || !userId) return
        const userRole = localStorage.getItem("userRole")?.toUpperCase() || "MEMBER"
        const userDept = localStorage.getItem("userDepartment")?.toUpperCase() || ""
        const isManager = userRole === "MANAGER" || userRole === "SALES HEAD" || userRole === "SUPER ADMIN"
        const isTSM = userRole === "TSM" || userRole === "TERRITORY SALES MANAGER"
        const hasGlobalAccess = userDept === "IT" || userDept === "ENGINEERING" || isManager || userRole === "LEADER"

        const calculateUnread = (docs: any[], currentUserId: string) => {
            let total = 0
            docs.forEach((data: any) => {
                if (data.messages && Array.isArray(data.messages)) {
                    total += data.messages.filter((m: any) => 
                        m.senderId !== currentUserId && (!m.seenBy || !m.seenBy.includes(currentUserId))
                    ).length
                }
            })
            return total
        }

        // FIX: Use server-side where filters for non-admin users to avoid downloading entire collections.
        // For admins/global-access users we still need all docs, but we limit to non-terminal statuses.
        const siteQuery = hasGlobalAccess
            ? query(collection(db, "appointments"), where("status", "not-in", ["COMPLETED", "CANCELLED", "DONE"]))
            : isTSM
                ? query(collection(db, "appointments"), where("submittedBy", "in", [userId, ...subordinateIds.slice(0, 9)]))
                : query(collection(db, "appointments"), where("submittedBy", "==", userId))

        const unsubSite = onSnapshot(siteQuery, snap => {
            let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            const isEngSV = userDept === "ENGINEERING" || userDept === "IT"; const isSalesSV = userDept === "SALES"; const isMgrSV = ["SUPER ADMIN", "MANAGER", "LEADER"].includes(userRole)
            const pending = docs.filter((d: any) => {
                const s = (d.status || "").toUpperCase(); if (["COMPLETED", "CANCELLED", "DONE"].includes(s)) return false
                const needEng = s.includes("CONFIRMED") || s.includes("SCHEDULED") || s.includes("APPROVED"); const needSales = s === "PENDING" || s.includes("SUBMITTED")
                return isMgrSV || (isEngSV && needEng) || (isSalesSV && needSales)
            }).length
            const unread = calculateUnread(docs, userId)
            setNotifications(prev => ({ ...prev, siteVisit: pending, unreadByService: { ...prev.unreadByService, siteVisit: unread } }))
            setMyTasks(prev => ({ ...prev, siteVisits: docs.filter((d: any) => d.pic === userId && d.status !== "COMPLETED") }))
        })

        const shopQuery = hasGlobalAccess
            ? query(collection(db, "shop_drawing_requests"), where("status", "not-in", ["COMPLETED", "CANCELLED", "DONE", "RELEASED"]))
            : isTSM
                ? query(collection(db, "shop_drawing_requests"), where("submittedBy", "in", [userId, ...subordinateIds.slice(0, 9)]))
                : query(collection(db, "shop_drawing_requests"), where("submittedBy", "==", userId))

        const unsubShop = onSnapshot(shopQuery, snap => {
            let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            const isEngSD = userDept === "ENGINEERING" || userDept === "IT"; const isSalesSD = userDept === "SALES"; const isMgrSD = ["SUPER ADMIN", "MANAGER", "LEADER"].includes(userRole)
            const pending = docs.filter((d: any) => {
                const s = (d.status || "").toUpperCase(); if (["COMPLETED", "CANCELLED", "DONE", "RELEASED"].includes(s)) return false
                const needEng = s.includes("REVIEW") || s.includes("PROGRESS") || s.includes("DESIGN"); const needSales = s.includes("PENDING") || s.includes("AWAITING") || s.includes("CLIENT")
                return isMgrSD || (isEngSD && needEng) || (isSalesSD && needSales)
            }).length
            const unread = calculateUnread(docs, userId)
            setNotifications(prev => ({ ...prev, shopDrawing: pending, unreadByService: { ...prev.unreadByService, shopDrawing: unread } }))
        })

        const jobQuery = hasGlobalAccess
            ? query(collection(db, "job_requests"), where("status", "not-in", ["COMPLETED", "CANCELLED", "DONE"]))
            : isTSM
                ? query(collection(db, "job_requests"), where("submittedBy", "in", [userId, ...subordinateIds.slice(0, 9)]))
                : query(collection(db, "job_requests"), where("submittedBy", "==", userId))

        const unsubJob = onSnapshot(jobQuery, snap => {
            let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            const isEngJR = userDept === "ENGINEERING" || userDept === "IT"; const isSalesJR = userDept === "SALES"; const isMgrJR = ["SUPER ADMIN", "MANAGER", "LEADER"].includes(userRole)
            const pending = docs.filter((d: any) => {
                const s = (d.status || "").toUpperCase(); if (["COMPLETED", "CANCELLED", "DONE"].includes(s)) return false
                const needEng = s.includes("ASSIGNED") || s.includes("PROGRESS") || s.includes("APPROVED"); const needSales = s === "PENDING" || s.includes("SUBMITTED") || s.includes("AWAITING")
                return isMgrJR || (isEngJR && needEng) || (isSalesJR && needSales)
            }).length
            const unread = calculateUnread(docs, userId)
            setNotifications(prev => ({ ...prev, jobRequest: pending, unreadByService: { ...prev.unreadByService, jobRequest: unread } }))
            setMyTasks(prev => ({ ...prev, jobRequests: docs.filter((d: any) => d.assignedTo === userId && d.status !== "COMPLETED") }))
        })

        const otherQuery = hasGlobalAccess
            ? query(collection(db, "other_requests"), where("status", "not-in", ["COMPLETED", "CANCELLED", "DONE", "RELEASED"]))
            : isTSM
                ? query(collection(db, "other_requests"), where("submittedBy", "in", [userId, ...subordinateIds.slice(0, 9)]))
                : query(collection(db, "other_requests"), where("submittedBy", "==", userId))

        const unsubOther = onSnapshot(otherQuery, snap => {
            let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            const isEngOR = userDept === "ENGINEERING" || userDept === "IT"; const isProcOR = userDept === "PROCUREMENT"; const isMgrOR = ["SUPER ADMIN", "MANAGER", "LEADER"].includes(userRole)
            const pending = docs.filter((d: any) => {
                const s = (d.status || "").toUpperCase(); if (["COMPLETED", "CANCELLED", "DONE", "RELEASED"].includes(s)) return false
                const needEng = s.includes("TESTING") || s.includes("REVIEW") || s.includes("TECHNICAL"); const needProc = s.includes("PROCUREMENT") || s.includes("PURCHASE") || s.includes("ORDER")
                return isMgrOR || (isEngOR && needEng) || (isProcOR && needProc)
            }).length
            const unread = calculateUnread(docs, userId)
            setNotifications(prev => ({ ...prev, otherRequest: pending, unreadByService: { ...prev.unreadByService, others: unread } }))
        })

        const dialuxQuery = hasGlobalAccess
            ? query(collection(db, "dialux_requests"), where("status", "not-in", ["COMPLETED", "CANCELLED", "DONE", "CLOSED"]))
            : isTSM
                ? query(collection(db, "dialux_requests"), where("submittedBy", "in", [userId, ...subordinateIds.slice(0, 9)]))
                : query(collection(db, "dialux_requests"), where("submittedBy", "==", userId))

        const unsubDialux = onSnapshot(dialuxQuery, snap => {
            let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            docs = docs.map((d: any) => ({ ...d, submittedBy: d.submittedBy || d.createdBy || d.userId }))
            const isEngineering = userDept === "ENGINEERING" || userDept === "IT"; const isSales = userDept === "SALES"; const isManager = ["SUPER ADMIN", "MANAGER", "LEADER"].includes(userRole)
            const pending = docs.filter((d: any) => {
                const status = (d.status || "").toUpperCase(); if (["COMPLETED", "CANCELLED", "DONE", "CLOSED"].includes(status)) return false
                const needsEng = status.includes("REVIEW") || status.includes("PROGRESS") || status.includes("DESIGN") || status.includes("SIMULATION")
                const needsSales = status === "PENDING" || status.includes("SUBMITTED") || status.includes("AWAITING") || status.includes("PAYMENT")
                if (isManager) return true; if (isEngineering && needsEng) return true; if (isSales && needsSales) return true; return !isEngineering && !isSales
            }).length
            const completed = docs.filter((d: any) => (d.status || "").toUpperCase() === "COMPLETED").length
            const unread = calculateUnread(docs, userId)
            setNotifications(prev => ({ ...prev, dialuxRequest: pending, dialuxCompleted: completed, unreadByService: { ...prev.unreadByService, dialux: unread } }))
        })

        // FIX: Filter testing_tracker server-side — only unreleased items
        const testingQuery = hasGlobalAccess
            ? query(collection(db, "testing_tracker"), where("releaseDate", "==", null))
            : isTSM
                ? query(collection(db, "testing_tracker"), where("submittedBy", "in", [userId, ...subordinateIds.slice(0, 9)]))
                : query(collection(db, "testing_tracker"), where("submittedBy", "==", userId))

        const unsubTesting = onSnapshot(testingQuery, snap => {
            let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            let active = 0; let overdue = 0; const today = new Date(); const myItems: any[] = []
            docs.forEach((d: any) => {
                if (!d.releaseDate) { const target = d.targetDate?.toDate(); if (target && isAfter(today, target)) overdue++; else if (d.arrivalDate) active++ }
                if (d.assignedTo === userId && d.status !== "RELEASED") myItems.push(d)
            })
            setNotifications(prev => ({ ...prev, testingActive: active, testingOverdue: overdue })); setMyTasks(prev => ({ ...prev, testingItems: myItems }))
        })

        const fetchProductRequests = async () => {
            const { data, count } = await supabase.from("spf_creation").select("*", { count: "exact", head: true }).eq("status", "Pending For Procurement")
            if (count !== null) setNotifications(prev => ({ ...prev, productRequest: count }))
        }
        fetchProductRequests()
        const ch = supabase.channel("spf_creation_dashboard").on("postgres_changes", { event: "*", schema: "public", table: "spf_creation" }, fetchProductRequests).subscribe()

        // Real-time meeting room pending count for Admin dept bell badge
        const setupMeetingRoomListener = async () => {
            try {
                const { onSnapshot, collection: fsCol, query: fsQuery, where: fsWhere } = await import("firebase/firestore")
                const unsub = onSnapshot(
                    fsQuery(fsCol(db, "room_bookings"), fsWhere("status", "==", "PENDING")),
                    snap => setNotifications(prev => ({ ...prev, meetingRoomPending: snap.size })),
                    () => {}
                )
                return unsub
            } catch { return () => {} }
        }
        let meetingRoomUnsub: (() => void) | undefined
        setupMeetingRoomListener().then(u => { meetingRoomUnsub = u })
        return () => { unsubSite(); unsubShop(); unsubTesting(); unsubJob(); unsubOther(); unsubDialux(); supabase.removeChannel(ch); if (meetingRoomUnsub) meetingRoomUnsub() }
    }, [userId, subordinateIds])

    useEffect(() => {
        const total = Object.values(notifications.unreadByService).reduce((a, b) => a + b, 0)
        setNotifications(prev => ({ ...prev, unreadMessages: total }))
    }, [notifications.unreadByService])

    // FIX: Consolidated activity feed — reuses the same queries as the notification counters above
    // but with limit(10) to avoid re-subscribing to entire collections a second time.
    useEffect(() => {
        if (!db || !userId) return
        const userDeptUpper = (userDept || "").toUpperCase(); const userRoleUpper = (userRole || "").toUpperCase()
        const isManager = userRoleUpper === "MANAGER" || userRoleUpper === "SALES HEAD" || userRoleUpper === "SUPER ADMIN"; const isTSM = userRoleUpper === "TSM" || userRoleUpper === "TERRITORY SALES MANAGER"
        const hasGlobalAccess = userDeptUpper === "IT" || userDeptUpper === "ENGINEERING" || isManager || userRoleUpper === "LEADER"

        // Use server-side filters + limit to minimize reads
        const makeActivityQuery = (collName: string) => {
            if (hasGlobalAccess) return query(collection(db, collName), orderBy("createdAt", "desc"), limit(10))
            if (isTSM) return query(collection(db, collName), where("submittedBy", "in", [userId, ...subordinateIds.slice(0, 9)]), orderBy("createdAt", "desc"), limit(10))
            return query(collection(db, collName), where("submittedBy", "==", userId), orderBy("createdAt", "desc"), limit(10))
        }

        const activitiesMap = new Map()
        function updateActivity(type: string, docs: any[]) {
            docs.forEach(doc => { const data = doc.data(); activitiesMap.set(doc.id, { id: doc.id, type, ...data }) })
            const sorted = Array.from(activitiesMap.values()).sort((a, b) => { const timeA = a.createdAt?.toMillis?.() || a.arrivalDate?.toMillis?.() || 0; const timeB = b.createdAt?.toMillis?.() || b.arrivalDate?.toMillis?.() || 0; return timeB - timeA }).slice(0, 5)
            setRecentActivity(sorted)
        }
        const unsubDialux = onSnapshot(makeActivityQuery("dialux_requests"), snap => updateActivity("DIAlux", snap.docs))
        const unsubJob = onSnapshot(makeActivityQuery("job_requests"), snap => updateActivity("Job", snap.docs))
        const unsubShop = onSnapshot(makeActivityQuery("shop_drawing_requests"), snap => updateActivity("Shop", snap.docs))
        const unsubSite = onSnapshot(makeActivityQuery("appointments"), snap => updateActivity("Site Visit", snap.docs))
        const unsubTesting = onSnapshot(makeActivityQuery("testing_tracker"), snap => updateActivity("Testing", snap.docs))
        return () => { unsubDialux(); unsubJob(); unsubShop(); unsubSite(); unsubTesting() }
    }, [userId, userRole, userDept, subordinateIds])

    // FIX: Schedule data — reuse filtered queries, add limit to avoid full collection scans
    useEffect(() => {
        if (!db || !userId) return
        const userRoleUpper = (userRole || "").toUpperCase(); const userDeptUpper = (userDept || "").toUpperCase()
        const isManager = userRoleUpper === "MANAGER" || userRoleUpper === "SALES HEAD" || userRoleUpper === "SUPER ADMIN"; const isTSM = userRoleUpper === "TSM" || userRoleUpper === "TERRITORY SALES MANAGER"
        const hasGlobalAccess = userDeptUpper === "IT" || userDeptUpper === "ENGINEERING" || isManager || userRoleUpper === "LEADER"

        const qApps = hasGlobalAccess
            ? query(collection(db, "appointments"), orderBy("appointmentDate", "asc"), limit(50))
            : isTSM
                ? query(collection(db, "appointments"), where("submittedBy", "in", [userId, ...subordinateIds.slice(0, 9)]), orderBy("appointmentDate", "asc"), limit(50))
                : query(collection(db, "appointments"), where("submittedBy", "==", userId), orderBy("appointmentDate", "asc"), limit(50))

        const qTesting = hasGlobalAccess
            ? query(collection(db, "testing_tracker"), where("releaseDate", "==", null), orderBy("targetDate", "asc"), limit(50))
            : isTSM
                ? query(collection(db, "testing_tracker"), where("submittedBy", "in", [userId, ...subordinateIds.slice(0, 9)]), orderBy("targetDate", "asc"), limit(50))
                : query(collection(db, "testing_tracker"), where("submittedBy", "==", userId), orderBy("targetDate", "asc"), limit(50))
        const unsubApps = onSnapshot(qApps, snap => {
            const today = new Date(); today.setHours(0, 0, 0, 0); const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
            let apps = snap.docs.map(doc => { const data = doc.data(); return { id: doc.id, type: "Site Visit", date: data.appointmentDate?.toDate(), title: data.client || "Untitled Visit", ...data } }).filter(a => a.date)
            setScheduleData(prev => {
                const combined = [...apps, ...prev.upcoming.filter(i => i.type === "Testing")].sort((a, b) => a.date.getTime() - b.date.getTime())
                const todayItems = combined.filter(i => i.date >= today && i.date < tomorrow); const upcomingItems = combined.filter(i => i.date >= tomorrow); const nextItem = combined.find(i => i.date >= new Date()) || null
                return { today: todayItems, upcoming: upcomingItems, next: nextItem }
            })
        })
        const unsubTesting = onSnapshot(qTesting, snap => {
            const today = new Date(); today.setHours(0, 0, 0, 0); const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
            let items = snap.docs.map(doc => { const data = doc.data(); return { id: doc.id, type: "Testing", date: data.targetDate?.toDate(), title: data.productName || "Untitled Product", releaseDate: data.releaseDate, ...data } }).filter(a => a.date && !a.releaseDate)
            setScheduleData(prev => {
                const combined = [...items, ...prev.today.filter(i => i.type === "Site Visit"), ...prev.upcoming.filter(i => i.type === "Site Visit")].sort((a, b) => a.date.getTime() - b.date.getTime())
                const todayItems = combined.filter(i => i.date >= today && i.date < tomorrow); const upcomingItems = combined.filter(i => i.date >= tomorrow); const nextItem = combined.find(i => i.date >= new Date()) || null
                return { today: todayItems, upcoming: upcomingItems, next: nextItem }
            })
        })
        return () => { unsubApps(); unsubTesting() }
    }, [userId, userRole, userDept, subordinateIds])

    const tabs = useMemo(() => {
        const dept = (userDept || "").toUpperCase(); const role = (userRole || "").toUpperCase(); let base = ["Monitoring"]
        if (dept === "ENGINEERING") base = ["Monitoring", "My Tasks", "Schedule"]
        else if (dept === "SALES") base = ["Monitoring", "My Tasks", "Schedule"]
        else if (dept === "PROCUREMENT" || dept === "WAREHOUSE OPERATIONS") base = ["Product Requests", "Testing"]
        else if (dept === "IT") base = ["Monitoring", "System", "Schedule"]
        else if (dept === "ADMIN") base = ["Overview", "Meeting Rooms", "Schedule"]
        if (role === "SUPER ADMIN" || role === "MANAGER") { if (!base.includes("Admin")) base.push("Admin") }
        return base
    }, [userRole, userDept, perms])

    const services = useMemo(() => {
        const all = [
            { label: "Site Visit Appointment", icon: CalendarCheck, count: notifications.siteVisit, msgCount: notifications.unreadByService.siteVisit, path: "/appointments/site-visit", key: "siteVisit" },
            { label: "Job Request", icon: FileText, count: notifications.jobRequest, msgCount: notifications.unreadByService.jobRequest, path: "/request/job", key: "jobRequest" },
            { label: "Dialux Simulation", icon: Monitor, count: notifications.dialuxRequest, msgCount: notifications.unreadByService.dialux, path: "/request/dialux", key: "dialux" },
            { label: "Product Recommendation", icon: ThumbsUp, count: 0, msgCount: 0, path: "/requests/recommendation", key: "recommendation" },
            { label: "SPF Shop Drawing Request", icon: StreetLightIcon as LucideIcon, count: notifications.shopDrawing, msgCount: notifications.unreadByService.shopDrawing, path: "/request/shop-drawing", key: "shopDrawing" },
            { label: "Testing Monitoring", icon: ClipboardCheck, count: notifications.testingActive + notifications.testingOverdue, msgCount: 0, path: "/request/testing", key: "testing" },
            { label: "SPF Product Request", icon: Package, count: notifications.productRequest || 0, msgCount: notifications.unreadByService.product || 0, path: "/request/product", key: "productRequest" },
            { label: "Other Request", icon: MoreHorizontal, count: notifications.otherRequest, msgCount: notifications.unreadByService.others, path: "/request/other", key: "other" },
            { label: "Meeting Rooms", icon: DoorOpen, count: notifications.meetingRoomPending || 0, msgCount: 0, path: "/appointments/meeting-rooms", key: "meetingRoom" },
        ]
        if (!userRole || dynamicPermissions.length === 0) return []
        const roleKey = userRole.toUpperCase()
        const deptKey = userDept ? userDept.toUpperCase().trim() : ""

        // IT dept + SUPER ADMIN always get all services — no Firestore gate needed
        const isSuperAdmin = roleKey === "SUPER ADMIN"
        const isIT = deptKey === "IT"
        if (isIT || isSuperAdmin) return all

        const targetId = deptKey ? `${deptKey}_${roleKey}` : `_${roleKey}`
        let currentPerms = dynamicPermissions.find(p => p.id === targetId)

        // TSM fallback
        if (!currentPerms && roleKey === "TSM") {
            const altId = deptKey ? `${deptKey}_TERRITORY SALES MANAGER` : `_TERRITORY SALES MANAGER`
            currentPerms = dynamicPermissions.find(p => p.id === altId)
        }
        // Sales TSA: Firestore role may be MEMBER/TSA but permission doc uses full position name
        if (!currentPerms && deptKey === "SALES" && (roleKey === "MEMBER" || roleKey === "TSA")) {
            currentPerms = dynamicPermissions.find(p => p.id === "SALES_TERRITORY SALES ASSOCIATE")
        }
        // Admin STAFF: Firestore role may be MEMBER but permission doc uses STAFF
        if (!currentPerms && deptKey === "ADMIN" && (roleKey === "MEMBER" || roleKey === "STAFF")) {
            currentPerms = dynamicPermissions.find(p => p.id === "ADMIN_STAFF")
        }
        // Last resort: match by role suffix
        if (!currentPerms) {
            currentPerms = dynamicPermissions.find(p => p.id.endsWith(`_${roleKey}`))
        }
        if (!currentPerms?.services) return []
        return all.filter(s => currentPerms.services[s.key === "other" ? "others" : s.key] === true)
    }, [userRole, userDept, notifications, dynamicPermissions])

    // For Admin dept — only count meeting room pending bookings in the bell badge
    const totalNotifications = userDetails.Department?.toUpperCase() === "ADMIN"
        ? (notifications.meetingRoomPending || 0)
        : notifications.siteVisit + notifications.shopDrawing + notifications.testingOverdue + notifications.jobRequest + notifications.otherRequest + notifications.dialuxRequest + notifications.productRequest
    const getWeatherIcon = (condition: string, size: number) => {
        const isNight = currentTime.getHours() >= 18 || currentTime.getHours() < 6
        switch (condition) {
            case "Rainy": return <CloudRain size={size} className="text-blue-400" />
            case "Stormy": return <CloudLightning size={size} className="text-purple-400" />
            case "Cloudy": return isNight ? <CloudMoon size={size} className="text-indigo-300" /> : <Cloud size={size} className="text-gray-400" />
            case "Clear": return isNight ? <Moon size={size} className="text-yellow-300" /> : <Sun size={size} className="text-yellow-500" />
            default: return isNight ? <CloudMoon size={size} className="text-indigo-200" /> : <CloudSun size={size} className="text-orange-400" />
        }
    }
    const getGreeting = () => { const h = currentTime.getHours(); if (h < 12) return "Good Morning"; if (h < 18) return "Good Afternoon"; return "Good Evening" }
    const formattedTime = currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const formattedDate = currentTime.toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" })

    return (
        <ProtectedPageWrapper>
            <SidebarProvider defaultOpen={false}>
                <AppSidebar userId={userId} />
                <SidebarInset className="bg-[#F2F4F7] min-h-screen font-sans">
                    <header className="hidden md:flex h-16 items-center justify-between px-6 lg:px-10 bg-white border-b border-gray-100 sticky top-0 z-50">
                        <div className="flex items-center gap-4">
                            <SidebarTrigger className="hover:bg-gray-100 rounded-xl transition-colors p-2" />
                            <div className="h-4 w-px bg-gray-200" />
                            <div className="flex items-center gap-3">
                                <div className="size-9 rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0 ring-2 ring-gray-100">
                                    {userDetails.profilePicture ? <img src={userDetails.profilePicture} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white font-black text-[11px]">{userDetails.Firstname ? userDetails.Firstname.substring(0, 2).toUpperCase() : "EN"}</div>}
                                </div>
                                <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">{getGreeting()}</p><div className="flex items-center gap-2 mt-0.5"><h2 className="text-[15px] font-black text-gray-900 tracking-tight leading-none">{userDetails.Firstname || "User"}</h2>{userDetails.Department && <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wide">{userDetails.Department}</span>}</div></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="hidden lg:flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 text-gray-500"><div className="flex items-center gap-1.5"><div className="size-1.5 bg-emerald-500 rounded-full animate-pulse" /><span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Live</span></div><div className="h-3 w-px bg-gray-200" /><div className="flex items-center gap-1.5">{getWeatherIcon(weather.condition, 14)}<span className="text-[11px] font-black text-gray-700">{weather.temp}</span></div><div className="h-3 w-px bg-gray-200" /><span className="text-[10px] font-bold text-gray-600">{formattedTime}</span></div>
                            <button onClick={() => router.push("/messages")} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all relative"><MessageSquare size={18} />{notifications.unreadMessages > 0 && <span className="absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white border-2 border-white px-0.5">{notifications.unreadMessages > 99 ? "99+" : notifications.unreadMessages}</span>}</button>
                            <div className="relative" ref={notifRef}><button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className={cn("p-2 rounded-xl transition-all relative", showNotifDropdown ? "bg-red-50 text-[#E33636]" : "text-gray-400 hover:text-[#E33636] hover:bg-red-50")}><Bell size={18} />{totalNotifications > 0 && <span className="absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-[#E33636] text-[9px] font-bold text-white border-2 border-white px-0.5">{totalNotifications > 99 ? "99+" : totalNotifications}</span>}</button>{showNotifDropdown && <div className="absolute right-0 mt-2 z-[60]"><EnhancedNotifications notifications={notifications} userId={userId} userDept={userDept} onClose={() => setShowNotifDropdown(false)} /></div>}</div>
                        </div>
                    </header>
                    <header className="md:hidden bg-[#E33636] pt-14 pb-24 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden"><div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-24 -mt-24 pointer-events-none" /><div className="max-w-7xl mx-auto"><div className="flex justify-between items-start mb-8"><div className="flex items-center gap-3"><div className="size-11 rounded-full overflow-hidden border-2 border-white/30 bg-white/10 flex-shrink-0">{userDetails.profilePicture ? <img src={userDetails.profilePicture} alt="User" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white font-black text-sm">{userDetails.Firstname ? userDetails.Firstname[0].toUpperCase() : "E"}</div>}</div><div className="text-white"><p className="text-[10px] font-bold uppercase tracking-widest opacity-70 leading-none mb-1">{getGreeting()}</p><h1 className="text-xl font-extrabold tracking-tight leading-none">{userDetails.Firstname || "User"}!</h1>{userDetails.Department && <p className="text-[9px] font-bold uppercase tracking-widest opacity-60 mt-0.5">{userDetails.Department}</p>}</div></div><div className="flex gap-2"><button onClick={() => router.push("/messages")} className="p-2.5 bg-white/10 rounded-full border border-white/10 text-white relative"><MessageSquare size={18} />{notifications.unreadMessages > 0 && <span className="absolute -top-1 -right-1 flex min-w-[16px] h-4 items-center justify-center rounded-full bg-blue-400 text-[9px] font-bold text-white border-2 border-[#E33636] px-0.5 shadow-sm">{notifications.unreadMessages > 9 ? "9+" : notifications.unreadMessages}</span>}</button><div className="relative" ref={notifRef}><button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className="p-2.5 bg-white/10 rounded-full border border-white/10 text-white relative"><Bell size={18} />{totalNotifications > 0 && <span className="absolute -top-1 -right-1 flex min-w-[16px] h-4 items-center justify-center rounded-full bg-white text-[9px] font-black text-[#E33636] border-2 border-[#E33636] px-0.5">{totalNotifications > 9 ? "9+" : totalNotifications}</span>}</button>{showNotifDropdown && <div className="absolute right-0 top-full mt-2 z-[60]"><EnhancedNotifications notifications={notifications} userId={userId} userDept={userDept} onClose={() => setShowNotifDropdown(false)} /></div>}</div><SidebarTrigger className="p-2.5 bg-white text-[#E33636] rounded-full shadow-lg" /></div></div><div className="bg-white rounded-2xl flex items-stretch shadow-xl overflow-hidden h-[80px]"><div className="flex-[1.2] px-4 flex items-center gap-3"><div className="p-1.5 rounded-lg">{getWeatherIcon(weather.condition, 28)}</div><div><p className="text-[9px] font-bold text-gray-400 leading-none mb-1">{getGreeting()}!</p><div className="flex items-baseline gap-1"><span className="text-xl font-black text-gray-900 leading-none">{formattedTime.split(" ")[0]}</span><span className="text-[10px] font-black text-gray-700">{formattedTime.split(" ")[1]}</span></div></div></div><div className="w-px bg-gray-100 my-3" /><div className="flex-1 flex flex-col items-center justify-center"><p className="text-[9px] font-bold text-gray-300 uppercase mb-0.5">{weather.condition}</p><span className="text-xl font-black text-gray-800 leading-none">{weather.temp}</span><p className="text-[8px] font-bold text-gray-400 uppercase mt-1">{formattedDate.split(",")[0]}</p></div></div></div></header>
                    <main className="px-4 -mt-8 space-y-6 pb-32 md:mt-0 md:px-6 lg:px-10 md:py-6 max-w-7xl mx-auto animate-in fade-in duration-500">
                        <section className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 relative z-10"><div className="flex items-center justify-between mb-4"><h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Services</h2>{!isDataLoading && services.length > 0 && <span className="text-[9px] font-black text-gray-300 uppercase">{services.length} Available</span>}</div>{isDataLoading ? (
                                    <div className="space-y-4">
                                        <BoneyardSkeleton />
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {[...Array(4)].map((_, i) => (
                                                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-10 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
                                                        <div className="space-y-1.5 flex-1">
                                                            <div className="h-2.5 w-full bg-gradient-to-r from-gray-100 to-gray-200 rounded-full animate-pulse" />
                                                            <div className="h-2 w-2/3 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full animate-pulse" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : services.length === 0 ? <div className="py-8 text-center"><p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No services configured</p></div> : <><div className="md:hidden"><div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar py-2" onScroll={(e) => setCurrentPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth))} ref={scrollRef}>{[...Array(Math.ceil(services.length / 6))].map((_, pageIndex) => <div key={pageIndex} className="min-w-full grid grid-cols-3 gap-y-5 px-2 snap-center">{services.slice(pageIndex * 6, (pageIndex + 1) * 6).map((service, i) => <button key={i} onClick={() => router.push(service.path)} className="flex flex-col items-center transition-all active:scale-90"><div className="size-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-2.5 relative"><service.icon className="text-[#E33636]" size={26} />{service.count > 0 && <span className="absolute -top-1 -right-1 bg-[#E33636] text-white text-[10px] min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center font-bold border-2 border-white">{service.count > 99 ? "99+" : service.count}</span>}{service.msgCount > 0 && <span className="absolute -bottom-1 -left-1 bg-blue-600 text-white text-[9px] size-5 rounded-full flex items-center justify-center font-bold border-2 border-white"><MessageSquare size={10} fill="currentColor" /></span>}</div><span className="text-[11px] font-bold text-gray-600 text-center leading-tight px-1">{service.label}</span></button>)}</div>)}</div>{Math.ceil(services.length / 6) > 1 && <div className="flex justify-center gap-2 mt-3">{[...Array(Math.ceil(services.length / 6))].map((_, i) => <div key={i} className={cn("h-1.5 rounded-full transition-all duration-300", currentPage === i ? "w-6 bg-[#E33636]" : "w-1.5 bg-gray-200")} />)}</div>}</div><div className="hidden md:grid grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-5">{services.map((service, i) => <button key={i} onClick={() => router.push(service.path)} className="flex flex-col items-center group transition-all hover:-translate-y-1"><div className="size-14 bg-gray-50 rounded-xl flex items-center justify-center mb-2 group-hover:bg-red-50 transition-all relative border border-gray-100"><service.icon className="text-[#E33636]" size={22} />{service.count > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center font-bold border-2 border-white">{service.count > 99 ? "99+" : service.count}</span>}{service.msgCount > 0 && <span className="absolute -bottom-1.5 -left-1.5 bg-blue-600 text-white text-[9px] size-5 rounded-full flex items-center justify-center font-bold border-2 border-white shadow-md animate-bounce"><MessageSquare size={10} fill="currentColor" /></span>}</div><span className="text-[10px] font-bold text-gray-500 text-center leading-tight">{service.label}</span></button>)}</div></>}</section>
                        {isDataLoading ? <PremiumCardLoading /> : (userDetails.Department?.toUpperCase() === "ADMIN") ? null : <ProductivityHub userDetails={userDetails} tasks={myTasks} schedule={scheduleData} router={router} />}
                        {!isDataLoading && perms?.dashboard?.showAlertBanner !== false && notifications.testingOverdue > 0 && userDetails.Department?.toUpperCase() !== "ADMIN" && <div className="flex items-center justify-between gap-3 bg-[#E33636] text-white px-4 py-3 rounded-2xl shadow-lg cursor-pointer active:scale-[0.99] transition-all" onClick={() => router.push("/request/testing")}><div className="flex items-center gap-2.5"><AlertTriangle size={15} className="flex-shrink-0" /><p className="text-[11px] font-black uppercase tracking-wide">{notifications.testingOverdue} Critical Testing Item{notifications.testingOverdue > 1 ? "s" : ""} — Action Required</p></div><ChevronRight size={14} className="flex-shrink-0 opacity-70" /></div>}
                        
                        {/* Admin dept — tailored command center */}
                        {userDetails.Department?.toUpperCase() === "ADMIN" && !isDataLoading && (
                            <AdminDashboard router={router} userId={userId} />
                        )}

                        {userDetails.Department?.toUpperCase() !== "ADMIN" && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                            <div className="lg:col-span-2 space-y-6">
                                <RecentActivityFeed activities={recentActivity} router={router} />
                                {isDataLoading && (userRole === "SUPER ADMIN" || userRole === "MANAGER" || userDept === "IT") ? (
                                    <BoneyardSkeleton />
                                ) : (userRole === "SUPER ADMIN" || userRole === "MANAGER" || userDept === "IT") && <WorkloadOverview notifications={notifications} />}
                                <section className="space-y-3">
                                    {perms?.dashboard?.showOverviewTabs !== false && (
                                        <><h2 className="text-lg font-bold text-gray-900 tracking-tight">Overview</h2><div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">{tabs.map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={cn("px-5 py-1.5 rounded-full text-[10px] font-bold transition-all border whitespace-nowrap", activeTab === tab ? "bg-[#E33636] text-white border-[#E33636] shadow-md" : "bg-white text-gray-400 border-gray-100 hover:border-gray-200")}>{tab}</button>))}</div></>
                                    )}
                                    <div className="mt-4">
                                        {activeTab === "Overview" && userDept === "ADMIN" ? (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <ActivityCard label="Pending Bookings" value={notifications.siteVisit} icon={CalendarCheck} loading={isDataLoading} onClick={() => router.push("/appointments/meeting-rooms")} />
                                                    <ActivityCard label="Meeting Rooms" value={0} icon={MoreHorizontal} loading={isDataLoading} onClick={() => router.push("/admin/meeting-rooms")} />
                                                </div>
                                                <button onClick={() => router.push("/admin/meeting-rooms/dashboard")} className="w-full flex items-center justify-between p-3 bg-zinc-900 text-white rounded-2xl hover:bg-zinc-800 transition-all active:scale-[0.98]">
                                                    <div className="flex items-center gap-2.5">
                                                        <BarChart3 size={16} className="text-zinc-400" />
                                                        <div className="text-left">
                                                            <p className="text-[11px] font-black uppercase">Room Analytics</p>
                                                            <p className="text-[9px] text-zinc-400">View utilization & peak hours</p>
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={14} className="text-zinc-500" />
                                                </button>
                                                <button onClick={() => router.push("/admin/meeting-rooms")} className="w-full flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-2xl hover:bg-zinc-50 transition-all active:scale-[0.98]">
                                                    <div className="flex items-center gap-2.5">
                                                        <Zap size={16} className="text-zinc-600" />
                                                        <div className="text-left">
                                                            <p className="text-[11px] font-black uppercase text-zinc-900">Manage Rooms</p>
                                                            <p className="text-[9px] text-zinc-400">Add, edit, or deactivate rooms</p>
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={14} className="text-zinc-300" />
                                                </button>
                                            </div>
                                        ) : activeTab === "Meeting Rooms" && userDept === "ADMIN" ? (
                                            <div className="space-y-2">
                                                <button onClick={() => router.push("/appointments/meeting-rooms/add")} className="w-full flex items-center gap-3 p-3 bg-zinc-900 text-white rounded-2xl hover:bg-zinc-800 transition-all active:scale-[0.98]">
                                                    <Plus size={16} />
                                                    <span className="text-[11px] font-black uppercase">Book a Room</span>
                                                </button>
                                                <button onClick={() => router.push("/appointments/meeting-rooms")} className="w-full flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-2xl hover:bg-zinc-50 transition-all">
                                                    <span className="text-[11px] font-black uppercase text-zinc-900">All Bookings</span>
                                                    <ChevronRight size={14} className="text-zinc-300" />
                                                </button>
                                                <button onClick={() => router.push("/admin/meeting-rooms/dashboard")} className="w-full flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-2xl hover:bg-zinc-50 transition-all">
                                                    <span className="text-[11px] font-black uppercase text-zinc-900">Analytics Dashboard</span>
                                                    <ChevronRight size={14} className="text-zinc-300" />
                                                </button>
                                            </div>
                                        ) : activeTab === "Monitoring" ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                <ActivityCard label="In-Testing" value={notifications.testingActive} icon={ClipboardCheck} loading={isDataLoading} onClick={() => router.push("/request/testing")} />
                                                <ActivityCard label="Critical" value={notifications.testingOverdue} icon={AlertTriangle} loading={isDataLoading} isAlert={notifications.testingOverdue > 0} onClick={() => router.push("/request/testing")} />
                                                <ActivityCard label="Site Visits" value={notifications.siteVisit} icon={CalendarCheck} loading={isDataLoading} onClick={() => router.push("/appointments/site-visit")} />
                                                <ActivityCard label="Shop Review" value={notifications.shopDrawing} icon={StreetLightIcon as LucideIcon} loading={isDataLoading} onClick={() => router.push("/request/shop-drawing")} />
                                            </div>
                                        ) : activeTab === "My Tasks" ? (
                                            <div className="space-y-2">
                                                {Object.values(myTasks).every(arr => arr.length === 0) ? <div className="py-10 flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-gray-200"><ThumbsUp size={20} className="text-gray-200 mb-2" /><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">All tasks completed!</p></div> : <>{myTasks.siteVisits.map(task => (<div key={task.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center justify-between group hover:shadow-sm transition-all cursor-pointer" onClick={() => router.push(`/appointments/site-visit/${task.id}`)}><div className="flex items-center gap-3"><div className="size-8 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600"><CalendarCheck size={14} /></div><div><p className="text-[11px] font-black text-gray-900 uppercase truncate max-w-[120px]">{task.client || "Site Visit"}</p><p className="text-[9px] text-gray-400 font-bold">{task.appointmentDate ? format(task.appointmentDate.toDate(), "MMM dd") : "No date"} · Site Visit</p></div></div><ChevronRight size={12} className="text-gray-300 group-hover:translate-x-0.5 transition-transform" /></div>))}{myTasks.jobRequests.map(task => (<div key={task.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center justify-between group hover:shadow-sm transition-all cursor-pointer" onClick={() => router.push(`/request/job/${task.id}`)}><div className="flex items-center gap-3"><div className="size-8 rounded-xl flex items-center justify-center bg-orange-50 text-orange-600"><FileText size={14} /></div><div><p className="text-[11px] font-black text-gray-900 uppercase truncate max-w-[120px]">{task.projectName || "Job Request"}</p><p className="text-[9px] text-gray-400 font-bold">{task.createdAt ? format(task.createdAt.toDate(), "MMM dd") : "No date"} · Job Request</p></div></div><ChevronRight size={12} className="text-gray-300 group-hover:translate-x-0.5 transition-transform" /></div>))}{myTasks.testingItems.map(task => (<div key={task.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center justify-between group hover:shadow-sm transition-all cursor-pointer" onClick={() => router.push(`/request/testing/${task.id}`)}><div className="flex items-center gap-3"><div className="size-8 rounded-xl flex items-center justify-center bg-violet-50 text-violet-600"><ClipboardCheck size={14} /></div><div><p className="text-[11px] font-black text-gray-900 uppercase truncate max-w-[120px]">{task.productName || "Testing"}</p><p className="text-[9px] text-gray-400 font-bold">{task.targetDate ? format(task.targetDate.toDate(), "MMM dd") : "No date"} · Testing</p></div></div><ChevronRight size={12} className="text-gray-300 group-hover:translate-x-0.5 transition-transform" /></div>))}</>}
                                            </div>
                                        ) : activeTab === "Schedule" ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Schedule View</p><div className="flex p-1 bg-gray-100 rounded-xl"><button onClick={() => setScheduleView("list")} className={cn("px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all", scheduleView === "list" ? "bg-white text-zinc-900 shadow-sm" : "text-gray-400")}>List</button><button onClick={() => setScheduleView("calendar")} className={cn("px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all", scheduleView === "calendar" ? "bg-white text-zinc-900 shadow-sm" : "text-gray-400")}>Calendar</button></div></div>
                                                {scheduleView === "list" ? (<div className="space-y-4"><div className="space-y-2"><p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Today</p>{scheduleData.today.length > 0 ? scheduleData.today.map(item => (<div key={item.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center justify-between group hover:shadow-sm transition-all"><div className="flex items-center gap-3"><div className={cn("size-8 rounded-xl flex items-center justify-center", item.type === "Site Visit" ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600")}>{item.type === "Site Visit" ? <CalendarCheck size={14} /> : <ClipboardCheck size={14} />}</div><div><p className="text-[11px] font-black text-gray-900 uppercase truncate max-w-[120px]">{item.title}</p><p className="text-[9px] text-gray-400 font-bold">{format(item.date, "HH:mm")} · {item.type}</p></div></div><ChevronRight size={12} className="text-gray-300 group-hover:translate-x-0.5 transition-transform" /></div>)) : <div className="p-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-100 text-center"><p className="text-[9px] font-black text-gray-300 uppercase">No items today</p></div>}</div><div className="space-y-2"><p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Upcoming</p>{scheduleData.upcoming.length > 0 ? scheduleData.upcoming.slice(0, 3).map(item => (<div key={item.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center justify-between group hover:shadow-sm transition-all"><div className="flex items-center gap-3"><div className={cn("size-8 rounded-xl flex items-center justify-center", item.type === "Site Visit" ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600")}>{item.type === "Site Visit" ? <CalendarCheck size={14} /> : <ClipboardCheck size={14} />}</div><div><p className="text-[11px] font-black text-gray-900 uppercase truncate max-w-[120px]">{item.title}</p><p className="text-[9px] text-gray-400 font-bold">{format(item.date, "MMM dd")} · {item.type}</p></div></div><ChevronRight size={12} className="text-gray-300 group-hover:translate-x-0.5 transition-transform" /></div>)) : <div className="p-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-100 text-center"><p className="text-[9px] font-black text-gray-300 uppercase">No upcoming items</p></div>}</div></div>) : <DashboardCalendar scheduleData={scheduleData} router={router} />}
                                            </div>
                                        ) : null}
                                    </div>
                                </section>
                            </div>

                            <div className="space-y-6 lg:sticky lg:top-24 z-10">
                                <QuickActionHub role={userRole || ""} dept={userDept || ""} router={router} />
                                {(userRole === "TSM" || userRole === "MANAGER" || userRole === "SUPER ADMIN" || userDept === "IT" || userDept === "SALES") && <RecentCustomersWidget customers={recentCustomers} loading={loadingCustomerCount} router={router} />}
                                <DepartmentPulse userDept={userDept} myTasks={myTasks} />
                            </div>
                        </div>
                        )}
                    </main>
                    <FloatingActionButton department={userDept || ""} userId={userId} />
                    <DashboardGuide department={userDept || ""} role={userRole || "MEMBER"} />
                </SidebarInset>
            </SidebarProvider>
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </ProtectedPageWrapper>
    )
}
