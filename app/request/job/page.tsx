"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import {
    Plus, Search, ChevronRight, Activity, RotateCcw,
    Ticket, Wrench, User2, Loader2, CheckCircle2, ShieldCheck,
    Clock, LayoutGrid, XCircle, ArrowRight,
    User, Building2, MapPin, ClipboardList, Info, Sparkles,
    ChevronLeft, ChevronDown, ListFilter,
    Target, TrendingUp, AlertCircle, CheckCircle, BarChart3,
    HelpCircle, Lightbulb, Bell, ListChecks, Briefcase,
    Eye, Download, Calendar, Timer, FileText, X
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

// FIREBASE
import { db } from "@/lib/firebase"
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc } from "firebase/firestore"

// CUSTOM COMPONENTS
import { PageHeader } from "@/components/page-header"
import { JobCounterAdmin } from "@/components/job-counter-admin"

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    PENDING: {
        label: "Pending Job",
        color: "text-amber-600", bg: "bg-transparent", border: "border-transparent", dot: "bg-amber-500",
    },
    IN_PROGRESS: {
        label: "In Progress",
        color: "text-blue-600", bg: "bg-transparent", border: "border-transparent", dot: "bg-blue-500",
    },
    COMPLETED: {
        label: "Job Completed",
        color: "text-emerald-600", bg: "bg-transparent", border: "border-transparent", dot: "bg-emerald-500",
    },
}

const FILTERS = [
    { key: null, label: "All Jobs", icon: LayoutGrid, variant: "default" },
    { key: "PENDING", label: "Pending", icon: Clock, variant: "warning" },
    { key: "IN_PROGRESS", label: "Active", icon: Wrench, variant: "blue" },
    { key: "COMPLETED", label: "Completed", icon: CheckCircle2, variant: "emerald" },
]

function getStatusMeta(status: string) {
    const s = (status || "").toUpperCase().trim()
    return STATUS_META[s] || { label: status, color: "text-zinc-500", bg: "bg-zinc-50", border: "border-zinc-200", dot: "bg-zinc-300" }
}

function DashboardCard({ label, value, subValue, icon: Icon, colorClass, loading }: any) {
    return (
        <div className="flex-1 bg-white rounded-xl md:rounded-2xl p-2.5 md:p-3 border border-zinc-200/60 shadow-sm flex items-center gap-3 group hover:shadow-md transition-all min-w-0">
            <div className={cn("p-2 rounded-lg md:rounded-xl flex-shrink-0", colorClass)}>
                <Icon className="size-3.5 md:size-4" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                    {loading ? (
                        <div className="h-3.5 md:h-4 w-12 md:w-16 bg-zinc-100 rounded animate-pulse" />
                    ) : (
                        <p className="text-[13px] md:text-[14px] font-black text-zinc-900 leading-none truncate tracking-tight">{value}</p>
                    )}
                    {!loading && subValue && (
                        <span className="hidden xl:inline-block text-[7px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-50 px-1 py-0.5 rounded border border-zinc-100 whitespace-nowrap flex-shrink-0">
                            {subValue}
                        </span>
                    )}
                </div>
                <p className="text-[7px] font-black uppercase text-zinc-400 tracking-[0.1em] truncate">{label}</p>
            </div>
        </div>
    )
}

function StatPill({ label, count, isActive, onClick, loading }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all flex-shrink-0 active:scale-95",
                isActive 
                    ? "bg-zinc-900 border-zinc-900 text-white shadow-md shadow-zinc-200" 
                    : "bg-white border-zinc-200/60 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"
            )}
        >
            <div className="text-left">
                {loading ? (
                    <div className="h-3 w-3 bg-zinc-100 rounded animate-pulse" />
                ) : (
                    <p className={cn("text-[13px] font-black leading-none", isActive ? "text-white" : "text-zinc-900")}>{count}</p>
                )}
                <p className={cn("text-[7px] font-black uppercase tracking-widest mt-1 whitespace-nowrap", isActive ? "text-zinc-400" : "text-zinc-400")}>{label}</p>
            </div>
        </button>
    )
}

function GuideItem({ icon: Icon, title, description, colorClass }: any) {
    return (
        <div className="flex gap-4 p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 hover:bg-white hover:shadow-sm transition-all group">
            <div className={cn("p-2.5 rounded-xl flex-shrink-0 self-start", colorClass)}>
                <Icon size={18} />
            </div>
            <div>
                <h4 className="text-[13px] font-black text-zinc-900 uppercase tracking-tight mb-1">{title}</h4>
                <p className="text-[11px] font-bold text-zinc-500 leading-relaxed">{description}</p>
            </div>
        </div>
    )
}

function UserGuideDialog({ open, onOpenChange }: any) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] border-none shadow-2xl p-0 bg-white scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent">
                <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-10 px-8 py-6 border-b border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                            <HelpCircle size={22} />
                        </div>
                        <div>
                            <h2 className="text-[20px] font-black text-zinc-900 tracking-tight">
                                Quick Help Guide
                            </h2>
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Simple ways to manage job requests</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {/* Basics */}
                    <section>
                        <div className="mb-4">
                            <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-wide">The Basics</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <GuideItem
                                icon={Plus}
                                title="Create New Job"
                                description="Click the '+ New Job' button to submit a new engineering project. Fill in project details and client information."
                                colorClass="bg-zinc-900 text-white"
                            />
                            <GuideItem
                                icon={Search}
                                title="Find Records Fast"
                                description="Use the search bar to find any project name or job ID instantly. No more scrolling through long lists!"
                                colorClass="bg-blue-50 text-blue-600"
                            />
                        </div>
                    </section>

                    {/* Views */}
                    <section>
                        <div className="mb-4">
                            <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-wide">Quick Actions</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <GuideItem
                                icon={Wrench}
                                title="Toggle Priority"
                                description="Click the Priority badge to quickly toggle between Normal and Urgent status for any job."
                                colorClass="bg-rose-50 text-rose-600"
                            />
                            <GuideItem
                                icon={ListFilter}
                                title="Easy Filtering"
                                description="Click the status pills (like 'Pending' or 'Completed') to only see the jobs you care about right now."
                                colorClass="bg-amber-50 text-amber-600"
                            />
                        </div>
                    </section>

                    {/* Tips */}
                    <div className="bg-zinc-900 rounded-2xl p-6 text-white flex items-center justify-between gap-6 overflow-hidden relative">
                        <div className="relative z-10">
                            <h4 className="text-[15px] font-black mb-1">Quick Reminders!</h4>
                            <ul className="text-[11px] font-medium text-zinc-400 space-y-2 list-disc pl-4">
                                <li><span className="text-white">Sales/IT</span> can create new job requests.</li>
                                <li><span className="text-white">Red Priority</span> means urgent attention needed.</li>
                                <li><span className="text-white">Green</span> means the job is successfully completed!</li>
                            </ul>
                        </div>
                        <Lightbulb className="text-amber-400 flex-shrink-0 relative z-10" size={40} />
                        <div className="absolute -right-10 -bottom-10 size-40 bg-white/5 rounded-full blur-3xl" />
                    </div>
                </div>

                <div className="p-8 pt-0 flex justify-end">
                    <Button
                        onClick={() => onOpenChange(false)}
                        className="h-12 px-8 rounded-2xl bg-zinc-900 text-white font-black text-[12px] uppercase tracking-widest hover:bg-zinc-800 transition-all"
                    >
                        Got it, thanks!
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function SkeletonRow() {
    return (
        <div className="px-6 py-4 animate-pulse">
            {/* Desktop */}
            <div className="hidden md:grid grid-cols-[100px_1fr_100px_120px_100px_44px] gap-6 items-center">
                <div className="h-4 w-16 bg-zinc-100 rounded-full" />
                <div className="space-y-2">
                    <div className="h-4 w-48 bg-zinc-100 rounded-full" />
                    <div className="h-2.5 w-32 bg-zinc-100 rounded-full" />
                </div>
                <div className="h-4 w-24 bg-zinc-100 rounded-full" />
                <div className="h-4 w-28 bg-zinc-100 rounded-full" />
                <div className="h-6 w-20 bg-zinc-100 rounded-lg" />
                <div className="size-8 rounded-xl bg-zinc-100" />
            </div>
            {/* Mobile */}
            <div className="md:hidden space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-zinc-100" />
                        <div className="space-y-2">
                            <div className="h-3 w-28 bg-zinc-100 rounded-full" />
                            <div className="h-2 w-20 bg-zinc-100 rounded-full" />
                        </div>
                    </div>
                    <div className="h-6 w-24 bg-zinc-100 rounded-xl" />
                </div>
            </div>
        </div>
    )
}

function RoleInsights({ user, requests, setShowGuide }: any) {
    const isManager = ["SUPER ADMIN", "MANAGER", "LEADER"].includes(user.role)
    const isIT = user.dept === "IT"
    const isSales = user.dept === "SALES"

    const urgentJobs = requests.filter((r: any) => r.priority === "URGENT" && r.status !== "COMPLETED")
    const myPending = requests.filter((r: any) => r.status === "PENDING" && r.submittedBy === user.id)

    const completionRate = requests.length > 0
        ? (requests.filter((r: any) => r.status === "COMPLETED").length / requests.length) * 100
        : 0

    return (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {/* Dynamic Widget 1: Personal Agenda */}
            <div className="bg-white rounded-[24px] p-4 border border-zinc-200/60 shadow-sm flex items-center justify-between group overflow-hidden relative transition-all hover:shadow-md">
                <div className="flex items-center gap-3">
                    <div className="size-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-zinc-200 flex-shrink-0 group-hover:scale-110 transition-transform">
                        {isSales ? <TrendingUp size={20} /> : <Target size={20} />}
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">
                            {isSales ? "My Pipeline" : "Priority Jobs"}
                        </h4>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-black text-zinc-900 leading-none tracking-tighter">
                                {isSales ? myPending.length : urgentJobs.length}
                            </span>
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Active</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <p className="text-[8px] font-black text-zinc-300 uppercase tracking-widest leading-tight text-right max-w-[80px]">
                        {isSales ? "Pending requests" : "Urgent attention"}
                    </p>
                    {urgentJobs.length > 0 && !isSales && (
                        <div className="mt-2 size-2 bg-rose-500 rounded-full animate-ping" />
                    )}
                </div>
            </div>

            {/* Dynamic Widget 2: Operational Health */}
            <div className="bg-white rounded-[24px] p-4 border border-zinc-200/60 shadow-sm flex items-center justify-between group transition-all hover:shadow-md">
                <div className="flex items-center gap-3 flex-1">
                    <div className="size-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 flex-shrink-0 group-hover:scale-110 transition-transform">
                        <CheckCircle size={20} />
                    </div>
                    <div className="flex-1 pr-4">
                        <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-2">Completion Rate</h4>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-zinc-50 rounded-full overflow-hidden border border-zinc-100">
                                <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.4)]" style={{ width: `${completionRate}%` }} />
                            </div>
                            <span className="text-[12px] font-black text-emerald-600 tracking-tighter">{completionRate.toFixed(0)}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dynamic Widget 3: Help or Stats */}
            {(isManager || isIT) ? (
                <div className="bg-zinc-900 rounded-[24px] p-4 border border-zinc-800 shadow-xl flex items-center justify-between text-white group transition-all hover:bg-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center text-white flex-shrink-0 group-hover:rotate-12 transition-transform">
                            <BarChart3 size={20} />
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest leading-none mb-1 text-zinc-500">Job Volume</h4>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black leading-none tracking-tighter">{requests.length}</span>
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Total Jobs</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center -space-x-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="size-7 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[9px] font-black text-zinc-500 shadow-lg">
                                {String.fromCharCode(65 + i)}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => setShowGuide(true)}
                    className="bg-white rounded-[24px] p-4 border border-zinc-200/60 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-zinc-50 transition-all group hover:shadow-md"
                >
                    <div className="size-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100 flex-shrink-0 group-hover:scale-110 transition-transform">
                        <HelpCircle size={20} />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">Need Help?</h4>
                        <p className="text-[11px] font-black text-zinc-900 uppercase tracking-tight leading-tight">
                            Quick System Guide
                        </p>
                    </div>
                    <div className="ml-auto">
                        <div className="size-8 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                            <ChevronRight size={16} />
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}

/**
 * @name JobRequestManagementPage
 * @protocol Sales/IT Create, All View with Role Filtering
 * @version 3.0-ProductivityEnhanced
 */
export default function JobRequestManagementPage() {
    const router = useRouter()
    const [user, setUser] = React.useState<{ id: string | null; dept: string; role: string; refId: string; name: string }>({ id: null, dept: "", role: "", refId: "", name: "" })
    const [isUserLoading, setIsUserLoading] = React.useState(true)
    const [requests, setRequests] = React.useState<any[]>([])
    const [subordinateIds, setSubordinateIds] = React.useState<string[]>([])
    const [isDataLoading, setIsDataLoading] = React.useState(true)
    const [selectedStatus, setSelectedStatus] = React.useState<string | null>(null)
    const [searchQuery, setSearchQuery] = React.useState("")

    // New Productivity States
    const [currentPage, setCurrentPage] = React.useState(1)
    const [showGuide, setShowGuide] = React.useState(false)
    const PAGE_SIZE = 10

    // 1. IDENTITY & DEPARTMENT RETRIEVAL
    React.useEffect(() => {
        const storedId = localStorage.getItem("userId")
        if (!storedId) { setIsUserLoading(false); return; }

        const fetchUser = async () => {
            try {
                const res = await fetch(`/api/user?id=${encodeURIComponent(storedId)}`)
                const data = await res.json()

                // Get role from firestore for accuracy
                const userDoc = await getDoc(doc(db, "users", storedId))
                const firestoreRole = (userDoc.exists() ? (userDoc.data().Role || userDoc.data().role || "MEMBER") : "MEMBER").toUpperCase()

                const name = `${data.Firstname || ""} ${data.Lastname || ""}`.trim()
                const referenceId = (data.ReferenceID || "").toUpperCase()

                /**
                 * ROLE DETECTION STRATEGY:
                 * - For SALES dept: Use MongoDB Position as primary (supports TSM/TSA hierarchy)
                 * - For other depts: Use Firebase Role as primary (IT, Engineering, etc.)
                 * - Fallback to Firebase Role if Position is empty/generic
                 */
                const dept = (data.Department || "").toUpperCase()
                const position = (data.Position || "").toUpperCase()
                const isSalesDept = dept === "SALES"

                // Sales-specific role detection based on Position
                const isTSM = isSalesDept
                    ? (position.includes("TERRITORY SALES MANAGER") && !position.includes("ASSOCIATE"))
                    : (firestoreRole === "TSM" || firestoreRole === "TERRITORY SALES MANAGER")

                const isTSA = isSalesDept && position.includes("TERRITORY SALES ASSOCIATE")

                const isManager = isSalesDept
                    ? (position.includes("SALES HEAD") || position.includes("MANAGER"))
                    : (firestoreRole === "MANAGER" || firestoreRole === "SALES HEAD")

                // Determine final role priority: Manager > TSM > TSA > Firestore Role
                let finalRole = firestoreRole
                if (isManager) finalRole = "MANAGER"
                else if (isTSM) finalRole = "TSM"
                else if (isTSA) finalRole = "TSA"

                setUser({
                    id: storedId,
                    dept: data.Department?.toUpperCase() || "SALES",
                    role: finalRole,
                    refId: referenceId,
                    name
                })

                // Fetch subordinates if role is TSM or MANAGER
                if (isTSM || isManager) {
                    const usersRes = await fetch('/api/user')
                    const allUsers: any[] = await usersRes.json()
                    let subs: any[] = []

                    const clean = (n: string) => (n || "").replace(/,/g, "").replace(/\s+/g, " ").trim().toUpperCase()
                    const myCleanName = clean(name)

                    if (isTSM) {
                        // TSM can only see TSAs (MEMBER role) that have THIS TSM assigned
                        // Exclude other TSMs and users with empty TSM field
                        subs = allUsers.filter(u => {
                            // Skip if this user is also a TSM (prevent cross-visibility)
                            const uRole = (u.Role || u.role || "MEMBER").toUpperCase()
                            const uPosition = (u.Position || "").toUpperCase()
                            if (uRole === "TSM" || uPosition.includes("TERRITORY SALES MANAGER")) return false

                            // Check if this user has the current TSM assigned to them
                            const uTSM = clean(u.TSM)
                            const uTSMName = clean(u.TSMName)
                            const uTSM_low = clean(u.tsm)
                            const uTSMName_low = clean(u.tsmName)
                            
                            // Must have a non-empty TSM field that matches current user
                            const hasTSMAssigned = (uTSM && uTSM === myCleanName) || 
                                                   (uTSM && uTSM === referenceId) ||
                                                   (uTSMName && uTSMName === myCleanName) || 
                                                   (uTSM_low && uTSM_low === myCleanName) ||
                                                   (uTSM_low && uTSM_low === referenceId) || 
                                                   (uTSMName_low && uTSMName_low === myCleanName)
                            return hasTSMAssigned
                        })
                    } else if (isManager) {
                        // Manager can see all TSMs and TSAs under them
                        subs = allUsers.filter(u => {
                            const uMan = clean(u.Manager)
                            const uManName = clean(u.ManagerName)
                            const uMan_low = clean(u.manager)
                            const uManName_low = clean(u.managerName)
                            const hasManagerAssigned = (uMan && uMan === myCleanName) || 
                                                       (uMan && uMan === referenceId) ||
                                                       (uManName && uManName === myCleanName) || 
                                                       (uMan_low && uMan_low === myCleanName) ||
                                                       (uMan_low && uMan_low === referenceId) || 
                                                       (uManName_low && uManName_low === myCleanName)
                            return hasManagerAssigned
                        })
                    }
                    setSubordinateIds(subs.map(u => u._id))
                }
            } catch (error) {
                console.error("Profile Retrieval Error:", error)
            } finally {
                setIsUserLoading(false)
            }
        }
        fetchUser()
    }, [])

    // 2. LIVE DATA SYNC WITH ROLE-BASED FILTERING
    React.useEffect(() => {
        if (isUserLoading || !user.id) return;

        setIsDataLoading(true)
        const q = query(collection(db, "job_requests"), orderBy("createdAt", "desc"))

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let liveData = snapshot.docs.map(doc => {
                const data = doc.data()
                return {
                    id: doc.id.slice(-6).toUpperCase(),
                    fullId: doc.id,
                    ...data,
                    status: data.status?.toUpperCase() || "PENDING",
                    submittedBy: data.submittedBy,
                }
            })

            /**
             * VISIBILITY PROTOCOL:
             * - IT, ENGINEERING, SUPER ADMIN, MANAGER, LEADER: Global visibility
             * - TSM (SALES): Can see their own AND all TSA requests
             * - TSA (SALES): Restricted to personal records (submittedBy matches userId)
             * - OTHERS (MEMBER): Restricted to personal records (submittedBy matches userId)
             */
            const userDept = user.dept.toUpperCase();
            const userRole = user.role.toUpperCase();
            const hasGlobalAccess = userDept === "IT" || userDept === "ENGINEERING" || ["SUPER ADMIN", "LEADER"].includes(userRole);
            const isTSM = userRole === "TSM";
            const isManager = userRole === "MANAGER";

            // Client-side filtering for non-admin users
            if (!hasGlobalAccess) {
                if (isTSM || isManager) {
                    // TSM and MANAGER can see their own AND all their subordinate requests
                    liveData = liveData.filter(r =>
                        r.submittedBy === user.id ||
                        subordinateIds.includes(r.submittedBy)
                    );
                } else {
                    // TSA and other Members ONLY see their own requests
                    liveData = liveData.filter(r => r.submittedBy === user.id);
                }
            }

            setRequests(liveData)
            setIsDataLoading(false)
        }, (error) => {
            console.error("Firestore Sync Error:", error)
            setIsDataLoading(false)
        })

        return () => unsubscribe()
    }, [user, isUserLoading, subordinateIds])

    const filteredRequests = React.useMemo(() => {
        return requests.filter(r => {
            const s = `${r.projectName} ${r.id} ${r.clientName} ${r.jobRequestNo || ""}`.toLowerCase()
            const matchesSearch = s.includes(searchQuery.toLowerCase())
            const matchesStatus = selectedStatus ? r.status === selectedStatus : true
            return matchesSearch && matchesStatus
        })
    }, [requests, searchQuery, selectedStatus])

    // Pagination Logic
    const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE))
    const paginatedItems = React.useMemo(() => {
        return filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    }, [filteredRequests, currentPage])

    // UPDATED: Sales OR IT can create jobs
    const canCreateJob =
        user.dept === "SALES" ||
        user.dept === "IT" ||
        ["SUPER ADMIN", "MANAGER", "LEADER"].includes(user.role)

    const handleAddNew = () => router.push('/request/job/add')
    const handleReset = () => { setSelectedStatus(null); setSearchQuery(""); setCurrentPage(1); }

    // QUICK STATUS TOGGLE
    const toggleUrgency = async (id: string, current: string) => {
        try {
            const nextStatus = current === "URGENT" ? "NORMAL" : "URGENT"
            await updateDoc(doc(db, "job_requests", id), {
                priority: nextStatus,
                updatedAt: new Date()
            })
        } catch (e) { console.error("Update failed:", e) }
    }

    const counts = {
        all: requests.length,
        pending: requests.filter(r => r.status === "PENDING").length,
        inProgress: requests.filter(r => r.status === "IN_PROGRESS").length,
        completed: requests.filter(r => r.status === "COMPLETED").length,
    }

    return (
        <ProtectedPageWrapper>
            <SidebarProvider defaultOpen={false}>
                <AppSidebar userId={user.id} />
                <SidebarInset className="bg-[#F8FAFA] pb-24 md:pb-10 min-h-screen m-0 rounded-none border-none shadow-none overflow-visible">

                    <PageHeader
                        title="JOB REQUESTS"
                        version="V3.0"
                        showBackButton={true}
                        trigger={<SidebarTrigger className="mr-2" />}
                        actions={
                            <div className="flex items-center gap-2">
                                <div className="hidden sm:flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1">
                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Dept:</span>
                                    <span className="text-[10px] font-black text-zinc-900 uppercase">{user.dept || "—"}</span>
                                </div>
                                <Button
                                    onClick={() => setShowGuide(true)}
                                    variant="outline"
                                    className="h-8 w-8 p-0 rounded-lg bg-white border-zinc-200 text-zinc-400 hover:text-zinc-900 transition-all"
                                >
                                    <HelpCircle className="size-4" />
                                </Button>
                                {canCreateJob && (
                                    <Button
                                        onClick={handleAddNew}
                                        className="h-8 rounded-lg bg-zinc-900 text-white font-black uppercase text-[10px] tracking-wider px-4 hover:bg-zinc-800 transition-all shadow-sm flex items-center gap-2"
                                    >
                                        <Plus className="size-3.5" />
                                        <span className="hidden sm:inline">New Job</span>
                                    </Button>
                                )}
                            </div>
                        }
                    />

                    <main className="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
                        {/* ── ROLE INSIGHTS - Top 3 Large Cards ── */}
                        {!isUserLoading && (
                            <RoleInsights user={user} requests={requests} setShowGuide={setShowGuide} />
                        )}

                        {/* ── ADMIN ACCESS BANNER & COUNTER ADMIN ── */}
                        {!isUserLoading && (user.dept === "IT" || ["SUPER ADMIN", "MANAGER", "LEADER"].includes(user.role)) && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                                    <ShieldCheck className="size-4 text-blue-500 flex-shrink-0" />
                                    <p className="text-[11px] font-black text-blue-700">
                                        Administrative Access — viewing all job requests for {user.dept} and related personnel.
                                    </p>
                                </div>
                                {/* Job Counter Admin for IT/Engineering */}
                                <JobCounterAdmin />
                            </div>
                        )}

                        {/* ── DASHBOARD STATS - Compact Horizontal ── */}
                        <section className="flex flex-wrap md:flex-nowrap items-center gap-2">
                            <DashboardCard 
                                label="ALL JOBS" 
                                value={counts.all} 
                                icon={Activity} 
                                colorClass="bg-zinc-50 text-zinc-500" 
                                loading={isDataLoading} 
                            />
                            <DashboardCard 
                                label="PENDING" 
                                value={counts.pending} 
                                subValue={`${((counts.pending / (counts.all || 1)) * 100).toFixed(0)}%`}
                                icon={Clock} 
                                colorClass="bg-amber-50 text-amber-600" 
                                loading={isDataLoading} 
                            />
                            <DashboardCard 
                                label="IN PROGRESS" 
                                value={counts.inProgress} 
                                icon={Wrench} 
                                colorClass="bg-blue-50 text-blue-600" 
                                loading={isDataLoading} 
                            />
                            <DashboardCard 
                                label="COMPLETED" 
                                value={counts.completed} 
                                icon={CheckCircle2} 
                                colorClass="bg-emerald-50 text-emerald-600" 
                                loading={isDataLoading} 
                            />
                        </section>

                        {/* ── VIEW SWITCHER & FILTERS ── */}
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <div className="flex items-center gap-6">
                                {/* View Switcher - Basis Style */}
                                <div className="flex items-center p-1 bg-white rounded-xl border border-zinc-200/60 shadow-sm">
                                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-[10px] font-black uppercase tracking-wider shadow-sm transition-all">
                                        <LayoutGrid size={12} />
                                        LIST
                                    </button>
                                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-zinc-300 text-[10px] font-black uppercase tracking-wider hover:bg-zinc-50 transition-all opacity-50 cursor-not-allowed">
                                        <Calendar size={12} />
                                        CALENDAR
                                    </button>
                                </div>

                                {/* Filter Pills - Basis Style UPPERCASE */}
                                <div className="flex items-center gap-2 overflow-x-auto max-w-full scrollbar-none no-scrollbar">
                                    <button
                                        onClick={() => { setSelectedStatus(null); setCurrentPage(1); }}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                            selectedStatus === null
                                                ? "bg-zinc-900 text-white shadow-md shadow-zinc-200"
                                                : "bg-white border border-zinc-200/60 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                        )}
                                    >
                                        ALL JOBS ({counts.all})
                                    </button>
                                    <button
                                        onClick={() => { setSelectedStatus("PENDING"); setCurrentPage(1); }}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                            selectedStatus === "PENDING"
                                                ? "bg-zinc-900 text-white shadow-md shadow-zinc-200"
                                                : "bg-white border border-zinc-200/60 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                        )}
                                    >
                                        PENDING ({counts.pending})
                                    </button>
                                    <button
                                        onClick={() => { setSelectedStatus("IN_PROGRESS"); setCurrentPage(1); }}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                            selectedStatus === "IN_PROGRESS"
                                                ? "bg-zinc-900 text-white shadow-md shadow-zinc-200"
                                                : "bg-white border border-zinc-200/60 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                        )}
                                    >
                                        ACTIVE ({counts.inProgress})
                                    </button>
                                    <button
                                        onClick={() => { setSelectedStatus("COMPLETED"); setCurrentPage(1); }}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                            selectedStatus === "COMPLETED"
                                                ? "bg-zinc-900 text-white shadow-md shadow-zinc-200"
                                                : "bg-white border border-zinc-200/60 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                        )}
                                    >
                                        COMPLETED ({counts.completed})
                                    </button>
                                </div>
                            </div>

                            {/* Search & Actions Bar - Enterprise Style */}
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64 group">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
                                    <Input
                                        placeholder="Quick Search..."
                                        value={searchQuery}
                                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                        className="pl-10 h-11 rounded-[18px] border-zinc-200/60 bg-white text-[12px] font-bold placeholder:text-zinc-300 focus:ring-zinc-900 shadow-sm"
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleReset}
                                    className="h-11 w-11 rounded-[18px] border-zinc-200/60 bg-white text-zinc-300 hover:text-zinc-900 shadow-sm"
                                >
                                    <RotateCcw className="size-4" />
                                </Button>
                            </div>
                        </div>

                        {/* ── DATA TABLE ── */}
                        <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm overflow-hidden">
                            {/* Table Header - Aligned to Site Visit Basis */}
                            <div className="hidden md:grid grid-cols-[120px_1fr_120px_120px_120px_44px] gap-6 p-4 px-6 bg-zinc-50/50 border-b border-zinc-100 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                <span>REF_ID</span>
                                <span>PROJECT / CLIENT</span>
                                <span>TIMELINE</span>
                                <span>PRIORITY</span>
                                <span>STATUS</span>
                                <span className="text-right"></span>
                            </div>

                            {/* Table Body */}
                            <div className="divide-y divide-zinc-50">
                                {isDataLoading ? (
                                    <>
                                        <SkeletonRow />
                                        <SkeletonRow />
                                        <SkeletonRow />
                                        <SkeletonRow />
                                    </>
                                ) : paginatedItems.length === 0 ? (
                                    <div className="p-20 text-center">
                                        <div className="size-20 bg-zinc-50 rounded-[28px] flex items-center justify-center mx-auto mb-6">
                                            <Briefcase className="size-10 text-zinc-300" />
                                        </div>
                                        <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-tight">No Jobs Found</h3>
                                        <p className="text-[11px] font-bold text-zinc-400 mt-2 max-w-[200px] mx-auto uppercase tracking-wider leading-relaxed">
                                            We couldn't find any job requests matching your current criteria.
                                        </p>
                                        <Button 
                                            onClick={handleReset}
                                            variant="outline" 
                                            className="mt-6 h-10 px-6 rounded-xl border-zinc-200 text-zinc-500 font-bold text-[10px] uppercase tracking-widest hover:bg-zinc-50 transition-all"
                                        >
                                            Clear Filters
                                        </Button>
                                    </div>
                                ) : (
                                    paginatedItems.map((r) => {
                                        const meta = getStatusMeta(r.status)
                                        return (
                                            <div
                                                key={r.fullId}
                                                className="grid grid-cols-1 md:grid-cols-[120px_1fr_120px_120px_120px_44px] gap-6 p-4 px-6 items-center hover:bg-zinc-50/60 transition-all cursor-pointer group"
                                                onClick={() => router.push(`/request/job/${r.fullId}`)}
                                            >
                                                {/* JOB REQUEST NUMBER - Display sequential number if available */}
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-blue-600 tracking-tight uppercase">
                                                        {r.jobRequestNo || `#${r.id}`}
                                                    </span>
                                                    {!r.jobRequestNo && (
                                                        <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest truncate max-w-[100px]">{r.fullId.substring(0, 15)}...</span>
                                                    )}
                                                </div>

                                                {/* PROJECT / CLIENT - Basis Style Bold */}
                                                <div className="min-w-0">
                                                    <p className="text-[14px] font-black text-zinc-900 uppercase tracking-tighter group-hover:text-blue-600 transition-colors">
                                                        {r.projectName || "UNTITLED PROJECT"}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <div className="flex items-center gap-1.5 text-zinc-400">
                                                            <User2 size={10} className="text-zinc-300" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">{r.clientName || "GENERAL CLIENT"}</span>
                                                        </div>
                                                        <span className="size-1 bg-zinc-200 rounded-full" />
                                                        <div className="flex items-center gap-1.5 text-zinc-400">
                                                            <MapPin size={10} className="text-zinc-300" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest truncate max-w-[120px]">
                                                                {r.location || "BRANCH LOCATION"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* TIMELINE - Calendar Icon Basis Style */}
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={12} className="text-zinc-300" />
                                                    <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest whitespace-nowrap">
                                                        {r.createdAt ? format(r.createdAt.toDate(), "yyyy-MM-dd") : "—"}
                                                    </span>
                                                </div>

                                                {/* PRIORITY - Pill Basis Style */}
                                                <div className="flex justify-center md:justify-start">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            toggleUrgency(r.fullId, r.priority)
                                                        }}
                                                        className={cn(
                                                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 w-fit border",
                                                            r.priority === "URGENT"
                                                                ? "bg-rose-50 text-rose-600 border-rose-100"
                                                                : "bg-zinc-50 text-zinc-400 border-zinc-100"
                                                        )}
                                                    >
                                                        <div className={cn("size-1.5 rounded-full", r.priority === "URGENT" ? "bg-rose-500 animate-pulse" : "bg-zinc-300")} />
                                                        {r.priority || "NORMAL"}
                                                    </button>
                                                </div>

                                                {/* STATUS - Dot Basis Style */}
                                                <div>
                                                    <div className={cn(
                                                        "inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest whitespace-nowrap",
                                                        meta.color
                                                    )}>
                                                        <div className={cn("size-1.5 rounded-full", meta.dot)} />
                                                        {meta.label}
                                                    </div>
                                                </div>

                                                {/* Action */}
                                                <div className="flex justify-end">
                                                    <div className="size-8 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                                                        <ChevronRight size={16} />
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            {/* Pagination Footer */}
                            <div className="p-4 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="h-9 w-9 rounded-xl bg-white border-zinc-200 shadow-sm disabled:opacity-50"
                                        >
                                            <ChevronLeft className="size-4" />
                                        </Button>
                                        <div className="flex items-center px-4 h-9 bg-white border border-zinc-200 rounded-xl shadow-sm">
                                            <span className="text-[11px] font-black text-zinc-900 tracking-tighter">
                                                PAGE {currentPage} <span className="text-zinc-300 mx-1">/</span> {totalPages}
                                            </span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="h-9 w-9 rounded-xl bg-white border-zinc-200 shadow-sm disabled:opacity-50"
                                        >
                                            <ChevronRight className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="hidden sm:flex items-center gap-2">
                                    <Badge variant="outline" className="h-6 px-2 rounded-lg border-zinc-200 bg-white text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                        {filteredRequests.length} JOBS TOTAL
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </main>

                    {/* ── MOBILE FAB ── */}
                    {canCreateJob && (
                        <div className="md:hidden fixed bottom-8 right-6 z-50">
                            <Button
                                onClick={handleAddNew}
                                className="size-14 rounded-2xl bg-zinc-900 text-white shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                            >
                                <Plus className="size-6" />
                            </Button>
                        </div>
                    )}

                    {/* ── HELP DIALOG ── */}
                    <UserGuideDialog open={showGuide} onOpenChange={setShowGuide} />
                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    )
}