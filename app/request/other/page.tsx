"use client"

import * as React from "react"
import { useRouter } from "next/navigation" // Added for navigation
import { AppSidebar } from "@/components/app-sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import {
    Plus, Search, Activity, RotateCcw,
    ClipboardCheck, ShieldCheck,
    TrendingUp, Loader2, ChevronLeft, ChevronRight,
    Info, X, ArrowRight, Clock, AlertCircle
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// DATABASE TOOLS
import { db } from "@/lib/firebase"
import { collection, onSnapshot, query, orderBy, where, limit, doc, updateDoc } from "firebase/firestore"

// SHARED COMPONENTS
import { PageHeader } from "@/components/page-header"

export default function OtherRequestManagementPage() {
    const router = useRouter() // Initialize router
    
    // APP STATE
    const [userId, setUserId] = React.useState<string | null>(null)
    const [userRole, setUserRole] = React.useState<string>("")
    const [userDept, setUserDept] = React.useState<string>("")
    const [requests, setRequests] = React.useState<any[]>([])
    const [isDataLoading, setIsDataLoading] = React.useState(true)
    const [showInstructions, setShowInstructions] = React.useState(false)
    const [guideStep, setGuideStep] = React.useState(1)
    const [filterStatus, setFilterStatus] = React.useState<string | null>(null)
    const [searchTerm, setSearchTerm] = React.useState("")

    // PAGINATION
    const [currentPage, setCurrentPage] = React.useState(1)
    const [itemsPerPage, setItemsPerPage] = React.useState("10")

    // FETCH DATA — role-filtered to prevent full collection reads
    React.useEffect(() => {
        const storedId = localStorage.getItem("userId")
        const storedRole = (localStorage.getItem("userRole") || "MEMBER").toUpperCase()
        const storedDept = (localStorage.getItem("userDepartment") || localStorage.getItem("department") || "").toUpperCase()
        setUserId(storedId)
        setUserRole(storedRole)
        setUserDept(storedDept)
        if (!storedId) { setIsDataLoading(false); return; }

        const hasGlobalAccess =
            storedDept === "IT" ||
            storedDept === "ENGINEERING" ||
            ["SUPER ADMIN", "MANAGER", "LEADER"].includes(storedRole)

        let q
        if (hasGlobalAccess) {
            // Admin/IT/Engineering: full access with cap
            q = query(collection(db, "other_requests"), orderBy("createdAt", "desc"), limit(200))
        } else {
            // Regular members: only their own requests
            q = query(
                collection(db, "other_requests"),
                where("submittedBy", "==", storedId),
                orderBy("createdAt", "desc"),
                limit(100)
            )
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ 
                id: doc.id, 
                uid: doc.id.slice(-6).toUpperCase(),
                ...doc.data() 
            })))
            setIsDataLoading(false)
        })
        return () => unsubscribe()
    }, [])

    const handleCreateNew = () => router.push('/request/other/add')

    // QUICK STATUS TOGGLE
    const toggleUrgency = async (id: string, current: string) => {
        try {
            const nextStatus = current === "URGENT" ? "NORMAL" : "URGENT"
            await updateDoc(doc(db, "other_requests", id), {
                priority: nextStatus,
                updatedAt: new Date()
            })
        } catch (e) { console.error("Update failed:", e) }
    }

    const filteredRequests = requests.filter(r => {
        const matchesSearch = r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.uid?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = filterStatus === null ? true : r.status === filterStatus
        return matchesSearch && matchesStatus
    })

    const limit = parseInt(itemsPerPage)
    const totalPages = Math.ceil(filteredRequests.length / limit)
    const paginatedItems = filteredRequests.slice((currentPage - 1) * limit, currentPage * limit)

    return (
        <ProtectedPageWrapper>
            <SidebarProvider defaultOpen={false}>
                <AppSidebar userId={userId} />

                <SidebarInset className="relative bg-[#F4F7F7] pb-24 md:pb-0 font-sans">
                    <PageHeader
                        title="REQUEST HUB"
                        version="V2.8"
                        showBackButton={true}
                        trigger={<SidebarTrigger className="mr-2" />}
                        actions={
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setShowInstructions(!showInstructions); setGuideStep(1) }}
                                    className={cn("rounded-full h-10 w-10", showInstructions && "bg-blue-50 text-blue-600")}
                                >
                                    <Info className="size-5" />
                                </Button>
                                
                                {/* DESKTOP ADD BUTTON */}
                                <Button 
                                    onClick={handleCreateNew}
                                    className="hidden md:flex bg-black hover:bg-zinc-800 text-white px-5 rounded-xl h-10 text-xs font-bold tracking-tight"
                                >
                                    <Plus className="mr-2 size-4" /> NEW REQUEST
                                </Button>
                            </div>
                        }
                    />

                    <main className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">

                        {/* V2.8 USER GUIDE */}
                        {showInstructions && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/5 pointer-events-none">
                                <div className="bg-white p-8 rounded-[24px] shadow-2xl border border-zinc-200 w-[320px] pointer-events-auto animate-in zoom-in-95 duration-200">
                                    <div className="flex justify-between items-start mb-6">
                                        <Badge className="bg-rose-500 hover:bg-rose-600 text-[10px] font-bold px-3 py-1 uppercase tracking-wider">
                                            Guide {guideStep}/3
                                        </Badge>
                                        <button onClick={() => setShowInstructions(false)} className="text-zinc-400 hover:text-zinc-900">
                                            <X className="size-5" />
                                        </button>
                                    </div>

                                    <div className="space-y-2 mb-8">
                                        <h3 className="font-black text-xl tracking-tight text-zinc-900 uppercase">
                                            {guideStep === 1 && "Monitor Requests"}
                                            {guideStep === 2 && "Quick Toggles"}
                                            {guideStep === 3 && "Filtering"}
                                        </h3>
                                        <p className="text-sm leading-relaxed text-zinc-500">
                                            {guideStep === 1 && "Track all non-standard engineering requests in real-time."}
                                            {guideStep === 2 && "Click the Priority badge to quickly toggle between Normal and Urgent status."}
                                            {guideStep === 3 && "Use the top cards to filter by Pending or Completed status instantly."}
                                        </p>
                                    </div>

                                    <Button
                                        onClick={() => guideStep < 3 ? setGuideStep(guideStep + 1) : setShowInstructions(false)}
                                        className="w-full bg-zinc-900 hover:bg-black text-white rounded-2xl h-12 font-bold text-xs"
                                    >
                                        {guideStep === 3 ? "GOT IT!" : "NEXT"} <ChevronRight className="ml-2 size-4" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* SUMMARY CARDS */}
                        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard label="ALL REQUESTS" val={requests.length} icon={ClipboardCheck} isActive={filterStatus === null} onClick={() => setFilterStatus(null)} />
                            <StatCard label="PENDING" val={requests.filter(r => r.status === "PENDING").length} icon={Clock} isActive={filterStatus === "PENDING"} onClick={() => setFilterStatus("PENDING")} isStatus />
                            <StatCard label="RESPONSE RATE" val="98%" icon={TrendingUp} isStatic />
                            <StatCard label="SYSTEM HEALTH" val="OK" icon={ShieldCheck} isStatic />
                        </section>

                        {/* SEARCH & FILTERS */}
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                <input
                                    placeholder="Search by ID or subject..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-11 h-12 rounded-2xl border-none bg-white shadow-sm ring-1 ring-zinc-200 focus:ring-2 focus:ring-black outline-none transition-all text-sm"
                                />
                            </div>
                            <Button variant="outline" onClick={() => { setFilterStatus(null); setSearchTerm("") }} className="h-12 rounded-2xl bg-white border-zinc-200 font-bold text-[10px] tracking-widest uppercase">
                                <RotateCcw className="mr-2 size-3" /> RESET
                            </Button>
                        </div>

                        {/* DATA LIST */}
                        <div className="bg-white rounded-[24px] shadow-sm border border-zinc-200/60 overflow-hidden">
                            <div className="hidden md:grid grid-cols-6 bg-zinc-50/50 p-6 border-b border-zinc-100 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                <span>Ref ID</span>
                                <span className="col-span-2">Subject / Title</span>
                                <span>Priority</span>
                                <span>Status</span>
                                <span className="text-right">Action</span>
                            </div>

                            <div className="divide-y divide-zinc-50">
                                {isDataLoading ? (
                                    <div className="p-20 text-center flex flex-col items-center gap-3">
                                        <Loader2 className="animate-spin text-zinc-200 size-10" />
                                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Loading engiconnect...</p>
                                    </div>
                                ) : paginatedItems.length === 0 ? (
                                    <div className="p-20 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest italic">No Records Found</div>
                                ) : paginatedItems.map((r) => (
                                    <div key={r.id} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-6 items-center hover:bg-zinc-50/40 transition-colors">
                                        <span className="text-[10px] font-mono font-bold text-zinc-400">#{r.uid}</span>
                                        <div className="col-span-2 flex flex-col">
                                            <span className="text-sm font-bold text-zinc-900 uppercase truncate">{r.title}</span>
                                            <span className="text-[9px] text-zinc-400 font-bold uppercase">{r.category || "General"}</span>
                                        </div>
                                        
                                        <div>
                                            <button
                                                onClick={() => toggleUrgency(r.id, r.priority)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 border shadow-sm transition-all",
                                                    r.priority === "URGENT" ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-zinc-50 text-zinc-500 border-zinc-100"
                                                )}
                                            >
                                                <AlertCircle className={cn("size-3", r.priority === "URGENT" && "animate-pulse")} />
                                                {r.priority || "NORMAL"}
                                            </button>
                                        </div>

                                        <div>
                                            <Badge className={cn("rounded-lg px-2.5 py-1 text-[9px] font-bold border-none", 
                                                r.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                            )}>
                                                {r.status || "PENDING"}
                                            </Badge>
                                        </div>

                                        <div className="flex justify-end">
                                            <Button 
                                                variant="ghost" 
                                                onClick={() => router.push(`/request/other/${r.id}`)}
                                                className="h-8 rounded-xl text-[11px] font-bold hover:bg-black hover:text-white transition-all group"
                                            >
                                                View <ArrowRight className="size-3 ml-2 group-hover:translate-x-1" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* PAGINATION SYSTEM */}
                            <div className="p-5 bg-zinc-50/50 border-t border-zinc-100 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Show:</span>
                                    <Select value={itemsPerPage} onValueChange={setItemsPerPage}>
                                        <SelectTrigger className="w-16 h-8 bg-white border-zinc-200 rounded-lg text-xs font-bold"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {["5", "10", "20"].map(v => <SelectItem key={v} value={v} className="text-xs font-bold">{v}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} variant="outline" size="icon" className="size-9 rounded-xl bg-white"><ChevronLeft className="size-4" /></Button>
                                    <div className="px-5 py-2 bg-white rounded-xl border border-zinc-200 text-xs font-bold">{currentPage} / {totalPages || 1}</div>
                                    <Button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} variant="outline" size="icon" className="size-9 rounded-xl bg-white"><ChevronRight className="size-4" /></Button>
                                </div>
                            </div>
                        </div>
                    </main>

                    {/* MOBILE FLOATING ACTION BUTTON (FAB) */}
                    <div className="md:hidden fixed bottom-8 right-6 z-50">
                        <Button 
                            onClick={handleCreateNew}
                            className="size-16 rounded-3xl bg-black text-white shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center border border-white/10"
                        >
                            <Plus className="size-7 stroke-[3px]" />
                        </Button>
                    </div>

                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    )
}

function StatCard({ label, val, icon: Icon, isActive, onClick, isStatic, isStatus }: any) {
    return (
        <div
            onClick={!isStatic ? onClick : undefined}
            className={cn(
                "p-5 md:p-6 flex flex-col gap-3 rounded-[24px] bg-white transition-all shadow-sm border-2",
                !isStatic && "cursor-pointer active:scale-95",
                isActive ? "border-black shadow-md" : "border-transparent"
            )}
        >
            <div className="flex justify-between items-start">
                <div className={cn("p-2.5 rounded-xl", isStatus ? "bg-amber-50 text-amber-500" : "bg-zinc-50 text-zinc-400")}>
                    <Icon className="size-4 md:size-5" />
                </div>
                <span className="text-2xl md:text-3xl font-black text-zinc-900">{val}</span>
            </div>
            <p className="text-[9px] md:text-[10px] font-bold uppercase text-zinc-400 tracking-[0.15em]">{label}</p>
        </div>
    )
}