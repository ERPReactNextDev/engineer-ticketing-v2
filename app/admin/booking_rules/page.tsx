"use client"

import * as React from "react"
import { 
  Plus, Settings2, Search, Loader2, Zap, ShieldCheck, 
  RotateCcw, FileDown, HelpCircle, X, ChevronLeft, ChevronRight,
  ArrowRight, CheckSquare, Square, MousePointer2, Lightbulb,
  Terminal, Activity, Globe, Monitor, Smartphone, LayoutGrid,
  Filter, Sparkles, AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"

// FIREBASE
import { db } from "@/lib/firebase";
import { 
  collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, writeBatch, serverTimestamp
} from "firebase/firestore";

// SHADCN & UI COMPONENTS
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { PageHeader } from "@/components/page-header"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { Skeleton } from "@/components/ui/skeleton"

/* ─────────────────────────────────────────────────────────
   HELPERS & COMPONENTS
───────────────────────────────────────────────────────── */

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

function StatPill({ label, count, isActive, onClick, loading, icon: Icon }: {
    label: string; count: string | number; isActive: boolean; onClick: () => void; loading?: boolean; icon?: any
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
            {Icon && <Icon className={cn("size-3.5", isActive ? "text-white/70" : "text-zinc-400")} />}
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

// --- MAIN PAGE COMPONENT ---
export default function BookingRulesPage() {
    const [userId, setUserId] = React.useState<string | null>(null)
    const [searchTerm, setSearchTerm] = React.useState("")
    const [isOpen, setIsOpen] = React.useState(false)
    const [rules, setRules] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [selectedRule, setSelectedRule] = React.useState<any>(null)
    const [activeTab, setActiveTab] = React.useState<string>("ALL")
    const [filterType, setFilterType] = React.useState<string | null>(null)
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
    const [showGuide, setShowGuide] = React.useState(false)
    const [isBatchProcessing, setIsBatchProcessing] = React.useState(false)
    const [currentPage, setCurrentPage] = React.useState(1)
    const [itemsPerPage, setItemsPerPage] = React.useState("10")
    const searchInputRef = React.useRef<HTMLInputElement>(null)

    // DERIVED STATE
    const filteredRules = rules.filter(r => {
        const matchesSearch = r.condition?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             r.assignedPIC?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesType = filterType === null ? true : r.type === filterType
        return matchesSearch && matchesType
    })

    const limit = parseInt(itemsPerPage)
    const totalPages = Math.ceil(filteredRules.length / limit)
    const paginatedRules = filteredRules.slice((currentPage - 1) * limit, currentPage * limit)

    // Real-time listener for booking rules
    React.useEffect(() => {
        setUserId(localStorage.getItem("userId"))
        const q = query(collection(db, "booking_rules"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const deleteRule = async (id: string) => {
        if (window.confirm("CRITICAL: Permanent deletion of assignment logic. Proceed?")) {
            await deleteDoc(doc(db, "booking_rules", id));
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return
        if (!window.confirm(`Delete ${selectedIds.size} rules permanently?`)) return
        
        setIsBatchProcessing(true)
        try {
            const batch = writeBatch(db)
            selectedIds.forEach(id => {
                batch.delete(doc(db, "booking_rules", id))
            })
            await batch.commit()
            setSelectedIds(new Set())
        } catch (error) {
            console.error("Batch delete error:", error)
        } finally {
            setIsBatchProcessing(false)
        }
    }

    const handleExport = React.useCallback(() => {
        if (filteredRules.length === 0) return
        const headers = ["ID", "Priority Type", "Condition", "Assigned PIC", "Created At"]
        const rows = filteredRules.map(r => [
            r.id,
            r.type || "team",
            r.condition || "",
            r.assignedPIC || "",
            r.createdAt?.toDate?.()?.toISOString() || r.createdAt || ""
        ])
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n")
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `Assignment_Logic_Export_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }, [rules, searchTerm, filterType])

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleAllOnPage = () => {
        if (selectedIds.size === paginatedRules.length && paginatedRules.length > 0) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(paginatedRules.map(r => r.id)))
        }
    }

    const handleReset = () => {
        setSearchTerm("")
        setFilterType(null)
        setActiveTab("ALL")
        setCurrentPage(1)
    }

    React.useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
                e.preventDefault()
                searchInputRef.current?.focus()
            }
            if (e.key === "Escape" && document.activeElement?.tagName === "INPUT") {
                setSearchTerm("")
                searchInputRef.current?.blur()
            }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [])

    return (
        <ProtectedPageWrapper>
            <SidebarProvider defaultOpen={false}>
                <AppSidebar userId={userId} />
                <SidebarInset className="bg-[#F8FAFA] pb-24 md:pb-10 min-h-screen m-0 rounded-none border-none shadow-none overflow-visible font-sans">
                    <PageHeader 
                        title="Admin / Assignment Logic" 
                        version="V2.0-LOGIC"
                        trigger={<SidebarTrigger className="mr-2" />}
                        actions={
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowGuide(true)}
                                    className="rounded-xl h-9 px-4 transition-all text-[11px] font-bold uppercase text-zinc-500 hover:bg-white border border-transparent hover:border-zinc-200"
                                >
                                    <HelpCircle size={15} className="mr-2" />
                                    <span className="hidden md:inline">System Guide</span>
                                </Button>

                                <Button
                                    onClick={() => { setSelectedRule(null); setIsOpen(true) }}
                                    className="h-10 px-4 rounded-2xl bg-zinc-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 flex items-center gap-2"
                                >
                                    <Plus className="size-3.5" />
                                    <span>New Assignment Rule</span>
                                </Button>
                            </div>
                        }
                    />

                    <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-4 md:space-y-6">
                        {/* Status Cards Section */}
                        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                            <DashboardCard
                                label="Total Logic"
                                value={loading ? "--" : rules.length}
                                icon={Zap}
                                colorClass="text-zinc-600 bg-zinc-50"
                                loading={loading}
                                isActive={activeTab === "ALL"}
                                onClick={() => { setActiveTab("ALL"); setFilterType(null); }}
                            />
                            <DashboardCard
                                label="Keyword Specialists"
                                value={loading ? "--" : rules.filter(r => r.type === "specialist").length}
                                icon={Sparkles}
                                colorClass="text-amber-600 bg-amber-50"
                                loading={loading}
                                isActive={activeTab === "SPECIALIST"}
                                onClick={() => { setActiveTab("SPECIALIST"); setFilterType("specialist"); }}
                            />
                            <DashboardCard
                                label="Team Mappings"
                                value={loading ? "--" : rules.filter(r => r.type === "team").length}
                                icon={LayoutGrid}
                                colorClass="text-blue-600 bg-blue-50"
                                loading={loading}
                                isActive={activeTab === "TEAM"}
                                onClick={() => { setActiveTab("TEAM"); setFilterType("team"); }}
                            />
                            <DashboardCard
                                label="Engine Status"
                                value={loading ? "Syncing..." : "Live"}
                                subValue="DSI-CLOUD"
                                icon={ShieldCheck}
                                colorClass={cn("transition-colors", loading ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50")}
                                loading={loading}
                            />
                        </section>

                        {/* Sticky Search & Filter Bar */}
                        <div className="sticky top-[56px] md:top-[64px] z-[45] flex flex-col xl:flex-row xl:items-center gap-3 bg-white/80 backdrop-blur-md p-2 rounded-[24px] border border-zinc-200/40 shadow-sm transition-all">
                            <div className="flex gap-1.5 overflow-x-auto pb-1 xl:pb-0 scrollbar-none flex-1">
                                <StatPill
                                    label="All Logic"
                                    count={rules.length}
                                    isActive={activeTab === "ALL"}
                                    onClick={() => { setActiveTab("ALL"); setFilterType(null); }}
                                    loading={loading}
                                    icon={Terminal}
                                />
                                <StatPill
                                    label="Specialists"
                                    count={rules.filter(r => r.type === "specialist").length}
                                    isActive={activeTab === "SPECIALIST"}
                                    onClick={() => { setActiveTab("SPECIALIST"); setFilterType("specialist"); }}
                                    loading={loading}
                                    icon={Sparkles}
                                />
                                <StatPill
                                    label="Team Mapping"
                                    count={rules.filter(r => r.type === "team").length}
                                    isActive={activeTab === "TEAM"}
                                    onClick={() => { setActiveTab("TEAM"); setFilterType("team"); }}
                                    loading={loading}
                                    icon={LayoutGrid}
                                />
                            </div>

                            <div className="flex flex-col md:flex-row gap-2 xl:min-w-[550px]">
                                <div className="relative flex-1 group">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-300 group-focus-within:text-zinc-800 transition-colors" />
                                    <input
                                        ref={searchInputRef}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder='Search condition or PIC...'
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
                                    <Button
                                        variant="outline"
                                        onClick={handleExport}
                                        className="h-10 px-3 rounded-xl bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                                        disabled={filteredRules.length === 0}
                                    >
                                        <FileDown className="size-3.5" />
                                        <span>Export</span>
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={handleReset}
                                        className="h-10 w-10 rounded-xl bg-white border-zinc-200 hover:bg-zinc-50 flex items-center justify-center p-0 flex-shrink-0 shadow-sm"
                                        title="Reset filters"
                                    >
                                        <RotateCcw className="size-3.5 text-zinc-400" />
                                    </Button>

                                    {selectedIds.size > 0 && (
                                        <Button
                                            onClick={handleBatchDelete}
                                            disabled={isBatchProcessing}
                                            className="h-10 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm shadow-rose-100 animate-in slide-in-from-right-4"
                                        >
                                            <X className="size-3.5" />
                                            <span>Delete ({selectedIds.size})</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── SYSTEM GUIDE DIALOG ── */}
                        <Dialog open={showGuide} onOpenChange={setShowGuide}>
                            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] border-none shadow-2xl p-0 bg-white scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent hover:scrollbar-thumb-zinc-300 transition-colors">
                                <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-10 px-8 py-6 border-b border-zinc-100 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-[20px] font-black text-zinc-900 tracking-tight">
                                            Assignment Logic Guide
                                        </h2>
                                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Rule Management & Routing</p>
                                    </div>
                                </div>

                                <div className="p-8 space-y-8">
                                    <section>
                                        <div className="mb-4">
                                            <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-wide">Logic Types</h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <GuideItem 
                                                icon={LayoutGrid} 
                                                title="Team Mapping" 
                                                description="Standard routing based on broad categories or teams. Used for general request distribution."
                                                colorClass="bg-blue-50 text-blue-600"
                                            />
                                            <GuideItem 
                                                icon={Sparkles} 
                                                title="Keyword Specialists" 
                                                description="Override logic that detects specific keywords to route requests to specialized engineers."
                                                colorClass="bg-amber-50 text-amber-600"
                                            />
                                        </div>
                                    </section>

                                    <section>
                                        <div className="mb-4">
                                            <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-wide">Efficiency Tools</h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <GuideItem 
                                                icon={Zap} 
                                                title="Real-time Sync" 
                                                description="All logic updates are instantly applied to the request routing engine system-wide."
                                                colorClass="bg-emerald-50 text-emerald-600"
                                            />
                                            <GuideItem 
                                                icon={CheckSquare} 
                                                title="Batch Management" 
                                                description="Select multiple rules to perform mass deletions or exports. Perfect for system audits."
                                                colorClass="bg-zinc-900 text-white"
                                            />
                                        </div>
                                    </section>

                                    <div className="bg-zinc-900 rounded-2xl p-6 text-white flex items-center justify-between gap-6 overflow-hidden relative">
                                        <div className="relative z-10">
                                            <h4 className="text-[15px] font-black mb-1">Pro Tip!</h4>
                                            <p className="text-[11px] font-medium text-zinc-400 leading-relaxed max-w-[300px]">
                                                Use the <Settings2 className="inline size-3 text-emerald-500" /> Settings button on any rule to update the assigned PIC or condition trigger.
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

                        {/* Rules Table */}
                        <div className="bg-white rounded-[28px] shadow-sm border border-zinc-200/60 overflow-hidden">
                            <div className="hidden md:grid grid-cols-12 bg-zinc-50/80 px-6 py-4 border-b border-zinc-100 gap-4 items-center">
                                <div className="col-span-1">
                                    <button
                                        onClick={toggleAllOnPage}
                                        className="size-9 flex items-center justify-center rounded-xl hover:bg-zinc-200/50 transition-colors"
                                    >
                                        {selectedIds.size === paginatedRules.length && paginatedRules.length > 0 ? (
                                            <CheckSquare className="size-4 text-zinc-900" />
                                        ) : (
                                            <Square className="size-4 text-zinc-300" />
                                        )}
                                    </button>
                                </div>
                                <div className="col-span-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Priority</div>
                                <div className="col-span-4 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Condition Name</div>
                                <div className="col-span-4 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Assigned PIC</div>
                                <div className="col-span-1 text-right text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Actions</div>
                            </div>

                            <div className="divide-y divide-zinc-50/80 min-h-[400px]">
                                {loading ? (
                                    Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="px-6 py-4 animate-pulse grid grid-cols-12 gap-4 items-center">
                                            <Skeleton className="col-span-1 size-5 rounded" />
                                            <Skeleton className="col-span-2 h-6 w-20 rounded-full" />
                                            <Skeleton className="col-span-4 h-4 w-40" />
                                            <Skeleton className="col-span-4 h-4 w-32" />
                                            <Skeleton className="col-span-1 h-4 w-12 ml-auto" />
                                        </div>
                                    ))
                                ) : paginatedRules.length > 0 ? (
                                    paginatedRules.map((rule) => {
                                        const isSelected = selectedIds.has(rule.id)
                                        return (
                                            <div key={rule.id} className={cn("grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-zinc-50/70 transition-colors group cursor-default", isSelected && "bg-zinc-50/50")}>
                                                <div className="col-span-1">
                                                    <button
                                                        onClick={() => toggleSelection(rule.id)}
                                                        className="size-9 flex items-center justify-center rounded-xl hover:bg-zinc-200/50 transition-colors"
                                                    >
                                                        {isSelected ? (
                                                            <CheckSquare className="size-4 text-blue-600" />
                                                        ) : (
                                                            <Square className="size-4 text-zinc-300 group-hover:text-zinc-400" />
                                                        )}
                                                    </button>
                                                </div>

                                                <div className="col-span-2">
                                                    <Badge className={cn(
                                                        "rounded-full text-[8px] font-black uppercase px-2.5 py-0.5 border shadow-sm",
                                                        rule.type === 'specialist' 
                                                            ? "bg-amber-50 text-amber-600 border-amber-100" 
                                                            : "bg-blue-50 text-blue-600 border-blue-100"
                                                    )}>
                                                        {rule.type || 'team'}
                                                    </Badge>
                                                </div>

                                                <div className="col-span-4 flex items-center gap-3 min-w-0">
                                                    <div className="p-2 bg-zinc-100 rounded-xl text-zinc-500 group-hover:bg-white group-hover:text-zinc-900 transition-colors border border-transparent group-hover:border-zinc-200">
                                                        <Terminal className="size-3.5" />
                                                    </div>
                                                    <p className="text-[12px] font-black uppercase text-zinc-900 truncate tracking-tight">{rule.condition}</p>
                                                </div>

                                                <div className="col-span-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-1.5 rounded-full bg-emerald-500" />
                                                        <p className="text-[11px] font-bold text-zinc-600 truncate uppercase tracking-tight">
                                                            {rule.assignedPIC}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="col-span-1 flex justify-end">
                                                    <Button
                                                        onClick={() => {
                                                            setSelectedRule(rule)
                                                            setIsOpen(true)
                                                        }}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-9 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-white border border-transparent hover:border-zinc-200 transition-all active:scale-95"
                                                    >
                                                        <Settings2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                                        <div className="p-4 bg-zinc-50 rounded-3xl mb-4 border border-zinc-100">
                                            <Search className="size-8 opacity-20" />
                                        </div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em]">No logic rules found</p>
                                        <Button variant="ghost" onClick={handleReset} className="mt-2 text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50">Clear search filters</Button>
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Show</span>
                                    <Select value={itemsPerPage} onValueChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}>
                                        <SelectTrigger className="h-8 w-[70px] rounded-lg bg-white border-zinc-200 text-[10px] font-black shadow-sm focus:ring-zinc-900">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-zinc-200">
                                            <SelectItem value="10" className="text-[10px] font-bold">10</SelectItem>
                                            <SelectItem value="25" className="text-[10px] font-bold">25</SelectItem>
                                            <SelectItem value="50" className="text-[10px] font-bold">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">per page</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mr-4">
                                        Page {currentPage} of {totalPages || 1}
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(p => p - 1)}
                                        className="size-8 rounded-lg border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 active:scale-95 disabled:opacity-30"
                                    >
                                        <ChevronLeft className="size-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        onClick={() => setCurrentPage(p => p + 1)}
                                        className="size-8 rounded-lg border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 active:scale-95 disabled:opacity-30"
                                    >
                                        <ChevronRight className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </main>

                    {/* MODAL INTEGRATION */}
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogContent className="max-w-[480px] p-0 overflow-hidden border-none rounded-[32px] shadow-2xl bg-white animate-in zoom-in-95 duration-200">
                            <RuleModalContent setIsOpen={setIsOpen} initialData={selectedRule} onDelete={deleteRule} />
                        </DialogContent>
                    </Dialog>
                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    )
}

// --- MODAL COMPONENT ---
function RuleModalContent({ setIsOpen, initialData, onDelete }: any) {
    const [type, setType] = React.useState("team")
    const [condition, setCondition] = React.useState("")
    const [assignedPIC, setAssignedPIC] = React.useState("")
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [staff, setStaff] = React.useState<any[]>([])

    // Fetch Staff List for the dropdown — one-time read, admin-only
    React.useEffect(() => {
      const fetchStaff = async () => {
        try {
          const { getDocs } = await import("firebase/firestore");
          const q = query(collection(db, "staff"), orderBy("Firstname", "asc"));
          const snapshot = await getDocs(q);
          setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (e) { console.error("Staff fetch error:", e); }
      };
      fetchStaff();
    }, []);

    React.useEffect(() => {
      if (initialData) {
        setType(initialData.type || "team");
        setCondition(initialData.condition || "");
        setAssignedPIC(initialData.assignedPIC || "");
      } else {
        setType("team");
        setCondition("");
        setAssignedPIC("");
      }
    }, [initialData]);

    const handleCommit = async () => {
      if (!condition || !assignedPIC) return;
      setIsSubmitting(true);
      try {
        const payload = { 
            type, 
            condition: condition.toUpperCase(), 
            assignedPIC, 
            updatedAt: serverTimestamp() 
        };
        if (initialData) {
          await updateDoc(doc(db, "booking_rules", initialData.id), payload);
        } else {
          await addDoc(collection(db, "booking_rules"), { 
              ...payload, 
              createdAt: serverTimestamp() 
          });
        }
        setIsOpen(false);
      } catch (e) { 
        console.error(e); 
      } finally { 
        setIsSubmitting(false); 
      }
    }

    return (
        <div className="flex flex-col">
            <div className="bg-zinc-50/80 border-b border-zinc-100 p-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 rounded-2xl bg-zinc-900 text-white shadow-lg shadow-zinc-200">
                        <Zap className="size-5" />
                    </div>
                    <div>
                        <h2 className="text-[20px] font-black text-zinc-900 tracking-tight uppercase">
                            {initialData ? "Edit Assignment Logic" : "New Routing Rule"}
                        </h2>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Engine Configuration</p>
                    </div>
                </div>
            </div>
            
            <div className="p-8 space-y-6">
                <div className="grid gap-2.5">
                    <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Logic Priority Type</Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger className="h-12 rounded-2xl border-zinc-200 bg-white text-[12px] font-black uppercase tracking-tight focus:ring-2 focus:ring-zinc-900 transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-zinc-200">
                        <SelectItem value="team" className="text-[11px] font-bold uppercase py-2.5">Standard Team Mapping</SelectItem>
                        <SelectItem value="specialist" className="text-[11px] font-bold uppercase py-2.5">Keyword Specialist Override</SelectItem>
                      </SelectContent>
                    </Select>
                </div>
                
                <div className="grid gap-2.5">
                    <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Condition / Trigger Name</Label>
                    <div className="relative group">
                        <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" />
                        <Input 
                            value={condition} 
                            onChange={(e) => setCondition(e.target.value)} 
                            placeholder="E.G. TEAM CHI OR DIALUX" 
                            className="h-12 pl-11 rounded-2xl border-zinc-200 bg-white text-[12px] font-black uppercase tracking-tight focus-visible:ring-2 focus-visible:ring-zinc-900 transition-all" 
                        />
                    </div>
                </div>

                <div className="grid gap-2.5">
                    <Label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Assigned PIC (Lead Engineer)</Label>
                    <Select value={assignedPIC} onValueChange={setAssignedPIC}>
                      <SelectTrigger className="h-12 rounded-2xl border-zinc-200 bg-white text-[12px] font-black uppercase tracking-tight focus:ring-2 focus:ring-zinc-900 transition-all">
                        <div className="flex items-center gap-2">
                            <MousePointer2 className="size-3.5 text-zinc-300" />
                            <SelectValue placeholder="Select engineer..." />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-zinc-200 max-h-[240px]">
                        {staff.length === 0 ? (
                          <div className="p-4 text-center text-[10px] uppercase font-bold opacity-30">No_Staff_Found</div>
                        ) : staff.map((member) => (
                          <SelectItem 
                            key={member.id} 
                            value={`${member.Firstname} ${member.Lastname}`}
                            className="text-[11px] font-bold uppercase py-2.5"
                          >
                            {member.Firstname} {member.Lastname}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                </div>

                {initialData && (
                    <div className="pt-4 border-t border-zinc-50">
                        <Button 
                            variant="ghost" 
                            className="w-full h-12 rounded-2xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 text-[10px] font-black uppercase tracking-widest transition-all gap-2"
                            onClick={() => { onDelete(initialData.id); setIsOpen(false); }}
                        >
                            <AlertCircle className="size-4" />
                            Permanently Delete Rule
                        </Button>
                    </div>
                )}
            </div>

            <div className="p-8 pt-0 flex gap-3">
                <Button 
                    variant="outline" 
                    className="flex-1 h-12 rounded-2xl border-zinc-200 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 text-[11px] font-black uppercase tracking-widest transition-all" 
                    onClick={() => setIsOpen(false)}
                >
                    Cancel
                </Button>
                <Button 
                    disabled={isSubmitting || !condition || !assignedPIC} 
                    onClick={handleCommit} 
                    className="flex-1 h-12 rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800 text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-zinc-200 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {initialData ? "Update Logic" : "Commit Logic"}
                </Button>
            </div>
        </div>
    )
}
