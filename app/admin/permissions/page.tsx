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
    RotateCcw, ListTodo, ToggleRight
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
        meetingRoom:    boolean
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
        productRequest: false, others: false, meetingRoom: false,
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
   DEPARTMENT + ROLE MATRIX (Now Dynamic from Firestore!)
───────────────────────────────────────────────────────── */
type DepartmentConfig = {
    name: string
    roles: string[]
    color?: string
}

// Standard roles as default
const DEFAULT_ROLES = ["MEMBER", "LEADER", "MANAGER", "SUPER ADMIN"]

// Default departments (will be replaced from Firestore if available)
const DEFAULT_DEPARTMENTS: DepartmentConfig[] = [
    { name: "IT", roles: DEFAULT_ROLES, color: "emerald" },
    { name: "Engineering", roles: DEFAULT_ROLES, color: "blue" },
    { name: "Admin", roles: ["STAFF", "MANAGER"], color: "slate" },
    { name: "Sales", roles: ["TERRITORY SALES ASSOCIATE", "TERRITORY SALES MANAGER", "SALES HEAD", "SUPER ADMIN"], color: "red" },
    { name: "Procurement", roles: DEFAULT_ROLES, color: "violet" },
    { name: "Warehouse Operations", roles: DEFAULT_ROLES, color: "amber" },
]

// Get a color class for departments
const getDeptColorClass = (deptName: string) => {
    const colors = [
        "emerald", "blue", "red", "violet", "amber", 
        "pink", "indigo", "cyan", "lime", "fuchsia"
    ]
    let hash = 0
    for (let i = 0; i < deptName.length; i++) {
        hash = deptName.charCodeAt(i) + ((hash << 5) - hash)
    }
    const colorIndex = Math.abs(hash) % colors.length
    const color = colors[colorIndex]
    return `bg-${color}-100 text-${color}-700 border-${color}-200`
}

// Get a color class for roles
const getRoleColorClass = (roleName: string) => {
    if (roleName.toUpperCase() === "SUPER ADMIN") return "bg-zinc-900 text-white border-zinc-800"
    if (roleName.toUpperCase().includes("MANAGER") || roleName.toUpperCase().includes("HEAD")) 
        return "bg-blue-600 text-white border-blue-700"
    if (roleName.toUpperCase().includes("LEADER")) 
        return "bg-violet-100 text-violet-700 border-violet-200"
    return "bg-zinc-100 text-zinc-600 border-zinc-200"
}

/* ─────────────────────────────────────────────────────────
   PERMISSION SECTIONS CONFIG
   Drives the UI — each section has a title, icon,
   color, and list of toggleable keys with labels
───────────────────────────────────────────────────────── */
const SECTIONS = [
    {
        key:   "services",
        label: "App Features",
        description: "Choose which tools and features this role can use in the app.",
        icon:  Layers,
        color: "bg-blue-50 text-blue-700 border-blue-200",
        items: [
            { key: "siteVisit",      label: "Site Visits",          icon: CalendarCheck },
            { key: "jobRequest",     label: "Job Requests",         icon: FileText },
            { key: "dialux",         label: "DIAlux Simulations",   icon: Monitor },
            { key: "recommendation", label: "Product Recommendations", icon: ThumbsUp },
            { key: "shopDrawing",    label: "Shop Drawings",        icon: Wrench },
            { key: "testing",        label: "Testing & Monitoring", icon: ClipboardCheck },
            { key: "productRequest", label: "Product Requests",     icon: Package },
            { key: "others",         label: "Other Requests",       icon: MoreHorizontal },
            { key: "meetingRoom",    label: "Meeting Rooms",        icon: Building2 },
        ],
    },
    {
        key:   "nav",
        label: "Navigation",
        description: "Choose which pages this role can see in the menu.",
        icon:  LayoutDashboard,
        color: "bg-violet-50 text-violet-700 border-violet-200",
        items: [
            { key: "team",          label: "Team Directory",       icon: Users },
            { key: "admin",         label: "Access & Permissions", icon: ShieldCheck },
            { key: "analytics",     label: "Analytics",            icon: BarChart3 },
            { key: "systemSettings",label: "System Settings",      icon: Settings2 },
            { key: "helpCenter",    label: "Help Center",          icon: BookOpen },
        ],
    },
    {
        key:   "security",
        label: "Security",
        description: "Choose which security settings this role can manage.",
        icon:  Shield,
        color: "bg-rose-50 text-rose-700 border-rose-200",
        items: [
            { key: "changePassword",   label: "Change Password",      icon: Lock },
            { key: "managePin",        label: "Login PIN",            icon: CircleUser },
            { key: "manageBiometrics", label: "Biometrics",           icon: Fingerprint },
            { key: "manage2FA",        label: "Two-Step Verification", icon: Smartphone },
            { key: "viewActivityLog",  label: "Login Activity",       icon: Activity },
        ],
    },
    {
        key:   "account",
        label: "Profile",
        description: "Choose what this role can do with their profile.",
        icon:  CircleUser,
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
        items: [
            { key: "viewProfile", label: "View Profile",        icon: Eye },
            { key: "editProfile", label: "Edit Profile",        icon: Pencil },
            { key: "preferences", label: "App Preferences",     icon: Settings2 },
        ],
    },
    {
        key:   "dashboard",
        label: "Home Screen",
        description: "Choose which sections this role can see on the home screen.",
        icon:  LayoutDashboard,
        color: "bg-amber-50 text-amber-700 border-amber-200",
        items: [
            { key: "showStats",          label: "Stats Cards",       icon: BarChart3 },
            { key: "showRecentActivity", label: "Recent Activity",   icon: Bell },
            { key: "showOverviewTabs",   label: "Overview Tabs",     icon: Layers },
            { key: "showSchedule",       label: "Schedule",          icon: CalendarCheck },
            { key: "showAlertBanner",    label: "Alerts",            icon: Activity },
            { key: "showMyTasks",        label: "My Tasks",          icon: ListTodo },
        ],
    },
]

/* ─────────────────────────────────────────────────────────
   DEPARTMENT BADGE COLORS
───────────────────────────────────────────────────────── */
const DEPT_COLORS: Record<string, string> = {
    "IT":                   "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Engineering":          "bg-blue-100 text-blue-700 border-blue-200",
    "Admin":                "bg-slate-100 text-slate-700 border-slate-200",
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

function DashboardCard({ label, value, subValue, icon: Icon, colorClass, loading, isActive, onClick, percent }: {
    label: string; value: string | number; subValue?: string; icon: any; colorClass: string; loading?: boolean; isActive?: boolean; onClick?: () => void; percent?: number
}) {
    return (
        <button
            onClick={onClick}
            disabled={!onClick}
            className={cn(
                "bg-white rounded-2xl p-4 border shadow-sm flex flex-col gap-2.5 group transition-all text-left w-full active:scale-[0.98]",
                isActive
                    ? "border-zinc-900 ring-2 ring-zinc-900/10 shadow-md"
                    : onClick
                    ? "border-zinc-200/60 hover:shadow-md hover:border-zinc-300 cursor-pointer"
                    : "border-zinc-200/60 cursor-default"
            )}
        >
            {/* Top row: icon + value */}
            <div className="flex items-start justify-between gap-2">
                <div className={cn(
                    "size-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                    isActive ? "bg-zinc-900 text-white" : colorClass
                )}>
                    <Icon className="size-4" />
                </div>
                <div className="text-right min-w-0">
                    {loading ? (
                        <div className="h-6 w-10 bg-zinc-100 rounded animate-pulse ml-auto" />
                    ) : (
                        <p className="text-[22px] font-black text-zinc-900 leading-none tracking-tight">{value}</p>
                    )}
                    {subValue && !loading && (
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{subValue}</p>
                    )}
                </div>
            </div>

            {/* Progress bar (if percent provided) */}
            {percent !== undefined && !loading && (
                <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all duration-500",
                            isActive ? "bg-zinc-900" :
                            percent === 0 ? "bg-zinc-200" :
                            percent === 100 ? "bg-emerald-500" : "bg-blue-500"
                        )}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            )}

            {/* Label */}
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-400 leading-none">{label}</p>
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
   DEPARTMENT MANAGER COMPONENT
───────────────────────────────────────────────────────── */
function DeptManager({ 
    departments, 
    onAdd, 
    onUpdateRoles, 
    onDelete 
}: { 
    departments: DepartmentConfig[], 
    onAdd: (name: string) => Promise<void>, 
    onUpdateRoles: (deptName: string, roles: string[]) => Promise<void>,
    onDelete: (deptName: string) => Promise<void>
}) {
    const [newDeptName, setNewDeptName] = React.useState("")
    const [editingDept, setEditingDept] = React.useState<string | null>(null)
    const [editingRoles, setEditingRoles] = React.useState<string[]>([])
    const [isProcessing, setIsProcessing] = React.useState(false)

    const handleAdd = async () => {
        if (!newDeptName.trim()) return
        setIsProcessing(true)
        try {
            await onAdd(newDeptName)
            setNewDeptName("")
        } finally {
            setIsProcessing(false)
        }
    }

    const handleSaveRoles = async () => {
        if (!editingDept) return
        setIsProcessing(true)
        try {
            await onUpdateRoles(editingDept, editingRoles)
            setEditingDept(null)
        } finally {
            setIsProcessing(false)
        }
    }

    const handleAddRoleToEditing = () => {
        setEditingRoles([...editingRoles, "NEW ROLE"])
    }

    const handleUpdateEditingRole = (index: number, value: string) => {
        const newRoles = [...editingRoles]
        newRoles[index] = value.toUpperCase()
        setEditingRoles(newRoles)
    }

    const handleRemoveEditingRole = (index: number) => {
        if (editingRoles.length <= 1) return
        setEditingRoles(editingRoles.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-6">
            {/* Add new department */}
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200">
                <h3 className="text-[12px] font-black uppercase tracking-widest text-zinc-800 mb-3">Add New Department</h3>
                <div className="flex gap-2">
                    <input
                        value={newDeptName}
                        onChange={(e) => setNewDeptName(e.target.value)}
                        placeholder="Department name..."
                        className="flex-1 px-3 py-2 rounded-xl bg-white border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-bold"
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    />
                    <Button 
                        onClick={handleAdd} 
                        disabled={!newDeptName.trim() || isProcessing}
                        className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                        Add
                    </Button>
                </div>
            </div>

            {/* Department list */}
            <div className="space-y-3">
                <h3 className="text-[12px] font-black uppercase tracking-widest text-zinc-800">Manage Departments</h3>
                {departments.map((dept) => (
                    <div key={dept.name} className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className={cn("px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border", getDeptColorClass(dept.name))}>
                                    {dept.name}
                                </div>
                                <span className="text-[10px] font-black uppercase text-zinc-400">
                                    {dept.roles.length} roles
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setEditingDept(dept.name)
                                        setEditingRoles([...dept.roles])
                                    }}
                                    className="text-xs font-bold"
                                >
                                    Edit Roles
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDelete(dept.name)}
                                    disabled={departments.length <= 1}
                                    className="text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50"
                                >
                                    Delete
                                </Button>
                            </div>
                        </div>
                        
                        {editingDept === dept.name && (
                            <div className="border-t border-zinc-100 pt-4 space-y-3">
                                <h4 className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Roles for {dept.name}</h4>
                                <div className="space-y-2">
                                    {editingRoles.map((role, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input
                                                value={role}
                                                onChange={(e) => handleUpdateEditingRole(idx, e.target.value)}
                                                className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-bold"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRemoveEditingRole(idx)}
                                                disabled={editingRoles.length <= 1}
                                                className="text-rose-600 border-rose-200 hover:bg-rose-50"
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button variant="outline" size="sm" onClick={handleAddRoleToEditing} className="text-violet-600">
                                        + Add Role
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setEditingDept(null)}>
                                        Cancel
                                    </Button>
                                    <Button 
                                        onClick={handleSaveRoles} 
                                        disabled={isProcessing}
                                        className="bg-violet-600 hover:bg-violet-700 text-white"
                                    >
                                        Save Roles
                                    </Button>
                                </div>
                            </div>
                        )}

                        {editingDept !== dept.name && (
                            <div className="flex flex-wrap gap-2">
                                {dept.roles.map((role) => (
                                    <span 
                                        key={role} 
                                        className={cn("px-2 py-1 rounded-lg text-[9px] font-black uppercase border", getRoleColorClass(role))}
                                    >
                                        {role}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────── */
export default function PermissionsPage() {
    const [userId, setUserId]             = React.useState<string | null>(null)
    // Dynamic departments from Firestore
    const [departments, setDepartments]   = React.useState<DepartmentConfig[]>(DEFAULT_DEPARTMENTS)
    const [selectedDept, setSelectedDept] = React.useState(DEFAULT_DEPARTMENTS[0].name)
    // Get roles dynamically based on selected department
    const availableRoles = React.useMemo(() => {
        const dept = departments.find(d => d.name === selectedDept)
        return dept?.roles || DEFAULT_ROLES
    }, [departments, selectedDept])
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
    const [showDeptManager, setShowDeptManager] = React.useState(false)

    // Track all configured combos for the overview grid
    const [allConfigs, setAllConfigs] = React.useState<Record<string, PermissionDoc>>({})
    // Guard: only run Admin migration once per session
    const adminMigrationRan = React.useRef(false)
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

    /* ── Subscribe to department configs from Firestore ── */
    React.useEffect(() => {
        const unsub = onSnapshot(collection(db, "department_configs"), snap => {
            const deptList: DepartmentConfig[] = []
            snap.docs.forEach(d => {
                const data = d.data()
                if (data.name && Array.isArray(data.roles) && !data.deleted) {
                    deptList.push({
                        name: data.name,
                        roles: data.roles,
                        color: data.color
                    })
                }
            })
            // If no departments in Firestore, use defaults
            if (deptList.length > 0) {
                setDepartments(deptList)
                // If selected department isn't in new list, pick first
                if (!deptList.find(d => d.name === selectedDept)) {
                    setSelectedDept(deptList[0].name)
                }

                // FIX: Ensure "Admin" department exists with correct roles.
                // Use a ref to only run this migration ONCE per session, not on every snapshot.
                const adminDept = deptList.find(d => d.name.toUpperCase() === "ADMIN")
                const adminHasWrongRoles = adminDept && (
                    adminDept.roles.length !== 2 ||
                    !adminDept.roles.includes("STAFF") ||
                    !adminDept.roles.includes("MANAGER")
                )
                if ((!adminDept || adminHasWrongRoles) && !adminMigrationRan.current) {
                    adminMigrationRan.current = true
                    const adminDocRef = doc(db, "department_configs", "ADMIN")
                    setDoc(adminDocRef, {
                        name: "Admin",
                        roles: ["STAFF", "MANAGER"],
                        color: "slate",
                    }, { merge: true }).catch(console.error)
                }
            } else {
                // Initialize Firestore with default departments if empty
                const init = async () => {
                    for (const dept of DEFAULT_DEPARTMENTS) {
                        const docRef = doc(db, "department_configs", dept.name.toUpperCase())
                        await setDoc(docRef, dept, { merge: true })
                    }
                }
                init()
                setDepartments(DEFAULT_DEPARTMENTS)
            }
        })
        return () => unsub()
    }, [])

    /* ── Reset role only when current role is no longer valid for the selected dept ── */
    React.useEffect(() => {
        if (!availableRoles.includes(selectedRole)) {
            setSelectedRole(availableRoles[0])
        }
    }, [availableRoles])

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
    const totalCombos = departments.reduce((sum, dept) => sum + dept.roles.length, 0)
    const allUniqueRoles = React.useMemo(() => {
        const roles = new Set<string>()
        departments.forEach(d => d.roles.forEach(r => roles.add(r)))
        return Array.from(roles)
    }, [departments])

    // Department manager functions
    const handleAddDepartment = async (name: string) => {
        if (!name.trim()) return
        const deptName = name.trim()
        const docRef = doc(db, "department_configs", deptName.toUpperCase())
        await setDoc(docRef, {
            name: deptName,
            roles: DEFAULT_ROLES,
            color: "blue"
        })
        toast.success(`Department "${deptName}" added!`)
    }

    const handleUpdateDepartmentRoles = async (deptName: string, roles: string[]) => {
        const docRef = doc(db, "department_configs", deptName.toUpperCase())
        await setDoc(docRef, { roles }, { merge: true })
        toast.success(`Roles updated for ${deptName}!`)
    }

    const handleDeleteDepartment = async (deptName: string) => {
        if (departments.length <= 1) {
            toast.error("You need at least one department!")
            return
        }
        const docRef = doc(db, "department_configs", deptName.toUpperCase())
        await setDoc(docRef, { deleted: true }, { merge: true })
        // Remove from local state first
        const newDepts = departments.filter(d => d.name !== deptName)
        setDepartments(newDepts)
        if (selectedDept === deptName) {
            setSelectedDept(newDepts[0].name)
        }
        toast.success(`Department "${deptName}" deleted!`)
    }
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
                <SidebarInset className="bg-[#F8FAFA] pb-24 md:pb-10 min-h-screen m-0 rounded-none border-none shadow-none overflow-auto font-sans">
                    <PageHeader
                        title="Access Rights"
                        version="v2"
                        showBackButton={true}
                        trigger={<SidebarTrigger className="mr-2" />}
                        actions={
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowGuide(true)}
                                    className="rounded-xl h-9 px-3 transition-all text-[11px] font-bold text-zinc-600 hover:bg-white border border-transparent hover:border-zinc-200"
                                >
                                    <HelpCircle size={14} className="mr-1" />
                                    <span className="hidden sm:inline">Help</span>
                                </Button>

                                <div className="hidden md:flex items-center gap-2">
                                    {isDirty && (
                                        <Button
                                            onClick={handleReset}
                                            variant="ghost"
                                            size="sm"
                                            className="text-zinc-500 text-[11px] font-bold rounded-xl"
                                        >
                                            <RefreshCw className="size-3 mr-1" /> Discard
                                        </Button>
                                    )}
                                    <Button
                                        onClick={handleSave}
                                        disabled={!isDirty || isSaving}
                                        size="sm"
                                        className={cn(
                                            "h-10 rounded-2xl text-[11px] font-bold transition-all px-4",
                                            isDirty
                                                ? "bg-black text-white hover:bg-zinc-800 shadow-lg"
                                                : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                                        )}
                                    >
                                        {isSaving
                                            ? <><RefreshCw className="size-3 mr-1 animate-spin" />Saving...</>
                                            : <><Save className="size-3 mr-1" />Save</>}
                                    </Button>
                                </div>
                            </div>
                        }
                    />

                    <main className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full overflow-x-hidden space-y-4 pb-36 md:pb-24">

                        {/* ── STATS BAR ── */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* Total permissions — primary card */}
                            <div className="col-span-2 md:col-span-1 bg-zinc-900 text-white rounded-2xl p-4 flex items-center gap-4">
                                <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                                    <ToggleRight className="size-5 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[26px] font-black leading-none tracking-tight">
                                        {enabledTotal}
                                        <span className="text-[14px] font-bold text-white/40 ml-0.5">/{totalPermissions}</span>
                                    </p>
                                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/50 mt-1">Permissions On</p>
                                    <div className="mt-2 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-white/60 rounded-full transition-all duration-700"
                                            style={{ width: `${totalPermissions > 0 ? Math.round((enabledTotal / totalPermissions) * 100) : 0}%` }} />
                                    </div>
                                </div>
                            </div>
                            {/* App Features */}
                            {(() => {
                                const total = SECTIONS.find(s => s.key === "services")?.items.length || 0
                                const pct = total > 0 ? Math.round((enabledServices / total) * 100) : 0
                                return (
                                    <div className="bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-sm">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="size-8 bg-blue-50 rounded-xl flex items-center justify-center">
                                                <LayoutDashboard className="size-4 text-blue-600" />
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{pct}%</span>
                                        </div>
                                        <p className="text-[22px] font-black text-zinc-900 leading-none">{enabledServices}<span className="text-[12px] font-bold text-zinc-400 ml-0.5">/{total}</span></p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-1">App Features</p>
                                        <div className="mt-2 h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                                            <div className={cn("h-full rounded-full transition-all duration-700", pct === 100 ? "bg-emerald-500" : "bg-blue-500")} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                )
                            })()}
                            {/* Security */}
                            {(() => {
                                const total = SECTIONS.find(s => s.key === "security")?.items.length || 0
                                const pct = total > 0 ? Math.round((enabledSecurity / total) * 100) : 0
                                return (
                                    <div className="bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-sm">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="size-8 bg-rose-50 rounded-xl flex items-center justify-center">
                                                <Lock className="size-4 text-rose-600" />
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{pct}%</span>
                                        </div>
                                        <p className="text-[22px] font-black text-zinc-900 leading-none">{enabledSecurity}<span className="text-[12px] font-bold text-zinc-400 ml-0.5">/{total}</span></p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-1">Security</p>
                                        <div className="mt-2 h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                                            <div className={cn("h-full rounded-full transition-all duration-700", pct === 100 ? "bg-emerald-500" : "bg-rose-500")} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                )
                            })()}
                            {/* Roles configured */}
                            {(() => {
                                const pct = totalCombos > 0 ? Math.round((totalConfigured / totalCombos) * 100) : 0
                                return (
                                    <div className="bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-sm">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="size-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                                                <Users className="size-4 text-emerald-600" />
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{pct}%</span>
                                        </div>
                                        <p className="text-[22px] font-black text-zinc-900 leading-none">{totalConfigured}<span className="text-[12px] font-bold text-zinc-400 ml-0.5">/{totalCombos}</span></p>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-1">Roles Set Up</p>
                                        <div className="mt-2 h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                                            <div className={cn("h-full rounded-full transition-all duration-700", pct === 100 ? "bg-emerald-500" : "bg-emerald-400")} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>

                        {/* ── STICKY TOOLBAR — sticks right below the PageHeader ── */}
                        <div className="sticky top-[57px] md:top-[65px] z-40 bg-white/95 backdrop-blur-md border border-zinc-200/80 rounded-2xl shadow-sm px-3 py-2.5 flex items-center gap-2">
                            {/* Search */}
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                                <input
                                    ref={searchInputRef}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search permissions..."
                                    className="w-full pl-8 pr-8 h-9 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:bg-white focus:border-zinc-400 transition-all text-[12px] font-medium"
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors">
                                        <X className="size-3.5" />
                                    </button>
                                )}
                            </div>
                            {/* Action buttons */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => handleCollapseAll(true)}
                                    className="h-9 px-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 text-[10px] font-black uppercase tracking-wide transition-all hidden sm:flex items-center gap-1.5">
                                    <ChevronUp className="size-3" /> Collapse
                                </button>
                                <button onClick={() => handleCollapseAll(false)}
                                    className="h-9 px-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 text-[10px] font-black uppercase tracking-wide transition-all hidden sm:flex items-center gap-1.5">
                                    <ChevronDown className="size-3" /> Expand
                                </button>
                                <button onClick={() => handleCollapseAll(true)}
                                    className="h-9 w-9 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 transition-all sm:hidden flex items-center justify-center">
                                    <ChevronUp className="size-4" />
                                </button>
                                <button onClick={() => handleCollapseAll(false)}
                                    className="h-9 w-9 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 transition-all sm:hidden flex items-center justify-center">
                                    <ChevronDown className="size-4" />
                                </button>
                                <div className="w-px h-5 bg-zinc-200 mx-0.5" />
                                <button onClick={() => setShowDeptManager(true)}
                                    className="h-9 px-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 text-[10px] font-black uppercase tracking-wide transition-all flex items-center gap-1.5">
                                    <Settings2 className="size-3.5" />
                                    <span className="hidden sm:inline">Departments</span>
                                </button>
                                <button
                                    onClick={() => { setSelectedDept(departments[0].name); setSelectedRole(departments[0].roles[0]); setSearchTerm("") }}
                                    className="h-9 w-9 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 transition-all flex items-center justify-center"
                                    title="Reset view"
                                >
                                    <RotateCcw className="size-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* ── DEPARTMENT MANAGER DIALOG ── */}
                        <Dialog open={showDeptManager} onOpenChange={setShowDeptManager}>
                            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] border-none shadow-2xl p-0 bg-white scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent hover:scrollbar-thumb-zinc-300 transition-colors">
                                <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-10 px-8 py-6 border-b border-zinc-100 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-[20px] font-black text-zinc-900 tracking-tight">
                                            Department Manager
                                        </h2>
                                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Manage Departments & Their Roles</p>
                                    </div>
                                </div>
                                <div className="p-8 space-y-6">
                                    <DeptManager 
                                        departments={departments}
                                        onAdd={handleAddDepartment}
                                        onUpdateRoles={handleUpdateDepartmentRoles}
                                        onDelete={handleDeleteDepartment}
                                    />
                                </div>
                            </DialogContent>
                        </Dialog>

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
                            CHOOSE WHO YOU'RE EDITING
                        ══════════════════════════════ */}
                        <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 w-full overflow-hidden">
                            <div className="flex items-center gap-3 mb-5">
                                <ShieldCheck className="size-5 text-zinc-500" />
                                <h2 className="font-bold text-lg text-zinc-900">
                                    Choose Role to Edit
                                </h2>
                                <div className="ml-auto flex items-center gap-2">
                                    {isConfigured && (
                                        <span className="text-xs font-medium bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200">
                                            Set up
                                        </span>
                                    )}
                                    {!isConfigured && (
                                        <span className="text-xs font-medium bg-zinc-50 text-zinc-500 px-3 py-1.5 rounded-full border border-zinc-200">
                                            Default
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Department pills */}
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Department</p>
                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                        {departments.map(dept => (
                                            <button
                                                key={dept.name}
                                                onClick={() => setSelectedDept(dept.name)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all shrink-0 border",
                                                    selectedDept === dept.name
                                                        ? getDeptColorClass(dept.name) + " shadow-sm"
                                                        : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-700"
                                                )}
                                            >
                                                {dept.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Role pills */}
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Role</p>
                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                        {availableRoles.map(role => (
                                            <button
                                                key={role}
                                                onClick={() => setSelectedRole(role)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all shrink-0 border",
                                                    selectedRole === role
                                                        ? getRoleColorClass(role) + " shadow-sm"
                                                        : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-700"
                                                )}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Current selection summary */}
                            <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={cn("text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0",
                                        getDeptColorClass(selectedDept))}>
                                        {selectedDept}
                                    </span>
                                    <span className="text-zinc-300 text-sm shrink-0">·</span>
                                    <span className={cn("text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0",
                                        getRoleColorClass(selectedRole))}>
                                        {selectedRole}
                                    </span>
                                </div>
                                {!isLoading && (
                                    <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-3 flex-wrap text-[10px] font-black text-zinc-400 uppercase tracking-wide">
                                        {SECTIONS.map(s => (
                                            <span key={s.key}>
                                                {s.label}: <span className="text-zinc-800">{countEnabled(s.key)}/{s.items.length}</span>
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