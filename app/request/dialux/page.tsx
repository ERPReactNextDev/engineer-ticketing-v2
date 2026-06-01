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
    Plus, Search, RotateCcw,
    TrendingUp, ChevronLeft, ChevronRight,
    ArrowRight, Clock, AlertCircle,
    Layers, PlayCircle, 
    Filter, ArrowUpDown, ChevronUp, ChevronDown,
    CheckSquare, Square, CheckCircle2,
    Download, X, Calendar, Briefcase,
    Activity, Wrench, LayoutGrid, Target, CheckCircle,
    BarChart3, HelpCircle, Lightbulb, ShieldCheck,
    Users, Info
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

// DATABASE TOOLS
import { db } from "@/lib/firebase"
import { collection, onSnapshot, query, orderBy, where, doc, writeBatch, updateDoc, Timestamp, getDoc } from "firebase/firestore"

// SHARED COMPONENTS
import { PageHeader } from "@/components/page-header"

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    PENDING: {
        label: "Pending",
        color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500",
    },
    "IN PROGRESS": {
        label: "In Progress",
        color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500",
    },
    COMPLETED: {
        label: "Completed",
        color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500",
    },
    CANCELLED: {
        label: "Cancelled",
        color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500",
    },
}

const FILTERS = [
    { key: null, label: "All Requests", icon: LayoutGrid, variant: "default" },
    { key: "PENDING", label: "Pending", icon: Clock, variant: "warning" },
    { key: "IN PROGRESS", label: "In Progress", icon: Wrench, variant: "blue" },
    { key: "COMPLETED", label: "Completed", icon: CheckCircle2, variant: "emerald" },
]

function getStatusMeta(status: string) {
    const s = (status || "").toUpperCase().trim()
    return STATUS_META[s] || { label: status, color: "text-zinc-500", bg: "bg-zinc-50", border: "border-zinc-200", dot: "bg-zinc-300" }
}

// TYPES
interface DialuxRequest {
    id: string;
    uid: string;
    projectName: string;
    clientName?: string;
    status: string;
    priority: string;
    createdAt: Timestamp;
    createdBy?: string;
    userId?: string;
    submittedBy?: string;
    assessment?: {
        simulationType?: string;
    };
}

interface SortConfig {
    key: 'uid' | 'projectName' | 'createdAt';
    direction: 'asc' | 'desc';
}

/* ─────────────────────────────────────────────
   UI COMPONENTS
───────────────────────────────────────────── */

function DashboardCard({ label, value, subValue, icon: Icon, colorClass, loading }: any) {
    return (
        <div className="flex-1 min-w-[120px] bg-white rounded-[16px] px-4 py-3 border border-zinc-200/60 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
                <div className={cn("p-1.5 rounded-lg", colorClass.split(" ")[0])}>
                    <Icon className={cn("size-3.5", colorClass.split(" ")[1])} />
                </div>
                <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">{label}</span>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-zinc-900">{loading ? "—" : value}</span>
                {subValue && <span className="text-[10px] font-bold text-zinc-400">{subValue}</span>}
            </div>
        </div>
    )
}

function GuideItem({ icon: Icon, title, desc }: any) {
    return (
        <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-zinc-50 text-zinc-500 shrink-0"><Icon className="size-4" /></div>
            <div>
                <p className="text-[12px] font-black text-zinc-900">{title}</p>
                <p className="text-[11px] font-medium text-zinc-400 leading-relaxed">{desc}</p>
            </div>
        </div>
    )
}

function UserGuideDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="text-sm font-black uppercase tracking-wider">Quick Guide</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                    <GuideItem icon={Layers} title="Creating Requests" desc="Use the + button to submit new Dialux simulation requests. Fill in project details and select the appropriate simulation type." />
                    <GuideItem icon={Clock} title="Tracking Progress" desc="Monitor your request status in real-time. Filter by Pending, In Progress, or Completed to stay organized." />
                    <GuideItem icon={Users} title="Role-Based Visibility" desc="TSM sees their TSA requests, Managers see their team. IT/Admin has full visibility across all departments." />
                    <GuideItem icon={CheckCircle} title="Bulk Actions" desc="Select multiple requests using checkboxes to update status or export data to Excel for reporting." />
                </div>
            </DialogContent>
        </Dialog>
    )
}

function RoleInsights({ user, requests, setShowGuide, subordinateIds }: any) {
    const isManager = user.role === "MANAGER"
    const isTSM = user.role === "TSM"
    const isIT = user.dept === "IT"
    const isSales = user.dept === "SALES"
    const hasSubordinates = subordinateIds && subordinateIds.length > 0

    const urgentRequests = requests.filter((r: any) => r.priority === "URGENT" && r.status !== "COMPLETED")
    const myPending = requests.filter((r: any) => r.status === "PENDING" && r.submittedBy === user.id)
    const teamPending = requests.filter((r: any) => r.status === "PENDING" && subordinateIds?.includes(r.submittedBy))

    const completionRate = requests.length > 0
        ? (requests.filter((r: any) => r.status === "COMPLETED").length / requests.length) * 100
        : 0

    return (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {/* Card 1: Pipeline - Compact Horizontal */}
            <div className="bg-white rounded-2xl p-4 border border-zinc-200/60 shadow-sm flex items-center justify-between group overflow-hidden relative">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                        <Layers className="size-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">
                            {isManager || isTSM ? "Team Pipeline" : "My Pipeline"}
                        </p>
                        <p className="text-xs font-bold text-zinc-500">
                            {isManager || isTSM ? `${teamPending.length} team pending` : `${myPending.length} pending`}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black text-zinc-900">{myPending.length}</p>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase">My Pending</p>
                </div>
                {urgentRequests.length > 0 && (
                    <div className="absolute top-2 right-2">
                        <div className="flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full text-[9px] font-black">
                            <AlertCircle className="size-3" /> {urgentRequests.length}
                        </div>
                    </div>
                )}
            </div>

            {/* Card 2: Completion Rate - Compact */}
            <div className="bg-white rounded-2xl p-4 border border-zinc-200/60 shadow-sm flex items-center justify-between group">
                <div className="flex items-center gap-3 flex-1">
                    <div className="size-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 flex-shrink-0">
                        <Target className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">Completion</p>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="text-right ml-3">
                    <p className="text-xl font-black text-zinc-900">{completionRate.toFixed(0)}%</p>
                    <p className="text-[9px] font-bold text-emerald-600">{requests.filter((r: any) => r.status === "COMPLETED").length} done</p>
                </div>
            </div>

            {/* Card 3: Team/Volume - Compact */}
            <div className="bg-white rounded-2xl p-4 border border-zinc-200/60 shadow-sm flex items-center justify-between group">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2.5 rounded-xl", isManager || isTSM ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600")}>
                        {isManager || isTSM ? <Users className="size-5" /> : <BarChart3 className="size-5" />}
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">
                            {isManager || isTSM ? "Team Size" : "This Month"}
                        </p>
                        <p className="text-xs font-bold text-zinc-500">
                            {isManager || isTSM ? `${subordinateIds?.length || 0} members` : `${requests.filter((r: any) => r.createdAt?.toDate?.() && new Date(r.createdAt.toDate()).getMonth() === new Date().getMonth()).length} requests`}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowGuide(true)} 
                    className="p-2 hover:bg-zinc-50 rounded-lg transition-colors"
                    title="How it works"
                >
                    <HelpCircle className="size-4 text-zinc-400" />
                </button>
            </div>
        </section>
    )
}

function SkeletonRow() {
    return (
        <div className="px-4 py-4 md:px-6 md:py-4 border-b border-zinc-50">
            <div className="flex items-center gap-4">
                <div className="h-4 w-4 bg-zinc-100 rounded animate-pulse" />
                <div className="h-3 w-16 bg-zinc-100 rounded animate-pulse" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-48 bg-zinc-100 rounded animate-pulse" />
                    <div className="h-2 w-32 bg-zinc-100 rounded animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-zinc-100 rounded-full animate-pulse" />
                <div className="h-6 w-20 bg-zinc-100 rounded-full animate-pulse" />
                <div className="h-3 w-20 bg-zinc-100 rounded animate-pulse" />
                <div className="h-8 w-8 bg-zinc-100 rounded-lg animate-pulse" />
            </div>
        </div>
    )
}

export default function DialuxManagementPage() {
    const router = useRouter()
    const [user, setUser] = React.useState<{ id: string | null; dept: string; role: string; refId: string; name: string }>({ id: null, dept: "", role: "", refId: "", name: "" })
    const [isUserLoading, setIsUserLoading] = React.useState(true)
    const [subordinateIds, setSubordinateIds] = React.useState<string[]>([])
    const [requests, setRequests] = React.useState<DialuxRequest[]>([])
    const [isDataLoading, setIsDataLoading] = React.useState(true)
    
    const [filterStatus, setFilterStatus] = React.useState<string | null>(null)
    const [filterPriority, setFilterPriority] = React.useState<string>("ALL")
    const [searchTerm, setSearchTerm] = React.useState("")
    const [sortConfig, setSortConfig] = React.useState<SortConfig>({ key: 'createdAt', direction: 'desc' })
    const [selectedIds, setSelectedIds] = React.useState<string[]>([])
    const [currentPage, setCurrentPage] = React.useState(1)
    const [itemsPerPage, setItemsPerPage] = React.useState("10")
    const [showGuide, setShowGuide] = React.useState(false)

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

    const togglePriority = async (id: string, currentPriority: string) => {
        const newPriority = currentPriority === "URGENT" ? "NORMAL" : "URGENT";
        try {
            await updateDoc(doc(db, "dialux_requests", id), { priority: newPriority });
        } catch (error) {
            console.error("Error updating priority:", error);
        }
    }

    // 2. LIVE DATA SYNC — server-side filtered to avoid full collection downloads
    React.useEffect(() => {
        if (isUserLoading || !user.id) return;

        setIsDataLoading(true)
        const userDept = user.dept.toUpperCase();
        const userRole = user.role.toUpperCase();
        const hasGlobalAccess = userDept === "IT" || userDept === "ENGINEERING" || ["SUPER ADMIN", "MANAGER", "LEADER"].includes(userRole);
        const isTSM = userRole === "TSM";
        const isManager = userRole === "MANAGER";
        const isProcurement = userDept === "PROCUREMENT";

        // FIX: Apply server-side where filter for non-admin users
        let q;
        if (hasGlobalAccess || isProcurement) {
            q = query(collection(db, "dialux_requests"), orderBy("createdAt", "desc"))
        } else if ((isTSM || isManager) && subordinateIds.length > 0) {
            q = query(collection(db, "dialux_requests"), where("submittedBy", "in", [user.id, ...subordinateIds.slice(0, 9)]), orderBy("createdAt", "desc"))
        } else {
            q = query(collection(db, "dialux_requests"), where("submittedBy", "==", user.id), orderBy("createdAt", "desc"))
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let liveData = snapshot.docs.map(doc => {
                const data = doc.data()
                return {
                    id: doc.id,
                    uid: doc.id.slice(-6).toUpperCase(),
                    ...data,
                    status: data.status?.toUpperCase() || "PENDING",
                    submittedBy: data.submittedBy || data.createdBy || data.userId,
                }
            }) as DialuxRequest[]

            // Procurement filter for paid simulations only
            if (isProcurement) {
                liveData = liveData.filter(r => r.assessment?.simulationType?.toLowerCase() === "paid");
            }

            setRequests(liveData)
            setIsDataLoading(false)
        }, (error) => {
            console.error("Firestore Sync Error:", error)
            setIsDataLoading(false)
        })

        return () => unsubscribe()
    }, [user, isUserLoading, subordinateIds])

    const filteredAndSortedRequests = React.useMemo(() => {
        let result = requests.filter(r => {
            const matchesSearch = (r.projectName + r.uid + (r.clientName || "")).toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === null || (r.status || "PENDING").toUpperCase() === filterStatus;
            const matchesPriority = filterPriority === "ALL" || (r.priority || "NORMAL").toUpperCase() === filterPriority;
            return matchesSearch && matchesStatus && matchesPriority;
        })
        return result.sort((a, b) => {
            const valA = sortConfig.key === 'createdAt' ? (a.createdAt?.toMillis() || 0) : (a[sortConfig.key] || "").toString().toLowerCase();
            const valB = sortConfig.key === 'createdAt' ? (b.createdAt?.toMillis() || 0) : (b[sortConfig.key] || "").toString().toLowerCase();
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        })
    }, [requests, searchTerm, filterStatus, filterPriority, sortConfig]);

    // Computed counts
    const counts = {
        all: requests.length,
        pending: requests.filter(r => (r.status || "PENDING").toUpperCase() === "PENDING").length,
        inProgress: requests.filter(r => r.status?.toUpperCase() === "IN PROGRESS").length,
        completed: requests.filter(r => r.status?.toUpperCase() === "COMPLETED").length,
    }

    // Can create request check
    const canCreateRequest =
        user.dept === "SALES" ||
        user.dept === "IT" ||
        ["SUPER ADMIN", "MANAGER", "LEADER"].includes(user.role)

    const paginatedItems = filteredAndSortedRequests.slice((currentPage - 1) * parseInt(itemsPerPage), currentPage * parseInt(itemsPerPage));
    const totalPages = Math.ceil(filteredAndSortedRequests.length / parseInt(itemsPerPage));

    const SortIcon = ({ column }: { column: SortConfig['key'] }) => {
        if (sortConfig.key !== column) return <ArrowUpDown className="ml-1.5 size-3 opacity-30" />;
        return sortConfig.direction === 'asc' ? <ChevronUp className="ml-1.5 size-3 text-black" /> : <ChevronDown className="ml-1.5 size-3 text-black" />;
    }

    const handleSort = (key: SortConfig['key']) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }))
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === paginatedItems.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(paginatedItems.map(item => item.id));
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }

    const handleBulkUpdate = async (newStatus: string) => {
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
            batch.update(doc(db, "dialux_requests", id), { status: newStatus, updatedAt: new Date() });
        });
        await batch.commit();
        setSelectedIds([]);
    }

    const exportToExcel = () => {
        const selectedData = requests.filter(r => selectedIds.includes(r.id));
        const headers = ["Ref ID,Project Name,Client,Status,Priority,Date\n"];
        const rows = selectedData.map(r => 
            `${r.uid},${r.projectName},${r.clientName || "N/A"},${r.status},${r.priority},${r.createdAt?.toDate ? new Date(r.createdAt.toDate()).toLocaleDateString() : "---"}\n`
        );
        const blob = new Blob([headers.concat(rows).join("")], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dialux_export_${new Date().getTime()}.csv`;
        a.click();
    }

    return (
        <ProtectedPageWrapper>
            <SidebarProvider defaultOpen={false}>
                <AppSidebar userId={user.id} />
                <SidebarInset className="bg-[#F8FAFA] pb-24 md:pb-10">
                    <PageHeader 
                        title="DIALUX HUB" 
                        version="V3.2" 
                        showBackButton 
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
                                {canCreateRequest && (
                                    <Button 
                                        onClick={() => router.push('/request/dialux/add')} 
                                        className="hidden md:flex bg-zinc-900 text-white rounded-xl h-8 text-[9px] font-bold tracking-widest px-4"
                                    >
                                        <Plus className="size-3 mr-1.5" /> NEW REQUEST
                                    </Button>
                                )}
                            </div>
                        }
                    />

                    <UserGuideDialog open={showGuide} onOpenChange={setShowGuide} />

                    {/* MOBILE FAB */}
                    {canCreateRequest && (
                        <Button 
                            onClick={() => router.push('/request/dialux/add')} 
                            className="md:hidden fixed bottom-6 right-6 size-14 rounded-full bg-zinc-900 text-white shadow-2xl z-40 p-0 flex items-center justify-center border-4 border-white active:scale-90 transition-transform"
                        >
                            <Plus className="size-7" />
                        </Button>
                    )}

                    <main className="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
                        {/* ── ROLE INSIGHTS - Top 3 Cards ── */}
                        {!isUserLoading && (
                            <RoleInsights user={user} requests={requests} setShowGuide={setShowGuide} subordinateIds={subordinateIds} />
                        )}

                        {/* ── ADMIN ACCESS BANNER ── */}
                        {!isUserLoading && (user.dept === "IT" || ["SUPER ADMIN", "MANAGER", "LEADER"].includes(user.role)) && (
                            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                                <ShieldCheck className="size-4 text-blue-500 flex-shrink-0" />
                                <p className="text-[11px] font-black text-blue-700">
                                    Administrative Access — viewing all Dialux requests for {user.dept} and related personnel.
                                </p>
                            </div>
                        )}

                        {/* ── DASHBOARD STATS - Compact Horizontal ── */}
                        <section className="flex flex-wrap md:flex-nowrap items-center gap-2">
                            <DashboardCard 
                                label="ALL REQUESTS" 
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

                        {/* ── FILTER PILLS & SEARCH ── */}
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <div className="flex items-center gap-6">
                                {/* Filter Pills */}
                                <div className="flex items-center gap-2 overflow-x-auto max-w-full scrollbar-none no-scrollbar">
                                    <button
                                        onClick={() => { setFilterStatus(null); setCurrentPage(1); }}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                            filterStatus === null
                                                ? "bg-zinc-900 text-white shadow-md shadow-zinc-200"
                                                : "bg-white border border-zinc-200/60 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                        )}
                                    >
                                        ALL ({counts.all})
                                    </button>
                                    <button
                                        onClick={() => { setFilterStatus("PENDING"); setCurrentPage(1); }}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                            filterStatus === "PENDING"
                                                ? "bg-zinc-900 text-white shadow-md shadow-zinc-200"
                                                : "bg-white border border-zinc-200/60 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                        )}
                                    >
                                        PENDING ({counts.pending})
                                    </button>
                                    <button
                                        onClick={() => { setFilterStatus("IN PROGRESS"); setCurrentPage(1); }}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                            filterStatus === "IN PROGRESS"
                                                ? "bg-zinc-900 text-white shadow-md shadow-zinc-200"
                                                : "bg-white border border-zinc-200/60 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                        )}
                                    >
                                        ACTIVE ({counts.inProgress})
                                    </button>
                                    <button
                                        onClick={() => { setFilterStatus("COMPLETED"); setCurrentPage(1); }}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                            filterStatus === "COMPLETED"
                                                ? "bg-zinc-900 text-white shadow-md shadow-zinc-200"
                                                : "bg-white border border-zinc-200/60 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                        )}
                                    >
                                        COMPLETED ({counts.completed})
                                    </button>
                                </div>
                            </div>

                            {/* Search & Priority Filter */}
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64 group">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
                                    <Input
                                        placeholder="Quick Search..."
                                        value={searchTerm}
                                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                        className="pl-10 h-11 rounded-[18px] border-zinc-200/60 bg-white text-[12px] font-bold placeholder:text-zinc-300 focus:ring-zinc-900 shadow-sm"
                                    />
                                </div>
                                <Select value={filterPriority} onValueChange={(v) => { setFilterPriority(v); setCurrentPage(1); }}>
                                    <SelectTrigger className="w-[120px] h-11 bg-white rounded-xl border-zinc-200 text-xs font-bold uppercase tracking-wider">
                                        <div className="flex items-center gap-2"><Filter className="size-3" /><SelectValue /></div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL" className="text-xs font-bold">ALL</SelectItem>
                                        <SelectItem value="URGENT" className="text-xs font-bold text-rose-600">URGENT</SelectItem>
                                        <SelectItem value="NORMAL" className="text-xs font-bold text-zinc-500">NORMAL</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button 
                                    variant="outline" 
                                    onClick={() => { setFilterStatus(null); setFilterPriority("ALL"); setSearchTerm(""); setSelectedIds([]); setCurrentPage(1); }} 
                                    className="h-11 px-3 rounded-xl bg-white font-bold text-[10px] tracking-widest border-zinc-200"
                                >
                                    <RotateCcw className="size-3.5" />
                                </Button>
                            </div>
                        </div>

                        {/* ── REQUESTS TABLE ── */}
                        <div className="bg-white rounded-[24px] shadow-sm border border-zinc-200/60 overflow-hidden">
                            <div className="hidden md:grid grid-cols-[50px_1fr_2fr_1fr_1fr_1fr_60px] bg-zinc-50/50 px-6 py-4 border-b text-[9px] font-black uppercase tracking-[0.15em] text-zinc-400 items-center">
                                <button onClick={toggleSelectAll}>{selectedIds.length === paginatedItems.length && paginatedItems.length > 0 ? <CheckSquare className="size-4" /> : <Square className="size-4" />}</button>
                                <button onClick={() => handleSort('uid')} className="flex items-center">Ref ID <SortIcon column="uid" /></button>
                                <button onClick={() => handleSort('projectName')} className="flex items-center">Project Name <SortIcon column="projectName" /></button>
                                <span>Priority</span>
                                <span>Status</span>
                                <button onClick={() => handleSort('createdAt')} className="flex items-center">Date <SortIcon column="createdAt" /></button>
                                <span className="text-right">Action</span>
                            </div>

                            <div className="divide-y divide-zinc-50">
                                {isDataLoading ? (
                                    <>
                                        <SkeletonRow />
                                        <SkeletonRow />
                                        <SkeletonRow />
                                        <SkeletonRow />
                                        <SkeletonRow />
                                    </>
                                ) : paginatedItems.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <div className="size-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                            <Info className="size-8 text-zinc-300" />
                                        </div>
                                        <p className="text-[13px] font-black text-zinc-900 uppercase tracking-tight mb-1">No requests found</p>
                                        <p className="text-[11px] font-bold text-zinc-400">Try adjusting your filters or search query</p>
                                    </div>
                                ) : (
                                    paginatedItems.map((r) => {
                                        const meta = getStatusMeta(r.status)
                                        return (
                                            <div 
                                                key={r.id} 
                                                onClick={(e) => {
                                                    // Don't navigate if clicking on checkbox, priority button, or select area
                                                    const target = e.target as HTMLElement;
                                                    if (target.closest('button') || target.closest('[data-noclick]')) return;
                                                    router.push(`/request/dialux/${r.id}`);
                                                }}
                                                className={cn(
                                                    "group transition-all px-4 py-4 md:px-6 md:py-4 cursor-pointer hover:bg-zinc-50/80 active:scale-[0.99]",
                                                    selectedIds.includes(r.id) && "bg-zinc-50"
                                                )}
                                            >
                                                {/* Mobile Layout */}
                                                <div className="md:hidden space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-3">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); toggleSelect(r.id); }}
                                                                data-noclick
                                                            >
                                                                {selectedIds.includes(r.id) ? <CheckSquare className="size-5 text-black" /> : <Square className="size-5 text-zinc-200" />}
                                                            </button>
                                                            <span className="text-[10px] font-mono font-bold text-zinc-400">#{r.uid}</span>
                                                        </div>
                                                        <Badge className={cn("rounded-full px-3 py-0.5 text-[8px] font-black border uppercase shadow-none", meta.bg, meta.color, meta.border)}>
                                                            {meta.label}
                                                        </Badge>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-black text-zinc-900 uppercase line-clamp-1">{r.projectName}</h3>
                                                        <p className="text-[10px] text-zinc-400 font-bold uppercase flex items-center gap-1.5 mt-1"><Briefcase className="size-3" /> {r.clientName || "General Client"}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between pt-2 border-t border-zinc-50">
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); togglePriority(r.id, r.priority); }}
                                                                data-noclick
                                                                className={cn("px-2 py-0.5 rounded-full text-[8px] font-black flex items-center gap-1 border transition-all active:scale-90", r.priority === "URGENT" ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-white text-zinc-400 border-zinc-100")}
                                                            >
                                                                <AlertCircle className="size-2.5" />{r.priority || "NORMAL"}
                                                            </button>
                                                            <span className="text-[9px] font-bold text-zinc-400 flex items-center gap-1"><Calendar className="size-3" /> {r.createdAt?.toDate ? format(r.createdAt.toDate(), 'MMM d, yyyy') : "---"}</span>
                                                        </div>
                                                        <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white transition-all">
                                                            <ArrowRight className="size-4" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Desktop Layout */}
                                                <div className="hidden md:grid md:grid-cols-[50px_1fr_2fr_1fr_1fr_1fr_60px] gap-4 items-center">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); toggleSelect(r.id); }}
                                                        data-noclick
                                                    >
                                                        {selectedIds.includes(r.id) ? <CheckSquare className="size-4 text-black" /> : <Square className="size-4 text-zinc-200" />}
                                                    </button>
                                                    <span className="text-[10px] font-mono font-bold text-zinc-400">#{r.uid}</span>
                                                    <div className="flex flex-col">
                                                        <span className="text-[13px] font-black text-zinc-900 uppercase truncate leading-none mb-1">{r.projectName}</span>
                                                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wide">{r.clientName || "General Client"}</span>
                                                    </div>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); togglePriority(r.id, r.priority); }}
                                                        data-noclick
                                                        className={cn("px-2.5 py-1 rounded-full text-[8px] font-black flex w-fit items-center gap-1.5 border shadow-sm transition-all hover:brightness-95 active:scale-95", r.priority === "URGENT" ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-white text-zinc-400 border-zinc-100")}
                                                    >
                                                        <AlertCircle className="size-3" />{r.priority || "NORMAL"}
                                                    </button>
                                                    <Badge className={cn("rounded-full px-4 py-1 text-[9px] font-black border uppercase shadow-none tracking-wider", meta.bg, meta.color, meta.border)}>
                                                        {meta.label}
                                                    </Badge>
                                                    <span className="text-[10px] font-bold text-zinc-400">{r.createdAt?.toDate ? format(r.createdAt.toDate(), 'MMM d, yyyy') : "---"}</span>
                                                    <div className="flex justify-end">
                                                        <div className="h-9 w-9 p-0 rounded-xl bg-zinc-100 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
                                                            <ArrowRight className="size-4" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            {/* Pagination */}
                            <div className="p-4 bg-zinc-50/50 border-t flex flex-col sm:flex-row justify-between items-center gap-4 px-6">
                                <div className="flex items-center gap-3">
                                    <span className="text-[9px] font-black text-zinc-400 uppercase">Rows:</span>
                                    <Select value={itemsPerPage} onValueChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}>
                                        <SelectTrigger className="w-16 h-8 bg-white text-[10px] font-bold rounded-lg border-zinc-200"><SelectValue /></SelectTrigger>
                                        <SelectContent>{["5", "10", "20"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} variant="outline" className="h-9 px-3 rounded-xl border-zinc-200 bg-white"><ChevronLeft className="size-4 mr-1" /> Prev</Button>
                                    <span className="text-[10px] font-black text-zinc-900">{currentPage} / {totalPages || 1}</span>
                                    <Button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} variant="outline" className="h-9 px-3 rounded-xl border-zinc-200 bg-white">Next <ChevronRight className="size-4 ml-1" /></Button>
                                </div>
                            </div>
                        </div>

                        {/* Bulk Action Bar */}
                        {selectedIds.length > 0 && (
                            <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-auto bg-zinc-900 text-white p-2 md:px-6 md:py-3 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center gap-2 md:gap-6 animate-in slide-in-from-bottom-8 z-50 border border-white/10">
                                <div className="flex items-center justify-between w-full md:w-auto md:border-r md:border-white/10 md:pr-6 px-2 py-1 md:py-0">
                                    <div className="flex items-center gap-2">
                                        <span className="h-5 w-5 rounded-full bg-white text-black text-[9px] font-black flex items-center justify-center">{selectedIds.length}</span>
                                        <span className="text-[9px] font-black uppercase tracking-widest">Selected</span>
                                    </div>
                                    <button onClick={() => setSelectedIds([])} className="md:hidden"><X className="size-4 text-zinc-500" /></button>
                                </div>
                                <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto no-scrollbar">
                                    <Button onClick={() => handleBulkUpdate("IN PROGRESS")} variant="ghost" className="flex-1 md:flex-none h-9 text-[8px] font-black hover:bg-white/10 text-white uppercase"><PlayCircle className="size-3 mr-1.5 text-blue-400" /> Start</Button>
                                    <Button onClick={() => handleBulkUpdate("COMPLETED")} variant="ghost" className="flex-1 md:flex-none h-9 text-[8px] font-black hover:bg-white/10 text-white uppercase"><CheckCircle2 className="size-3 mr-1.5 text-emerald-400" /> Done</Button>
                                    <Button onClick={exportToExcel} variant="ghost" className="flex-1 md:flex-none h-9 text-[8px] font-black hover:bg-white/10 text-white uppercase"><Download className="size-3 mr-1.5 text-amber-400" /> Excel</Button>
                                </div>
                                <button onClick={() => setSelectedIds([])} className="hidden md:block hover:rotate-90 transition-transform"><X className="size-4 text-zinc-500" /></button>
                            </div>
                        )}
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    )
}
