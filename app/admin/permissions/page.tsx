"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { PageHeader } from "@/components/page-header"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc, onSnapshot, collection } from "firebase/firestore"

import {
    CalendarCheck, FileText, Monitor, ThumbsUp, Wrench,
    ClipboardCheck, Package, MoreHorizontal, Users, ShieldCheck,
    BarChart3, Settings2, BookOpen, CircleUser, Lock,
    Fingerprint, Smartphone, Eye, Pencil, LayoutDashboard,
    Save, RefreshCw, Shield, ChevronDown, ChevronUp,
    Building2, Layers, Activity, Bell, Search, X, Sparkles,
    HelpCircle, Lightbulb, Zap, CheckSquare, Square, Info,
    Key, ShieldAlert, FileDown, ArrowRight, MousePointer2,
    RotateCcw, ListTodo
} from "lucide-react"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

/* ─────────────────────────────────────────────────────────
   PERMISSION SCHEMA
   This is the complete structure stored in Firestore:
   role_permissions/{DEPT_ROLE}

   services    → which service tiles appear (dashboard + sidebar)
   nav         → which sidebar nav sections appear
   security    → which security page features are accessible
   account     → which account page features are accessible
   dashboard   → which dashboard sections are visible
───────────────────────────────────────────────────────── */
type PermissionDoc = {
    services: {
        siteVisit:      boolean
        jobRequest:     boolean
        dialux:         boolean
        recommendation: boolean
        shopDrawing:    boolean
        testing:        boolean
        productRequest: boolean
        others:         boolean
    }
    nav: {
        team:        boolean   // Staff Directory access
        admin:       boolean   // Access Rights / Protocols
        analytics:   boolean   // Analytics page
        systemSettings: boolean // System Settings (IT only typically)
        helpCenter:  boolean
    }
    security: {
        changePassword:   boolean
        managePin:        boolean
        manageBiometrics: boolean
        manage2FA:        boolean
        viewActivityLog:  boolean
    }
    account: {
        viewProfile:  boolean
        editProfile:  boolean
        preferences:  boolean
    }
    dashboard: {
        showStats:          boolean
        showRecentActivity: boolean
        showOverviewTabs:   boolean
        showSchedule:       boolean
        showAlertBanner:    boolean
        showMyTasks:        boolean
    }
}

const DEFAULT_PERMISSIONS: PermissionDoc = {
    services: {
        siteVisit: false, jobRequest: false, dialux: false,
        recommendation: false, shopDrawing: false, testing: false,
        productRequest: false, others: false,
    },
    nav: {
        team: false, admin: false, analytics: false,
        systemSettings: false, helpCenter: false,
    },
    security: {
        changePassword: true, managePin: true, manageBiometrics: true,
        manage2FA: false, viewActivityLog: true,
    },
    account: {
        viewProfile: true, editProfile: true, preferences: true,
    },
    dashboard: {
        showStats: true, showRecentActivity: true,
        showOverviewTabs: true, showSchedule: true, showAlertBanner: true,
        showMyTasks: true,
    },
}

/* ─────────────────────────────────────────────────────────
   DEPARTMENT + ROLE MATRIX
───────────────────────────────────────────────────────── */
const DEPARTMENTS = [
    "IT",
    "Engineering",
    "Sales",
    "Procurement",
    "Warehouse Operations",
]

// Standard roles for most departments
const STANDARD_ROLES = ["MEMBER", "LEADER", "MANAGER", "SUPER ADMIN"]

// Sales-specific roles for Sales department hierarchy
const SALES_ROLES = ["TERRITORY SALES ASSOCIATE", "TERRITORY SALES MANAGER", "SALES HEAD", "SUPER ADMIN"]

// Get roles based on department
const getRolesForDepartment = (dept: string): string[] => {
    if (dept === "Sales") return SALES_ROLES
    return STANDARD_ROLES
}

const ROLES = getRolesForDepartment(DEPARTMENTS[0])

/* ─────────────────────────────────────────────────────────
   PERMISSION SECTIONS CONFIG
   Drives the UI — each section has a title, icon,
   color, and list of toggleable keys with labels
───────────────────────────────────────────────────────── */
const SECTIONS = [
    {
        key:   "services",
        label: "Service Access",
        description: "Controls which service tiles appear on the Dashboard and Sidebar for this role.",
        icon:  Layers,
        color: "bg-blue-50 text-blue-600 border-blue-100",
        items: [
            { key: "siteVisit",      label: "Site Visit Appointments", icon: CalendarCheck },
            { key: "jobRequest",     label: "Job Requests",            icon: FileText },
            { key: "dialux",         label: "DIAlux Simulation",       icon: Monitor },
            { key: "recommendation", label: "Product Recommendation",  icon: ThumbsUp },
            { key: "shopDrawing",    label: "Shop Drawing Requests",   icon: Wrench },
            { key: "testing",        label: "Testing Monitoring",      icon: ClipboardCheck },
            { key: "productRequest", label: "SPF Product Request",     icon: Package },
            { key: "others",         label: "Other Requests",          icon: MoreHorizontal },
        ],
    },
    {
        key:   "nav",
        label: "Navigation Access",
        description: "Controls which sidebar navigation sections are visible to this role.",
        icon:  LayoutDashboard,
        color: "bg-violet-50 text-violet-600 border-violet-100",
        items: [
            { key: "team",          label: "Team — Staff Directory",    icon: Users },
            { key: "admin",         label: "Admin — Access & Protocols", icon: ShieldCheck },
            { key: "analytics",     label: "Analytics Dashboard",        icon: BarChart3 },
            { key: "systemSettings",label: "System Settings",            icon: Settings2 },
            { key: "helpCenter",    label: "Help Center",                icon: BookOpen },
        ],
    },
    {
        key:   "security",
        label: "Security Controls",
        description: "Controls which features are available on the Security settings page.",
        icon:  Shield,
        color: "bg-red-50 text-red-600 border-red-100",
        items: [
            { key: "changePassword",   label: "Change Password",       icon: Lock },
            { key: "managePin",        label: "Manage Login PIN",      icon: CircleUser },
            { key: "manageBiometrics", label: "Biometric Registration",icon: Fingerprint },
            { key: "manage2FA",        label: "Two-Step Verification", icon: Smartphone },
            { key: "viewActivityLog",  label: "View Login Activity",   icon: Activity },
        ],
    },
    {
        key:   "account",
        label: "Account Features",
        description: "Controls what the user can do on their profile / account page.",
        icon:  CircleUser,
        color: "bg-emerald-50 text-emerald-600 border-emerald-100",
        items: [
            { key: "viewProfile", label: "View Profile",        icon: Eye },
            { key: "editProfile", label: "Edit Profile Details", icon: Pencil },
            { key: "preferences", label: "App Preferences",     icon: Settings2 },
        ],
    },
    {
        key:   "dashboard",
        label: "Dashboard Visibility",
        description: "Controls which sections are visible on the main dashboard.",
        icon:  LayoutDashboard,
        color: "bg-amber-50 text-amber-600 border-amber-100",
        items: [
            { key: "showStats",          label: "Summary Stats Cards",   icon: BarChart3 },
            { key: "showRecentActivity", label: "Recent Activity Feed",  icon: Bell },
            { key: "showOverviewTabs",   label: "Overview Tabs",         icon: Layers },
            { key: "showSchedule",       label: "Task Schedule View",    icon: CalendarCheck },
            { key: "showAlertBanner",    label: "Critical Alert Banner", icon: Activity },
            { key: "showMyTasks",        label: "My Tasks Section",      icon: ListTodo },
        ],
    },
]

/* ─────────────────────────────────────────────────────────
   DEPARTMENT BADGE COLORS
───────────────────────────────────────────────────────── */
const DEPT_COLORS: Record<string, string> = {
    "IT":                   "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Engineering":          "bg-blue-100 text-blue-700 border-blue-200",
    "Sales":                "bg-red-100 text-[#E33636] border-red-200",
    "Procurement":          "bg-violet-100 text-violet-700 border-violet-200",
    "Warehouse Operations": "bg-amber-100 text-amber-700 border-amber-200",
}

const ROLE_COLORS: Record<string, string> = {
    "SUPER ADMIN":              "bg-zinc-900 text-white border-zinc-800",
    "MANAGER":                  "bg-blue-600 text-white border-blue-700",
    "LEADER":                   "bg-violet-100 text-violet-700 border-violet-200",
    "MEMBER":                   "bg-zinc-100 text-zinc-600 border-zinc-200",
    // Sales-specific roles
    "TERRITORY SALES MANAGER":  "bg-amber-100 text-amber-700 border-amber-200",
    "TERRITORY SALES ASSOCIATE":"bg-orange-100 text-orange-700 border-orange-200",
    "SALES HEAD":               "bg-red-100 text-red-700 border-red-200",
}

/* ─────────────────────────────────────────────────────────
   HELPER — build Firestore doc ID
───────────────────────────────────────────────────────── */
const makeDocId = (dept: string, role: string) =>
    `${dept.toUpperCase().trim()}_${role.toUpperCase().trim()}`

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

function PermissionSection({
    section,
    perms,
    onChange,
    isSaving,
    query,
    collapseSignal,
    collapsedByDefault,
}: {
    section: typeof SECTIONS[0]
    perms: Record<string, boolean>
    onChange: (key: string, val: boolean) => void
    isSaving: boolean
    query: string
    collapseSignal: number
    collapsedByDefault: boolean
}) {
    const [collapsed, setCollapsed] = React.useState(false)
    const Icon = section.icon
    const allOn  = section.items.every(i => perms[i.key])
    const allOff = section.items.every(i => !perms[i.key])
    const visibleItems = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return section.items
        return section.items.filter(item => item.label.toLowerCase().includes(q))
    }, [query, section.items])
    const enabledVisible = visibleItems.filter(i => perms[i.key]).length

    React.useEffect(() => {
        setCollapsed(collapsedByDefault)
    }, [collapseSignal, collapsedByDefault])

    if (query.trim() && visibleItems.length === 0) return null

    const toggleAll = () => {
        const next = !allOn
        section.items.forEach(i => onChange(i.key, next))
    }

    return (
        <div className="bg-white rounded-[24px] border border-zinc-200/50 shadow-sm overflow-hidden transition-all hover:shadow-md">
            {/* Section header */}
            <div
                className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-4 p-5 cursor-pointer hover:bg-zinc-50/50 transition-colors"
                onClick={() => setCollapsed(!collapsed)}
            >
                <div className={cn("p-2.5 rounded-2xl border flex-shrink-0 transition-transform group-hover:scale-110", section.color)}>
                    <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-black text-[13px] uppercase tracking-tight text-zinc-900">
                        {section.label}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-zinc-400 font-bold hidden md:block truncate">
                            {section.description}
                        </p>
                        <span className="hidden md:inline text-zinc-200">|</span>
                        <span className="text-[10px] text-zinc-600 font-black whitespace-nowrap">{enabledVisible}/{visibleItems.length} ACTIVE</span>
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-3 flex-shrink-0">
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); toggleAll() }}
                        className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap min-w-[70px] shadow-sm",
                            allOn
                                ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                                : allOff
                                ? "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200"
                                : "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                        )}
                    >
                        {allOn ? "Enabled" : allOff ? "Disabled" : "Partial"}
                    </button>
                    <div className="p-1.5 rounded-lg bg-zinc-50 text-zinc-400">
                        {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                    </div>
                </div>
            </div>

            {/* Toggle items */}
            {!collapsed && (
                <div className="border-t border-zinc-100 bg-zinc-50/30 p-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {visibleItems.map(item => {
                            const ItemIcon = item.icon
                            const isEnabled = !!perms[item.key]
                            return (
                                <div
                                    key={item.key}
                                    className={cn(
                                        "flex items-center justify-between px-4 py-3 rounded-2xl border transition-all",
                                        isEnabled 
                                            ? "bg-white border-zinc-200 shadow-sm" 
                                            : "bg-transparent border-transparent opacity-60 grayscale-[0.5]"
                                    )}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={cn(
                                            "p-2 rounded-xl transition-colors",
                                            isEnabled ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-400"
                                        )}>
                                            <ItemIcon className="size-3.5" />
                                        </div>
                                        <span className={cn(
                                            "text-[11px] font-black uppercase tracking-tight truncate",
                                            isEnabled ? "text-zinc-900" : "text-zinc-400"
                                        )}>
                                            {item.label}
                                        </span>
                                    </div>
                                    <Switch
                                        checked={isEnabled}
                                        onCheckedChange={val => onChange(item.key, val)}
                                        disabled={isSaving}
                                        className="data-[state=checked]:bg-zinc-900"
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

/* ─────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────── */
export default function PermissionsPage() {
    const [userId, setUserId]             = React.useState<string | null>(null)
    const [selectedDept, setSelectedDept] = React.useState(DEPARTMENTS[0])
    // Get roles dynamically based on department
    const availableRoles = React.useMemo(() => getRolesForDepartment(selectedDept), [selectedDept])
    const [selectedRole, setSelectedRole] = React.useState(availableRoles[0])
    const [perms, setPerms]               = React.useState<PermissionDoc>(DEFAULT_PERMISSIONS)
    const [isLoading, setIsLoading]       = React.useState(false)
    const [isSaving, setIsSaving]         = React.useState(false)
    const [isDirty, setIsDirty]           = React.useState(false)
    const [savedSnapshot, setSavedSnapshot] = React.useState<string>("")
    const [searchTerm, setSearchTerm] = React.useState("")
    const searchInputRef = React.useRef<HTMLInputElement>(null)
    const [collapseSignal, setCollapseSignal] = React.useState(0)
    const [allCollapsed, setAllCollapsed] = React.useState(false)
    const [showGuide, setShowGuide] = React.useState(false)

    // Track all configured combos for the overview grid
    const [allConfigs, setAllConfigs] = React.useState<Record<string, PermissionDoc>>({})

    React.useEffect(() => {
        setUserId(localStorage.getItem("userId"))
    }, [])

    React.useEffect(() => {
        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
                e.preventDefault()
                searchInputRef.current?.focus()
            }
            if (e.key === "Escape" && document.activeElement?.tagName === "INPUT") {
                setSearchTerm("")
                searchInputRef.current?.blur()
            }
        }
        window.addEventListener("keydown", keyHandler)
        return () => window.removeEventListener("keydown", keyHandler)
    }, [])

    /* ── Subscribe to all role_permissions docs ── */
    React.useEffect(() => {
        const unsub = onSnapshot(collection(db, "role_permissions"), snap => {
            const map: Record<string, PermissionDoc> = {}
            snap.docs.forEach(d => {
                map[d.id] = d.data() as PermissionDoc
            })
            setAllConfigs(map)
        })
        return () => unsub()
    }, [])

    /* ── Reset role when department changes ── */
    React.useEffect(() => {
        const newRoles = getRolesForDepartment(selectedDept)
        setSelectedRole(newRoles[0])
    }, [selectedDept])

    /* ── Load when dept/role selection changes ── */
    React.useEffect(() => {
        const load = async () => {
            setIsLoading(true)
            setIsDirty(false)
            const docId  = makeDocId(selectedDept, selectedRole)
            const docRef = doc(db, "role_permissions", docId)
            try {
                const snap = await getDoc(docRef)
                if (snap.exists()) {
                    // Deep merge with defaults to handle missing keys
                    const data = snap.data() as Partial<PermissionDoc>
                    const merged: PermissionDoc = {
                        services:  { ...DEFAULT_PERMISSIONS.services,  ...(data.services  || {}) },
                        nav:       { ...DEFAULT_PERMISSIONS.nav,        ...(data.nav       || {}) },
                        security:  { ...DEFAULT_PERMISSIONS.security,   ...(data.security  || {}) },
                        account:   { ...DEFAULT_PERMISSIONS.account,    ...(data.account   || {}) },
                        dashboard: { ...DEFAULT_PERMISSIONS.dashboard,  ...(data.dashboard || {}) },
                    }
                    setPerms(merged)
                    setSavedSnapshot(JSON.stringify(merged))
                } else {
                    setPerms(DEFAULT_PERMISSIONS)
                    setSavedSnapshot(JSON.stringify(DEFAULT_PERMISSIONS))
                }
            } catch (e) {
                console.error("Load permissions error:", e)
                toast.error("Failed to load permissions.")
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [selectedDept, selectedRole])

    /* ── Detect unsaved changes ── */
    React.useEffect(() => {
        setIsDirty(JSON.stringify(perms) !== savedSnapshot)
    }, [perms, savedSnapshot])

    /* ── Toggle a single permission ── */
    const handleToggle = (section: string, key: string, val: boolean) => {
        setPerms(prev => ({
            ...prev,
            [section]: { ...(prev as any)[section], [key]: val },
        }))
    }

    /* ── Save to Firestore ── */
    const handleSave = async () => {
        setIsSaving(true)
        const docId  = makeDocId(selectedDept, selectedRole)
        const docRef = doc(db, "role_permissions", docId)
        try {
            await setDoc(docRef, {
                ...perms,
                updatedAt: new Date().toISOString(),
                updatedBy: userId,
            }, { merge: true })
            setSavedSnapshot(JSON.stringify(perms))
            setIsDirty(false)
            toast.success(`Permissions saved for ${selectedDept} · ${selectedRole}`)
        } catch (e) {
            console.error("Save permissions error:", e)
            toast.error("Failed to save permissions.")
        } finally {
            setIsSaving(false)
        }
    }

    /* ── Reset to last saved ── */
    const handleReset = () => {
        setPerms(JSON.parse(savedSnapshot))
        setIsDirty(false)
    }

    /* ── Count enabled per section ── */
    const countEnabled = (section: string) =>
        Object.values((perms as any)[section] || {}).filter(Boolean).length

    const docId        = makeDocId(selectedDept, selectedRole)
    const isConfigured = !!allConfigs[docId]
    const totalConfigured = Object.keys(allConfigs).length
    const totalCombos = DEPARTMENTS.length * availableRoles.length
    const enabledTotal = React.useMemo(() => {
        return SECTIONS.reduce((sum, section) => sum + Object.values((perms as any)[section.key] || {}).filter(Boolean).length, 0)
    }, [perms])
    const totalPermissions = React.useMemo(() => {
        return SECTIONS.reduce((sum, section) => sum + section.items.length, 0)
    }, [])
    const enabledServices = Object.values(perms.services || {}).filter(Boolean).length
    const enabledSecurity = Object.values(perms.security || {}).filter(Boolean).length

    const handleCollapseAll = (next: boolean) => {
        setAllCollapsed(next)
        setCollapseSignal(prev => prev + 1)
    }

    return (
        <ProtectedPageWrapper>
            <SidebarProvider defaultOpen={false}>
                <AppSidebar userId={userId} />
                <SidebarInset className="bg-[#F8FAFA] pb-24 md:pb-10 min-h-screen m-0 rounded-none border-none shadow-none overflow-visible font-sans">
                    <PageHeader
                        title="Admin / Access Rights"
                        version="V2.0-STABLE"
                        showBackButton={true}
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
                                    <span className="hidden md:inline">User Guide</span>
                                </Button>

                                <div className="hidden md:flex items-center gap-2">
                                    {isDirty && (
                                        <Button
                                            onClick={handleReset}
                                            variant="ghost"
                                            size="sm"
                                            className="text-zinc-500 text-[10px] font-black uppercase rounded-xl"
                                        >
                                            <RefreshCw className="size-3 mr-1.5" /> Reset
                                        </Button>
                                    )}
                                    <Button
                                        onClick={handleSave}
                                        disabled={!isDirty || isSaving}
                                        size="sm"
                                        className={cn(
                                            "h-10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                                            isDirty
                                                ? "bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg"
                                                : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                                        )}
                                    >
                                        {isSaving
                                            ? <><RefreshCw className="size-3 mr-1.5 animate-spin" />Saving...</>
                                            : <><Save className="size-3 mr-1.5" />Save Changes</>}
                                    </Button>
                                </div>
                            </div>
                        }
                    />

                    <main className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full overflow-x-hidden space-y-4 md:space-y-6 pb-36 md:pb-24">
                        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                            <DashboardCard
                                label="Total Enabled"
                                value={`${enabledTotal}/${totalPermissions}`}
                                icon={Sparkles}
                                colorClass="text-zinc-600 bg-zinc-50"
                                isActive={true}
                            />
                            <DashboardCard
                                label="Service Access"
                                value={enabledServices}
                                subValue={`${SECTIONS.find(s => s.key === "services")?.items.length || 0} MAX`}
                                icon={Layers}
                                colorClass="text-blue-600 bg-blue-50"
                            />
                            <DashboardCard
                                label="Security Access"
                                value={enabledSecurity}
                                subValue={`${SECTIONS.find(s => s.key === "security")?.items.length || 0} MAX`}
                                icon={Shield}
                                colorClass="text-red-600 bg-red-50"
                            />
                            <DashboardCard
                                label="Configured"
                                value={totalConfigured}
                                subValue={`${totalCombos} TOTAL`}
                                icon={Building2}
                                colorClass="text-emerald-600 bg-emerald-50"
                            />
                        </section>

                        <div className="sticky top-[56px] md:top-[64px] z-[45] flex flex-col xl:flex-row xl:items-center gap-3 bg-white/80 backdrop-blur-md p-2 rounded-[24px] border border-zinc-200/40 shadow-sm transition-all">
                            <div className="flex-1 relative group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-300 group-focus-within:text-zinc-800 transition-colors" />
                                <input
                                    ref={searchInputRef}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder='Search permission label... ("/" focus)'
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
                                    onClick={() => handleCollapseAll(true)}
                                    className="h-10 px-3 rounded-xl bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-black text-[10px] uppercase tracking-wider transition-all"
                                >
                                    Collapse All
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => handleCollapseAll(false)}
                                    className="h-10 px-3 rounded-xl bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-black text-[10px] uppercase tracking-wider transition-all"
                                >
                                    Expand All
                                </Button>
                                <div className="w-px h-8 bg-zinc-200 mx-1 hidden xl:block" />
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedDept(DEPARTMENTS[0])
                                        setSelectedRole(getRolesForDepartment(DEPARTMENTS[0])[0])
                                        setSearchTerm("")
                                    }}
                                    className="h-10 w-10 rounded-xl bg-white border-zinc-200 hover:bg-zinc-50 flex items-center justify-center p-0 flex-shrink-0"
                                    title="Reset view"
                                >
                                    <RotateCcw className="size-3.5 text-zinc-400" />
                                </Button>
                            </div>
                        </div>

                        {/* ── USER GUIDE DIALOG ── */}
                        <Dialog open={showGuide} onOpenChange={setShowGuide}>
                            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] border-none shadow-2xl p-0 bg-white scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent hover:scrollbar-thumb-zinc-300 transition-colors">
                                <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-10 px-8 py-6 border-b border-zinc-100 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-[20px] font-black text-zinc-900 tracking-tight">
                                            Access Rights Guide
                                        </h2>
                                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Role-Based Access Control (RBAC)</p>
                                    </div>
                                </div>

                                <div className="p-8 space-y-8">
                                    <section>
                                        <div className="mb-4">
                                            <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-wide">Managing Permissions</h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <GuideItem 
                                                icon={MousePointer2} 
                                                title="Interactive Matrix" 
                                                description="Click any cell in the Configuration Overview to instantly switch between department and role combinations."
                                                colorClass="bg-zinc-900 text-white"
                                            />
                                            <GuideItem 
                                                icon={ShieldCheck} 
                                                title="Atomic Control" 
                                                description="Toggle individual permissions within sections. Use the section-level toggle to enable or disable all items at once."
                                                colorClass="bg-blue-50 text-blue-600"
                                            />
                                        </div>
                                    </section>

                                    <section>
                                        <div className="mb-4">
                                            <h3 className="text-[14px] font-black text-zinc-900 uppercase tracking-wide">Visual Indicators</h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <GuideItem 
                                                icon={Activity} 
                                                title="Live Status" 
                                                description="Cells marked in emerald represent combinations that have custom permissions saved in the registry."
                                                colorClass="bg-emerald-50 text-emerald-600"
                                            />
                                            <GuideItem 
                                                icon={Info} 
                                                title="Unsaved Changes" 
                                                description="The Save bar will automatically appear when you make changes. Be sure to save before switching roles!"
                                                colorClass="bg-amber-50 text-amber-600"
                                            />
                                        </div>
                                    </section>

                                    <div className="bg-zinc-900 rounded-2xl p-6 text-white flex items-center justify-between gap-6 overflow-hidden relative">
                                        <div className="relative z-10">
                                            <h4 className="text-[15px] font-black mb-1">Pro Tip!</h4>
                                            <p className="text-[11px] font-medium text-zinc-400 leading-relaxed max-w-[300px]">
                                                Use the <Search className="inline size-3 text-zinc-400" /> search bar to quickly find specific permissions across all sections. The list will auto-expand to show matches.
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

                        {/* ══════════════════════════════
                            OVERVIEW GRID — all combos
                        ══════════════════════════════ */}
                        <section className="bg-white rounded-[24px] border border-zinc-200/50 shadow-sm overflow-hidden w-full">
                            <div className="px-6 py-4 border-b border-zinc-50 flex items-center gap-3">
                                <Building2 className="size-4 text-zinc-400" />
                                <h2 className="font-black text-[11px] uppercase tracking-wide text-zinc-800">
                                    Configuration Overview
                                </h2>
                                <span className="ml-auto text-[9px] font-black text-zinc-400 uppercase">
                                    {Object.keys(allConfigs).length} configured
                                </span>
                            </div>
                            <div className="w-full overflow-x-auto">
                                <table className="w-full min-w-[560px] text-[10px]">
                                    <thead>
                                        <tr className="border-b border-zinc-50">
                                            <th className="text-left px-5 py-3 font-black uppercase tracking-widest text-zinc-400 w-40">
                                                Department
                                            </th>
                                            {availableRoles.map(role => (
                                                <th key={role} className="text-center px-3 py-3 font-black uppercase tracking-widest text-zinc-400">
                                                    {role}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-50">
                                        {DEPARTMENTS.map(dept => (
                                            <tr key={dept} className="hover:bg-zinc-50/40 transition-colors">
                                                <td className="px-5 py-3">
                                                    <span className={cn(
                                                        "text-[9px] font-black uppercase px-2 py-1 rounded-full border",
                                                        DEPT_COLORS[dept] || "bg-zinc-100 text-zinc-500 border-zinc-200"
                                                    )}>
                                                        {dept.length > 14 ? dept.slice(0, 12) + "…" : dept}
                                                    </span>
                                                </td>
                                                {getRolesForDepartment(dept).map(role => {
                                                    const id  = makeDocId(dept, role)
                                                    const cfg = allConfigs[id]
                                                    const serviceCount = cfg
                                                        ? Object.values(cfg.services || {}).filter(Boolean).length
                                                        : null
                                                    const isSelected = selectedDept === dept && selectedRole === role

                                                    return (
                                                        <td key={role} className="text-center px-3 py-3">
                                                            <button
                                                                onClick={() => { setSelectedDept(dept); setSelectedRole(role) }}
                                                                className={cn(
                                                                    "mx-auto size-10 rounded-2xl flex items-center justify-center text-[11px] font-black transition-all border relative overflow-hidden active:scale-90",
                                                                    isSelected
                                                                        ? "bg-zinc-900 border-zinc-900 text-white shadow-lg shadow-zinc-200 z-10 scale-110"
                                                                        : cfg
                                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-200"
                                                                        : "bg-zinc-50 text-zinc-300 border-zinc-100 hover:bg-zinc-100 hover:text-zinc-500"
                                                                )}
                                                                title={cfg ? `${serviceCount} services enabled` : "Not configured"}
                                                            >
                                                                {cfg ? (
                                                                    <span>{serviceCount}</span>
                                                                ) : (
                                                                    <div className="size-1 rounded-full bg-current opacity-30" />
                                                                )}
                                                                {isSelected && (
                                                                    <div className="absolute top-0 right-0 p-1">
                                                                        <MousePointer2 className="size-2 text-white/50" />
                                                                    </div>
                                                                )}
                                                            </button>
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-5 py-3 border-t border-zinc-50 flex items-center gap-4 flex-wrap text-[9px] text-zinc-400 font-bold uppercase">
                                <div className="flex items-center gap-1.5">
                                    <div className="size-3 bg-[#121212] rounded" />Selected
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="size-3 bg-emerald-100 border border-emerald-200 rounded" />Configured
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="size-3 bg-zinc-50 border border-zinc-100 rounded" />Not set
                                </div>
                            </div>
                        </section>

                        {/* ══════════════════════════════
                            SELECTOR — dept + role
                        ══════════════════════════════ */}
                        <section className="bg-white rounded-[24px] border border-zinc-200/50 shadow-sm p-5 w-full overflow-hidden">
                            <div className="flex items-center gap-3 mb-4">
                                <ShieldCheck className="size-4 text-zinc-400" />
                                <h2 className="font-black text-[11px] uppercase tracking-widest text-zinc-800">
                                    Editing Permissions For
                                </h2>
                                {isConfigured && (
                                    <span className="ml-auto text-[8px] font-black uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                                        Configured
                                    </span>
                                )}
                                {!isConfigured && (
                                    <span className="ml-auto text-[8px] font-black uppercase bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full border border-zinc-200">
                                        Using Defaults
                                    </span>
                                )}
                            </div>

                            {/* Department pills */}
                            <div className="space-y-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Department</p>
                                <div className="flex flex-wrap gap-2">
                                    {DEPARTMENTS.map(dept => (
                                        <button
                                            key={dept}
                                            onClick={() => setSelectedDept(dept)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all",
                                                selectedDept === dept
                                                    ? (DEPT_COLORS[dept] || "bg-zinc-900 text-white border-zinc-900") + " scale-105 shadow-sm"
                                                    : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100"
                                            )}
                                        >
                                            {dept}
                                        </button>
                                    ))}
                                </div>

                                {/* Role pills */}
                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-2">Role</p>
                                <div className="flex flex-wrap gap-2">
                                    {availableRoles.map(role => (
                                        <button
                                            key={role}
                                            onClick={() => setSelectedRole(role)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all",
                                                selectedRole === role
                                                    ? (ROLE_COLORS[role] || "bg-zinc-900 text-white") + " scale-105 shadow-sm"
                                                    : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100"
                                            )}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Current selection summary */}
                            <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-[9px] font-black uppercase px-2 py-1 rounded-full border",
                                        DEPT_COLORS[selectedDept] || "bg-zinc-100 text-zinc-500 border-zinc-200")}>
                                        {selectedDept}
                                    </span>
                                    <span className="text-zinc-300 text-xs">·</span>
                                    <span className={cn("text-[9px] font-black uppercase px-2 py-1 rounded-full border",
                                        ROLE_COLORS[selectedRole] || "bg-zinc-100 text-zinc-500 border-zinc-200")}>
                                        {selectedRole}
                                    </span>
                                </div>
                                {!isLoading && (
                                    <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-3 flex-wrap text-[9px] font-black uppercase text-zinc-400">
                                        {SECTIONS.map(s => (
                                            <span key={s.key}>
                                                {s.label.split(" ")[0]}: <span className="text-zinc-700">{countEnabled(s.key)}/{s.items.length}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* ══════════════════════════════
                            PERMISSION SECTIONS
                        ══════════════════════════════ */}
                        {isLoading ? (
                            <div className="space-y-4">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="bg-white rounded-[20px] border border-zinc-100 p-5 animate-pulse">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="size-9 bg-zinc-100 rounded-xl" />
                                            <div className="space-y-2">
                                                <div className="h-3 w-32 bg-zinc-100 rounded" />
                                                <div className="h-2 w-48 bg-zinc-50 rounded" />
                                            </div>
                                        </div>
                                        {[...Array(3)].map((_, j) => (
                                            <div key={j} className="flex items-center justify-between py-3 border-t border-zinc-50">
                                                <div className="h-3 w-36 bg-zinc-100 rounded" />
                                                <div className="h-5 w-10 bg-zinc-100 rounded-full" />
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {SECTIONS.map(section => (
                                    <PermissionSection
                                        key={section.key}
                                        section={section}
                                        perms={(perms as any)[section.key] || {}}
                                        onChange={(key, val) => handleToggle(section.key, key, val)}
                                        isSaving={isSaving}
                                        query={searchTerm}
                                        collapseSignal={collapseSignal}
                                        collapsedByDefault={allCollapsed}
                                    />
                                ))}
                            </div>
                        )}

                        {/* ── Sticky save bar (mobile) ── */}
                        <div className="fixed bottom-0 left-0 right-0 p-4 pb-5 bg-white/95 backdrop-blur-sm border-t border-zinc-200 z-50 flex items-center gap-2 md:gap-3 md:hidden shadow-2xl shadow-zinc-900/10 overflow-x-hidden">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-zinc-900 uppercase tracking-wide truncate">
                                        {isDirty ? "Unsaved changes" : "No changes yet"}
                                    </p>
                                    <p className="text-[9px] text-zinc-400 font-medium">
                                        {selectedDept} · {selectedRole}
                                    </p>
                                </div>
                                <Button onClick={handleReset} variant="outline" size="sm"
                                    disabled={!isDirty || isSaving}
                                    className="h-12 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest border-zinc-200 flex-shrink-0 px-3">
                                    Reset
                                </Button>
                                <Button onClick={handleSave} disabled={!isDirty || isSaving} size="sm"
                                    className="h-12 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex-shrink-0 px-3">
                                    {isSaving ? <RefreshCw className="size-3.5 animate-spin" /> : <><Save className="size-3.5 mr-1.5" /> Save Changes</>}
                                </Button>
                            </div>
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    )
}