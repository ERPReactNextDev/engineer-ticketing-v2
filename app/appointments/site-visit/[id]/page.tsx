"use client"
//test
import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
    ShieldCheck, MapPin, User, FileText,
    Loader2, Activity, ShieldAlert,
    Terminal, ChevronLeft, Fingerprint, MessageSquare,
    Wrench, Paperclip, Clock,
    Cpu, History, ExternalLink,
    Calendar, CheckCircle2, AlertCircle, ArrowRight,
    PauseCircle,
    Lock,
    Radio,
    Download,
    Copy,
    Building2,
    ClipboardList,
    Timer,
    Info,
    XCircle
} from "lucide-react"

import { db } from "@/lib/firebase"
import { doc, onSnapshot, updateDoc, serverTimestamp, query, collection, where } from "firebase/firestore"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"

import { AppSidebar } from "@/components/app-sidebar"
import { CollaborationHub } from "@/components/collaboration-hub"

export default function AppointmentDetailsPage() {
    const params = useParams() as { id: string }
    const id = params.id
    const router = useRouter()

    const [loading, setLoading] = React.useState(true)
    const [data, setData] = React.useState<any>(null)
    const [submitterName, setSubmitterName] = React.useState("")
    const [userContext, setUserContext] = React.useState({ role: "", id: "", name: "", profilePicture: "", dept: "", userRole: "" })
    const [actionLoading, setActionLoading] = React.useState(false)
    const [confNotes, setConfNotes] = React.useState("")
    const [cancelReason, setCancelReason] = React.useState("")
    const [showCancelForm, setShowCancelForm] = React.useState(false)

    const [countdown, setCountdown] = React.useState("00:00:00")
    const [isOverdue, setIsOverdue] = React.useState(false)
    const [isDetailsCollapsed, setIsDetailsCollapsed] = React.useState(false)
    const [timeElapsed, setTimeElapsed] = React.useState("0h 0m")
    const [availablePics, setAvailablePics] = React.useState<any[]>([])
    const [protocolLabels, setProtocolLabels] = React.useState<string[]>([])
    const [selectedAssignees, setSelectedAssignees] = React.useState<string[]>([])

    const status = data?.status?.toUpperCase() || "PENDING"

    // FETCH PROTOCOL LABELS AND AVAILABLE PICS
    React.useEffect(() => {
        if (!data?.protocols || data.protocols.length === 0) return;

        const fetchProtocols = async () => {
            try {
                const q = query(collection(db, "protocols"), where("isActive", "==", true));
                const unsubscribe = onSnapshot(q, (snapshot: any) => {
                    const dbProtocols = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as any[];
                    const matched = dbProtocols.filter((proto: any) => data.protocols.includes(proto.id));
                    
                    // Update Labels for display
                    setProtocolLabels(matched.map(p => p.label || p.id));

                    // LOGIC: IF "INSTALLATION SERVICES" IS SELECTED, ONLY SHOW ITS PICS
                    const installationProtocol = matched.find(p => p.label?.toLowerCase().includes("installation"));
                    
                    let finalPics: any[] = [];
                    if (installationProtocol) {
                        finalPics = Array.from(new Set((installationProtocol.pic || []).map((name: string) => name.trim().toUpperCase())));
                    } else {
                        finalPics = Array.from(new Set(matched.flatMap(p => p.pic || []).map((name: string) => name.trim().toUpperCase())));
                    }
                    
                    setAvailablePics(finalPics);
                });
                return () => unsubscribe();
            } catch (err) { console.error("PROTOCOL_SYNC_ERROR", err); }
        };
        fetchProtocols();
    }, [data?.protocols]);

    // PRE-FILL SELECTED ASSIGNEES IF ALREADY ASSIGNED
    React.useEffect(() => {
        if (data?.pic && data.pic !== "UNASSIGNED") {
            const currentPics = Array.isArray(data.pic) ? data.pic : data.pic.split(", ").map((p: string) => p.trim().toUpperCase());
            setSelectedAssignees(currentPics);
        }
    }, [data?.pic]);

    // SLA & ELAPSED TIMER LOGIC
    React.useEffect(() => {
        const timerInterval = setInterval(() => {
            let referenceTime = data?.createdAt
            let hoursLimit = 24 // Default SLA 24h

            if (status === "CONFIRMED") {
                referenceTime = data?.confirmedAt
                hoursLimit = 12 // Manager approval SLA 12h
            }

            if (referenceTime) {
                const startTs = referenceTime.seconds * 1000
                const start = new Date(startTs).getTime()
                const limit = start + (hoursLimit * 60 * 60 * 1000)
                const now = new Date().getTime()
                
                // SLA Countdown
                const diff = limit - now
                const absDiff = Math.abs(diff)
                const h = Math.floor(absDiff / (1000 * 60 * 60))
                const m = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60))
                const s = Math.floor((absDiff % (1000 * 60)) / 1000)
                setCountdown(`${diff < 0 ? '-' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
                setIsOverdue(diff < 0)

                // Time Elapsed since creation
                const creationTs = data.createdAt?.seconds * 1000
                if (creationTs) {
                    const elapsed = now - creationTs
                    const eh = Math.floor(elapsed / (1000 * 60 * 60))
                    const em = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60))
                    setTimeElapsed(`${eh}h ${em}m`)
                }
            }
        }, 1000)
        return () => clearInterval(timerInterval)
    }, [data, status])

    React.useEffect(() => {
        let unsubscribe: () => void
        const establishUplink = async () => {
            const storedId = localStorage.getItem("userId")
            if (!storedId) return

            try {
                const res = await fetch(`/api/user?id=${encodeURIComponent(storedId)}`)
                const user = await res.json()
                
                // Fetch role from Firebase where the correct MANAGER role is stored
                const { getDoc, doc } = await import("firebase/firestore")
                const { db } = await import("@/lib/firebase")
                const userDocRef = doc(db, "users", storedId)
                const userDocSnap = await getDoc(userDocRef)
                const firestoreRole = userDocSnap.exists() ? (userDocSnap.data().Role || userDocSnap.data().role || "").toUpperCase() : ""
                
                // DEBUG: Log all user fields
                console.log("[DEBUG] MongoDB user data:", { Role: user.Role, RoleCode: user.RoleCode, Position: user.Position })
                console.log("[DEBUG] Firebase user role:", firestoreRole)
                
                const position = (user.Position || "").toUpperCase()
                const roleCode = (user.RoleCode || "").toUpperCase()
                const mongoRole = (user.Role || "").toUpperCase()
                
                // Use Firebase role if available (it's the correct one), otherwise fall back to MongoDB logic
                const combinedRole = firestoreRole.includes("MANAGER") || firestoreRole.includes("LEADER")
                    ? firestoreRole
                    : position.includes("MANAGER") || position.includes("LEADER") || 
                      roleCode.includes("MANAGER") || roleCode.includes("LEADER") ||
                      mongoRole.includes("MANAGER") || mongoRole.includes("LEADER")
                      ? (position.includes("ENGINEERING") ? "ENGINEERING MANAGER" : "MANAGER")
                      : roleCode || mongoRole || "STAFF"
                
                setUserContext({
                    role: user.Department?.toLowerCase() || "",
                    id: storedId,
                    name: user.Firstname + " " + user.Lastname,
                    profilePicture: user.ProfilePicture || "",
                    dept: user.Department?.toLowerCase() || "",
                    userRole: combinedRole
                })

                const docRef = doc(db, "appointments", id)
                unsubscribe = onSnapshot(docRef, async (docSnap) => {
                    if (docSnap.exists()) {
                        const appointmentData = docSnap.data()
                        setData(appointmentData)
                        setConfNotes((prev) => prev || appointmentData.confirmationNotes || "")

                        // FETCH SUBMITTER NAME IF ID EXISTS
                        if (appointmentData.submittedBy && appointmentData.submittedBy !== "SYSTEM") {
                            try {
                                const subRes = await fetch(`/api/user?id=${encodeURIComponent(appointmentData.submittedBy)}`)
                                const subUser = await subRes.json()
                                if (subUser?.Firstname) {
                                    setSubmitterName(`${subUser.Firstname} ${subUser.Lastname}`)
                                }
                            } catch (e) { console.error("SUBMITTER_FETCH_ERROR", e) }
                        }
                    }
                    setLoading(false)
                })
            } catch (err) {
                toast.error("Failed to connect to the server.")
                setLoading(false)
            }
        }
        establishUplink()
        return () => unsubscribe?.()
    }, [id])

    const handleStatusUpdate = async (newStatus: string, additionalData = {}) => {
        setActionLoading(true)
        const toastId = toast.loading(`Updating status to ${newStatus.toLowerCase()}...`)
        try {
            const docRef = doc(db, "appointments", id)
            const statusKey = `${newStatus.toLowerCase()}At`
            const actorKey = `${newStatus.toLowerCase()}By`

            await updateDoc(docRef, {
                status: newStatus.toUpperCase(),
                updatedAt: serverTimestamp(),
                [statusKey]: serverTimestamp(),
                [actorKey]: userContext.name,
                lastModifiedBy: userContext.id,
                ...additionalData
            })
            toast.success(`Visit successfully marked as ${newStatus.toLowerCase()}.`, { id: toastId })
        } catch (err) {
            toast.error("Failed to update status. Please try again.", { id: toastId })
        } finally {
            setActionLoading(false)
        }
    }

    const handleCancel = async () => {
        if (!cancelReason.trim()) {
            toast.error("Please provide a reason for cancellation")
            return
        }
        setActionLoading(true)
        const toastId = toast.loading("Cancelling request...")
        try {
            const docRef = doc(db, "appointments", id)
            await updateDoc(docRef, {
                status: "CANCELLED",
                updatedAt: serverTimestamp(),
                cancelledAt: serverTimestamp(),
                cancelledBy: userContext.name,
                cancelledById: userContext.id,
                cancelReason: cancelReason.trim(),
                lastModifiedBy: userContext.id,
            })
            toast.success("Request has been cancelled.", { id: toastId })
            setShowCancelForm(false)
            setCancelReason("")
        } catch (err) {
            toast.error("Failed to cancel request. Please try again.", { id: toastId })
        } finally {
            setActionLoading(false)
        }
    }

    const handleDownload = async (url: string) => {
        const toastId = toast.loading("Preparing download...")
        try {
            const response = await fetch(url)
            const blob = await response.blob()
            const blobUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = blobUrl
            link.download = `Reference_${id.slice(-6).toUpperCase()}_Document.pdf`
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(blobUrl)
            toast.success("Download complete.", { id: toastId })
        } catch (err) {
            toast.error("Failed to download the document.", { id: toastId })
        }
    }

    if (loading) return <LoadingScreen />

    const isEngineering = userContext.role === "it" || userContext.role === "engineering"
    const isSales = userContext.role === "sales"
    const isRequestor = userContext.id === data?.submittedBy
    const isStaff = isEngineering || userContext.role === "admin"
    
    // IT, Engineering Leader, Engineering Manager, and Super Admin can assign personnel
    const userDeptUpper = userContext.dept.toUpperCase().trim()
    const userRoleUpper = userContext.userRole.trim()
    const isEngDept = userDeptUpper === "ENGINEERING"
    const isManagerRole = ["LEADER", "MANAGER", "SUPER ADMIN", "ENGINEERING MANAGER", "ENGINEERING LEADER"].includes(userRoleUpper)
    
    const canAssignPersonnel = 
        userDeptUpper === "IT" || 
        (isEngDept && isManagerRole) ||
        ["ENGINEERING MANAGER", "ENGINEERING LEADER"].includes(userRoleUpper)
    
    // DEBUG: Check user values
    console.log("[DEBUG] userContext:", { 
        dept: userContext.dept, 
        deptUpper: userDeptUpper,
        userRole: userContext.userRole, 
        roleUpper: userRoleUpper,
        isEngDept,
        isManagerRole,
        canAssignPersonnel 
    })

    const isPending = status === "PENDING"
    const isConfirmed = status === "CONFIRMED"
    const isCompleted = status === "COMPLETED"

    const getStatusInsight = () => {
        if (isCompleted) return {
            responsibility: "VISIT FINISHED",
            tip: isRequestor ? "The visit report is finalized. Thank you!" : "Record archived. No further action needed.",
            color: "text-emerald-500",
            bg: "bg-emerald-50",
            border: "border-emerald-100",
            iconBg: "bg-emerald-500",
            label: "System Status"
        };
        
        if (isOverdue) return {
            responsibility: isStaff ? "YOUR ACTION" : "ENGINEERING MGMT",
            tip: isStaff ? "URGENT: This appointment is past its SLA limit!" : "We're sorry for the delay. We are expediting your visit.",
            color: "text-red-500",
            bg: "bg-red-50",
            border: "border-red-100",
            iconBg: "bg-red-500",
            label: isStaff ? "SLA Breach" : "Delay Alert"
        };

        if (isPending) return {
            responsibility: isStaff ? "YOUR ACTION" : "ENGINEERING TEAM",
            tip: isStaff ? "Awaiting personnel assignment or site visit report." : "We're preparing the team for your site visit.",
            color: "text-blue-500",
            bg: "bg-blue-50",
            border: "border-blue-100",
            iconBg: "bg-blue-500",
            label: isStaff ? "Next Step" : "Current Phase"
        };

        if (isConfirmed) return {
            responsibility: isSales ? "YOUR ACTION" : "SALES MGMT",
            tip: isSales ? "Engineer has reported. Please review and finalize." : "Awaiting final manager approval of the report.",
            color: "text-blue-600",
            bg: "bg-blue-50",
            border: "border-blue-100",
            iconBg: "bg-blue-600",
            label: isSales ? "Final Review" : "Approval Phase"
        };

        return {
            responsibility: "SYSTEM",
            tip: "Synchronizing appointment data...",
            color: "text-slate-400",
            bg: "bg-slate-50",
            border: "border-slate-100",
            iconBg: "bg-slate-400",
            label: "Status"
        };
    };

    const insight = getStatusInsight();

    const protocolDisplay = protocolLabels.length > 0 
        ? protocolLabels.join(" + ").toUpperCase() 
        : (Array.isArray(data?.protocols) ? data.protocols.join(" + ").toUpperCase() : (data?.protocols?.toUpperCase() || "NOT_DEFINED"))

    const formatBookingDate = (ts: any) => {
        if (!ts) return "UNSCHEDULED"
        const date = ts.toDate ? ts.toDate() : new Date(ts)
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }).toUpperCase()
    }

    return (
        <SidebarProvider defaultOpen={false}>
            <AppSidebar userId={userContext.id} />
            <SidebarInset className="bg-[#F8FAFC] pb-24 md:pb-0 relative flex flex-col min-h-screen">

                {/* --- STICKY HEADER SECTION --- */}
                <PageHeader
                    title={`REF: ${data?.siteVisitNo || id.slice(-8).toUpperCase()}`}
                    version="V2.8-STABLE"
                    showBackButton={true}
                    trigger={<SidebarTrigger className="mr-2" />}
                    actions={
                        <div className="flex items-center gap-1.5">
                            {!isCompleted && (
                                <div className={cn(
                                    "flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg border transition-all shrink-0",
                                    isOverdue ? "bg-red-50 border-red-100" : "bg-white border-slate-200"
                                )}>
                                    <div className="flex flex-col items-end border-r pr-1.5 border-slate-100">
                                        <span className={cn(
                                            "text-[5px] font-black uppercase tracking-widest leading-none",
                                            isOverdue ? "text-red-500" : "text-slate-400"
                                        )}>SLA</span>
                                        <span className={cn(
                                            "text-[6px] font-bold uppercase mt-0.5",
                                            isOverdue ? "text-red-600" : "text-slate-500"
                                        )}>
                                            {isPending ? "Visit" : "Appr"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Timer size={9} className={cn("shrink-0", isOverdue ? "text-red-500" : "text-blue-500")} />
                                        <span className={cn(
                                            "text-[9px] font-mono font-black tabular-nums leading-none",
                                            isOverdue ? "text-red-600" : "text-slate-900"
                                        )}>
                                            {countdown}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    navigator.clipboard.writeText(id.toUpperCase())
                                    toast.success("Reference ID copied")
                                }}
                                className="h-6.5 px-2 rounded-lg border-slate-200 text-slate-500 hover:text-blue-600 transition-all text-[7px] font-bold uppercase tracking-widest gap-1 bg-white"
                            >
                                <Copy size={8} />
                                <span className="hidden sm:inline">Copy ID</span>
                            </Button>
                        </div>
                    }
                />

                <main className="flex-1 w-full max-w-7xl mx-auto p-1.5 md:p-2.5 space-y-1.5">

                    {/* --- EXTREME HUD: STATUS, PROGRESS & TIMER --- */}
                    <div className="bg-white border border-slate-200/50 rounded-xl p-1.5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        {/* Status Section */}
                        <div className="flex items-center gap-2.5 pr-3 md:border-r border-slate-100 shrink-0">
                            <div className={cn(
                                "size-8 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/10",
                                isCompleted ? "bg-emerald-500" : isConfirmed ? "bg-blue-500" : "bg-amber-500"
                            )}>
                                {isCompleted ? <CheckCircle2 size={16} /> : isConfirmed ? <Clock size={16} /> : <Activity size={16} />}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-tight text-slate-900 leading-none mb-0.5">{status}</span>
                                <div className="flex items-center gap-1">
                                    <Timer size={8} className={cn(isOverdue ? "text-red-500" : "text-blue-500")} />
                                    <span className={cn("text-[8px] font-mono font-black tabular-nums", isOverdue ? "text-red-600" : "text-slate-600")}>{countdown}</span>
                                </div>
                            </div>
                        </div>

                        {/* Integrated Progress Stepper */}
                        <div className="flex-1 flex items-center px-2 relative">
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-50 -translate-y-1/2 z-0" />
                            <div 
                                className="absolute top-1/2 left-0 h-0.5 bg-blue-500 -translate-y-1/2 z-0 transition-all duration-1000" 
                                style={{ width: isPending ? '0%' : isConfirmed ? '50%' : '100%' }}
                            />
                            <div className="flex items-center justify-between w-full relative z-10">
                                <MiniStep active={true} completed={!isPending} label="Pending" />
                                <MiniStep active={isConfirmed || isCompleted} completed={isCompleted} label="Completed" />
                                <MiniStep active={isCompleted} completed={isCompleted} label="Acknowledged" />
                            </div>
                        </div>

                        {/* Ball in Court Section (Personalized) */}
                        <div className="hidden lg:flex items-center gap-2 px-3 border-l border-slate-100 shrink-0">
                          <div className="flex flex-col items-end">
                            <span className="text-[6px] font-black uppercase text-slate-400 tracking-widest leading-none mb-0.5">{insight.label}</span>
                            <span className={cn("text-[9px] font-black leading-none uppercase", insight.color)}>{insight.responsibility}</span>
                          </div>
                          <div className={cn("size-7 rounded-lg flex items-center justify-center", insight.bg)}>
                            <User size={12} className={insight.color} />
                          </div>
                        </div>

                        {/* Action Tip Section (Personalized) */}
                        <div className="hidden xl:flex items-center gap-2 px-3 border-l border-slate-100 shrink-0 max-w-[180px]">
                          <p className="text-[8px] font-bold text-slate-500 italic leading-tight uppercase">
                            Tip: {insight.tip}
                          </p>
                        </div>

                        {/* Quick Metrics */}
                        <div className="flex items-center gap-2 pl-3 md:border-l border-slate-100 shrink-0">
                            <div className="flex flex-col items-end">
                                <span className="text-[6px] font-black uppercase text-slate-400 tracking-widest leading-none mb-0.5">Elapsed</span>
                                <span className="text-[10px] font-black text-slate-900 leading-none">{timeElapsed}</span>
                            </div>
                            <div className="size-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                <History size={12} />
                            </div>
                        </div>
                    </div>

                    {/* Smart Status Insight (Mobile Personalized Card) */}
                    <div className={cn("lg:hidden rounded-xl p-3 border shadow-sm shrink-0 flex items-center justify-between gap-3", insight.bg, insight.border)}>
                      <div className="flex items-center gap-2.5">
                        <div className={cn("size-8 rounded-lg flex items-center justify-center text-white", insight.iconBg)}>
                          <User size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[7px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">{insight.label}</span>
                          <span className={cn("text-[11px] font-black leading-none uppercase", insight.color)}>{insight.responsibility}</span>
                        </div>
                      </div>
                      <div className="flex-1 max-w-[160px] text-right">
                        <p className={cn("text-[8px] font-bold italic uppercase leading-tight", insight.color)}>
                          {insight.tip}
                        </p>
                      </div>
                    </div>

                    {/* --- COMPACT HUD PASS 2 --- */}
                    <section className="grid grid-cols-2 lg:grid-cols-5 gap-1.5">
                        <CompactStat label="SERVICE" value={protocolDisplay} icon={ShieldAlert} />
                        <CompactStat label="CLIENT" value={data?.client} icon={Building2} />
                        <CompactStat label="REQUESTOR" value={submitterName || data?.requestorName || "UNSPECIFIED"} icon={Fingerprint} />
                        <CompactStat label="ENGINEER" value={data?.pic || "UNASSIGNED"} icon={User} color={!data?.pic || data?.pic === "UNASSIGNED" ? "text-slate-400" : "text-blue-600"} />
                        <CompactStat label="REF ID" value={data?.siteVisitNo || id.slice(-8).toUpperCase()} icon={Terminal} />
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-1.5 md:gap-2">

                        {/* --- LEFT COLUMN: ACTION CENTER --- */}
                        <div className="lg:col-span-4 space-y-1.5 order-2 lg:order-1">
                            <div className="relative">
                                {canAssignPersonnel && isPending && (
                                    <div className="space-y-1.5">
                                        {/* PERSONNEL ASSIGNMENT SECTION (If UNASSIGNED) */}
                                        {(!data?.pic || data.pic === "UNASSIGNED") ? (
                                            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm space-y-3">
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                    <div className="size-7 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                                                        <User size={14} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-[9px] font-black uppercase text-slate-900 tracking-tight leading-none">Assign Personnel</h3>
                                                        <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Engineering Deployment</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Select PIC(s)*</label>
                                                    <div className="grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto pr-1 scrollbar-hide">
                                                        {availablePics.map((pic: any) => {
                                                            const picName = (pic.name || pic).trim().toUpperCase();
                                                            const isChecked = selectedAssignees.includes(picName);
                                                            return (
                                                                <button 
                                                                    key={picName}
                                                                    onClick={() => {
                                                                        if (isChecked) setSelectedAssignees(prev => prev.filter(p => p !== picName));
                                                                        else setSelectedAssignees(prev => [...prev, picName]);
                                                                    }}
                                                                    className={cn(
                                                                        "flex items-center justify-between w-full px-3 h-8 rounded-lg border transition-all text-left",
                                                                        isChecked ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm" : "bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200"
                                                                    )}
                                                                >
                                                                    <span className="text-[9px] font-black uppercase">{picName}</span>
                                                                    {isChecked ? <CheckCircle2 size={12} /> : <div className="size-3 rounded-full border-2 border-slate-200" />}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <Button
                                                    disabled={actionLoading || selectedAssignees.length === 0}
                                                    onClick={() => handleStatusUpdate("PENDING", { 
                                                        pic: selectedAssignees.join(", "),
                                                        assignedAt: serverTimestamp(),
                                                        assignedBy: userContext.name,
                                                        assignedById: userContext.id
                                                    })}
                                                    className="w-full h-9 bg-zinc-900 hover:bg-zinc-800 text-white font-black rounded-lg uppercase tracking-widest transition-all text-[9px]"
                                                >
                                                    {actionLoading ? <Loader2 className="animate-spin size-3.5" /> : `Confirm ${selectedAssignees.length > 1 ? 'Multiple' : 'Assignment'}`}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-white/5 overflow-hidden group">
                                                <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 bg-blue-500 rounded text-white">
                                                            <Cpu size={12} />
                                                        </div>
                                                        <h3 className="text-[9px] font-black uppercase tracking-tight">Visit Confirmation</h3>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="size-1 rounded-full bg-blue-500 animate-pulse" />
                                                        <span className="text-[7px] font-bold text-blue-400 uppercase">Live</span>
                                                    </div>
                                                </div>

                                                {/* PIC Assignment Info */}
                                                {data?.assignedAt && (
                                                    <div className="flex items-center gap-1.5 text-[6px] text-slate-400 uppercase tracking-widest">
                                                        <User size={8} className="text-blue-400" />
                                                        <span>Assigned: {data.assignedBy || 'System'} • {data.assignedAt?.toDate ? data.assignedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <div className="flex gap-1.5">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => window.location.href = `viber://chat?number=${data.requestorPhone}`}
                                                            className="flex-1 bg-white/5 hover:bg-white/10 border-white/10 text-white rounded-lg font-bold uppercase text-[7px] h-7"
                                                        >
                                                            <Radio size={9} className="mr-1 text-blue-400" /> Viber
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(data.requestorPhone || "")
                                                                toast.success("Phone copied")
                                                            }}
                                                            className="bg-white/5 hover:bg-white/10 border-white/10 text-white rounded-lg font-bold uppercase text-[7px] h-7"
                                                        >
                                                            <Copy size={9} className="mr-1" /> Copy #
                                                        </Button>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Textarea
                                                            value={confNotes}
                                                            onChange={(e) => setConfNotes(e.target.value)}
                                                            className="min-h-[80px] rounded-lg bg-black/30 border-white/10 font-medium text-[12px] focus:border-blue-500/50 transition-all resize-none placeholder:text-slate-700 text-slate-100 p-2.5 shadow-inner leading-snug"
                                                            placeholder="Findings and actions taken during visit..."
                                                        />
                                                    </div>

                                                    <Button
                                                        disabled={actionLoading || !confNotes}
                                                        onClick={() => handleStatusUpdate("CONFIRMED", { confirmationNotes: confNotes })}
                                                        className="w-full h-9 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-lg uppercase tracking-widest transition-all group shadow-lg shadow-blue-600/20 text-[9px]"
                                                    >
                                                        {actionLoading ? <Loader2 className="animate-spin size-3.5" /> : "Confirm Visit Complete"}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isPending && (isRequestor || isSales || isStaff) && (
                                    <div className="bg-white border border-red-100 p-3 rounded-xl shadow-sm">
                                        {!showCancelForm ? (
                                            <button
                                                onClick={() => setShowCancelForm(true)}
                                                className="w-full flex items-center justify-center gap-2 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <XCircle size={14} />
                                                <span className="text-[9px] font-black uppercase tracking-widest">Cancel / Decline Request</span>
                                            </button>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 border-b border-red-100 pb-2">
                                                    <div className="size-7 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
                                                        <XCircle size={14} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-[9px] font-black uppercase text-red-900 tracking-tight leading-none">Cancel Request</h3>
                                                        <p className="text-[6px] font-bold text-red-400 uppercase tracking-widest mt-0.5">Reason Required</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    <Textarea
                                                        value={cancelReason}
                                                        onChange={(e) => setCancelReason(e.target.value)}
                                                        className="min-h-[60px] rounded-lg bg-red-50/50 border-red-100 font-medium text-[11px] focus:border-red-300 transition-all resize-none placeholder:text-red-300 text-red-900 p-2 leading-snug"
                                                        placeholder="Enter reason for cancellation..."
                                                    />
                                                </div>

                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => {
                                                            setShowCancelForm(false)
                                                            setCancelReason("")
                                                        }}
                                                        className="flex-1 h-8 bg-white hover:bg-slate-50 text-slate-600 font-bold rounded-lg uppercase text-[9px] border-slate-200"
                                                    >
                                                        Back
                                                    </Button>
                                                    <Button
                                                        disabled={actionLoading || !cancelReason.trim()}
                                                        onClick={handleCancel}
                                                        className="flex-1 h-8 bg-red-600 hover:bg-red-500 text-white font-black rounded-lg uppercase tracking-widest transition-all text-[9px]"
                                                    >
                                                        {actionLoading ? <Loader2 className="animate-spin size-3" /> : "Confirm Cancel"}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isSales && isConfirmed && (
                                    <div className="bg-white border border-slate-200/50 p-3 rounded-xl shadow-sm flex flex-col gap-2">
                                        <div className="flex items-center gap-2.5 w-full border-b border-slate-100 pb-2">
                                            <div className="size-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md">
                                                <ShieldCheck size={16} />
                                            </div>
                                            <div className="text-left">
                                                <h4 className="text-[9px] font-black uppercase text-slate-900 tracking-tight leading-none mb-0.5">Manager Review</h4>
                                                <p className="text-[6px] text-slate-400 font-bold uppercase tracking-widest leading-none">Approval Pending</p>
                                            </div>
                                        </div>

                                        <div className="relative p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="absolute top-0 left-2 -translate-y-1/2 px-1.5 py-0.5 bg-white rounded-full text-[5px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">Engineer Report</div>
                                            <p className="text-[11px] leading-relaxed text-slate-700 font-medium italic">"{data.confirmationNotes}"</p>
                                        </div>

                                        <Button
                                            disabled={actionLoading}
                                            onClick={() => handleStatusUpdate("COMPLETED")}
                                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg h-9 uppercase tracking-widest transition-all shadow-md text-[9px]"
                                        >
                                            {actionLoading ? <Loader2 className="animate-spin size-3.5" /> : "Approve & Finalize"}
                                        </Button>
                                    </div>
                                )}

                                {((isEngineering && (isConfirmed || isCompleted)) || (isSales && isPending) || (isSales && isCompleted)) && (
                                    <div className="bg-white border border-slate-200/50 p-4 rounded-xl flex flex-col items-center text-center overflow-hidden shadow-sm">
                                        <div className={cn(
                                            "size-10 rounded-lg border flex items-center justify-center mb-2 transition-all",
                                            isCompleted ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-300"
                                        )}>
                                            {isCompleted ? <CheckCircle2 size={20} /> : <Clock size={20} className="animate-pulse" />}
                                        </div>
                                        <div className="space-y-0.5">
                                            <h4 className="text-[9px] font-black uppercase text-slate-900 tracking-widest">
                                                {isCompleted ? "Visit Finalized" : "Work in Progress"}
                                            </h4>
                                            <p className="text-[7px] font-medium text-slate-500 uppercase tracking-wide leading-tight max-w-[160px]">
                                                {isCompleted
                                                    ? "Record archived and available for reporting."
                                                    : isEngineering
                                                        ? "Report submitted. Awaiting manager approval."
                                                        : "The engineer is currently handling the visit."}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ACTIVITY - MORE COMPACT PASS 2 */}
                            <div className="bg-white border border-slate-200/50 rounded-xl shadow-sm overflow-hidden">
                                <div className="bg-slate-50/50 px-2.5 py-1.5 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="text-[7px] font-bold uppercase tracking-widest flex items-center gap-1 text-slate-500">
                                        <History size={9} />
                                        Activity
                                    </h3>
                                    {isCompleted && (
                                        <button 
                                            className="text-[7px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700"
                                            onClick={() => window.print()}
                                        >
                                            <Download size={8} className="inline mr-0.5" /> Print
                                        </button>
                                    )}
                                </div>
                                <div className="p-2.5 pb-0.5 space-y-0">
                                    <TimelineItem label="Created" time={data?.createdAt} status="done" desc="Pending Request submitted" />
                                    <TimelineItem 
                                        label="In Progress" 
                                        time={data?.confirmedAt} 
                                        status={isConfirmed ? "current" : isCompleted ? "done" : "pending"} 
                                        desc={isConfirmed ? "Request Completed - awaiting approval" : "Engineer to submit report"}
                                        dept={isConfirmed ? "SALES MGMT" : isPending ? "ENGINEERING" : undefined}
                                    />
                                    <TimelineItem 
                                        label="Acknowledged" 
                                        time={data?.completedAt} 
                                        status={isCompleted ? "done" : "pending"} 
                                        desc="Request Acknowledge - completed" 
                                        isLast 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* --- RIGHT COLUMN: DENSE VISIT DETAILS --- */}
                        <div className="lg:col-span-8 space-y-1.5 order-1 lg:order-2">
                            <div className="bg-white border border-slate-200/50 rounded-xl shadow-sm overflow-hidden">
                                <div className="bg-slate-900 px-3 py-2 flex justify-between items-center relative overflow-hidden group">
                                    <div className="flex items-center gap-2 relative z-10">
                                        <div className="p-1 bg-blue-500 rounded text-white">
                                            <FileText size={12} />
                                        </div>
                                        <div>
                                            <h3 className="text-[9px] font-black text-white tracking-widest uppercase leading-none mb-0.5">Visit Details</h3>
                                            <p className="text-[6px] font-bold text-blue-400 uppercase tracking-widest leading-none">Service Information</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setIsDetailsCollapsed(!isDetailsCollapsed)}
                                        className="relative z-10 p-1 hover:bg-white/10 rounded text-white transition-all"
                                    >
                                        <ChevronLeft size={10} className={cn("transition-transform duration-300", isDetailsCollapsed ? "-rotate-90" : "rotate-90")} />
                                    </button>
                                </div>

                                {!isDetailsCollapsed && (
                                    <div className="divide-y divide-slate-50 animate-in slide-in-from-top-2 duration-200">
                                        <div className="p-3 md:p-4 bg-slate-50/10">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                                                <ManifestItem label="Date" value={formatBookingDate(data.appointmentDate)} icon={Calendar} isHighlight />
                                                <ManifestItem label="Support Category" value={protocolDisplay} icon={Wrench} />
                                                <ManifestItem label="Engineer PIC" value={data.pic} icon={User} />
                                            </div>
                                        </div>

                                        <div className="p-3 md:p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                                                <div className="space-y-3">
                                                    <ManifestItem label="Client / Company" value={data.client} icon={Building2} canCopy />
                                                    <div className="grid grid-cols-2 gap-3 pl-3 border-l border-slate-100">
                                                        <ManifestItem label="Email Address" value={data.email} icon={MessageSquare} canCopy />
                                                        <ManifestItem label="Contact Number" value={data.contactNumber} icon={Radio} canCopy />
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <ManifestItem label="Site Location" value={data.address} icon={MapPin} canCopy />
                                                    {data.landmark && (
                                                        <div className="pl-3 border-l border-slate-100">
                                                            <ManifestItem label="Landmark / Building" value={data.landmark} icon={Building2} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <ManifestItem label="Agenda / Purpose" value={data.agenda} icon={ClipboardList} isLongText />
                                            {data.notes && (
                                                <ManifestItem label="Strategic Context / Notes" value={data.notes} icon={Info} isLongText />
                                            )}
                                        </div>

                                        {/* DEPLOYMENT REQUIREMENTS (PPE, Personnel, Permits) */}
                                        {(data.ppe?.length > 0 || data.personnel?.length > 0 || data.permits?.length > 0) && (
                                            <div className="p-3 md:p-4 bg-slate-50/20 border-t border-slate-100">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="size-5 bg-blue-50 rounded flex items-center justify-center text-blue-600 border border-blue-100">
                                                        <ShieldCheck size={12} />
                                                    </div>
                                                    <span className="text-[9px] font-black uppercase text-slate-900 tracking-tight">Deployment Requirements</span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    {data.personnel?.length > 0 && (
                                                        <RequirementList label="Required Personnel" items={data.personnel} icon={User} color="bg-blue-50 text-blue-700 border-blue-100" />
                                                    )}
                                                    {data.ppe?.length > 0 && (
                                                        <RequirementList label="Mandatory PPE" items={data.ppe} icon={ShieldAlert} color="bg-amber-50 text-amber-700 border-amber-100" />
                                                    )}
                                                    {data.permits?.length > 0 && (
                                                        <RequirementList label="Required Permits" items={data.permits} icon={FileText} color="bg-emerald-50 text-emerald-700 border-emerald-100" />
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {data.fileUrl && (
                                            <div className="p-3 bg-slate-50/30 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1 bg-white border border-slate-200 rounded text-slate-400">
                                                        <Paperclip size={10} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black uppercase text-slate-900 leading-none mb-0.5">Attachment</span>
                                                        <span className="text-[6px] text-slate-400 font-bold uppercase tracking-widest leading-none">Reference Doc</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <a href={data.fileUrl} target="_blank" rel="noopener noreferrer" className="h-7 px-2.5 inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg hover:border-blue-500 transition-all text-[7px] font-black uppercase text-slate-600">
                                                        <ExternalLink size={9} /> View
                                                    </a>
                                                    <button onClick={() => handleDownload(data.fileUrl)} className="h-7 px-2.5 inline-flex items-center gap-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all text-[7px] font-black uppercase">
                                                        <Download size={9} /> Get File
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {(isConfirmed || isCompleted) && (
                                            <div className="p-3 bg-slate-900 text-white relative overflow-hidden">
                                                <div className="flex items-center gap-1.5 mb-1.5 relative z-10">
                                                    <div className="p-0.5 bg-blue-500/20 rounded text-blue-400">
                                                        <Cpu size={9} />
                                                    </div>
                                                    <span className="text-[8px] font-black uppercase tracking-widest">Engineer's Report</span>
                                                </div>
                                                <div className="relative pl-3 border-l-2 border-blue-500/30 z-10">
                                                    <p className="text-[11px] italic text-slate-300 leading-snug font-medium">
                                                        "{data.confirmationNotes}"
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <button onClick={() => router.back()} className="px-3 h-7 flex items-center justify-center gap-1.5 text-[7px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-all bg-white rounded-lg border border-slate-200 shadow-sm">
                                    <ChevronLeft size={9} /> Back
                                </button>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[6px] font-bold text-slate-300 uppercase tracking-widest">End of Record</span>
                                    <div className="size-1 bg-slate-200 rounded-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                <CollaborationHub
                    requestId={id}
                    spfNumber={data?.siteVisitNo || id}
                    collectionName="appointments"
                    messages={data?.messages || []}
                    currentUserId={userContext.id}
                    userName={userContext.name}
                    profilePicture={userContext.profilePicture}
                    userRole={userContext.role}
                    status={status}
                    title={data?.client || "dsiconnect"}
                />
            </SidebarInset>
        </SidebarProvider>
    )
}

function RequirementList({ label, items, icon: Icon, color }: any) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
                <Icon size={10} className="text-slate-400" />
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
            </div>
            <div className="flex flex-wrap gap-1">
                {items.map((item: string, idx: number) => (
                    <Badge key={idx} variant="outline" className={cn("text-[7px] px-1.5 py-0 rounded-md border font-black uppercase tracking-tight", color)}>
                        {item}
                    </Badge>
                ))}
            </div>
        </div>
    )
}

function MiniStep({ active, completed, label }: any) {
    return (
        <div className="flex flex-col items-center gap-1 relative z-10">
            <div className={cn(
                "size-5 md:size-6 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                completed ? "bg-blue-500 border-blue-500 text-white" : 
                active ? "bg-white border-blue-500 text-blue-600 ring-2 ring-blue-50" : 
                "bg-white border-slate-200 text-slate-300"
            )}>
                {completed ? <CheckCircle2 size={10} /> : <div className="size-1.5 bg-current rounded-full" />}
            </div>
            <span className={cn(
                "text-[7px] md:text-[8px] font-black uppercase tracking-tight",
                active ? "text-slate-900" : "text-slate-400"
            )}>{label}</span>
        </div>
    )
}

function CompactStat({ label, value, icon: Icon, color = "text-slate-900" }: any) {
    return (
        <div className="bg-white p-2.5 border border-slate-200/50 shadow-sm rounded-xl flex items-center gap-3 group hover:shadow-md transition-all">
            <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-500 transition-all text-slate-400 shrink-0">
                <Icon size={14} />
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-1">{label}</span>
                <span className={cn("text-[11px] font-black tracking-tight truncate leading-none", color)}>
                    {value || "N/A"}
                </span>
            </div>
        </div>
    )
}

function Step({ active, completed, icon: Icon, label, date }: any) {
    return (
        <div className="flex flex-col items-center gap-1.5 relative z-10">
            <div className={cn(
                "size-8 md:size-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 shadow-sm",
                completed ? "bg-blue-500 border-blue-500 text-white" : 
                active ? "bg-white border-blue-500 text-blue-600 ring-4 ring-blue-50" : 
                "bg-white border-slate-200 text-slate-300"
            )}>
                {completed ? <CheckCircle2 size={16} /> : <Icon size={16} />}
            </div>
            <div className="flex flex-col items-center">
                <span className={cn(
                    "text-[9px] md:text-[10px] font-black uppercase tracking-tight",
                    active ? "text-slate-900" : "text-slate-400"
                )}>{label}</span>
                <span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest">{date}</span>
            </div>
        </div>
    )
}

function TimelineItem({ label, time, status, desc, dept, isLast = false }: any) {
    const isActive = status === "done"
    const isCurrent = status === "current"
    
    // Format date and time
    const formatDateTime = (timestamp: any) => {
        if (!timestamp?.toDate) return "---"
        const date = timestamp.toDate()
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        return `${dateStr} • ${timeStr}`
    }
    
    const formattedDateTime = formatDateTime(time)
    
    return (
        <div className="relative flex gap-3">
            {!isLast && <div className={cn("absolute left-[5px] top-4 w-[1px] h-full", isActive ? "bg-blue-100" : "bg-slate-50")} />}
            <div className={cn(
                "relative z-10 size-[10px] rounded-full border-2 mt-1 flex items-center justify-center transition-all",
                isCurrent ? "bg-amber-500 border-white ring-2 ring-amber-50 shadow-xs" :
                isActive ? "bg-blue-600 border-white ring-2 ring-blue-50 shadow-xs" : "bg-white border-slate-200"
            )} />
            <div className="pb-3 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-[9px] font-bold uppercase tracking-tight", 
                        isCurrent ? "text-amber-600" :
                        isActive ? "text-slate-900" : "text-slate-400 opacity-60"
                    )}>{label}</span>
                    {(isActive || isCurrent) && (
                        <span className={cn("text-[7px] px-1.5 py-0.5 rounded-full font-medium border",
                            isCurrent ? "bg-amber-50 text-amber-600 border-amber-100" :
                            "bg-blue-50 text-blue-600 border-blue-100"
                        )}>
                            {formattedDateTime}
                        </span>
                    )}
                    {isCurrent && dept && (
                        <span className="text-[7px] px-1.5 py-0.5 rounded-full font-black uppercase bg-red-50 text-red-600 border border-red-100">
                            {dept} • BALL
                        </span>
                    )}
                </div>
                <p className={cn("text-[8px] font-medium leading-none mt-0.5",
                    isCurrent ? "text-amber-600" : "text-slate-500"
                )}>{desc}</p>
            </div>
        </div>
    )
}

function ManifestItem({ label, value, icon: Icon, isLongText = false, isHighlight = false, canCopy = false }: { label: string, value: string, icon: any, isLongText?: boolean, isHighlight?: boolean, canCopy?: boolean }) {
    const copyToClipboard = () => {
        if (!value) return
        navigator.clipboard.writeText(value)
        toast.success(`${label} copied`)
    }

    return (
        <div className="flex flex-col gap-1.5 group">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <div className="p-1 bg-slate-50 rounded text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                        <Icon size={10} />
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                </div>
                {canCopy && value && (
                    <button 
                        onClick={copyToClipboard}
                        className="p-1 hover:bg-slate-100 rounded text-slate-300 hover:text-blue-500 transition-all opacity-0 group-hover:opacity-100"
                    >
                        <Copy size={8} />
                    </button>
                )}
            </div>
            <div className={cn(
                "pl-3 border-l border-slate-100 group-hover:border-blue-100 transition-all",
                isLongText ? "min-h-[30px]" : ""
            )}>
                <span className={cn(
                    "block leading-tight font-semibold",
                    isHighlight ? "text-base md:text-lg text-blue-600 font-black tracking-tight" : "text-[12px] text-slate-700"
                )}>
                    {value || "N/A"}
                </span>
            </div>
        </div>
    )
}

function StatBlock({ label, value, icon: Icon, color = "" }: any) {
    return (
        <div className="bg-white p-5 border border-slate-200/60 shadow-sm rounded-2xl flex flex-col justify-between min-h-[110px] group hover:shadow-md transition-all">
            <div className="flex items-center gap-2.5 text-slate-400 mb-3">
                <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                    <Icon size={14} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
            </div>
            <div className="flex flex-col gap-1.5">
                <span className={cn("text-sm md:text-base font-bold tracking-tight truncate", color || "text-slate-900")}>
                    {value || "NOT_SET"}
                </span>
                <div className="h-[3px] w-8 bg-slate-100 rounded-full group-hover:w-full group-hover:bg-blue-500/20 transition-all duration-500" />
            </div>
        </div>
    )
}

function LoadingScreen() {
    return (
        <div className="h-screen flex flex-col items-center justify-center gap-6 bg-slate-50">
            <div className="relative flex items-center justify-center">
                <div className="absolute size-20 border-2 border-t-blue-600 rounded-full animate-spin border-slate-200" />
                <div className="size-12 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                    <Activity className="text-blue-600 size-6 animate-pulse" />
                </div>
            </div>
            <div className="flex flex-col items-center gap-1">
                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-900 ml-1">Loading Appointment</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Synchronizing Record...</span>
            </div>
        </div>
    )
}