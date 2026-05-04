"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import {
    Users, Search, ShieldCheck,
    ChevronRight, ChevronLeft, Loader2, RefreshCw,
    Cpu, X, ShieldAlert, Key, Info,
    LogOut, Ban, Shield, Filter, Mail, Building2, UserCog,
    RotateCcw, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle,
    Square, CheckSquare, ShieldOff, LockKeyhole, FileDown,
    HelpCircle, Lightbulb, Zap, BarChart2, Sparkles, Activity
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// FIREBASE DIRECT ACCESS
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from "firebase/firestore"

// SHADCN + CUSTOM
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Sheet,
    SheetContent,
} from "@/components/ui/sheet"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const ITEMS_PER_PAGE = 10

// Standard roles for most departments
const STANDARD_ROLES = ["SUPER ADMIN", "MANAGER", "LEADER", "MEMBER"]

// Sales-specific roles for Sales department hierarchy
const SALES_ROLES = ["SUPER ADMIN", "SALES HEAD", "TERRITORY SALES MANAGER", "TERRITORY SALES ASSOCIATE"]

// Get roles based on department
const getRolesForDepartment = (dept?: string): string[] => {
    if (!dept) return STANDARD_ROLES
    if (dept.toUpperCase() === "SALES") return SALES_ROLES
    return STANDARD_ROLES
}

const ROLE_OPTIONS = getRolesForDepartment()

type SortField = "name" | "department" | "role" | "status" | "activity"
type SortDir = "asc" | "desc"

const roleRank: Record<string, number> = {
    "SUPER ADMIN": 5,
    "SALES HEAD": 4,
    "MANAGER": 4,
    "TERRITORY SALES MANAGER": 3,
    "LEADER": 2,
    "TERRITORY SALES ASSOCIATE": 1,
    "MEMBER": 1,
}

/* ─────────────────────────────────────────────
   HELPERS & COMPONENTS
───────────────────────────────────────────── */

function GuideItem({ icon: Icon, title, description, colorClass }: { icon: any, title: string, description: string, colorClass: string }) {
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

function relativeTime(dateStr?: string): string {
    if (!dateStr) return "—"
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function DashboardCard({ label, value, subValue, icon: Icon, colorClass, loading, isActive, onClick }: {
    label: string; value: string | number; subValue?: string; icon: any; colorClass: string; loading?: boolean; isActive?: boolean; onClick?: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex-1 bg-white rounded-2xl p-3 border shadow-sm flex items-center gap-3 group transition-all min-w-0 active:scale-95 text-left",
                isActive ? "border-zinc-900 ring-4 ring-zinc-900/5 shadow-md" : "border-zinc-200/60 hover:shadow-md hover:border-zinc-300"
            )}
        >
            <div className={cn("p-2 rounded-xl flex-shrink-0 transition-colors", isActive ? "bg-zinc-900 text-white" : colorClass)}>
                <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                    {loading ? (
                        <div className="h-4 w-12 bg-zinc-100 rounded animate-pulse" />
                    ) : (
                        <p className="text-[14px] font-black text-zinc-900 leading-none truncate tracking-tight">{value}</p>
                    )}
                    {!loading && subValue && (
                        <span className="hidden xl:inline-block text-[7px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-50 px-1 py-0.5 rounded border border-zinc-100 whitespace-nowrap flex-shrink-0">
                            {subValue}
                        </span>
                    )}
                </div>
                <p className="text-[7px] font-black uppercase text-zinc-400 tracking-[0.1em] truncate">{label}</p>
            </div>
        </button>
    )
}

function StatPill({ label, count, isActive, onClick, loading, colorClass }: {
    label: string; count: string | number; isActive: boolean; onClick: () => void; loading?: boolean; colorClass?: string
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all flex-shrink-0 active:scale-95",
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

export default function StaffDirectoryPage() {
    const [userId, setUserId] = React.useState<string | null>(null)
    const [searchTerm, setSearchTerm] = React.useState("")
    const [activeDept, setActiveDept] = React.useState<string>("ALL")
    const [staff, setStaff] = React.useState<any[]>([])
    const [isFetching, setIsFetching] = React.useState(true)
    const [sortField, setSortField] = React.useState<SortField>("name")
    const [sortDir, setSortDir] = React.useState<SortDir>("asc")

    // Pagination State
    const [currentPage, setCurrentPage] = React.useState(1)

    // Security States
    const [selectedStaff, setSelectedStaff] = React.useState<any | null>(null)
    const [pendingRole, setPendingRole] = React.useState<string | null>(null)
    const [confirmType, setConfirmType] = React.useState<"ROLE" | "TERMINATE" | "SUSPEND" | "BATCH_GRANT" | "BATCH_REVOKE" | "BATCH_ROLE" | null>(null)
    const [isProcessing, setIsProcessing] = React.useState(false)
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
    const [batchRole, setBatchRole] = React.useState<string>("MEMBER")
    
    // Get available roles for batch operations (uses first department with staff, or standard roles)
    const batchRoleOptions = React.useMemo(() => {
        // For batch operations, use standard roles as default
        // The actual department-specific roles will be determined when individual staff is selected
        return STANDARD_ROLES
    }, [])
    const [showGuide, setShowGuide] = React.useState(false)

    const activeRole = pendingRole || selectedStaff?.Role?.toUpperCase() || "MEMBER"
    const hasPendingRoleChange = !!selectedStaff && activeRole !== (selectedStaff.Role?.toUpperCase() || "MEMBER")
    const searchInputRef = React.useRef<HTMLInputElement>(null)

    // DERIVED STATE
    const departments = React.useMemo(() => {
        const depts = staff.map(s => s.Department?.toUpperCase()).filter(Boolean)
        return Array.from(new Set(depts))
    }, [staff])

    const filteredStaff = React.useMemo(() => {
        return staff.filter(person => {
            const search = searchTerm.toLowerCase()
            const fullName = `${person.Firstname} ${person.Lastname}`.toLowerCase()
            const matchesSearch = fullName.includes(search) || person.Email?.toLowerCase().includes(search)
            const matchesDept = activeDept === "ALL" ? true :
                activeDept === "AUTHORIZED" ? person.isActive === true :
                activeDept === "SUSPENDED" ? person.isActive === false :
                    person.Department?.toUpperCase() === activeDept
            return matchesSearch && matchesDept
        })
    }, [staff, searchTerm, activeDept])

    const sortedStaff = React.useMemo(() => {
        const getName = (person: any) => `${person.Firstname || ""} ${person.Lastname || ""}`.trim().toLowerCase()
        const getDepartment = (person: any) => (person.Department || "").toString().toLowerCase()
        const getRole = (person: any) => (person.Role || "MEMBER").toUpperCase()
        const getStatus = (person: any) => (person.isActive === true ? 1 : 0)
        const getActivity = (person: any) => person.lastSecurityUpdate || ""

        return [...filteredStaff].sort((a, b) => {
            let comparison = 0
            if (sortField === "name") comparison = getName(a).localeCompare(getName(b))
            if (sortField === "department") comparison = getDepartment(a).localeCompare(getDepartment(b))
            if (sortField === "role") comparison = (roleRank[getRole(a)] || 0) - (roleRank[getRole(b)] || 0)
            if (sortField === "status") comparison = getStatus(a) - getStatus(b)
            if (sortField === "activity") comparison = getActivity(a).localeCompare(getActivity(b))
            return sortDir === "asc" ? comparison : -comparison
        })
    }, [filteredStaff, sortField, sortDir])

    const totalPages = Math.ceil(sortedStaff.length / ITEMS_PER_PAGE)
    const paginatedStaff = sortedStaff.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    )

    const updateStaffList = React.useCallback(async () => {
        setIsFetching(true)
        try {
            const res = await fetch("/api/UserManagement/Fetch")
            const mongoUsers = await res.json()

            const firestoreSnap = await getDocs(collection(db, "users"))
            const securityMap: Record<string, any> = {}
            firestoreSnap.forEach(doc => {
                securityMap[doc.id] = doc.data()
            })

            // Filter out resigned staff and merge security data
            const mergedData = mongoUsers
                .filter((u: any) => (u.Status || "").toUpperCase() !== "RESIGNED")
                .map((u: any) => {
                    const security = securityMap[u._id] || {
                        isActive: false,
                        Role: "MEMBER"
                    }
                    return {
                        ...u,
                        isActive: security.isActive,
                        Role: security.Role,
                        lastSecurityUpdate: security.lastSecurityUpdate,
                        hasSecurityDoc: !!securityMap[u._id]
                    }
                })

            setStaff(mergedData || [])
        } catch (err) {
            console.error(err)
            toast.error("Database synchronization failed")
        } finally {
            // Small timeout to prevent layout jumping if the API is too fast
            setTimeout(() => setIsFetching(false), 300)
        }
    }, [])

    const executeSecurityAction = async () => {
        if (!selectedStaff && !["BATCH_GRANT", "BATCH_REVOKE", "BATCH_ROLE"].includes(confirmType || "")) return
        setIsProcessing(true)
        const toastId = toast.loading("Updating Firestore Security Registry...")

        try {
            if (confirmType === "BATCH_GRANT" || confirmType === "BATCH_REVOKE" || confirmType === "BATCH_ROLE") {
                const ids = Array.from(selectedIds)
                const isGrant = confirmType === "BATCH_GRANT"
                const isRevoke = confirmType === "BATCH_REVOKE"
                const isRoleUpdate = confirmType === "BATCH_ROLE"
                
                await Promise.all(ids.map(async (id) => {
                    const person = staff.find(s => s._id === id)
                    if (!person) return
                    
                    const userDocRef = doc(db, "users", id)
                    const docSnap = await getDoc(userDocRef)
                    
                    const updateData: any = {
                        lastSecurityUpdate: new Date().toISOString(),
                        updatedBy: userId,
                        email: person.Email
                    }
                    
                    if (isGrant) updateData.isActive = true
                    if (isRevoke) updateData.isActive = false
                    if (isRoleUpdate) updateData.Role = batchRole
                    
                    if (!docSnap.exists()) {
                        await setDoc(userDocRef, {
                            ...updateData,
                            isActive: isGrant ? true : (isRevoke ? false : (person.isActive || false)),
                            Role: isRoleUpdate ? batchRole : (person.Role || "MEMBER")
                        })
                    } else {
                        await updateDoc(userDocRef, updateData)
                    }
                }))
                
                let successMsg = `Batch Update Successful`
                if (isGrant) successMsg = `Batch Grant Successful`
                if (isRevoke) successMsg = `Batch Revoke Successful`
                if (isRoleUpdate) successMsg = `Batch Role Updated to ${batchRole}`

                toast.success(successMsg, { id: toastId })
                setSelectedIds(new Set())
            } else {
                const targetId = selectedStaff._id
                const userDocRef = doc(db, "users", targetId)
                const docSnap = await getDoc(userDocRef)

                let updateData: any = {
                    lastSecurityUpdate: new Date().toISOString(),
                    updatedBy: userId
                }

                if (confirmType === "ROLE") {
                    updateData.Role = pendingRole
                } else if (confirmType === "TERMINATE") {
                    updateData.sessionRevoked = true
                    updateData.isActive = false
                } else if (confirmType === "SUSPEND") {
                    updateData.isActive = selectedStaff.isActive === false
                }

                if (!docSnap.exists()) {
                    await setDoc(userDocRef, {
                        ...updateData,
                        isActive: confirmType === "SUSPEND" ? true : false,
                        Role: pendingRole || "MEMBER", // <--- SAVED AS "Role" (Capital R)
                        email: selectedStaff.Email
                    }, { merge: true })
                } else {
                    await updateDoc(userDocRef, updateData) // updateData also uses "Role"
                }

                toast.success("Security Policy Applied", { id: toastId })
            }

            await updateStaffList()
            setConfirmType(null)
            setPendingRole(null)
            setSelectedStaff(null)
        } catch (err) {
            console.error("Firestore Error:", err)
            toast.error("Write failed. Check Firestore Rules.", { id: toastId })
        } finally {
            setIsProcessing(false)
        }
    }

    React.useEffect(() => {
        setUserId(localStorage.getItem("userId"))
        updateStaffList()
    }, [updateStaffList])

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    const toggleAll = () => {
        if (selectedIds.size === paginatedStaff.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(paginatedStaff.map(s => s._id)))
        }
    }

    React.useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, activeDept, sortField, sortDir])

    const handleSort = React.useCallback((field: SortField) => {
        if (field === sortField) {
            setSortDir(prev => prev === "asc" ? "desc" : "asc")
            return
        }
        setSortField(field)
        setSortDir("asc")
    }, [sortField])

    const resetFilters = React.useCallback(() => {
        setSearchTerm("")
        setActiveDept("ALL")
        setCurrentPage(1)
        setSortField("name")
        setSortDir("asc")
    }, [])

    const handleExport = React.useCallback(() => {
        if (sortedStaff.length === 0) return
        const headers = ["ID", "Firstname", "Lastname", "Email", "Department", "Role", "Status", "Last Security Update"]
        const rows = sortedStaff.map(s => [
            s._id,
            s.Firstname,
            s.Lastname,
            s.Email,
            s.Department,
            s.Role || "MEMBER",
            s.isActive ? "Authorized" : "Revoked",
            s.lastSecurityUpdate || "N/A"
        ])
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n")
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `Staff_Directory_Export_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success(`Exported ${sortedStaff.length} staff records`)
    }, [sortedStaff])

    React.useEffect(() => {
        if (selectedStaff) {
            setPendingRole(selectedStaff.Role?.toUpperCase() || "MEMBER")
            return
        }
        setPendingRole(null)
    }, [selectedStaff])

    React.useEffect(() => {
        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setSearchTerm("")
                searchInputRef.current?.blur()
            }
            if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
                e.preventDefault()
                searchInputRef.current?.focus()
            }
        }
        window.addEventListener("keydown", keyHandler)
        return () => window.removeEventListener("keydown", keyHandler)
    }, [])

    return (
        <ProtectedPageWrapper>
            <SidebarProvider defaultOpen={false}>
                <AppSidebar userId={userId} />
                <SidebarInset className="bg-[#F8FAFA] pb-24 md:pb-10 min-h-screen m-0 rounded-none border-none shadow-none overflow-visible font-sans">
                    <PageHeader
                        title="STAFF DIRECTORY"
                        version="V4.5-SECURITY"
                        showBackButton={true}
                        trigger={<SidebarTrigger className="mr-2" />}
                        actions={
                            <Button onClick={updateStaffList} variant="ghost" size="icon" className="rounded-full">
                                <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
                            </Button>
                        }
                    />

                    <main className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-4">
                        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                            <ShieldCheck className="size-4 text-blue-500 flex-shrink-0" />
                            <p className="text-[11px] font-black text-blue-700">
                                Tip: Press <span className="font-mono">/</span> to focus search and <span className="font-mono">Esc</span> to clear.
                            </p>
                        </div>

                        {!isFetching && staff.filter(s => s.isActive === false).length > 0 && activeDept !== "SUSPENDED" && (
                            <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="size-4 text-amber-500 flex-shrink-0" />
                                    <p className="text-[11px] font-black text-amber-700">
                                        {staff.filter(s => s.isActive === false).length} staff account{staff.filter(s => s.isActive === false).length > 1 ? "s are" : " is"} currently without access.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setActiveDept("SUSPENDED")}
                                    className="text-[9px] font-black text-amber-700 underline underline-offset-2 flex-shrink-0"
                                >
                                    Review →
                                </button>
                            </div>
                        )}

                        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                            <DashboardCard
                                label="Total Staff"
                                value={isFetching ? "--" : staff.length}
                                icon={Users}
                                colorClass="text-zinc-600 bg-zinc-50"
                                loading={isFetching}
                                isActive={activeDept === "ALL"}
                                onClick={() => setActiveDept("ALL")}
                            />
                            <DashboardCard
                                label="Engineering"
                                value={isFetching ? "--" : staff.filter(s => s.Department?.toUpperCase() === "ENGINEERING").length}
                                icon={Cpu}
                                colorClass="text-blue-600 bg-blue-50"
                                loading={isFetching}
                                isActive={activeDept === "ENGINEERING"}
                                onClick={() => setActiveDept("ENGINEERING")}
                            />
                            <DashboardCard
                                label="Authorized"
                                value={isFetching ? "--" : staff.filter(s => s.isActive === true).length}
                                icon={ShieldCheck}
                                colorClass="text-emerald-600 bg-emerald-50"
                                loading={isFetching}
                                isActive={activeDept === "AUTHORIZED"}
                                onClick={() => setActiveDept("AUTHORIZED")}
                            />
                            <DashboardCard
                                label="Revoked"
                                value={isFetching ? "--" : staff.filter(s => s.isActive === false).length}
                                icon={Ban}
                                colorClass="text-rose-600 bg-rose-50"
                                loading={isFetching}
                                isActive={activeDept === "SUSPENDED"}
                                onClick={() => setActiveDept("SUSPENDED")}
                            />
                        </section>

                        <div className="sticky top-[56px] md:top-[64px] z-[45] flex flex-col xl:flex-row xl:items-center gap-3 bg-white/80 backdrop-blur-md p-2 rounded-[24px] border border-zinc-200/40 shadow-sm transition-all">
                            <div className="flex gap-1.5 overflow-x-auto pb-1 xl:pb-0 scrollbar-none flex-1">
                                <StatPill
                                    label="All Staff"
                                    count={staff.length}
                                    isActive={activeDept === "ALL"}
                                    onClick={() => setActiveDept("ALL")}
                                    loading={isFetching}
                                />
                                <StatPill
                                    label="Authorized"
                                    count={staff.filter(s => s.isActive === true).length}
                                    isActive={activeDept === "AUTHORIZED"}
                                    onClick={() => setActiveDept("AUTHORIZED")}
                                    loading={isFetching}
                                />
                                <StatPill
                                    label="Revoked"
                                    count={staff.filter(s => s.isActive === false).length}
                                    isActive={activeDept === "SUSPENDED"}
                                    onClick={() => setActiveDept("SUSPENDED")}
                                    loading={isFetching}
                                />
                                <div className="h-8 w-px bg-zinc-200 mx-1 flex-shrink-0" />
                                {departments.slice(0, 4).map(d => (
                                    <StatPill
                                        key={d}
                                        label={d}
                                        count={staff.filter(s => s.Department?.toUpperCase() === d).length}
                                        isActive={activeDept === d}
                                        onClick={() => setActiveDept(d)}
                                        loading={isFetching}
                                    />
                                ))}
                            </div>

                            <div className="flex flex-col md:flex-row gap-2 xl:min-w-[500px]">
                                <div className="relative flex-1 group">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-300 group-focus-within:text-zinc-800 transition-colors" />
                                    <input
                                        ref={searchInputRef}
                                        placeholder='Search staff by name or email...'
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-9 h-10 rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 outline-none focus:ring-2 focus:ring-zinc-900 transition-all text-xs font-bold"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm("")}
                                                className="text-zinc-300 hover:text-zinc-600 transition-colors"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        )}
                                        <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded border border-zinc-100 bg-zinc-50 text-[8px] font-black text-zinc-400">
                                            <span>/</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Select value={activeDept} onValueChange={setActiveDept}>
                                        <SelectTrigger className="h-10 px-3 rounded-xl bg-white border-zinc-200 font-bold text-[10px] uppercase w-[140px] shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Filter className="size-3 text-zinc-400" />
                                                <SelectValue placeholder="Dept" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-zinc-100">
                                            <SelectItem value="ALL" className="font-bold text-[10px] uppercase py-2">All Depts</SelectItem>
                                            {departments.map(d => (
                                                <SelectItem key={d} value={d} className="font-bold text-[10px] uppercase py-2">{d}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Button
                                        variant="outline"
                                        onClick={() => setShowGuide(true)}
                                        className="h-10 px-3 rounded-xl bg-blue-50 border-blue-100 hover:bg-blue-100 text-blue-600 font-black text-[10px] uppercase tracking-wider transition-all"
                                    >
                                        <HelpCircle className="size-3.5 mr-1.5" />
                                        Guide
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={handleExport}
                                        className="h-10 px-3 rounded-xl bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5"
                                        disabled={sortedStaff.length === 0}
                                    >
                                        <FileDown className="size-3.5" />
                                        <span>Export</span>
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={resetFilters}
                                        className="h-10 w-10 rounded-xl bg-white border-zinc-200 hover:bg-zinc-50 flex items-center justify-center p-0 flex-shrink-0"
                                        title="Reset filters"
                                    >
                                        <RotateCcw className="size-3.5 text-zinc-400" />
                                    </Button>

                                    {selectedIds.size > 0 && (
                                        <div className="flex gap-1 animate-in slide-in-from-right-4">
                                            <Button
                                                onClick={() => setConfirmType("BATCH_GRANT")}
                                                className="h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-100"
                                            >
                                                <ShieldCheck className="size-3.5" />
                                                <span>Grant ({selectedIds.size})</span>
                                            </Button>
                                            <Button
                                                onClick={() => setConfirmType("BATCH_REVOKE")}
                                                className="h-10 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm shadow-rose-100"
                                            >
                                                <ShieldOff className="size-3.5" />
                                                <span>Revoke ({selectedIds.size})</span>
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        className="h-10 px-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-[10px] uppercase tracking-wider border-none w-[110px] shadow-sm shadow-violet-100 flex items-center gap-1.5"
                                                    >
                                                        <UserCog className="size-3.5" />
                                                        <span>Role</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="rounded-xl border-zinc-100 min-w-[140px]">
                                                    {batchRoleOptions.map(r => (
                                                        <DropdownMenuItem 
                                                            key={r} 
                                                            onClick={() => { setBatchRole(r); setConfirmType("BATCH_ROLE"); }}
                                                            className="font-bold text-[10px] uppercase py-2 cursor-pointer"
                                                        >
                                                            {r}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── USER GUIDE DIALOG ── */}
                        <Dialog open={showGuide} onOpenChange={setShowGuide}>
                            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] border-none shadow-2xl p-0 bg-white scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent hover:scrollbar-thumb-zinc-300 transition-colors">
                                <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-10 px-8 py-6 border-b border-zinc-100 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-[20px] font-black text-zinc-900 tracking-tight">
                                            Staff Management Guide
                                        </h2>
                                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Security & Access Control</p>
                                    </div>
                                </div>

                                <div className="p-8 space-y-8">
                                    <section>
                                        <div className="mb-4">
                                            <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-wide">Security Roles</h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <GuideItem 
                                                icon={ShieldCheck} 
                                                title="Super Admin" 
                                                description="Full system access including security management, logs, and system protocols."
                                                colorClass="bg-zinc-900 text-white"
                                            />
                                            <GuideItem 
                                                icon={Shield} 
                                                title="Manager / Leader" 
                                                description="Higher level access for overseeing departmental tasks and approvals."
                                                colorClass="bg-blue-50 text-blue-600"
                                            />
                                        </div>
                                    </section>

                                    <section>
                                        <div className="mb-4">
                                            <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-wide">Access Workflow</h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <GuideItem 
                                                icon={Zap} 
                                                title="Batch Grant/Revoke" 
                                                description="Select multiple staff profiles to instantly toggle their application access. Use this for quick onboarding or offboarding."
                                                colorClass="bg-emerald-50 text-emerald-600"
                                            />
                                            <GuideItem 
                                                icon={LogOut} 
                                                title="Session Termination" 
                                                description="Force logout a user by revoking their active tokens. This takes effect immediately on their next request."
                                                colorClass="bg-rose-50 text-rose-600"
                                            />
                                        </div>
                                    </section>

                                    <div className="bg-zinc-900 rounded-2xl p-6 text-white flex items-center justify-between gap-6 overflow-hidden relative">
                                        <div className="relative z-10">
                                            <h4 className="text-[15px] font-black mb-1">Pro Tip!</h4>
                                            <p className="text-[11px] font-medium text-zinc-400 leading-relaxed max-w-[300px]">
                                                The <LockKeyhole className="inline size-3 text-emerald-500" /> icon indicates that the staff member is already registered in the Firestore Security Registry.
                                            </p>
                                        </div>
                                        <Lightbulb className="text-amber-400 flex-shrink-0 relative z-10" size={40} />
                                        <div className="absolute -right-10 -bottom-10 size-40 bg-white/5 rounded-full blur-3xl" />
                                    </div>
                                </div>

                                <div className="p-8 pt-0 flex justify-end">
                                    <Button 
                                        onClick={() => setShowGuide(false)}
                                        className="h-12 px-8 rounded-2xl bg-zinc-900 text-white font-black text-[12px] uppercase tracking-widest hover:bg-zinc-800 transition-all"
                                    >
                                        Got it!
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <div className="bg-white rounded-[28px] shadow-sm border border-zinc-200/60 overflow-hidden">
                            <div className="hidden md:grid grid-cols-[44px_1.8fr_1fr_1fr_1fr_1fr_44px] bg-zinc-50/80 px-6 py-4 border-b gap-4 items-center">
                                <button
                                    onClick={toggleAll}
                                    className="size-9 flex items-center justify-center rounded-xl hover:bg-zinc-200/50 transition-colors"
                                >
                                    {selectedIds.size === paginatedStaff.length && paginatedStaff.length > 0 ? (
                                        <CheckSquare className="size-4 text-zinc-900" />
                                    ) : (
                                        <Square className="size-4 text-zinc-300" />
                                    )}
                                </button>
                                <StaffSortButton label="Staff Profile" field="name" currentField={sortField} dir={sortDir} onSort={handleSort} />
                                <StaffSortButton label="Department" field="department" currentField={sortField} dir={sortDir} onSort={handleSort} />
                                <StaffSortButton label="Role" field="role" currentField={sortField} dir={sortDir} onSort={handleSort} />
                                <StaffSortButton label="Security Status" field="status" currentField={sortField} dir={sortDir} onSort={handleSort} />
                                <StaffSortButton label="Activity" field="activity" currentField={sortField} dir={sortDir} onSort={handleSort} />
                                <span />
                            </div>

                            <div className="divide-y divide-zinc-50/80 min-h-[400px]">
                                {isFetching ? (
                                    Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="px-5 md:px-6 py-4 animate-pulse">
                                            <div className="hidden md:grid grid-cols-[44px_1.8fr_1fr_1fr_1fr_1fr_44px] gap-4 items-center">
                                                <Skeleton className="size-5 rounded" />
                                                <div className="flex items-center gap-3">
                                                    <Skeleton className="size-10 rounded-xl" />
                                                    <div className="space-y-2">
                                                        <Skeleton className="h-3.5 w-28" />
                                                        <Skeleton className="h-2.5 w-44" />
                                                    </div>
                                                </div>
                                                <Skeleton className="h-5 w-24 rounded-full" />
                                                <Skeleton className="h-5 w-20 rounded-full" />
                                                <Skeleton className="h-5 w-24 rounded-full" />
                                                <Skeleton className="h-3.5 w-20" />
                                                <Skeleton className="size-8 rounded-xl" />
                                            </div>
                                            <div className="md:hidden space-y-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-3">
                                                        <Skeleton className="size-10 rounded-xl" />
                                                        <div className="space-y-2">
                                                            <Skeleton className="h-3 w-24" />
                                                            <Skeleton className="h-2.5 w-32" />
                                                        </div>
                                                    </div>
                                                    <Skeleton className="h-6 w-20 rounded-xl" />
                                                </div>
                                                <div className="pl-[52px] flex items-center gap-2">
                                                    <Skeleton className="h-5 w-16 rounded-full" />
                                                    <Skeleton className="h-5 w-14 rounded-full" />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : paginatedStaff.length > 0 ? (
                                    paginatedStaff.map((person) => {
                                        const fullName = `${person.Firstname || ""} ${person.Lastname || ""}`.trim()
                                        const role = (person.Role || "MEMBER").toUpperCase()
                                        const dept = person.Department || "N/A"
                                        const accessOn = person.isActive === true
                                        const isSelected = selectedIds.has(person._id)

                                        return (
                                            <div
                                                key={person._id}
                                                className={cn(
                                                    "group cursor-pointer hover:bg-zinc-50/80 active:bg-zinc-100/60 transition-colors",
                                                    isSelected && "bg-blue-50/40 hover:bg-blue-50/60"
                                                )}
                                            >
                                                {/* Desktop row */}
                                                <div className="hidden md:grid grid-cols-[44px_1.8fr_1fr_1fr_1fr_1fr_44px] px-6 py-4 items-center gap-4">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            toggleSelection(person._id)
                                                        }}
                                                        className="size-9 flex items-center justify-center rounded-xl hover:bg-zinc-200/50 transition-colors"
                                                    >
                                                        {isSelected ? (
                                                            <CheckSquare className="size-4 text-blue-600" />
                                                        ) : (
                                                            <Square className="size-4 text-zinc-300 group-hover:text-zinc-400" />
                                                        )}
                                                    </button>

                                                    <div className="flex items-center gap-3 min-w-0" onClick={() => setSelectedStaff(person)}>
                                                        <Avatar className="size-10 rounded-xl border border-zinc-100 shadow-sm flex-shrink-0 transition-transform group-hover:scale-105">
                                                            <AvatarImage src={person.profilePicture} className="object-cover" />
                                                            <AvatarFallback className="bg-zinc-900 text-white text-[10px] font-bold">{person.Firstname?.[0]}{person.Lastname?.[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-[12px] font-black uppercase text-zinc-900 truncate">{fullName || "Unnamed Staff"}</p>
                                                                {person.hasSecurityDoc && (
                                                                    <div className="flex items-center" title="Security Document Linked">
                                                                        <LockKeyhole className="size-2.5 text-emerald-500" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <p className="text-[9px] text-zinc-400 font-bold truncate">{person.Email || "No email"}</p>
                                                                {person.ReferenceID && (
                                                                    <>
                                                                        <span className="text-[8px] text-zinc-200">•</span>
                                                                        <span className="text-[8px] font-mono text-zinc-300 font-bold">{person.ReferenceID}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div onClick={() => setSelectedStaff(person)}>
                                                        <Badge variant="secondary" className="bg-zinc-50 text-zinc-500 text-[9px] font-black uppercase border border-zinc-100/50 py-0.5 px-2">
                                                            {dept}
                                                        </Badge>
                                                        {person.Position && (
                                                            <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-1 truncate">{person.Position}</p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2" onClick={() => setSelectedStaff(person)}>
                                                        <div className={cn(
                                                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors",
                                                            role === "SUPER ADMIN" ? "bg-zinc-900 text-white border-zinc-900" :
                                                                role === "MANAGER" || role === "SALES HEAD" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                                    role === "LEADER" ? "bg-violet-50 text-violet-700 border-violet-200" :
                                                                        role === "TERRITORY SALES MANAGER" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                                            role === "TERRITORY SALES ASSOCIATE" ? "bg-orange-50 text-orange-700 border-orange-200" :
                                                                                "bg-zinc-100 text-zinc-600 border-zinc-200"
                                                        )}>
                                                            <Key className={cn("size-2.5", role === "SUPER ADMIN" ? "text-zinc-400" : "text-current opacity-70")} />
                                                            <span className="text-[9px] font-black uppercase tracking-wider">
                                                                {role}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2" onClick={() => setSelectedStaff(person)}>
                                                        <div className={cn("size-2 rounded-full", accessOn ? "bg-emerald-500" : "bg-zinc-300 shadow-inner")} />
                                                        <span className={cn("text-[10px] font-black uppercase tracking-wide", accessOn ? "text-emerald-600" : "text-zinc-400")}>
                                                            {accessOn ? "Authorized" : "Revoked"}
                                                        </span>
                                                    </div>

                                                    <div onClick={() => setSelectedStaff(person)}>
                                                        <p className="text-[10px] font-bold text-zinc-700 leading-none">{relativeTime(person.lastSecurityUpdate)}</p>
                                                        <p className="text-[8px] text-zinc-400 mt-1 flex items-center gap-1 uppercase tracking-widest font-black">
                                                            <Activity size={8} /> Updated
                                                        </p>
                                                    </div>

                                                    <div className="flex justify-end" onClick={() => setSelectedStaff(person)}>
                                                        <div className="size-8 flex items-center justify-center rounded-xl border border-transparent group-hover:border-zinc-200 group-hover:bg-white transition-all">
                                                            <ChevronRight className="size-3.5 text-zinc-300 group-hover:text-zinc-800 transition-colors" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Mobile card */}
                                                <div className="md:hidden px-4 py-4" onClick={() => setSelectedStaff(person)}>
                                                    <div className="flex items-start justify-between gap-2 mb-2.5">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <button 
                                                                className="size-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    toggleSelection(person._id)
                                                                }}
                                                            >
                                                                {isSelected ? <CheckSquare className="size-4 text-blue-600" /> : <Square className="size-4 text-zinc-300" />}
                                                            </button>
                                                            <Avatar className="size-10 rounded-xl border border-zinc-100 shadow-sm flex-shrink-0">
                                                                <AvatarImage src={person.profilePicture} className="object-cover" />
                                                                <AvatarFallback className="bg-zinc-900 text-white text-[10px] font-bold">{person.Firstname?.[0]}{person.Lastname?.[0]}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <p className="text-[13px] font-black uppercase text-zinc-900 leading-tight truncate">{fullName || "Unnamed Staff"}</p>
                                                                    {person.hasSecurityDoc && <LockKeyhole className="size-2.5 text-emerald-500" />}
                                                                </div>
                                                                <p className="text-[10px] text-zinc-400 font-bold truncate mt-0.5">{person.Email || "No email"}</p>
                                                            </div>
                                                        </div>
                                                        <div className={cn(
                                                            "flex items-center gap-1.5 px-2 py-0.5 rounded-lg border flex-shrink-0",
                                                            accessOn ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-zinc-100 border-zinc-200 text-zinc-600"
                                                        )}>
                                                            <div className={cn("size-1 rounded-full", accessOn ? "bg-emerald-500" : "bg-zinc-400")} />
                                                            <span className="text-[8px] font-black uppercase tracking-wide">
                                                                {accessOn ? "Auth" : "Rev"}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between pl-[44px]">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className="text-[8px] bg-zinc-50 border border-zinc-100 rounded-md px-1.5 py-0.5 uppercase font-bold text-zinc-400">
                                                                {dept}
                                                            </span>
                                                            <span className={cn(
                                                                "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border",
                                                                role === "SUPER ADMIN" ? "bg-zinc-900 text-white border-zinc-900" :
                                                                    role === "MANAGER" || role === "SALES HEAD" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                                        role === "LEADER" ? "bg-violet-50 text-violet-700 border-violet-200" :
                                                                            role === "TERRITORY SALES MANAGER" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                                                role === "TERRITORY SALES ASSOCIATE" ? "bg-orange-50 text-orange-700 border-orange-200" :
                                                                                    "bg-zinc-100 text-zinc-600 border-zinc-200"
                                                            )}>
                                                                {role}
                                                            </span>
                                                        </div>
                                                        <ChevronRight className="size-4 text-zinc-200 group-hover:text-zinc-500 transition-colors flex-shrink-0 ml-2" />
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="py-24 flex flex-col items-center gap-3">
                                        <div className="size-16 rounded-3xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                                            <Users className="size-7 text-zinc-200" />
                                        </div>
                                        <p className="text-[11px] font-black uppercase text-zinc-300 tracking-widest text-center px-4">No matching staff found</p>
                                        {(searchTerm || activeDept !== "ALL") && (
                                            <button
                                                onClick={() => { setSearchTerm(""); setActiveDept("ALL") }}
                                                className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1 hover:text-blue-700 transition-colors"
                                            >
                                                Clear all filters
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {!isFetching && sortedStaff.length > 0 && (
                                <div className="px-4 md:px-6 py-3 border-t bg-zinc-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest order-2 sm:order-1">
                                        {sortedStaff.length === staff.length ? `${staff.length} profiles` : `${sortedStaff.length} of ${staff.length} profiles`}
                                        {activeDept !== "ALL" ? " · filtered" : ""}
                                        {searchTerm ? ` · "${searchTerm}"` : ""}
                                        {sortField !== "name" || sortDir !== "asc" ? ` · sorted by ${sortField} ${sortDir}` : ""}
                                    </p>

                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-1.5 order-1 sm:order-2">
                                            <button
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                className={cn(
                                                    "size-8 rounded-xl border flex items-center justify-center transition-all",
                                                    currentPage === 1 ? "border-zinc-100 text-zinc-300 cursor-not-allowed" : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 active:scale-95"
                                                )}
                                            >
                                                <ChevronLeft className="size-3.5" />
                                            </button>

                                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                                                    if (i > 0 && typeof arr[i - 1] === "number" && (p as number) - (arr[i - 1] as number) > 1) acc.push("...")
                                                    acc.push(p)
                                                    return acc
                                                }, [])
                                                .map((p, i) =>
                                                    p === "..." ? (
                                                        <span key={`ellipsis-${i}`} className="text-[10px] text-zinc-300 px-1">...</span>
                                                    ) : (
                                                        <button
                                                            key={p}
                                                            onClick={() => setCurrentPage(p as number)}
                                                            className={cn(
                                                                "size-8 rounded-xl text-[10px] font-black transition-all active:scale-95",
                                                                currentPage === p ? "bg-zinc-900 text-white border border-zinc-900" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                                                            )}
                                                        >
                                                            {p}
                                                        </button>
                                                    )
                                                )}

                                            <button
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                                className={cn(
                                                    "size-8 rounded-xl border flex items-center justify-center transition-all",
                                                    currentPage === totalPages ? "border-zinc-100 text-zinc-300 cursor-not-allowed" : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 active:scale-95"
                                                )}
                                            >
                                                <ChevronRight className="size-3.5" />
                                            </button>

                                            <span className="text-[9px] font-black text-zinc-400 ml-1 hidden sm:block">
                                                Page {currentPage} of {totalPages}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </main>

                    {/* Security Sheet */}
                    <Sheet open={!!selectedStaff} onOpenChange={() => !isProcessing && setSelectedStaff(null)}>
                        <SheetContent side="right" className="sm:max-w-[470px] w-full p-0 border-l border-zinc-200 bg-[#F8FAFA] flex flex-col">
                            {selectedStaff && (
                                <>
                                    <div className="h-14 shrink-0 relative border-b border-zinc-200 bg-white">
                                        <p className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                                            Staff Access
                                        </p>
                                        <Button
                                            onClick={() => setSelectedStaff(null)}
                                            variant="ghost"
                                            className="absolute top-2.5 right-2.5 h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 p-0"
                                        >
                                            <X className="size-4" />
                                        </Button>
                                    </div>

                                    <div className="px-5 sm:px-6 -mt-4 flex-1 flex flex-col overflow-hidden">
                                        <Avatar className="size-16 rounded-[18px] border-4 border-white shadow-sm mb-3 bg-white">
                                            <AvatarImage src={selectedStaff.profilePicture} className="object-cover" />
                                            <AvatarFallback className="bg-zinc-900 text-white text-xl font-black">{selectedStaff.Firstname?.[0]}{selectedStaff.Lastname?.[0]}</AvatarFallback>
                                        </Avatar>

                                        <div className="mb-3">
                                            <h2 className="text-3xl sm:text-[34px] font-black uppercase tracking-tight leading-[0.95] text-zinc-900 break-words">
                                                {selectedStaff.Firstname} {selectedStaff.Lastname}
                                            </h2>
                                            <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                                <div className={cn("flex items-center gap-1.5 py-1 px-2 rounded-full border", selectedStaff.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-600 border-zinc-200")}>
                                                    <Activity className="size-3" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">{selectedStaff.isActive ? "Authorized Access" : "No Access"}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
                                                    <Building2 className="size-3" />
                                                    {selectedStaff.Department || "No Department"}
                                                </div>
                                                <span className="text-[10px] text-zinc-400 font-medium">ID: {selectedStaff._id.slice(-6).toUpperCase()}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3 overflow-y-auto pr-1 pb-32 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300/90 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400">
                                            <section className="rounded-[20px] border border-zinc-200 bg-white p-4 space-y-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em]">Access Profile</p>
                                                        <p className="text-[10px] text-zinc-400 mt-1">Identity and role mapped in Firestore.</p>
                                                    </div>
                                                    <div className="size-8 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center">
                                                        <UserCog className="size-4 text-zinc-500" />
                                                    </div>
                                                </div>

                                                <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-3 flex items-center gap-2.5">
                                                    <div className="size-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center">
                                                        <Mail className="size-3.5 text-zinc-500" />
                                                    </div>
                                                    <p className="text-[10px] text-zinc-500 font-semibold break-all">{selectedStaff.Email || "No email available"}</p>
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                                                        <Shield className="size-3" /> Assigned Permission Role
                                                    </label>
                                                    <Select value={activeRole} onValueChange={setPendingRole}>
                                                        <SelectTrigger className="h-11 bg-white border-zinc-200 rounded-2xl font-bold text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-2xl border-zinc-100">
                                                            {getRolesForDepartment(selectedStaff?.Department).map(r => (
                                                                <SelectItem key={r} value={r} className="font-bold text-[10px] uppercase py-3">{r}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-[10px] text-zinc-400">
                                                        {hasPendingRoleChange ? `Ready to update from ${selectedStaff.Role?.toUpperCase() || "MEMBER"} to ${activeRole}.` : "Role is synchronized with Firestore."}
                                                    </p>
                                                </div>
                                            </section>

                                            <section className="rounded-[20px] border border-zinc-200 bg-white p-4 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em]">Authorization Controls</p>
                                                    <div className={cn(
                                                        "text-[9px] font-black uppercase px-2 py-1 rounded-full border",
                                                        selectedStaff.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-600 border-zinc-200"
                                                    )}>
                                                        {selectedStaff.isActive ? "Access On" : "Access Off"}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black uppercase text-zinc-800">Authorization Switch</span>
                                                        <span className="text-[10px] text-zinc-400">Grant or revoke app access</span>
                                                    </div>
                                                    <Switch
                                                        checked={selectedStaff.isActive === true}
                                                        onCheckedChange={() => setConfirmType("SUSPEND")}
                                                        className="data-[state=checked]:bg-emerald-500"
                                                    />
                                                </div>

                                                <Button
                                                    onClick={() => setConfirmType("SUSPEND")}
                                                    variant="outline"
                                                    className="w-full h-11 rounded-2xl border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-bold text-[10px] uppercase tracking-[0.15em]"
                                                >
                                                    {selectedStaff.isActive ? "Revoke Access" : "Grant Access"}
                                                </Button>
                                            </section>

                                            <section className="rounded-[20px] border border-red-200 bg-red-50/40 p-4 space-y-4">
                                                <p className="text-[10px] font-black text-red-500/70 uppercase tracking-[0.2em]">Danger Zone</p>
                                                <Button
                                                    onClick={() => setConfirmType("TERMINATE")}
                                                    variant="outline"
                                                    className="w-full h-11 rounded-2xl border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 font-bold text-[10px] uppercase tracking-[0.2em] transition-all"
                                                >
                                                    <LogOut className="mr-3 size-4" /> Force Logout (Revoke Tokens)
                                                </Button>
                                                <div className="flex gap-2 p-3 bg-amber-50 rounded-2xl border border-amber-100">
                                                    <Info className="size-4 text-amber-600 shrink-0" />
                                                    <p className="text-[9px] text-amber-700 leading-relaxed font-medium">
                                                        This uses the Firestore `sessionRevoked` flag. On next request, the user is denied and required to log in again.
                                                    </p>
                                                </div>
                                            </section>
                                        </div>

                                        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 bg-[#F8FAFA] border-t border-zinc-200">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                <Button
                                                    onClick={() => setSelectedStaff(null)}
                                                    variant="outline"
                                                    className="h-11 rounded-2xl border-zinc-200 bg-white text-zinc-700 font-bold uppercase text-[10px] tracking-widest hover:bg-zinc-50"
                                                >
                                                    Close Panel
                                                </Button>
                                                <Button
                                                    onClick={() => setConfirmType("ROLE")}
                                                    disabled={!hasPendingRoleChange}
                                                    className={cn(
                                                        "h-11 rounded-2xl text-white font-bold uppercase text-[10px] tracking-widest transition-all",
                                                        hasPendingRoleChange ? "bg-zinc-900 hover:bg-zinc-800" : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                                                    )}
                                                >
                                                    Save Role
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </SheetContent>
                    </Sheet>

                    {/* Confirmation Dialog */}
                    <AlertDialog open={!!confirmType} onOpenChange={() => !isProcessing && setConfirmType(null)}>
                        <AlertDialogContent className="rounded-[32px] border-none shadow-2xl p-10 max-w-sm">
                            <AlertDialogHeader className="items-center text-center">
                                <div className={cn(
                                    "size-16 rounded-3xl flex items-center justify-center mb-6 shadow-lg",
                                    confirmType === "ROLE" ? "bg-blue-600 text-white" : "bg-red-600 text-white"
                                )}>
                                    <ShieldAlert className="size-8" />
                                </div>
                                <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter text-zinc-900">
                                    Confirm Action
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-zinc-500 text-sm font-medium mt-2">
                                    {confirmType === "ROLE" && `Set ${selectedStaff?.Firstname}'s security role to ${pendingRole}?`}
                                    {confirmType === "TERMINATE" && `Invalidate all active sessions for ${selectedStaff?.Firstname}?`}
                                    {confirmType === "SUSPEND" && `Update access rights for ${selectedStaff?.Firstname}?`}
                                    {confirmType === "BATCH_GRANT" && `Grant access to ${selectedIds.size} selected staff members?`}
                                    {confirmType === "BATCH_REVOKE" && `Revoke access for ${selectedIds.size} selected staff members?`}
                                    {confirmType === "BATCH_ROLE" && `Update security role to ${batchRole} for ${selectedIds.size} selected staff members?`}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-10 sm:flex-col gap-3">
                                <AlertDialogAction
                                    onClick={(e) => { e.preventDefault(); executeSecurityAction(); }}
                                    className={cn(
                                        "h-14 rounded-2xl font-bold uppercase text-[11px] tracking-widest w-full order-1 sm:order-2",
                                        ["ROLE", "BATCH_ROLE", "BATCH_GRANT"].includes(confirmType || "") ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"
                                    )}
                                >
                                    {isProcessing ? <Loader2 className="animate-spin size-5" /> : "Confirm Security Write"}
                                </AlertDialogAction>
                                <AlertDialogCancel className="h-14 rounded-2xl font-bold uppercase text-[11px] tracking-widest w-full border-zinc-100 order-2 sm:order-1">
                                    Cancel
                                </AlertDialogCancel>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    )
}

function StaffSortButton({
    label,
    field,
    currentField,
    dir,
    onSort,
}: {
    label: string
    field: SortField
    currentField: SortField
    dir: SortDir
    onSort: (field: SortField) => void
}) {
    const active = field === currentField
    return (
        <button
            onClick={() => onSort(field)}
            className={cn(
                "flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.2em] transition-colors",
                active ? "text-zinc-700" : "text-zinc-400 hover:text-zinc-600"
            )}
        >
            {label}
            {active
                ? dir === "asc"
                    ? <ArrowUp className="size-3" />
                    : <ArrowDown className="size-3" />
                : <ArrowUpDown className="size-3 opacity-40" />}
        </button>
    )
}