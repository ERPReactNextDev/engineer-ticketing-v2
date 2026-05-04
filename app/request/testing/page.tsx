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
    ChevronLeft, ChevronRight,
    ArrowRight, Clock, AlertCircle,
    Layers, PlayCircle,
    Filter, ArrowUpDown, ChevronUp, ChevronDown,
    CheckSquare, Square, CheckCircle2,
    X, Calendar, Package,
    Activity, Wrench, LayoutGrid, Target, CheckCircle,
    BarChart3, HelpCircle, Lightbulb, ShieldCheck,
    Users, Info, TrendingUp, Timer, CalendarClock,
    Box, Truck
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { format, isAfter, differenceInDays } from "date-fns"

// DATABASE TOOLS
import { db } from "@/lib/firebase"
import { collection, onSnapshot, query, orderBy, doc, writeBatch, updateDoc, Timestamp, getDoc } from "firebase/firestore"

// SHARED COMPONENTS
import { PageHeader } from "@/components/page-header"
import { GoogleSheetsSync } from "@/components/google-sheets-sync"

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    AWAITING: {
        label: "Awaiting",
        color: "text-zinc-600", bg: "bg-zinc-50", border: "border-zinc-200", dot: "bg-zinc-400",
    },
    TESTING: {
        label: "In Testing",
        color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500",
    },
    OVERDUE: {
        label: "Overdue",
        color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500",
    },
    RELEASED: {
        label: "Released",
        color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500",
    },
}

const FILTERS = [
    { key: null, label: "All Items", icon: LayoutGrid, variant: "default" },
    { key: "TESTING", label: "In Testing", icon: PlayCircle, variant: "blue" },
    { key: "OVERDUE", label: "Overdue", icon: AlertCircle, variant: "warning" },
    { key: "RELEASED", label: "Released", icon: CheckCircle2, variant: "emerald" },
]

function getStatusMeta(status: string) {
    const s = (status || "").toUpperCase().trim()
    return STATUS_META[s] || { label: status, color: "text-zinc-500", bg: "bg-zinc-50", border: "border-zinc-200", dot: "bg-zinc-300" }
}

// TYPES
interface TrackerEntry {
    id: string;
    uid: string;
    fullId: string;
    productName?: string;
    shipmentCode?: string;
    quantity?: number;
    arrivalDate?: any;
    targetDate?: any;
    releaseDate?: any;
    autoStatus: "AWAITING" | "RELEASED" | "OVERDUE" | "TESTING";
    createdAt?: any;
    createdBy?: string;
    submittedBy?: string;
    priority?: string;
    notes?: string;
}

interface SortConfig {
    key: 'uid' | 'productName' | 'arrivalDate' | 'targetDate';
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
                    <DialogTitle className="text-sm font-black uppercase tracking-wider">Testing Tracker Guide</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                    <GuideItem icon={Box} title="Adding Test Items" desc="Use the + button to add new products for testing. Enter product details, shipment code, quantity, and target release date." />
                    <GuideItem icon={Clock} title="Status Tracking" desc="Items automatically move through statuses: Awaiting → In Testing → Released. Overdue items are flagged when past target date." />
                    <GuideItem icon={Users} title="Role-Based Visibility" desc="Managers see all team testing items. Regular users see only items they created or are assigned to." />
                    <GuideItem icon={CheckCircle} title="Release Process" desc="Mark items as released once testing is complete. Released items are archived but remain searchable." />
                </div>
            </DialogContent>
        </Dialog>
    )
}

function RoleInsights({ user, entries, setShowGuide, subordinateIds }: any) {
    const isManager = user.role === "MANAGER"
    const isTSM = user.role === "TSM"
    const isIT = user.dept === "IT"
    const isProcurement = user.dept === "PROCUREMENT"
    const hasSubordinates = subordinateIds && subordinateIds.length > 0

    const overdueItems = entries.filter((e: any) => e.autoStatus === "OVERDUE")
    const myTesting = entries.filter((e: any) => e.autoStatus === "TESTING" && e.createdBy === user.id)
    const teamTesting = entries.filter((e: any) => e.autoStatus === "TESTING" && subordinateIds?.includes(e.createdBy))

    const releaseRate = entries.length > 0
        ? (entries.filter((e: any) => e.autoStatus === "RELEASED").length / entries.length) * 100
        : 0

    return (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {/* Card 1: Pipeline - Testing Items */}
            <div className="bg-white rounded-2xl p-4 border border-zinc-200/60 shadow-sm flex items-center justify-between group overflow-hidden relative">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                        <Box className="size-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">
                            {isManager || isTSM ? "Team In Testing" : "My Testing Items"}
                        </p>
                        <p className="text-xs font-bold text-zinc-500">
                            {isManager || isTSM ? `${teamTesting.length} team items` : `${myTesting.length} items`}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black text-zinc-900">{isManager || isTSM ? teamTesting.length : myTesting.length}</p>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase">Active</p>
                </div>
                {overdueItems.length > 0 && (
                    <div className="absolute top-2 right-2">
                        <div className="flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full text-[9px] font-black">
                            <AlertCircle className="size-3" /> {overdueItems.length}
                        </div>
                    </div>
                )}
            </div>

            {/* Card 2: Release Rate - Completion */}
            <div className="bg-white rounded-2xl p-4 border border-zinc-200/60 shadow-sm flex items-center justify-between group">
                <div className="flex items-center gap-3 flex-1">
                    <div className="size-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 flex-shrink-0">
                        <Target className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">Release Rate</p>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${releaseRate}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="text-right ml-3">
                    <p className="text-xl font-black text-zinc-900">{releaseRate.toFixed(0)}%</p>
                    <p className="text-[9px] font-bold text-emerald-600">{entries.filter((e: any) => e.autoStatus === "RELEASED").length} released</p>
                </div>
            </div>

            {/* Card 3: Team/Volume Stats */}
            <div className="bg-white rounded-2xl p-4 border border-zinc-200/60 shadow-sm flex items-center justify-between group">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2.5 rounded-xl", isManager || isTSM ? "bg-violet-50 text-violet-600" : "bg-amber-50 text-amber-600")}>
                        {isManager || isTSM ? <Users className="size-5" /> : <BarChart3 className="size-5" />}
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">
                            {isManager || isTSM ? "Team Size" : "This Month"}
                        </p>
                        <p className="text-xs font-bold text-zinc-500">
                            {isManager || isTSM ? `${subordinateIds?.length || 0} members` : `${entries.filter((e: any) => e.createdAt?.toDate?.() && new Date(e.createdAt.toDate()).getMonth() === new Date().getMonth()).length} items`}
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

export default function TestingTrackerPage() {
    const router = useRouter()
    const [user, setUser] = React.useState<{ id: string | null; dept: string; role: string; refId: string; name: string }>({ id: null, dept: "", role: "", refId: "", name: "" })
    const [isUserLoading, setIsUserLoading] = React.useState(true)
    const [subordinateIds, setSubordinateIds] = React.useState<string[]>([])
    
    // TRACKER STATES
    const [entries, setEntries] = React.useState<TrackerEntry[]>([])
    const [isDataLoading, setIsDataLoading] = React.useState(true)
    const [filterStatus, setFilterStatus] = React.useState<string | null>(null)
    const [filterPriority, setFilterPriority] = React.useState<string>("ALL")
    const [searchTerm, setSearchTerm] = React.useState("")
    const [sortConfig, setSortConfig] = React.useState<SortConfig>({ key: 'arrivalDate', direction: 'desc' })
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
                    dept: data.Department?.toUpperCase() || "PROCUREMENT",
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
        const q = query(collection(db, "testing_tracker"), orderBy("createdAt", "desc"))

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let liveData = snapshot.docs.map(doc => {
                const data = doc.data()
                const today = new Date()
                const target = data.targetDate?.toDate()
                const release = data.releaseDate?.toDate()
                const arrival = data.arrivalDate?.toDate()

                let autoStatus: TrackerEntry["autoStatus"] = "AWAITING"
                if (release) autoStatus = "RELEASED"
                else if (target && isAfter(today, target)) autoStatus = "OVERDUE"
                else if (arrival) autoStatus = "TESTING"

                return {
                    id: doc.id,
                    uid: doc.id.slice(-6).toUpperCase(),
                    fullId: doc.id,
                    ...data,
                    autoStatus,
                    createdBy: data.createdBy || data.submittedBy || data.userId,
                } as TrackerEntry
            })

            /**
             * VISIBILITY PROTOCOL:
             * - IT, PROCUREMENT, ENGINEERING, PQ (Product Quality), QUALITY, SUPER ADMIN, MANAGER, LEADER: Global visibility
             * - TSM: Can see their own AND all TSA requests
             * - TSA/MEMBER: Restricted to personal records
             */
            const userDept = user.dept.toUpperCase();
            const userRole = user.role.toUpperCase();
            const hasGlobalAccess = userDept === "IT" || userDept === "PROCUREMENT" || userDept === "ENGINEERING" || userDept === "PQ" || userDept === "QUALITY" || ["SUPER ADMIN", "MANAGER", "LEADER", "PQ"].includes(userRole);
            const isTSM = userRole === "TSM";
            const isManager = userRole === "MANAGER";

            // Client-side filtering for non-admin users
            if (!hasGlobalAccess) {
                if (isTSM || isManager) {
                    liveData = liveData.filter(r =>
                        r.createdBy === user.id ||
                        subordinateIds.includes(r.createdBy || "")
                    );
                } else {
                    liveData = liveData.filter(r => r.createdBy === user.id);
                }
            }

            setEntries(liveData)
            setIsDataLoading(false)
        }, (error) => {
            console.error("Firestore Sync Error:", error)
            setIsDataLoading(false)
        })

        return () => unsubscribe()
    }, [user, isUserLoading, subordinateIds])

    const filteredAndSortedEntries = React.useMemo(() => {
        let result = entries.filter(e => {
            const matchesSearch = (e.productName + e.uid + (e.shipmentCode || "")).toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === null || e.autoStatus === filterStatus;
            const matchesPriority = filterPriority === "ALL" || (e.priority || "NORMAL").toUpperCase() === filterPriority;
            return matchesSearch && matchesStatus && matchesPriority;
        })
        return result.sort((a, b) => {
            let valA, valB;
            if (sortConfig.key === 'arrivalDate' || sortConfig.key === 'targetDate') {
                valA = a[sortConfig.key]?.toMillis?.() || 0;
                valB = b[sortConfig.key]?.toMillis?.() || 0;
            } else {
                valA = (a[sortConfig.key] || "").toString().toLowerCase();
                valB = (b[sortConfig.key] || "").toString().toLowerCase();
            }
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        })
    }, [entries, searchTerm, filterStatus, filterPriority, sortConfig]);

    // Computed counts
    const counts = {
        all: entries.length,
        awaiting: entries.filter(e => e.autoStatus === "AWAITING").length,
        testing: entries.filter(e => e.autoStatus === "TESTING").length,
        overdue: entries.filter(e => e.autoStatus === "OVERDUE").length,
        released: entries.filter(e => e.autoStatus === "RELEASED").length,
    }

    // Can create entry check - PQ = Product Quality department
    const canCreateEntry =
        user.dept === "PROCUREMENT" ||
        user.dept === "IT" ||
        user.dept === "ENGINEERING" ||
        user.dept === "PQ" ||           // Product Quality
        user.dept === "QUALITY" ||
        ["SUPER ADMIN", "MANAGER", "LEADER", "PQ"].includes(user.role)  // PQ role = Product Quality

    // Can sync with Google Sheets
    const canSyncSheets = canCreateEntry || user.dept === "PQ"

    const paginatedItems = filteredAndSortedEntries.slice((currentPage - 1) * parseInt(itemsPerPage), currentPage * parseInt(itemsPerPage));
    const totalPages = Math.ceil(filteredAndSortedEntries.length / parseInt(itemsPerPage));

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

    const handleBulkRelease = async () => {
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
            batch.update(doc(db, "testing_tracker", id), { 
                releaseDate: new Date(), 
                autoStatus: "RELEASED",
                updatedAt: new Date() 
            });
        });
        await batch.commit();
        setSelectedIds([]);
    }

    const exportToExcel = () => {
        const selectedData = entries.filter(e => selectedIds.includes(e.id));
        const headers = ["Ref ID,Product Name,Shipment Code,Qty,Status,Arrival Date,Target Date,Release Date\n"];
        const rows = selectedData.map(e => 
            `${e.uid},${e.productName || "N/A"},${e.shipmentCode || "N/A"},${e.quantity || 0},${e.autoStatus},${e.arrivalDate?.toDate ? format(e.arrivalDate.toDate(), "yyyy-MM-dd") : ""},${e.targetDate?.toDate ? format(e.targetDate.toDate(), "yyyy-MM-dd") : ""},${e.releaseDate?.toDate ? format(e.releaseDate.toDate(), "yyyy-MM-dd") : ""}\n`
        );
        const blob = new Blob([headers.concat(rows).join("")], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `testing_export_${new Date().getTime()}.csv`;
        a.click();
    }

    return (
        <ProtectedPageWrapper>
            <SidebarProvider defaultOpen={false}>
                <AppSidebar userId={user.id} />
                <SidebarInset className="bg-[#F8FAFA] pb-24 md:pb-10">
                    <PageHeader 
                        title="TESTING TRACKER" 
                        version="V3.0" 
                        showBackButton 
                        trigger={<SidebarTrigger className="mr-2" />} 
                        actions={
                            <div className="flex items-center gap-2">
                                <div className="hidden sm:flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1">
                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Dept:</span>
                                    <span className="text-[10px] font-black text-zinc-900 uppercase">{user.dept || "—"}</span>
                                </div>
                                {canSyncSheets && (
                                    <GoogleSheetsSync 
                                        selectedIds={selectedIds} 
                                        onSyncComplete={() => setSelectedIds([])}
                                    />
                                )}
                                <Button 
                                    onClick={() => setShowGuide(true)}
                                    variant="outline"
                                    className="h-8 w-8 p-0 rounded-lg bg-white border-zinc-200 text-zinc-400 hover:text-zinc-900 transition-all"
                                >
                                    <HelpCircle className="size-4" />
                                </Button>
                                {canCreateEntry && (
                                    <Button 
                                        onClick={() => router.push('/request/testing/add')} 
                                        className="hidden md:flex bg-zinc-900 text-white rounded-xl h-8 text-[9px] font-bold tracking-widest px-4"
                                    >
                                        <Plus className="size-3 mr-1.5" /> NEW ENTRY
                                    </Button>
                                )}
                            </div>
                        }
                    />

                    <UserGuideDialog open={showGuide} onOpenChange={setShowGuide} />

                    {/* MOBILE FAB */}
                    {canCreateEntry && (
                        <Button 
                            onClick={() => router.push('/request/testing/add')} 
                            className="md:hidden fixed bottom-6 right-6 size-14 rounded-full bg-zinc-900 text-white shadow-2xl z-40 p-0 flex items-center justify-center border-4 border-white active:scale-90 transition-transform"
                        >
                            <Plus className="size-7" />
                        </Button>
                    )}

                    <main className="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">
                        {/* ── ROLE INSIGHTS - Top 3 Cards ── */}
                        {!isUserLoading && (
                            <RoleInsights user={user} entries={entries} setShowGuide={setShowGuide} subordinateIds={subordinateIds} />
                        )}

                        {/* ── ADMIN/Product Quality ACCESS BANNER ── */}
                        {!isUserLoading && (user.dept === "IT" || user.dept === "PROCUREMENT" || user.dept === "ENGINEERING" || user.dept === "PQ" || user.dept === "QUALITY" || ["SUPER ADMIN", "MANAGER", "LEADER", "PQ"].includes(user.role)) && (
                            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                                <ShieldCheck className="size-4 text-blue-500 flex-shrink-0" />
                                <p className="text-[11px] font-black text-blue-700">
                                    {user.dept === "PQ" || user.dept === "QUALITY" || user.role === "PQ" 
                                        ? "Product Quality (PQ) Team Access — You can add and manage testing items, sync with Google Sheets"
                                        : `Administrative Access — viewing all testing items for ${user.dept} and related personnel.`}
                                </p>
                            </div>
                        )}

                        {/* ── DASHBOARD STATS - Compact Horizontal ── */}
                        <section className="flex flex-wrap md:flex-nowrap items-center gap-2">
                            <DashboardCard 
                                label="ALL ITEMS" 
                                value={counts.all} 
                                icon={Package} 
                                colorClass="bg-zinc-50 text-zinc-500" 
                                loading={isDataLoading} 
                            />
                            <DashboardCard 
                                label="AWAITING" 
                                value={counts.awaiting} 
                                subValue={`${((counts.awaiting / (counts.all || 1)) * 100).toFixed(0)}%`}
                                icon={Clock} 
                                colorClass="bg-zinc-50 text-zinc-500" 
                                loading={isDataLoading} 
                            />
                            <DashboardCard 
                                label="IN TESTING" 
                                value={counts.testing} 
                                icon={PlayCircle} 
                                colorClass="bg-blue-50 text-blue-600" 
                                loading={isDataLoading} 
                            />
                            <DashboardCard 
                                label="OVERDUE" 
                                value={counts.overdue} 
                                icon={AlertCircle} 
                                colorClass="bg-rose-50 text-rose-600" 
                                loading={isDataLoading} 
                            />
                            <DashboardCard 
                                label="RELEASED" 
                                value={counts.released} 
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
                                        onClick={() => { setFilterStatus("TESTING"); setCurrentPage(1); }}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                            filterStatus === "TESTING"
                                                ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                                : "bg-white border border-zinc-200/60 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                        )}
                                    >
                                        TESTING ({counts.testing})
                                    </button>
                                    <button
                                        onClick={() => { setFilterStatus("OVERDUE"); setCurrentPage(1); }}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                            filterStatus === "OVERDUE"
                                                ? "bg-rose-600 text-white shadow-md shadow-rose-200"
                                                : "bg-white border border-zinc-200/60 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                        )}
                                    >
                                        OVERDUE ({counts.overdue})
                                    </button>
                                    <button
                                        onClick={() => { setFilterStatus("RELEASED"); setCurrentPage(1); }}
                                        className={cn(
                                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                            filterStatus === "RELEASED"
                                                ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                                                : "bg-white border border-zinc-200/60 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                        )}
                                    >
                                        RELEASED ({counts.released})
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

                        {/* ── ENTRIES TABLE ── */}
                        <div className="bg-white rounded-[24px] shadow-sm border border-zinc-200/60 overflow-hidden">
                            <div className="hidden md:grid grid-cols-[50px_1fr_2fr_1fr_1fr_1fr_1fr_60px] bg-zinc-50/50 px-6 py-4 border-b text-[9px] font-black uppercase tracking-[0.15em] text-zinc-400 items-center">
                                <button onClick={toggleSelectAll}>{selectedIds.length === paginatedItems.length && paginatedItems.length > 0 ? <CheckSquare className="size-4" /> : <Square className="size-4" />}</button>
                                <button onClick={() => handleSort('uid')} className="flex items-center">Ref ID <SortIcon column="uid" /></button>
                                <button onClick={() => handleSort('productName')} className="flex items-center">Product & Shipment <SortIcon column="productName" /></button>
                                <span>Qty</span>
                                <span>Status</span>
                                <button onClick={() => handleSort('arrivalDate')} className="flex items-center">Arrival <SortIcon column="arrivalDate" /></button>
                                <button onClick={() => handleSort('targetDate')} className="flex items-center">Target <SortIcon column="targetDate" /></button>
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
                                        <p className="text-[13px] font-black text-zinc-900 uppercase tracking-tight mb-1">No testing items found</p>
                                        <p className="text-[11px] font-bold text-zinc-400">Try adjusting your filters or search query</p>
                                    </div>
                                ) : (
                                    paginatedItems.map((item) => {
                                        const meta = getStatusMeta(item.autoStatus)
                                        return (
                                            <div 
                                                key={item.id} 
                                                onClick={(e) => {
                                                    const target = e.target as HTMLElement;
                                                    if (target.closest('button') || target.closest('[data-noclick]')) return;
                                                    router.push(`/request/testing/${item.fullId}`);
                                                }}
                                                className={cn(
                                                    "group transition-all px-4 py-4 md:px-6 md:py-4 cursor-pointer hover:bg-zinc-50/80 active:scale-[0.99]",
                                                    selectedIds.includes(item.id) && "bg-zinc-50"
                                                )}
                                            >
                                                {/* Mobile Layout */}
                                                <div className="md:hidden space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-3">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                                                                data-noclick
                                                            >
                                                                {selectedIds.includes(item.id) ? <CheckSquare className="size-5 text-black" /> : <Square className="size-5 text-zinc-200" />}
                                                            </button>
                                                            <span className="text-[10px] font-mono font-bold text-zinc-400">#{item.uid}</span>
                                                        </div>
                                                        <Badge className={cn("rounded-full px-3 py-1 text-[9px] font-black border-none", meta.bg, meta.color)}>
                                                            {meta.label}
                                                        </Badge>
                                                    </div>
                                                    <div className="pl-8">
                                                        <p className="text-sm font-black text-zinc-900">{item.productName || "Untitled Product"}</p>
                                                        <p className="text-[10px] font-bold text-zinc-400 uppercase">{item.shipmentCode || "No Shipment Code"}</p>
                                                    </div>
                                                    <div className="pl-8 grid grid-cols-3 gap-2 text-[10px]">
                                                        <div>
                                                            <span className="text-zinc-300 font-black uppercase block">Qty</span>
                                                            <span className="font-bold text-zinc-600">{item.quantity || 0} pcs</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-zinc-300 font-black uppercase block">Arrival</span>
                                                            <span className="font-bold text-zinc-600">{item.arrivalDate ? format(item.arrivalDate.toDate(), "MMM dd") : "—"}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-zinc-300 font-black uppercase block">Target</span>
                                                            <span className={cn("font-bold", item.autoStatus === "OVERDUE" ? "text-rose-500" : "text-zinc-600")}>
                                                                {item.targetDate ? format(item.targetDate.toDate(), "MMM dd") : "—"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Desktop Layout */}
                                                <div className="hidden md:grid grid-cols-[50px_1fr_2fr_1fr_1fr_1fr_1fr_60px] items-center">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                                                        data-noclick
                                                    >
                                                        {selectedIds.includes(item.id) ? <CheckSquare className="size-4 text-black" /> : <Square className="size-4 text-zinc-300" />}
                                                    </button>
                                                    <span className="text-[10px] font-mono font-bold text-zinc-400">#{item.uid}</span>
                                                    <div>
                                                        <p className="text-sm font-black text-zinc-900 truncate">{item.productName || "Untitled Product"}</p>
                                                        <p className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                                                            <Package className="size-3" /> {item.shipmentCode || "No Code"}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs font-bold text-zinc-600">{item.quantity || 0} <span className="text-zinc-300">pcs</span></span>
                                                    <Badge className={cn("rounded-full px-3 py-1 text-[9px] font-black border-none w-fit", meta.bg, meta.color)}>
                                                        {meta.label}
                                                    </Badge>
                                                    <span className="text-[11px] font-bold text-zinc-500">
                                                        {item.arrivalDate ? format(item.arrivalDate.toDate(), "MMM dd, yyyy") : "—"}
                                                    </span>
                                                    <span className={cn("text-[11px] font-bold", item.autoStatus === "OVERDUE" ? "text-rose-500" : "text-zinc-500")}>
                                                        {item.targetDate ? format(item.targetDate.toDate(), "MMM dd, yyyy") : "—"}
                                                    </span>
                                                    <div className="flex justify-end">
                                                        <ArrowRight className="size-4 text-zinc-200 group-hover:text-black group-hover:translate-x-1 transition-all" />
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            {/* BULK ACTIONS BAR */}
                            {selectedIds.length > 0 && (
                                <div className="px-6 py-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-white text-xs font-black">{selectedIds.length} Selected</span>
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => setSelectedIds([])}
                                            className="h-7 text-[10px] font-bold bg-transparent border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={exportToExcel}
                                            className="h-7 text-[10px] font-bold bg-transparent border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
                                        >
                                            Export CSV
                                        </Button>
                                        <Button 
                                            size="sm"
                                            onClick={handleBulkRelease}
                                            className="h-7 text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-700"
                                        >
                                            Mark Released
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* PAGINATION */}
                            {!isDataLoading && totalPages > 1 && (
                                <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                            Showing {((currentPage - 1) * parseInt(itemsPerPage)) + 1}-{Math.min(currentPage * parseInt(itemsPerPage), filteredAndSortedEntries.length)} of {filteredAndSortedEntries.length}
                                        </p>
                                        <Select value={itemsPerPage} onValueChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}>
                                            <SelectTrigger className="h-7 w-[70px] bg-white rounded-lg border-zinc-200 text-[10px] font-bold">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10" className="text-xs">10</SelectItem>
                                                <SelectItem value="25" className="text-xs">25</SelectItem>
                                                <SelectItem value="50" className="text-xs">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button 
                                            variant="outline" 
                                            size="icon"
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(prev => prev - 1)}
                                            className="size-8 rounded-lg border-zinc-200 bg-white"
                                        >
                                            <ChevronLeft className="size-4" />
                                        </Button>
                                        <span className="text-[10px] font-black px-3">{currentPage} / {totalPages}</span>
                                        <Button 
                                            variant="outline" 
                                            size="icon"
                                            disabled={currentPage === totalPages}
                                            onClick={() => setCurrentPage(prev => prev + 1)}
                                            className="size-8 rounded-lg border-zinc-200 bg-white"
                                        >
                                            <ChevronRight className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    )
}