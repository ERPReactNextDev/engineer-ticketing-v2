"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Clock, RefreshCcw, CheckCircle2, History, Loader2, 
  ShieldCheck, ChevronLeft, Image as ImageIcon, ExternalLink,
  Check, X, Timer, FileText, Briefcase, MapPin, User, Copy,
  ArrowRight, Info, AlertCircle, Share2, Calendar, Activity,
  Download, Building2, ClipboardList, Timer as TimerIcon,
  Search, Eye, Trash2, Edit3, Send, Plus, Fingerprint,
  Radio, Cpu, ShieldAlert, Wrench, LayoutGrid, Ruler, Handshake, Construction
} from "lucide-react";

// DATABASE
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";

// UI COMPONENTS
import { toast } from "sonner";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// CUSTOM COMPONENTS
import { PageHeader } from "@/components/page-header";
import { CollaborationHub } from "@/components/collaboration-hub";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

export default function JobDetailsPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notes, setNotes] = useState("");
  const [userContext, setUserContext] = useState({ id: "", name: "", role: "", profilePicture: "" });
  const [elapsedTime, setElapsedTime] = useState("0h 0m");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState("00:00:00");
  const [isOverdue, setIsOverdue] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const status = data?.status?.toUpperCase() || "PENDING";
  const isAdmin = userContext.role === "admin" || userContext.role === "it";

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (userId) {
      fetch(`/api/user?id=${userId}`)
        .then(res => res.json())
        .then(user => setUserContext({
          id: userId,
          name: `${user.Firstname} ${user.Lastname}`,
          role: user.Department?.toLowerCase() || "",
          profilePicture: user.profilePicture || ""
        }));
    }

    const docRef = doc(db, "job_requests", params.id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const jobData = docSnap.data();
        setData(jobData);
        setNotes(jobData.adminNotes || "");
        if (jobData.attachments?.[0] && !selectedImage) {
          setSelectedImage(jobData.attachments[0]);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [params.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (data?.createdAt) {
        const start = new Date(data.createdAt.seconds * 1000).getTime();
        const now = new Date().getTime();
        
        // SLA: 24h limit
        const limit = start + (24 * 60 * 60 * 1000);
        const diff = limit - now;
        const absDiff = Math.abs(diff);
        const h = Math.floor(absDiff / (1000 * 60 * 60));
        const m = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((absDiff % (1000 * 60)) / 1000);
        setCountdown(`${diff < 0 ? '-' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        setIsOverdue(diff < 0);

        // Total Elapsed
        const elapsed = now - start;
        const eh = Math.floor(elapsed / (1000 * 60 * 60));
        const em = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
        setElapsedTime(`${eh}h ${em}m`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [data]);

  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      const docRef = doc(db, "job_requests", params.id);
      await updateDoc(docRef, {
        status: newStatus,
        adminNotes: notes,
        updatedAt: serverTimestamp(),
        [`${newStatus.toLowerCase()}At`]: serverTimestamp(),
        [`${newStatus.toLowerCase()}By`]: userContext.name
      });
      toast.success(`Request marked as ${newStatus.toLowerCase()}`);
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const hasImages = data?.attachments?.length > 0 || data?.attachmentUrl;

  const isRequestor = userContext.id === data?.createdBy;
  const isEngineering = userContext.role === "engineering" || userContext.role === "it" || userContext.role === "admin";

  const getStatusInsight = () => {
    if (status === "COMPLETED") return {
      responsibility: "JOB FINISHED",
      tip: isRequestor ? "Your request is complete. Thank you!" : "Record archived. No further action needed.",
      color: "text-emerald-500",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      iconBg: "bg-emerald-500",
      label: "System Status"
    };
    
    if (isOverdue) return {
      responsibility: isEngineering ? "YOUR ACTION" : "ENGINEERING MGMT",
      tip: isEngineering ? "URGENT: This ticket is past its 24h limit!" : "We're sorry for the delay. We are expediting this.",
      color: "text-red-500",
      bg: "bg-red-50",
      border: "border-red-100",
      iconBg: "bg-red-500",
      label: isEngineering ? "SLA Breach" : "Delay Alert"
    };

    if (status === "PENDING") return {
      responsibility: isEngineering ? "YOUR ACTION" : "ENGINEERING TEAM",
      tip: isEngineering ? "New request received. Please assign a personnel." : "We've received your request and are reviewing it.",
      color: "text-blue-500",
      bg: "bg-blue-50",
      border: "border-blue-100",
      iconBg: "bg-blue-500",
      label: isEngineering ? "Next Step" : "Current Phase"
    };

    return {
      responsibility: isEngineering ? "YOUR ACTION" : "ASSIGNED ENGINEER",
      tip: isEngineering ? "Work is underway. Remember to update the console." : "The engineer is currently on-site for your project.",
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
      iconBg: "bg-blue-600",
      label: isEngineering ? "Ongoing Work" : "Live Update"
    };
  };

  const insight = getStatusInsight();

  return (
    <ProtectedPageWrapper>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar userId={userContext.id} />
        <SidebarInset className="bg-[#F8FAFC] pb-24 md:pb-0 relative flex flex-col min-h-screen">
          
          <PageHeader 
            title={`REF: ${params.id.slice(-8).toUpperCase()}`} 
            version="V3.2 STABLE" 
            showBackButton={true}
            trigger={<SidebarTrigger className="mr-2" />}
            actions={
              <div className="flex items-center gap-1.5">
                <div className="hidden sm:flex flex-col items-end mr-2">
                  <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Logged in as</span>
                  <span className="text-[9px] font-black text-blue-600 uppercase">{userContext.name}</span>
                </div>
                <div className={cn(
                    "flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg border transition-all shrink-0 bg-white border-slate-200 shadow-sm",
                    isOverdue ? "bg-red-50 border-red-100" : ""
                )}>
                    <div className="flex flex-col items-end border-r pr-1.5 border-slate-100">
                        <span className={cn("text-[5px] font-black uppercase tracking-widest leading-none", isOverdue ? "text-red-500" : "text-slate-400")}>SLA</span>
                        <span className={cn("text-[6px] font-bold uppercase mt-0.5", isOverdue ? "text-red-600" : "text-slate-500")}>LIMIT</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <TimerIcon size={9} className={cn("shrink-0", isOverdue ? "text-red-500" : "text-blue-500")} />
                        <span className={cn("text-[9px] font-mono font-black tabular-nums leading-none", isOverdue ? "text-red-600" : "text-slate-900")}>
                            {countdown}
                        </span>
                    </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(params.id.toUpperCase())
                    toast.success("Reference ID copied")
                  }}
                  className="h-6.5 px-2 rounded-lg border-slate-200 text-slate-500 hover:text-blue-600 transition-all text-[7px] font-bold uppercase tracking-widest gap-1 bg-white shadow-sm"
                >
                  <Copy size={8} />
                  <span className="hidden sm:inline">Copy ID</span>
                </Button>
              </div>
            }
          />

          <main className="flex-1 w-full max-w-7xl mx-auto p-1 md:p-2 space-y-1 overflow-hidden flex flex-col">

            {/* --- EXTREME HUD: STATUS, PROGRESS & TIMER --- */}
            <div className="bg-white border border-slate-200/50 rounded-xl p-1.5 shadow-sm flex flex-row items-center gap-3 shrink-0 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-3 pr-3 border-r border-slate-100 shrink-0">
                    <div className={cn(
                        "size-8 rounded-lg flex items-center justify-center text-white shadow-lg",
                        status === "COMPLETED" ? "bg-emerald-500 shadow-emerald-500/10" : "bg-blue-500 shadow-blue-500/10"
                    )}>
                        {status === "COMPLETED" ? <CheckCircle2 size={16} /> : <Activity size={16} />}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-tight text-slate-900 leading-none mb-0.5">{status}</span>
                        <div className="flex items-center gap-1">
                            <TimerIcon size={8} className={cn(isOverdue ? "text-red-500" : "text-blue-500")} />
                            <span className={cn("text-[8px] font-mono font-black tabular-nums", isOverdue ? "text-red-600" : "text-slate-600")}>{countdown}</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex items-center px-6 relative min-w-[250px]">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-50 -translate-y-1/2 z-0" />
                    <div 
                        className="absolute top-1/2 left-0 h-0.5 bg-blue-500 -translate-y-1/2 z-0 transition-all duration-1000" 
                        style={{ width: status === 'PENDING' ? '33%' : status === 'IN_PROGRESS' ? '66%' : '100%' }}
                    />
                    <div className="flex items-center justify-between w-full relative z-10">
                        <MiniStep active={true} completed={status !== 'PENDING'} label="Filed" />
                        <MiniStep active={status !== 'PENDING'} completed={status === 'COMPLETED'} label="In Progress" />
                        <MiniStep active={status === 'COMPLETED'} completed={status === 'COMPLETED'} label="Finalized" />
                    </div>
                </div>

                {/* Ball in Court Section (NEW) */}
                <div className="hidden lg:flex items-center gap-3 px-4 border-l border-slate-100 shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-[6px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">{insight.label}</span>
                    <span className={cn("text-[9px] font-black leading-none uppercase", insight.color)}>{insight.responsibility}</span>
                  </div>
                  <div className={cn("size-7 rounded-lg flex items-center justify-center", insight.bg)}>
                    <User size={12} className={insight.color} />
                  </div>
                </div>

                {/* Action Tip Section (NEW) */}
                <div className="hidden xl:flex items-center gap-3 px-4 border-l border-slate-100 shrink-0 max-w-[200px]">
                  <p className="text-[8px] font-bold text-slate-500 italic leading-tight uppercase">
                    Tip: {insight.tip}
                  </p>
                </div>

                <div className="flex items-center gap-3 pl-3 border-l border-slate-100 shrink-0">
                    <div className="flex flex-col items-end">
                        <span className="text-[6px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Elapsed</span>
                        <span className="text-[10px] font-black text-slate-900 leading-none">{elapsedTime}</span>
                    </div>
                    <div className="size-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                        <History size={12} />
                    </div>
                </div>
            </div>

            {/* --- COMPACT STATS ROW --- */}
            <section className="grid grid-cols-3 md:grid-cols-5 gap-1 shrink-0">
                <CompactStat label="PROJECT" value={data?.projectName} icon={Briefcase} />
                <CompactStat label="CLIENT" value={data?.clientName || "GENERAL"} icon={Building2} />
                <CompactStat label="PRIORITY" value={data?.priority} icon={ShieldAlert} color={data?.priority === 'HIGH' ? 'text-red-600' : 'text-blue-600'} />
                <CompactStat className="hidden md:flex" label="REQUESTOR" value={data?.submittedBy_name || "USER"} icon={User} />
                <CompactStat className="hidden md:flex" label="REF ID" value={params.id.slice(-8).toUpperCase()} icon={Fingerprint} />
            </section>

            {/* --- MAIN CONTENT: COMMAND CENTER --- */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {/* DESKTOP VIEW: 3-COLUMN HUB */}
              <div className="hidden lg:grid grid-cols-12 gap-2 h-full">
                
                {/* LEFT (3): CONTROLS & JOURNEY */}
                <div className="col-span-3 flex flex-col gap-2 overflow-hidden h-full">
                  {isAdmin && status !== "COMPLETED" && (
                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-white/5 shrink-0">
                      <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
                        <Cpu size={12} className="text-blue-500" />
                        <h3 className="text-[9px] font-black uppercase tracking-tight">Engineer's Console</h3>
                      </div>
                      <div className="space-y-2">
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="min-h-[60px] rounded-lg bg-black/30 border-white/10 text-[11px] placeholder:text-slate-700 leading-tight"
                          placeholder="Internal notes..."
                        />
                        <Button 
                          onClick={() => handleUpdateStatus("COMPLETED")} 
                          className="w-full h-8 bg-[#00C853] hover:bg-[#00B24A] text-white font-black rounded-lg uppercase tracking-widest text-[9px] shadow-lg shadow-emerald-900/20"
                        >
                          Mark as Finished
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="bg-white border border-slate-200/50 rounded-xl shadow-sm flex flex-col flex-1 min-h-0">
                    <div className="bg-slate-50/50 px-2.5 py-1.5 border-b border-slate-100 flex items-center gap-1 text-slate-500 shrink-0">
                      <History size={10} /> <span className="text-[8px] font-black uppercase tracking-widest">Progress Tracker</span>
                    </div>
                    <div className="p-3 overflow-y-auto flex-1 scrollbar-hide">
                      <TimelineItem label="Request Sent" time={data?.createdAt} status="done" desc="Ticket Filed" />
                      <TimelineItem label="In Progress" time={data?.in_progressAt} status={status !== 'PENDING' ? "done" : "pending"} desc="Work Started" />
                      <TimelineItem label="Finished" time={data?.completedAt} status={status === 'COMPLETED' ? "done" : "pending"} desc="Job Completed" isLast />
                    </div>
                  </div>
                </div>

                {/* CENTER (6): MASTER MANIFEST (ALL DETAILS) */}
                <div className="col-span-6 flex flex-col gap-2 h-full overflow-hidden">
                  <div className="bg-white border border-slate-200/50 rounded-xl shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="bg-slate-900 px-4 py-3 flex justify-between items-center relative overflow-hidden shrink-0">
                      <div className="flex items-center gap-2.5 relative z-10">
                        <div className="size-8 bg-blue-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                          <ClipboardList size={16} />
                        </div>
                        <div>
                          <h3 className="text-[10px] font-black text-white tracking-widest uppercase leading-none mb-0.5">Project Information</h3>
                          <p className="text-[7px] font-bold text-blue-400 uppercase tracking-widest leading-none">Job Request Details</p>
                        </div>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-400 text-[8px] font-black border-none px-2 py-0.5 rounded-full">REF: {params.id.slice(-8).toUpperCase()}</Badge>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
                      {/* Section 1: Identity */}
                      <div className="grid grid-cols-2 gap-4">
                        <ManifestItem label="Project Name" value={data?.projectName} icon={Briefcase} isHighlight />
                        <ManifestItem label="Requestor" value={data?.submittedByName || "UNKNOWN"} icon={User} />
                      </div>

                      <Separator className="bg-slate-50" />

                      {/* Section 2: Core Details */}
                      <div className="grid grid-cols-3 gap-2">
                        <ManifestItem label="Client Name" value={data?.clientName || "GENERAL"} icon={Building2} />
                        <ManifestItem label="Urgency" value={data?.priority} icon={ShieldAlert} color={data?.priority === 'HIGH' ? 'text-red-600' : 'text-blue-600'} />
                        <ManifestItem label="Work Hours" value={data?.workingTime} icon={Clock} />
                      </div>

                      <Separator className="bg-slate-50" />

                      {/* Section 3: Work Services & Height */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Wrench size={12} /> Installation Type
                          </Label>
                          <div className="flex flex-wrap gap-1.5">
                            {data?.siteInstallation?.length > 0 ? data.siteInstallation.map((item: string) => (
                              <Badge key={item} variant="secondary" className="bg-slate-100 text-slate-600 text-[9px] px-2 py-0.5 rounded-md border-none font-black uppercase">{item}</Badge>
                            )) : <span className="text-[11px] text-slate-300 font-bold italic">None</span>}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <RefreshCcw size={12} /> Modification Type
                          </Label>
                          <div className="flex flex-wrap gap-1.5">
                            {data?.inHouse?.length > 0 ? data.inHouse.map((item: string) => (
                              <Badge key={item} variant="secondary" className="bg-slate-100 text-slate-600 text-[9px] px-2 py-0.5 rounded-md border-none font-black uppercase">{item}</Badge>
                            )) : <span className="text-[11px] text-slate-300 font-bold italic">None</span>}
                          </div>
                        </div>
                      </div>

                      {(data?.mountingHeight || data?.otherAssistance) && (
                        <div className="grid grid-cols-2 gap-4">
                          {data?.mountingHeight && <ManifestItem label="Mounting Height" value={data?.mountingHeight} icon={Ruler} />}
                          {data?.otherAssistance && <ManifestItem label="Other Assistance" value={data?.otherAssistance} icon={Handshake} />}
                        </div>
                      )}

                      <Separator className="bg-slate-50" />

                      {/* Section 4: Work Scope */}
                      <div className="space-y-2">
                        <ManifestItem label="Detailed Scope of Work" value={data?.scopeOfWork} icon={FileText} isLongText />
                      </div>

                      {(data?.tempFacility || data?.safetyInduction || data?.safetyNotes) && (
                        <>
                          <Separator className="bg-slate-50" />
                          {/* Section 5: Logistics & Safety */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <ShieldCheck size={10} /> Site Logistics
                              </Label>
                              <div className="grid grid-cols-2 gap-2">
                                {data?.tempFacility && (
                                  <div className="flex flex-col">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase">Temp Facility</span>
                                    <span className="text-[10px] font-black text-slate-900">{data?.tempFacility}</span>
                                  </div>
                                )}
                                {data?.safetyInduction && (
                                  <div className="flex flex-col">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase">Induction</span>
                                    <span className="text-[10px] font-black text-slate-900">{data?.safetyInduction}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {data?.safetyNotes && <ManifestItem label="Safety Reminders" value={data?.safetyNotes} icon={Construction} isLongText />}
                          </div>
                        </>
                      )}

                      <Separator className="bg-slate-50" />

                      {/* Section 6: Documents & Others */}
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck size={12} /> Permit Documents
                          </Label>
                          <div className="flex flex-wrap gap-1.5">
                            {data?.permits?.length > 0 ? data.permits.map((item: string) => (
                              <Badge key={item} className="bg-blue-50 text-blue-600 border border-blue-100 text-[9px] px-2 py-0.5 font-black uppercase">{item}</Badge>
                            )) : <span className="text-[11px] text-slate-300 font-bold italic">No Permits</span>}
                          </div>
                        </div>
                        {data?.otherDocuments && (
                          <ManifestItem label="Other Details" value={data.otherDocuments} icon={Info} isLongText />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT (3): MEDIA CENTER */}
                <div className="col-span-3 flex flex-col gap-2 h-full overflow-hidden">
                  <div className="bg-white border border-slate-200/50 rounded-xl shadow-sm flex flex-col flex-1 min-h-0">
                    <div className="bg-slate-50/50 px-3 py-2 border-b border-slate-100 flex items-center justify-between shrink-0">
                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                        <ImageIcon size={12} className="text-blue-500" /> Photo Gallery
                      </span>
                      {selectedImage && (
                        <a href={selectedImage} target="_blank" className="text-[7px] font-black text-blue-600 uppercase flex items-center gap-1">
                          Full Size <ExternalLink size={8} />
                        </a>
                      )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">
                      {hasImages ? (
                        <>
                          <div className="bg-slate-100 rounded-lg overflow-hidden h-[150px] relative flex items-center justify-center ring-1 ring-slate-200/50">
                            <TransformWrapper>
                              <TransformComponent wrapperClass="!w-full !h-full flex items-center justify-center">
                                <img src={selectedImage || ""} className="max-w-full max-h-full object-contain" />
                              </TransformComponent>
                            </TransformWrapper>
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {data.attachments?.map((img: string, idx: number) => (
                              <button 
                                key={idx} 
                                onClick={() => setSelectedImage(img)} 
                                className={cn(
                                  "aspect-square rounded-md border-2 overflow-hidden transition-all shadow-sm", 
                                  selectedImage === img ? "border-blue-500 scale-95" : "border-slate-100 opacity-60 hover:opacity-100"
                                )}
                              >
                                <img src={img} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-200 gap-2">
                          <ImageIcon size={32} />
                          <span className="text-[8px] font-black uppercase">No Photos</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Small Info Box */}
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 shrink-0">
                    <p className="text-[8px] font-bold text-blue-700 leading-tight uppercase">
                      Tip: Use the Media Center to review all project photos. Admin console is for finalized status updates.
                    </p>
                  </div>
                </div>
              </div>

              {/* MOBILE VIEW: VERTICAL SCROLLING FLOW (MATCHING REFERENCE) */}
              <div className="lg:hidden h-full flex flex-col overflow-y-auto scrollbar-hide space-y-2 pb-24">
                
                {/* Section 1: Top Level Project Info (Dark Header) */}
                <div className="bg-slate-900 text-white rounded-xl overflow-hidden shrink-0 shadow-lg">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-blue-400 uppercase tracking-[0.2em]">Project Name</span>
                        <h2 className="text-lg font-black leading-tight uppercase">{data?.projectName}</h2>
                      </div>
                      <Badge className="bg-blue-500 text-white border-none text-[8px] font-black">REF: {params.id.slice(-8).toUpperCase()}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                      <div className="space-y-1">
                        <span className="text-[7px] font-black text-slate-400 uppercase">Client Name</span>
                        <p className="text-[11px] font-bold truncate">{data?.clientName || "GENERAL"}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[7px] font-black text-slate-400 uppercase">Urgency</span>
                        <p className={cn("text-[11px] font-black", data?.priority === 'HIGH' ? 'text-red-400' : 'text-blue-400')}>{data?.priority}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 1.1: Smart Status Insight (Mobile NEW) */}
                <div className={cn("rounded-xl p-3 border shadow-sm shrink-0 flex items-center justify-between gap-3", insight.bg, insight.border)}>
                  <div className="flex items-center gap-2.5">
                    <div className={cn("size-8 rounded-lg flex items-center justify-center text-white", insight.iconBg)}>
                      <User size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">{insight.label}</span>
                      <span className={cn("text-[11px] font-black leading-none uppercase", insight.color)}>{insight.responsibility}</span>
                    </div>
                  </div>
                  <div className="flex-1 max-w-[140px] text-right">
                    <p className={cn("text-[8px] font-bold italic uppercase leading-tight", insight.color)}>
                      {insight.tip}
                    </p>
                  </div>
                </div>

                {/* Section 2: Detailed Job Information */}
                <div className="bg-white border border-slate-200/50 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-slate-50/50 px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                    <FileText size={12} className="text-blue-500" />
                    <h3 className="text-[9px] font-black uppercase text-slate-900 tracking-widest">Project Details</h3>
                  </div>
                  <div className="p-4 space-y-6">
                    {/* Work Schedule */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-50 pb-1.5">
                        <Clock size={10} className="text-slate-400" />
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Work Schedule</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <ManifestItem label="Hours" value={data?.workingTime} icon={Clock} />
                        <ManifestItem label="Days" value={data?.workingDays?.join(", ")} icon={Calendar} />
                      </div>
                    </div>

                    {/* Job Services */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-50 pb-1.5">
                        <Wrench size={10} className="text-slate-400" />
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Services</span>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Installation Type</span>
                          <div className="flex flex-wrap gap-1">
                            {data?.siteInstallation?.length > 0 ? data.siteInstallation.map((item: string) => (
                              <Badge key={item} className="bg-slate-100 text-slate-600 text-[7px] border-none font-bold uppercase">{item}</Badge>
                            )) : <span className="text-[9px] text-slate-300 font-bold italic">None</span>}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Modification Type</span>
                          <div className="flex flex-wrap gap-1">
                            {data?.inHouse?.length > 0 ? data.inHouse.map((item: string) => (
                              <Badge key={item} className="bg-slate-100 text-slate-600 text-[7px] border-none font-bold uppercase">{item}</Badge>
                            )) : <span className="text-[9px] text-slate-300 font-bold italic">None</span>}
                          </div>
                        </div>
                        {(data?.mountingHeight || data?.otherAssistance) && (
                          <div className="grid grid-cols-2 gap-4">
                            {data?.mountingHeight && <ManifestItem label="Height" value={data?.mountingHeight} icon={Ruler} />}
                            {data?.otherAssistance && <ManifestItem label="Assistance" value={data?.otherAssistance} icon={Handshake} />}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scope */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-50 pb-1.5">
                        <ClipboardList size={10} className="text-slate-400" />
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Scope of Work</span>
                      </div>
                      <ManifestItem label="Description" value={data?.scopeOfWork} icon={FileText} isLongText />
                    </div>

                    {/* Logistics */}
                    {(data?.tempFacility || data?.safetyInduction || data?.safetyNotes) && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-50 pb-1.5">
                          <ShieldCheck size={10} className="text-slate-400" />
                          <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Site Logistics</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {data?.tempFacility && (
                            <div className="flex flex-col">
                              <span className="text-[7px] font-bold text-slate-400 uppercase">Temp Facility</span>
                              <span className="text-[10px] font-black text-slate-900">{data?.tempFacility}</span>
                            </div>
                          )}
                          {data?.safetyInduction && (
                            <div className="flex flex-col">
                              <span className="text-[7px] font-bold text-slate-400 uppercase">Induction</span>
                              <span className="text-[10px] font-black text-slate-900">{data?.safetyInduction}</span>
                            </div>
                          )}
                        </div>
                        {data?.safetyNotes && <ManifestItem label="Safety Reminders" value={data?.safetyNotes} icon={Construction} isLongText />}
                      </div>
                    )}

                    {/* Permits */}
                    {(data?.permits?.length > 0 || data?.otherDocuments) && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-50 pb-1.5">
                          <ShieldCheck size={10} className="text-slate-400" />
                          <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Permits & Docs</span>
                        </div>
                        {data?.permits?.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Required Documents</span>
                            <div className="flex flex-wrap gap-1">
                              {data.permits.map((item: string) => (
                                <Badge key={item} className="bg-blue-50 text-blue-600 border-blue-100 text-[7px] font-bold uppercase">{item}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {data?.otherDocuments && (
                          <ManifestItem label="Other Details" value={data.otherDocuments} icon={Info} isLongText />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: Photo Gallery */}
                <div className="bg-white border border-slate-200/50 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-slate-50/50 px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon size={12} className="text-blue-500" />
                      <h3 className="text-[9px] font-black uppercase text-slate-900 tracking-widest">Photos</h3>
                    </div>
                  </div>
                  <div className="p-3">
                    {hasImages ? (
                      <div className="space-y-3">
                        <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden relative border border-slate-200">
                          <img src={selectedImage || ""} className="w-full h-full object-contain" />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                          {data.attachments?.map((img: string, idx: number) => (
                            <button key={idx} onClick={() => setSelectedImage(img)} className={cn("size-14 rounded-lg border-2 shrink-0 transition-all", selectedImage === img ? "border-blue-500 scale-95" : "border-slate-200 opacity-60")}>
                              <img src={img} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 flex flex-col items-center justify-center text-slate-300 gap-2">
                        <ImageIcon size={32} />
                        <span className="text-[8px] font-black uppercase">No Photos</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 4: Progress Tracker */}
                <div className="bg-white border border-slate-200/50 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-slate-50/50 px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                    <History size={12} className="text-blue-500" />
                    <h3 className="text-[9px] font-black uppercase text-slate-900 tracking-widest">Progress Tracker</h3>
                  </div>
                  <div className="p-4">
                    <TimelineItem label="Request Sent" time={data?.createdAt} status="done" desc="Ticket Filed" />
                    <TimelineItem label="In Progress" time={data?.in_progressAt} status={status !== 'PENDING' ? "done" : "pending"} desc="Work Started" />
                    <TimelineItem label="Finished" time={data?.completedAt} status={status === 'COMPLETED' ? "done" : "pending"} desc="Job Completed" isLast />
                  </div>
                </div>

                {/* Section 5: Engineer Console (If Admin) */}
                {isAdmin && status !== "COMPLETED" && (
                  <div className="bg-slate-900 text-white rounded-xl shadow-lg overflow-hidden border border-white/5">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                      <Cpu size={12} className="text-blue-500" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest">Engineer's Console</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="bg-black/30 border-white/10 text-white text-[12px] min-h-[100px] rounded-lg"
                        placeholder="Add internal notes..."
                      />
                      <Button onClick={() => handleUpdateStatus("COMPLETED")} className="w-full h-12 bg-[#00C853] text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40">
                        Mark as Finished
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>

          <CollaborationHub
            requestId={params.id}
            spfNumber={data?.projectName || params.id}
            collectionName="job_requests" 
            messages={data?.messages || []}
            currentUserId={userContext.id}
            userName={userContext.name}
            profilePicture={userContext.profilePicture}
            userRole={userContext.role}
            status={status}
            title={data?.projectName || "dsiconnect"}
          />
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}

function MiniStep({ active, completed, label }: any) {
  return (
      <div className="flex flex-col items-center gap-1 relative z-10">
          <div className={cn(
              "size-5 md:size-6 rounded-full flex items-center justify-center border-2 transition-all duration-500 shadow-sm",
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
              <span className={cn("text-[11px] font-black tracking-tight truncate leading-none uppercase", color)}>
                  {value || "N/A"}
              </span>
          </div>
      </div>
  )
}

function TimelineItem({ label, time, status, desc, isLast = false }: any) {
  const formattedTime = time?.toDate ? time.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : "---"
  const isActive = status === "done"
  return (
      <div className="relative flex gap-3">
          {!isLast && <div className={cn("absolute left-[5px] top-4 w-[1px] h-full", isActive ? "bg-blue-100" : "bg-slate-50")} />}
          <div className={cn(
              "relative z-10 size-[10px] rounded-full border-2 mt-1 flex items-center justify-center transition-all",
              isActive ? "bg-blue-600 border-white ring-2 ring-blue-50 shadow-xs" : "bg-white border-slate-200"
          )} />
          <div className="pb-3">
              <div className="flex items-center gap-2">
                  <span className={cn("text-[9px] font-bold uppercase tracking-tight", isActive ? "text-slate-900" : "text-slate-400 opacity-60")}>{label}</span>
                  {isActive && (
                      <span className="text-[7px] px-1 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-100">
                          {formattedTime}
                      </span>
                  )}
              </div>
              <p className="text-[8px] text-slate-500 font-medium leading-none mt-0.5">{desc}</p>
          </div>
      </div>
  )
}

function ManifestItem({ label, value, icon: Icon, isLongText = false, isHighlight = false, canCopy = false }: any) {
  const copyToClipboard = () => {
      if (!value) return
      navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
  }

  return (
      <div className="flex flex-col gap-2 group">
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-50 rounded text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                      <Icon size={12} />
                  </div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
              </div>
              {canCopy && value && (
                  <button 
                      onClick={copyToClipboard}
                      className="p-1 hover:bg-slate-100 rounded text-slate-300 hover:text-blue-500 transition-all opacity-0 group-hover:opacity-100"
                  >
                      <Copy size={10} />
                  </button>
              )}
          </div>
          <div className={cn(
              "pl-4 border-l-2 border-slate-100 group-hover:border-blue-100 transition-all",
              isLongText ? "min-h-[40px]" : ""
          )}>
              <span className={cn(
                  "block leading-snug font-bold uppercase",
                  isHighlight ? "text-lg md:text-xl text-blue-600 font-black tracking-tight" : "text-[14px] text-slate-700"
              )}>
                  {value || "N/A"}
              </span>
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
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-900 ml-1">Loading Request</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Synchronizing Record...</span>
          </div>
      </div>
  )
}