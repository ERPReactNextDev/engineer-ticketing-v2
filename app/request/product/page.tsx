"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import {
  Search, RotateCcw, ArrowRight, Clock,
  Package, CheckCircle2, LayoutGrid, Calendar,
  XCircle, AlertTriangle, ShieldCheck,
  ChevronLeft, ChevronRight, ArrowUpDown,
  ArrowUp, ArrowDown, TrendingUp, DollarSign,
  Activity, FileDown, Clock3, Globe, Copy, Check,
  HelpCircle, Lightbulb, MousePointer2, Sparkles,
  Info, Zap, BarChart2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { supabase } from "@/utils/supabase"
import { PageHeader } from "@/components/page-header"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
interface SPFCreation {
  id: string
  spf_number: string
  referenceid?: string
  tsm?: string
  status: string
  date_created: string
  date_updated?: string
  final_selling_cost?: string
  proj_lead_time?: string
  product_offer_unit_cost?: string
  final_unit_cost?: string
  product_offer_qty?: string
  product_offer_image?: string
  // Added fields
  clientName?: string
  totalSellingValue?: number
  expectedMargin?: number
  isAging?: boolean
  filledItems?: number
  totalItems?: number
  firstImage?: string
}

type SortField = "date_created" | "date_updated" | "spf_number"
type SortDir   = "asc" | "desc"

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const PAGE_SIZE = 10

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  PROCUREMENT: {
    label: "Pending For Procurement",
    color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400",
  },
  "PROCESSING BY PD": {
    label: "Processing By PD",
    color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500",
  },
  "APPROVED BY PROCUREMENT": {
    label: "Approved By Procurement",
    color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rejected",
    color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500",
  },
}

const FILTERS = [
  { key: null,                      label: "All",                     icon: LayoutGrid,  variant: "default" },
  { key: "NEEDS_COSTING",           label: "Needs Costing",           icon: AlertTriangle, variant: "warning" },
  { key: "PROCUREMENT",             label: "Pending",                 icon: Clock,       variant: "warning" },
  { key: "APPROVED BY PROCUREMENT", label: "Approved",                icon: CheckCircle2,variant: "emerald" },
  { key: "REJECTED",                label: "Rejected",                icon: XCircle,     variant: "rose"    },
]

/* ─────────────────────────────────────────────
   HELPERS
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

function getStatusMeta(status: string) {
  const s = (status || "").toUpperCase().trim()
  if (s.includes("APPROVED BY PROCUREMENT") || s.includes("APPROVED")) return STATUS_META["APPROVED BY PROCUREMENT"]
  if (s.includes("REJECTED"))    return STATUS_META["REJECTED"]
  if (s.includes("PROCESSING BY PD")) return STATUS_META["PROCESSING BY PD"]
  if (s.includes("PROCUREMENT")) return STATUS_META["PROCUREMENT"]
  return { label: status || "Pending For Procurement", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400" }
}

function isCostingFilled(r: SPFCreation) {
  if (!r.final_selling_cost) return false
  return !r.final_selling_cost.split("|ROW|").some(row =>
    row.split(",").some(v => !v || v.trim() === "-")
  )
}

function isPendingStatus(status: string) {
  const s = (status || "").toUpperCase().trim()
  return s === "PENDING FOR PROCUREMENT" || (s.includes("PROCUREMENT") && !s.includes("APPROVED"))
}

function relativeTime(dateStr?: string): string {
  if (!dateStr) return "—"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return "Just now"
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function formatPHP(val: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0
  }).format(val)
}

function parseValue(valStr?: string) {
  if (!valStr) return 0
  return valStr.split("|ROW|").reduce((sum, row) => {
    return sum + row.split(",").reduce((rowSum, val) => {
      const v = val.trim()
      if (!v || v === "-") return rowSum
      return rowSum + (parseFloat(v) || 0)
    }, 0)
  }, 0)
}

function parseTotalValue(costStr?: string, qtyStr?: string) {
  if (!costStr) return 0
  const rows = costStr.split("|ROW|")
  const qRows = (qtyStr || "").split("|ROW|")
  
  return rows.reduce((sum, row, rIdx) => {
    const costs = row.split(",")
    const qtys = qRows[rIdx]?.split(",") || []
    
    return sum + costs.reduce((rowSum, cost, pIdx) => {
      const c = parseFloat(cost.trim()) || 0
      const q = parseFloat(qtys[pIdx]?.trim()) || 0
      return rowSum + (c * q)
    }, 0)
  }, 0)
}

/* ─────────────────────────────────────────────
   DASHBOARD CARD
───────────────────────────────────────────── */
function DashboardCard({ label, value, subValue, icon: Icon, colorClass, loading }: {
  label: string; value: string; subValue?: string; icon: any; colorClass: string; loading?: boolean
}) {
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

/* ─────────────────────────────────────────────
   SKELETON ROW
───────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <div className="px-6 py-4 animate-pulse">
      {/* Desktop */}
      <div className="hidden md:grid grid-cols-[44px_1.6fr_1.2fr_0.7fr_1.4fr_1fr_44px] gap-4 items-center">
        <div className="size-9 rounded-xl bg-zinc-100" />
        <div className="space-y-2">
          <div className="h-3 w-28 bg-zinc-100 rounded-full" />
          <div className="h-2 w-20 bg-zinc-100 rounded-full" />
        </div>
        <div className="h-3 w-24 bg-zinc-100 rounded-full" />
        <div className="h-3 w-14 bg-zinc-100 rounded-full" />
        <div className="h-5 w-36 bg-zinc-100 rounded-full" />
        <div className="h-3 w-20 bg-zinc-100 rounded-full" />
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
        <div className="flex items-center gap-2 pl-[52px]">
          <div className="h-5 w-14 bg-zinc-100 rounded-lg" />
          <div className="h-3 w-16 bg-zinc-100 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   STAT PILL
───────────────────────────────────────────── */
function StatPill({ label, count, variant, isActive, onClick, loading }: {
  label: string; count: string; variant: string
  isActive: boolean; onClick: () => void; loading?: boolean
}) {
  const colors: Record<string, string> = {
    default: "text-zinc-500",
    warning: "text-amber-600",
    emerald: "text-emerald-600",
    rose:    "text-rose-600",
  }
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

/* ─────────────────────────────────────────────
   SORT HEADER BUTTON
───────────────────────────────────────────── */
function SortButton({ label, field, currentField, dir, onSort }: {
  label: string; field: SortField; currentField: SortField; dir: SortDir
  onSort: (f: SortField) => void
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

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function ProcurementListPage() {
  const router = useRouter()

  const [userId, setUserId]           = React.useState<string | null>(null)
  const [userRole, setUserRole]       = React.useState<string | null>(null)
  const [userRefId, setUserRefId]     = React.useState<string | null>(null)
  const [userDepartment, setUserDept] = React.useState<string | null>(null)
  const [requests, setRequests]       = React.useState<SPFCreation[]>([])
  const [staffNames, setStaffNames]   = React.useState<Record<string, string>>({})
  const [isLoading, setIsLoading]     = React.useState(true)
  const [filterStatus, setFilter]     = React.useState<string | null>(null)
  const [searchTerm, setSearch]       = React.useState("")
  const [page, setPage]               = React.useState(1)
  const [sortField, setSortField]     = React.useState<SortField>("date_created")
  const [sortDir, setSortDir]         = React.useState<SortDir>("desc")
  const [showGuide, setShowGuide]     = React.useState(false)

  // Added States
  const [exchangeRate, setExchangeRate] = React.useState<string>("60.00")
  const [rateLoading, setRateLoading]   = React.useState(false)

  const searchRef = React.useRef<HTMLInputElement>(null)

  /* ── FETCH ── */
  const fetchRequests = React.useCallback(async (dept?: string | null) => {
    setIsLoading(true)
    try {
      const department = dept ?? userDepartment
      const deptUpper = (department || "").toUpperCase()
      const isIT = deptUpper === "IT"
      const isProcurement = deptUpper === "PROCUREMENT"
      const hasFullAccess = isIT || isProcurement

      let query = supabase
        .from("spf_creation")
        .select(`
          id, spf_number, referenceid, tsm, status, date_created, date_updated, 
          final_selling_cost, proj_lead_time,
          product_offer_unit_cost, final_unit_cost, product_offer_qty,
          product_offer_image
        `)
        .order("date_created", { ascending: false })

      // IF IT or PROCUREMENT: Show all records
      // IF Others: Show only Pending and Approved for Procurement
      if (!hasFullAccess) {
        query = query.or("status.eq.Pending For Procurement,status.eq.Approved By Procurement")
      }

      const { data: creations, error } = await query as { data: SPFCreation[] | null, error: any }
      if (error) throw error
      
      if (!creations) {
        setRequests([])
        return
      }

      // Fetch Client Names from spf_request
      const spfNumbers = creations.map((c: SPFCreation) => c.spf_number)
      const { data: requestsData } = await supabase
        .from("spf_request")
        .select("spf_number, clientName")
        .in("spf_number", spfNumbers)

      const clientMap: Record<string, string> = {}
      requestsData?.forEach((r: any) => {
        if (r.spf_number) clientMap[r.spf_number] = r.clientName || "Unknown Client"
      })

      const enhanced = creations.map((c: SPFCreation) => {
        const totalSellingValue = parseTotalValue(c.final_selling_cost, c.product_offer_qty)
        const totalCostValue = parseTotalValue(c.final_unit_cost || c.product_offer_unit_cost, c.product_offer_qty)
        
        // Count filled items
        const rowData = (c.final_selling_cost || "").split("|ROW|")
        let totalItems = 0
        let filledItems = 0
        rowData.forEach((row: string) => {
          const cells = row.split(",")
          totalItems += cells.length
          filledItems += cells.filter((v: string) => v && v.trim() !== "-").length
        })

        // First image
        const firstImg = (c.product_offer_image || "").split("|ROW|")[0]?.split(",")[0]?.trim() || ""

        // Calculate margin
        let margin = 0
        if (totalSellingValue > 0) {
          margin = ((totalSellingValue - totalCostValue) / totalSellingValue) * 100
        }

        // Aging check (more than 3 days)
        const daysOld = Math.floor((Date.now() - new Date(c.date_created).getTime()) / 86400000)
        const isAging = daysOld >= 3 && isPendingStatus(c.status)

        return {
          ...c,
          clientName: clientMap[c.spf_number] || "Unknown Client",
          totalSellingValue,
          expectedMargin: margin,
          isAging,
          totalItems,
          filledItems,
          firstImage: firstImg
        }
      })

      setRequests(enhanced)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [userDepartment])

  /* ── FETCH RATE ── */
  const fetchRate = async () => {
    setRateLoading(true)
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD")
      const data = await res.json()
      if (data?.rates?.PHP) setExchangeRate(data.rates.PHP.toFixed(2))
    } catch (e) {
      console.error("Exchange rate error:", e)
    } finally {
      setRateLoading(false)
    }
  }

  /* ── INIT ── */
  React.useEffect(() => {
    const uid  = localStorage.getItem("userId")
    const dept = localStorage.getItem("userDepartment")
    const role = localStorage.getItem("userRole")
    setUserId(uid)
    setUserDept(dept)
    setUserRole(role)
    fetchRate()

    const fetchCurrentUserInfo = async () => {
      if (!uid) return
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(uid)}`)
        const mongoData = await res.json()
        const refId = mongoData.ReferenceID || ""
        setUserRefId(refId)
        fetchRequests(dept)
      } catch (e) {
        console.error("Error fetching user info:", e)
        fetchRequests(dept)
      }
    }
    fetchCurrentUserInfo()

    const fetchStaff = async () => {
      try {
        const res = await fetch('/api/user')
        const allUsers = await res.json()
        const mapping: Record<string, string> = {}
        allUsers.forEach((u: any) => {
          if (u.ReferenceID) {
            mapping[u.ReferenceID] = `${u.Firstname || ""} ${u.Lastname || ""}`.trim()
          }
        })
        setStaffNames(mapping)
      } catch (e) { console.error(e) }
    }
    fetchStaff()

    const ch = supabase
      .channel("spf_creation_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "spf_creation" }, () => fetchRequests(dept))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchRequests])

  /* ── KEYBOARD: Escape clears search, "/" focuses search ── */
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSearch(""); searchRef.current?.blur() }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  /* ── RESET page on filter/search change ── */
  React.useEffect(() => { setPage(1) }, [filterStatus, searchTerm, sortField, sortDir])

  /* ── DERIVED ── */
  const isIT = (userDepartment || "").toUpperCase() === "IT"
  const isProcurement = (userDepartment || "").toUpperCase() === "PROCUREMENT"
  const hasFullAccess = isIT || isProcurement

  const filtered = React.useMemo(() => {
    let list = requests.filter(r => {
      const s = `${r.spf_number} ${r.clientName} ${r.referenceid || ""} ${r.tsm || ""}`.toLowerCase()
      const matchSearch = s.includes(searchTerm.toLowerCase())
      const matchStatus = (() => {
        if (filterStatus === null) return true
        if (filterStatus === "NEEDS_COSTING") return isPendingStatus(r.status) && (r.filledItems || 0) < (r.totalItems || 0)
        const st = (r.status || "").toUpperCase().trim()
        if (filterStatus === "PROCUREMENT")             return isPendingStatus(r.status)
        if (filterStatus === "APPROVED BY PROCUREMENT") return st.includes("APPROVED")
        return st.includes(filterStatus)
      })()
      return matchSearch && matchStatus
    })

    // Sort
    list = [...list].sort((a, b) => {
      let va = "", vb = ""
      if (sortField === "spf_number") { va = a.spf_number; vb = b.spf_number }
      else if (sortField === "date_updated") { va = a.date_updated || ""; vb = b.date_updated || "" }
      else { va = a.date_created; vb = b.date_created }
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va)
    })

    return list
  }, [requests, searchTerm, filterStatus, sortField, sortDir])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const countFor = (key: string | null) => {
    if (key === null) return requests.length
    return requests.filter(r => {
      if (key === "NEEDS_COSTING") return isPendingStatus(r.status) && (r.filledItems || 0) < (r.totalItems || 0)
      const s = (r.status || "").toUpperCase().trim()
      if (key === "PROCUREMENT")             return isPendingStatus(r.status)
      if (key === "APPROVED BY PROCUREMENT") return s.includes("APPROVED")
      return s.includes(key)
    }).length
  }

  const pendingCosting = requests.filter(r => isPendingStatus(r.status) && !isCostingFilled(r)).length

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("desc") }
  }

  const handleReset = () => {
    setFilter(null)
    setSearch("")
    setPage(1)
    setSortField("date_created")
    setSortDir("desc")
    fetchRequests(userDepartment)
  }

  const handleExport = () => {
    if (filtered.length === 0) return
    const headers = ["SPF#", "Client", "Reference ID", "TSM", "Status", "Date Created", "Selling Value", "Expected Margin"]
    const rows = filtered.map(r => [
      r.spf_number,
      r.clientName,
      staffNames[r.referenceid || ""] || r.referenceid || "-",
      staffNames[r.tsm || ""] || r.tsm || "-",
      r.status,
      new Date(r.date_created).toLocaleDateString(),
      r.totalSellingValue || 0,
      `${(r.expectedMargin || 0).toFixed(1)}%`
    ])
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `SPF_Procurement_List_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  /* ── CALCULATE DASHBOARD STATS ── */
  const stats = React.useMemo(() => {
    const pendingRequests = requests.filter(r => isPendingStatus(r.status))
    const totalPendingValue = pendingRequests.reduce((sum, r) => sum + (r.totalSellingValue || 0), 0)
    const agingCount = pendingRequests.filter(r => r.isAging).length
    
    const approvedRequests = requests.filter(r => r.status.toUpperCase().includes("APPROVED"))
    const avgMargin = approvedRequests.length > 0
      ? approvedRequests.reduce((sum, r) => sum + (r.expectedMargin || 0), 0) / approvedRequests.length
      : 0

    return {
      totalPendingValue,
      agingCount,
      avgMargin
    }
  }, [requests])

  /* ── EMPTY STATE MESSAGE ── */
  const emptyMessage = () => {
    if (searchTerm) return `No results for "${searchTerm}"`
    if (filterStatus === "PROCUREMENT")             return "No pending records right now"
    if (filterStatus === "APPROVED BY PROCUREMENT") return "No approved records yet"
    if (filterStatus === "REJECTED")                return "No rejected records"
    return "No records found"
  }

  return (
    <ProtectedPageWrapper>
      <SidebarProvider defaultOpen={false} className="overflow-visible">
        <AppSidebar userId={userId} />
        <SidebarInset className="bg-[#F8FAFA] pb-24 md:pb-10 min-h-screen m-0 rounded-none border-none shadow-none overflow-visible">
          <PageHeader
            title="SPF PROCUREMENT"
            version="V1.1"
            showBackButton
            trigger={<SidebarTrigger className="mr-2" />}
            actions={
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1">
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Dept:</span>
                  <span className="text-[10px] font-black text-zinc-900 uppercase">{userDepartment || "—"}</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReset} 
                  disabled={isLoading}
                  className="h-8 rounded-lg bg-white border-zinc-200 text-zinc-600 font-bold text-[10px] uppercase tracking-wider"
                >
                  <RotateCcw className={cn("size-3 mr-1.5", isLoading && "animate-spin")} />
                  Reset Sync
                </Button>
              </div>
            }
          />

          <main className="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4">

            {/* ── FULL ACCESS BANNER (IT or PROCUREMENT) ── */}
            {!isLoading && hasFullAccess && (
              <div className="flex items-center gap-2 md:gap-3 bg-blue-50 border border-blue-200 rounded-xl md:rounded-2xl px-3 md:px-4 py-2 md:py-3">
                <ShieldCheck className="size-3.5 md:size-4 text-blue-500 flex-shrink-0" />
                <p className="text-[10px] md:text-[11px] font-black text-blue-700">
                  {isIT ? "IT Access" : "Procurement Access"} — viewing all records across all statuses.
                </p>
              </div>
            )}

            {/* ── NEEDS COSTING BANNER ── */}
            {!isLoading && !isIT && pendingCosting > 0 && (
              <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl md:rounded-2xl px-3 md:px-4 py-2 md:py-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-3.5 md:size-4 text-amber-500 flex-shrink-0" />
                  <p className="text-[10px] md:text-[11px] font-black text-amber-700">
                    {pendingCosting} record{pendingCosting > 1 ? "s" : ""} still need costing filled in.
                  </p>
                </div>
                <button
                  onClick={() => { setFilter("PROCUREMENT"); setPage(1) }}
                  className="text-[9px] md:text-[10px] font-black text-amber-700 underline underline-offset-2 flex-shrink-0"
                >
                  View →
                </button>
              </div>
            )}

            {/* ── DASHBOARD CARDS ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <DashboardCard
                label="Exchange Rate"
                value={`₱${exchangeRate}`}
                subValue="USD/PHP"
                icon={Globe}
                colorClass="text-blue-600 bg-blue-50"
                loading={rateLoading || isLoading}
              />
              <DashboardCard
                label="Pending Value"
                value={formatPHP(stats.totalPendingValue)}
                subValue={`${countFor("PROCUREMENT")} reqs`}
                icon={DollarSign}
                colorClass="text-emerald-600 bg-emerald-50"
                loading={isLoading}
              />
              <DashboardCard
                label="Avg Margin"
                value={`${stats.avgMargin.toFixed(1)}%`}
                subValue="Approved"
                icon={TrendingUp}
                colorClass="text-violet-600 bg-violet-50"
                loading={isLoading}
              />
              <DashboardCard
                label="Aging Requests"
                value={String(stats.agingCount)}
                subValue="3+ days"
                icon={Clock3}
                colorClass="text-rose-600 bg-rose-50"
                loading={isLoading}
              />
            </div>

            {/* ── ACTIONS BAR ── */}
            <div className="sticky top-[56px] md:top-[64px] z-[45] flex flex-col xl:flex-row xl:items-center gap-3 bg-white/80 backdrop-blur-md p-2 rounded-[24px] border border-zinc-200/40 shadow-sm transition-all">
              {/* Stat Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 xl:pb-0 scrollbar-none flex-1">
                {FILTERS.map(f => (
                  <StatPill
                    key={String(f.key)}
                    label={f.label}
                    count={String(countFor(f.key))}
                    variant={f.variant}
                    isActive={filterStatus === f.key}
                    onClick={() => setFilter(f.key)}
                    loading={isLoading}
                  />
                ))}
              </div>

              <div className="flex flex-col md:flex-row gap-2 xl:min-w-[450px]">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-300 group-focus-within:text-zinc-800 transition-colors" />
                  <input
                    ref={searchRef}
                    placeholder='Search SPF#, Client...'
                    value={searchTerm}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-9 h-10 rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 outline-none focus:ring-2 focus:ring-zinc-900 transition-all text-xs font-bold"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-600 transition-colors"
                    >
                      <XCircle className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowGuide(true)}
                    className="h-10 px-3 rounded-xl bg-blue-50 border-blue-100 hover:bg-blue-100 text-blue-600 font-black text-[10px] uppercase tracking-wider transition-all"
                  >
                    User Guide
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="h-10 w-10 rounded-xl bg-white border-zinc-200 hover:bg-zinc-50 flex items-center justify-center p-0 flex-shrink-0"
                    title="Reset all filters"
                  >
                    <RotateCcw className="size-3.5 text-zinc-400" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExport}
                    className="h-10 rounded-xl bg-white border-zinc-200 hover:bg-zinc-50 flex items-center gap-2 px-4 text-zinc-600 font-bold text-xs flex-1 md:flex-none"
                    disabled={filtered.length === 0}
                  >
                    <FileDown className="size-3.5" />
                    <span>Export</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* ── USER GUIDE DIALOG ── */}
            <Dialog open={showGuide} onOpenChange={setShowGuide}>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] border-none shadow-2xl p-0 bg-white scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent hover:scrollbar-thumb-zinc-300 transition-colors">
                <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-10 px-8 py-6 border-b border-zinc-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-[20px] font-black text-zinc-900 tracking-tight">
                      Procurement Portal Guide
                    </h2>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Costing & Workflow Management</p>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  {/* Dashboard Section */}
                  <section>
                    <div className="mb-4">
                      <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-wide">Real-time Insights</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <GuideItem 
                        icon={Globe} 
                        title="Live Exchange Rate" 
                        description="Automatically fetches the latest USD/PHP rate every minute. Use this as your primary reference for costing SPF China requests."
                        colorClass="bg-blue-50 text-blue-600"
                      />
                      <GuideItem 
                        icon={DollarSign} 
                        title="Pending Pipeline" 
                        description="Tracks the total PHP value of all unpriced items. This helps you understand the current financial volume awaiting your review."
                        colorClass="bg-emerald-50 text-emerald-600"
                      />
                    </div>
                  </section>

                  {/* Efficiency Section */}
                  <section>
                    <div className="mb-4">
                      <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-wide">Efficiency Tools</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <GuideItem 
                        icon={AlertTriangle} 
                        title="Smart Filters" 
                        description="Use the 'Needs Costing' filter to instantly isolate requests that aren't 100% priced. No more hunting through the list."
                        colorClass="bg-amber-50 text-amber-600"
                      />
                      <GuideItem 
                        icon={Clock3} 
                        title="Aging Alerts" 
                        description="Requests older than 3 days get a red 'Aging' badge. Prioritize these to keep project lead times within targets."
                        colorClass="bg-rose-50 text-rose-600"
                      />
                    </div>
                  </section>

                  {/* Navigation Section */}
                  <section>
                    <div className="mb-4">
                      <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-wide">Navigation & Actions</h3>
                    </div>
                    <div className="space-y-3">
                      <GuideItem 
                        icon={Copy} 
                        title="Quick Copy SPF#" 
                        description="Click the copy icon next to any SPF number to instantly copy it. Useful for searching in emails or internal chats."
                        colorClass="bg-zinc-100 text-zinc-600"
                      />
                      <GuideItem 
                        icon={Activity} 
                        title="Costing Progress" 
                        description="Watch the progress bar fill up as you add prices. A green bar means all items in that project are successfully costed."
                        colorClass="bg-blue-50 text-blue-600"
                      />
                      <GuideItem 
                        icon={FileDown} 
                        title="Data Export" 
                        description="Download your currently filtered view as a CSV file for offline reporting or detailed margin analysis in Excel."
                        colorClass="bg-violet-50 text-violet-600"
                      />
                    </div>
                  </section>

                  <div className="bg-zinc-900 rounded-2xl p-6 text-white flex items-center justify-between gap-6 overflow-hidden relative">
                    <div className="relative z-10">
                      <h4 className="text-[15px] font-black mb-1">Pro Tip!</h4>
                      <p className="text-[11px] font-medium text-zinc-400 leading-relaxed max-w-[300px]">
                        The generic package icon is replaced with the first product image from the request. Use it to recognize projects visually!
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
                    Got it, thanks!
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── TABLE ── */}
            <div className="bg-white rounded-[28px] shadow-sm border border-zinc-200/60 overflow-hidden">

              {/* Desktop column headers with sort */}
              <div className="hidden md:grid grid-cols-[44px_2fr_1.4fr_1fr_1.2fr_1.2fr_1fr_44px] bg-zinc-50/80 px-6 py-4 border-b gap-4 items-center">
                <span />
                <SortButton label="SPF# / Client"   field="spf_number"   currentField={sortField} dir={sortDir} onSort={handleSort} />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Reference / TSM</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Value / Margin</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Status</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Progress</span>
                <SortButton label="Last Updated"   field="date_updated" currentField={sortField} dir={sortDir} onSort={handleSort} />
                <span />
              </div>

              <div className="divide-y divide-zinc-50/80">
                {isLoading ? (
                  /* ── SKELETON ── */
                  Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))
                ) : paginated.length === 0 ? (
                  /* ── EMPTY STATE ── */
                  <div className="py-24 flex flex-col items-center gap-3">
                    <div className="size-16 rounded-3xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                      <Package className="size-7 text-zinc-200" />
                    </div>
                    <p className="text-[11px] font-black uppercase text-zinc-300 tracking-widest text-center px-4">
                      {emptyMessage()}
                    </p>
                    {(searchTerm || filterStatus) && (
                      <button
                        onClick={handleReset}
                        className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1 hover:text-blue-700 transition-colors"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                ) : (
                  paginated.map(r => {
                    const meta    = getStatusMeta(r.status)
                    const filled  = isCostingFilled(r)
                    const pending = isPendingStatus(r.status)
                    const progress = r.totalItems && r.totalItems > 0 ? (r.filledItems || 0) / r.totalItems : 0

                    return (
                      <div
                        key={r.id}
                        className="group cursor-pointer hover:bg-zinc-50/80 active:bg-zinc-100/60 transition-colors"
                      >
                        {/* ── DESKTOP ROW ── */}
                        <div className="hidden md:grid grid-cols-[44px_2fr_1.4fr_1fr_1.2fr_1.2fr_1fr_44px] px-6 py-3.5 items-center gap-4">
                          <div 
                            className="size-9 rounded-xl border border-zinc-100 flex items-center justify-center group-hover:bg-zinc-900 group-hover:border-zinc-900 transition-all overflow-hidden bg-zinc-50"
                            onClick={() => router.push(`/request/product/${r.id}`)}
                          >
                            {r.firstImage ? (
                              <img src={r.firstImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="product" />
                            ) : (
                              <Package size={14} className="text-zinc-300 group-hover:text-white transition-colors" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[12px] font-mono font-black text-zinc-900 leading-none">{r.spf_number}</p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigator.clipboard.writeText(r.spf_number)
                                  toast.success(`Copied: ${r.spf_number}`)
                                }}
                                className="p-1 hover:bg-zinc-100 rounded-md text-zinc-300 hover:text-zinc-600 transition-colors"
                              >
                                <Copy size={10} />
                              </button>
                              {r.isAging && (
                                <span className="text-[7px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-lg uppercase tracking-wide flex items-center gap-1">
                                  <Clock3 size={7} /> Aging
                                </span>
                              )}
                            </div>
                            {r.clientName && r.clientName !== "Unknown Client" && (
                              <p 
                                className="text-[10px] text-zinc-800 font-black uppercase tracking-tight truncate mt-1 hover:text-blue-600 cursor-pointer"
                                onClick={() => router.push(`/request/product/${r.id}`)}
                              >
                                {r.clientName}
                              </p>
                            )}
                          </div>

                          <div className="min-w-0" onClick={() => router.push(`/request/product/${r.id}`)}>
                            <p className="text-[11px] font-bold text-zinc-600 truncate leading-none">{staffNames[r.referenceid || ""] || r.referenceid || "—"}</p>
                            <p className="text-[9px] font-black text-zinc-400 uppercase truncate mt-1 leading-none">{staffNames[r.tsm || ""] || r.tsm || "—"}</p>
                          </div>

                          <div onClick={() => router.push(`/request/product/${r.id}`)}>
                            <p className="text-[11px] font-black text-zinc-900 leading-none">{formatPHP(r.totalSellingValue || 0)}</p>
                            {r.expectedMargin !== undefined && (
                              <div className="mt-1 leading-none">
                                <span className={cn("text-[9px] font-black", r.expectedMargin > 30 ? "text-emerald-600" : "text-amber-600")}>
                                  {r.expectedMargin.toFixed(1)}% Margin
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2" onClick={() => router.push(`/request/product/${r.id}`)}>
                            <div className={cn("size-2 rounded-full flex-shrink-0", meta.dot,
                              pending && !filled ? "animate-pulse" : "animate-none"
                            )} />
                            <span className={cn("text-[9px] font-black uppercase tracking-wide truncate", meta.color)}>
                              {r.status || "Pending For Procurement"}
                            </span>
                          </div>

                          <div className="min-w-0" onClick={() => router.push(`/request/product/${r.id}`)}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                {r.filledItems}/{r.totalItems} Items
                              </span>
                              <span className="text-[9px] font-black text-zinc-900">{Math.round(progress * 100)}%</span>
                            </div>
                            <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full transition-all duration-500", progress === 1 ? "bg-emerald-500" : "bg-blue-500")} 
                                style={{ width: `${progress * 100}%` }}
                              />
                            </div>
                          </div>

                          <div onClick={() => router.push(`/request/product/${r.id}`)}>
                            <p className="text-[10px] font-bold text-zinc-700 leading-none">{relativeTime(r.date_updated || r.date_created)}</p>
                            <p className="text-[8px] text-zinc-400 mt-1 flex items-center gap-1 leading-none">
                              <Calendar size={8} />
                              {new Date(r.date_created).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </p>
                          </div>

                          <div className="flex justify-end" onClick={() => router.push(`/request/product/${r.id}`)}>
                            <div className="size-8 flex items-center justify-center rounded-xl border border-transparent group-hover:border-zinc-200 group-hover:bg-white transition-all">
                              <ArrowRight className="size-3.5 text-zinc-300 group-hover:text-zinc-800 transition-colors" />
                            </div>
                          </div>
                        </div>

                        {/* ── MOBILE CARD ── */}
                        <div className="md:hidden px-4 py-3.5" onClick={() => router.push(`/request/product/${r.id}`)}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="size-9 rounded-xl border border-zinc-100 flex items-center justify-center flex-shrink-0 group-hover:bg-zinc-900 transition-all overflow-hidden bg-zinc-50">
                                {r.firstImage ? (
                                  <img src={r.firstImage} className="w-full h-full object-cover" alt="product" />
                                ) : (
                                  <Package size={14} className="text-zinc-300 group-hover:text-white" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[12px] font-mono font-black text-zinc-900 leading-tight truncate">{r.spf_number}</p>
                                {r.clientName && r.clientName !== "Unknown Client" && (
                                  <p className="text-[10px] text-zinc-800 font-black truncate">{r.clientName}</p>
                                )}
                              </div>
                            </div>
                            <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-lg border flex-shrink-0", meta.bg, meta.border)}>
                              <div className={cn("size-1 rounded-full", meta.dot)} />
                              <span className={cn("text-[7px] font-black uppercase tracking-wide", meta.color)}>
                                {meta.label}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pl-[48px] mb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[9px] bg-zinc-100 rounded-lg px-2 py-0.5 uppercase font-bold text-zinc-600">{formatPHP(r.totalSellingValue || 0)}</span>
                              {r.expectedMargin !== undefined && (
                                <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-lg", r.expectedMargin > 30 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                                  {r.expectedMargin.toFixed(0)}%
                                </span>
                              )}
                              {r.isAging && (
                                <span className="text-rose-600 font-black text-[7px] bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-lg flex items-center gap-1">
                                  <Clock3 size={7} /> Aging
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] text-zinc-400 font-bold">{relativeTime(r.date_updated || r.date_created)}</span>
                              <ArrowRight className="size-3.5 text-zinc-200 group-hover:text-zinc-500 transition-colors flex-shrink-0" />
                            </div>
                          </div>

                          <div className="pl-[48px]">
                            <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full transition-all duration-500", progress === 1 ? "bg-emerald-500" : "bg-blue-500")} 
                                style={{ width: `${progress * 100}%` }}
                              />
                            </div>
                            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mt-1">
                              {r.filledItems}/{r.totalItems} Costing Items Done
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* ── FOOTER: pagination + count ── */}
              {!isLoading && filtered.length > 0 && (
                <div className="px-4 md:px-6 py-3 border-t bg-zinc-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Record info */}
                  <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest order-2 sm:order-1">
                    {filtered.length === requests.length
                      ? `${requests.length} records`
                      : `${filtered.length} of ${requests.length} records`}
                    {filterStatus ? ` · filtered` : ""}
                    {searchTerm ? ` · "${searchTerm}"` : ""}
                  </p>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5 order-1 sm:order-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className={cn(
                          "size-8 rounded-xl border flex items-center justify-center transition-all",
                          page === 1
                            ? "border-zinc-100 text-zinc-300 cursor-not-allowed"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 active:scale-95"
                        )}
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>

                      {/* Page number pills */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                        .reduce<(number | "...")[]>((acc, p, i, arr) => {
                          if (i > 0 && typeof arr[i - 1] === "number" && (p as number) - (arr[i - 1] as number) > 1) acc.push("...")
                          acc.push(p)
                          return acc
                        }, [])
                        .map((p, i) =>
                          p === "..." ? (
                            <span key={`ellipsis-${i}`} className="text-[10px] text-zinc-300 px-1">···</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setPage(p as number)}
                              className={cn(
                                "size-8 rounded-xl text-[10px] font-black transition-all active:scale-95",
                                page === p
                                  ? "bg-zinc-900 text-white border border-zinc-900"
                                  : "border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                              )}
                            >
                              {p}
                            </button>
                          )
                        )}

                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className={cn(
                          "size-8 rounded-xl border flex items-center justify-center transition-all",
                          page === totalPages
                            ? "border-zinc-100 text-zinc-300 cursor-not-allowed"
                            : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 active:scale-95"
                        )}
                      >
                        <ChevronRight className="size-3.5" />
                      </button>

                      <span className="text-[9px] font-black text-zinc-400 ml-1 hidden sm:block">
                        Page {page} of {totalPages}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  )
}