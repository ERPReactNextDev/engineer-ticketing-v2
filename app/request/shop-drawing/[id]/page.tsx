"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FileText, Clock, Layers, ZoomIn, ZoomOut, RefreshCcw,
  CheckCircle2, History, Info, Loader2, ShieldCheck,
  Cpu, ArrowRight, ChevronLeft, MapPin, User, Maximize2,
  Trash2, Download, AlertTriangle, Lightbulb, ClipboardList,
  Check, X, Timer
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

import { CollaborationHub } from "@/components/collaboration-hub";

export default function EngineeringReviewPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [userContext, setUserContext] = useState({
    role: "",
    id: "",
    name: "",
    profilePicture: ""
  });

  const [clarification, setClarification] = useState("");
  const [activeTab, setActiveTab] = useState("schematic");
  const [isUpdating, setIsUpdating] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("00:00:00");

  useEffect(() => {
    const timerInterval = setInterval(() => {
      if (data?.updatedAt || data?.createdAt) {
        const start = new Date((data?.updatedAt?.seconds || data?.createdAt?.seconds) * 1000).getTime();
        const now = new Date().getTime();
        const diff = now - start;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setElapsedTime(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [data]);

  useEffect(() => {
    let unsubscribe: () => void;
    const loadUserAndData = async () => {
      const storedId = localStorage.getItem("userId");
      const storedName = localStorage.getItem("userName");

      if (!storedId) {
        toast.error("User not found. Please log in.");
        return;
      }

      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(storedId)}`);
        const user = await res.json();
        const dept = (user.Department || user.department || "").toLowerCase();

        // LOGIC FIX: Check if the name is missing or literally the string "undefined"
        let finalName = user.Name || user.name || user.userName || storedName;

        if (!finalName || finalName === "undefined") {
          finalName = "Staff Member";
        }

        setUserContext({
          role: dept,
          id: storedId,
          name: finalName,
          profilePicture: user.profilePicture || user.image || ""
        });

        const docRef = doc(db, "shop_drawing_requests", params.id);
        unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const drawingData = docSnap.data();
            setData(drawingData);
            setClarification(drawingData.engineeringNotes || "");
          } else {
            toast.error("Ticket not found.");
          }
          setLoading(false);
        });
      } catch (err) {
        toast.error("Database connection failed.");
        setLoading(false);
      }
    };

    loadUserAndData();
    return () => unsubscribe?.();
  }, [params.id]);

  const handleUpdateStatus = async (status: string, extraData = {}) => {
    if (isUpdating) return;

    setIsUpdating(true);
    const loadingToast = toast.loading(`Processing ${status.replace('_', ' ')}...`);

    try {
      const docRef = doc(db, "shop_drawing_requests", params.id);
      await updateDoc(docRef, {
        status: status.toUpperCase(),
        engineeringNotes: clarification,
        updatedAt: serverTimestamp(),
        lastModifiedBy: userContext.name,
        ...extraData
      });
      toast.success(`Request ${status.toLowerCase()} successfully`, { id: loadingToast });
    } catch (error) {
      toast.error("Process failed.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-slate-50">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initialising Review Environment...</p>
    </div>
  );

  const isEngineering = userContext.role === "it" || userContext.role === "engineering";
  const isSales = userContext.role === "sales";
  const status = (data?.status || "PENDING").toUpperCase();
  const p = data?.parameters;

  const renderVisualizer = () => {
    if (!p) return <div className="p-10 text-xs text-slate-400 text-center">Waiting for technical parameters...</div>;

    const isTech = activeTab === "technical";
    const isLight = activeTab === "light";

    const h = parseFloat(p.height) || 0;
    const aL = parseFloat(p.armLength) || 0;
    const angle = parseFloat(p.boomAngle) || 0;
    const topD = parseFloat(p.topDiameter) || 0;
    const botD = parseFloat(p.bottomDiameter) || 0;
    const thick = parseFloat(p.thickness) || 3;
    const bpS = parseFloat(p.basePlateSize) || 400;
    const bpT = parseFloat(p.basePlateThick) || 20;
    const stiffH = parseFloat(p.stiffenerSize) || 0;

    const scale = 300 / 15;
    const poleH = h * scale;
    const armW = aL * scale;
    const armRun = Math.cos(angle * Math.PI / 180) * armW;
    const armRise = Math.sin(angle * Math.PI / 180) * armW;
    const visBotD = (botD / 8);
    const visTopD = (topD / 8);
    const visABase = (parseFloat(p.armBaseDia) / 8) || 12;
    const visATip = (parseFloat(p.armTipDia) / 8) || 6;
    const visBP = (bpS / 10);
    const visBPT = (bpT / 2);
    const visStiff = (stiffH / 10);
    const visBoltL = (parseFloat(p.anchorBoltLength) / 20) || 30;
    const visBoltSpacing = (parseFloat(p.anchorBoltSpacing) / 10) || 30;
    const visBendL = (parseFloat(p.bendLength) / 10) || 10;
    const groundY = 380;

    return (
      <TransformWrapper initialScale={1} centerOnInit>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
              <Button size="sm" variant="secondary" className="h-10 w-10 md:h-8 md:w-8 p-0 bg-white/90 backdrop-blur shadow-sm border" onClick={() => zoomIn()}><ZoomIn size={16} /></Button>
              <Button size="sm" variant="secondary" className="h-10 w-10 md:h-8 md:w-8 p-0 bg-white/90 backdrop-blur shadow-sm border" onClick={() => zoomOut()}><ZoomOut size={16} /></Button>
              <Button size="sm" variant="secondary" className="h-10 w-10 md:h-8 md:w-8 p-0 bg-white/90 backdrop-blur shadow-sm border" onClick={() => resetTransform()}><RefreshCcw size={16} /></Button>
            </div>

            <TransformComponent wrapperClass="!w-full !h-full" contentClass="w-full h-full flex items-center justify-center">
              <div className={cn("p-10 transition-colors duration-700 w-full h-full flex items-center justify-center", isLight ? 'bg-[#020617]' : 'bg-transparent')}>
                <svg viewBox="0 0 300 450" className="w-full max-w-[300px] h-auto overflow-visible">
                  <defs>
                    <linearGradient id="lightBeamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.4" />
                      <stop offset="80%" stopColor="#FBBF24" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                    </linearGradient>
                    <filter id="lightBloom"><feGaussianBlur stdDeviation="6" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
                  </defs>

                  <g stroke={isTech ? '#121212' : isLight ? '#334155' : '#94a3b8'} strokeWidth={isTech ? "1" : "2"} fill="none">
                    <path d={`M ${150 - visBoltSpacing / 2} ${groundY} v ${visBoltL} ${p.anchorBoltShape === 'J' ? `q 0 ${visBendL / 2} -${visBendL} 0` : p.anchorBoltShape === 'L' ? `h -${visBendL}` : ''}`} />
                    <path d={`M ${150 + visBoltSpacing / 2} ${groundY} v ${visBoltL} ${p.anchorBoltShape === 'J' ? `q 0 ${visBendL / 2} ${visBendL} 0` : p.anchorBoltShape === 'L' ? `h ${visBendL}` : ''}`} />
                  </g>

                  {!isTech && <rect x="0" y={groundY} width="300" height="60" fill={isLight ? "#020617" : "#f1f5f9"} opacity="0.9" />}

                  {isLight && (
                    <g filter="url(#lightBloom)" opacity="0.8">
                      <path d={`M ${150 + visTopD / 2 + armRun} ${groundY - poleH - armRise} L ${150 + visTopD / 2 + armRun + 50} ${groundY} L ${150 + visTopD / 2 + armRun - 50} ${groundY} Z`} fill="url(#lightBeamGrad)" />
                      {p.armType === "double" && (
                        <path d={`M ${150 - visTopD / 2 - armRun} ${groundY - poleH - armRise} L ${150 - visTopD / 2 - armRun + 50} ${groundY} L ${150 - visTopD / 2 - armRun - 50} ${groundY} Z`} fill="url(#lightBeamGrad)" />
                      )}
                    </g>
                  )}

                  <path d={`M ${150 - visBotD / 2} ${groundY - visBPT} L ${150 - visBotD / 2 - visStiff} ${groundY - visBPT} L ${150 - visBotD / 2} ${groundY - visBPT - visStiff} Z`} fill={isTech ? 'none' : isLight ? '#0f172a' : '#94a3b8'} stroke={isTech ? '#121212' : 'none'} opacity="0.8" />
                  <path d={`M ${150 + visBotD / 2} ${groundY - visBPT} L ${150 + visBotD / 2 + visStiff} ${groundY - visBPT} L ${150 + visBotD / 2} ${groundY - visBPT - visStiff} Z`} fill={isTech ? 'none' : isLight ? '#0f172a' : '#94a3b8'} stroke={isTech ? '#121212' : 'none'} opacity="0.8" />
                  <rect x={150 - visBP / 2} y={groundY - visBPT} width={visBP} height={visBPT} fill={isTech ? 'none' : isLight ? '#1e293b' : '#475569'} stroke={isTech ? '#121212' : 'none'} rx="1" />
                  <path d={`M ${150 - visBotD / 2} ${groundY - visBPT} L ${150 + visBotD / 2} ${groundY - visBPT} L ${150 + visTopD / 2} ${groundY - poleH} L ${150 - visTopD / 2} ${groundY - poleH} Z`} fill={isTech ? 'none' : isLight ? '#0f172a' : p.ralColor} stroke={isLight ? '#1e293b' : "#121212"} strokeWidth={isTech ? 1 : thick / 4} />

                  <g transform={`translate(150, ${groundY - poleH})`}>
                    {p.postType === "straight" ? (
                      <path d={`M ${visTopD / 2} ${-visABase / 4} L ${visTopD / 2 + armRun} ${-armRise - visATip / 2} L ${visTopD / 2 + armRun} ${-armRise + visATip / 2} L ${visTopD / 2} ${visABase / 4} Z`} fill={isTech ? 'none' : isLight ? '#0f172a' : p.ralColor} stroke={isLight ? '#1e293b' : "#121212"} strokeWidth={isTech ? 1 : 0.5} />
                    ) : (
                      <path d={`M ${visTopD / 2} 0 Q ${visTopD / 2} ${-armRise * 0.7} ${visTopD / 2 + armRun} ${-armRise}`} fill="none" stroke={isTech ? '#121212' : isLight ? '#0f172a' : p.ralColor} strokeWidth={(visABase + visATip) / 2} strokeLinecap="round" />
                    )}
                    {p.armType === "double" && (
                      p.postType === "straight" ? (
                        <path d={`M ${-visTopD / 2} ${-visABase / 4} L ${-visTopD / 2 - armRun} ${-armRise - visATip / 2} L ${-visTopD / 2 - armRun} ${-armRise + visATip / 2} L ${-visTopD / 2} ${visABase / 4} Z`} fill={isTech ? 'none' : isLight ? '#0f172a' : p.ralColor} stroke={isLight ? '#1e293b' : "#121212"} strokeWidth={isTech ? 1 : 0.5} />
                      ) : (
                        <path d={`M ${-visTopD / 2} 0 Q ${-visTopD / 2} ${-armRise * 0.7} ${-visTopD / 2 - armRun} ${-armRise}`} fill="none" stroke={isTech ? '#121212' : isLight ? '#0f172a' : p.ralColor} strokeWidth={(visABase + visATip) / 2} strokeLinecap="round" />
                      )
                    )}
                  </g>
                </svg>
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    );
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar userId={userContext.id} />
      <SidebarInset className="bg-[#F8FAFC]">
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 md:px-6 sticky top-0 z-50">
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => router.back()}>
              <ChevronLeft size={18} />
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <div className="truncate">
              <h1 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight">{data?.projectName || "Engineering Verification"}</h1>
              <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {params.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <Badge className={cn(
            "font-bold text-[9px] md:text-[10px] uppercase px-4 py-1 rounded-full border-none",
            status === "APPROVED" ? "bg-emerald-500 text-white" : "bg-blue-600 text-white"
          )}>
            {status.replace('_', ' ')}
          </Badge>
        </header>

        <main className="p-4 md:p-6 pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] mx-auto">

            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-[450px] md:h-[550px] flex flex-col overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                  <div className="p-4 border-b flex justify-between bg-white">
                    <TabsList className="bg-slate-100 p-1 rounded-lg">
                      <TabsTrigger value="schematic" className="text-[10px] font-bold uppercase px-6">Profile</TabsTrigger>
                      <TabsTrigger value="technical" className="text-[10px] font-bold uppercase px-6">Blueprint</TabsTrigger>
                      <TabsTrigger value="light" className="text-[10px] font-bold uppercase px-6">Light</TabsTrigger>
                    </TabsList>
                  </div>
                  <div className="flex-1 relative bg-[#FDFDFD]">{renderVisualizer()}</div>
                </Tabs>
              </div>

              <CollaborationHub
                requestId={params.id}
                spfNumber={data?.projectName || params.id}
                collectionName="shop_drawing_requests"
                messages={data?.messages || []}
                currentUserId={userContext.id}
                userName={userContext.name}
                profilePicture={userContext.profilePicture}
                userRole={userContext.role}
                status={status}
                title={data?.title || "dsiconnect"}
              />
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest">
                    <History size={14} /> Request Timeline
                  </h3>
                  {status !== "APPROVED" && (
                    <Badge variant="outline" className="text-[10px] font-mono border-blue-100 text-blue-600 bg-blue-50/50 flex gap-1.5 items-center px-2 py-1">
                      <Timer size={12} className="animate-pulse" /> {elapsedTime}
                    </Badge>
                  )}
                </div>
                <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  <TimelineStep title="Requested" date={data?.createdAt} status="completed" />
                  <TimelineStep title="Review" date={status !== 'PENDING_REVIEW' ? data?.updatedAt : null} status={status === 'PENDING_REVIEW' ? 'active' : 'completed'} />
                  <TimelineStep title="Technical" status={status === 'ACCEPTED' ? 'active' : (status === 'COMPLETED' || status === 'APPROVED') ? 'completed' : 'pending'} />
                  <TimelineStep title="Acknowledgment" status={status === 'APPROVED' ? 'completed' : status === 'COMPLETED' ? 'active' : 'pending'} />
                </div>
              </div>

              <div className="space-y-4">
                {isEngineering && status === "PENDING_REVIEW" && (
                  <div className="bg-white border-2 border-blue-500 rounded-xl p-6 shadow-md">
                    <div className="flex items-center gap-2 mb-4 text-blue-600">
                      <ShieldCheck size={18} />
                      <h3 className="text-xs font-black uppercase tracking-widest">Phase 2 Review</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleUpdateStatus("ACCEPTED")} disabled={isUpdating}>
                        {isUpdating ? <Loader2 size={14} className="animate-spin mr-2" /> : <Check size={14} className="mr-2" />}
                        {isUpdating ? "WAITING" : "ACCEPT"}
                      </Button>
                      <Button variant="destructive" onClick={() => handleUpdateStatus("REJECTED")} disabled={isUpdating}>
                        {isUpdating ? <Loader2 size={14} className="animate-spin mr-2" /> : <X size={14} className="mr-2" />}
                        {isUpdating ? "WAITING" : "REJECT"}
                      </Button>
                    </div>
                  </div>
                )}

                {isEngineering && status === "ACCEPTED" && (
                  <div className="bg-slate-900 rounded-xl p-6 shadow-lg text-white">
                    <div className="flex items-center gap-2 mb-4 text-blue-400">
                      <Cpu size={18} />
                      <h3 className="text-xs font-black uppercase">Finalization</h3>
                    </div>
                    <Textarea
                      placeholder="Input technical notes..."
                      className="mb-4 bg-white/10 border-none text-white min-h-[100px]"
                      value={clarification}
                      onChange={(e) => setClarification(e.target.value)}
                      disabled={isUpdating}
                    />
                    <Button className="w-full bg-blue-600 hover:bg-blue-500 font-bold" onClick={() => handleUpdateStatus("COMPLETED")} disabled={!clarification || isUpdating}>
                      {isUpdating ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                      {isUpdating ? "PROCESSING..." : "SUBMIT DRAWING"}
                    </Button>
                  </div>
                )}

                {isSales && status === "COMPLETED" && (
                  <div className="bg-white border-2 border-emerald-500 rounded-xl p-6 shadow-md">
                    <div className="flex items-center gap-2 mb-4 text-emerald-600"><CheckCircle2 size={18} /><h3 className="text-xs font-black uppercase tracking-widest">Final Approval</h3></div>
                    <Button className="w-full bg-slate-900 hover:bg-slate-800 font-bold" onClick={() => handleUpdateStatus("APPROVED")} disabled={isUpdating}>
                      {isUpdating ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                      {isUpdating ? "WAITING..." : "ACKNOWLEDGE & CLOSE"}
                    </Button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2 tracking-widest"><Layers size={14} /> Full Specifications</h3>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-4 pr-4">
                    {p && Object.entries(p).map(([key, val]: [string, any]) => (
                      <SpecItem key={key} label={key.replace(/([A-Z])/g, ' $1').trim()} value={val?.toString()} />
                    ))}
                    {!p && <p className="text-xs text-slate-400 italic">No data encoded.</p>}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function TimelineStep({ title, date, status }: { title: string; date?: any; status: 'completed' | 'active' | 'pending' }) {
  const iconColor = status === 'completed' ? 'bg-blue-600' : status === 'active' ? 'bg-blue-400 animate-pulse' : 'bg-slate-200';
  return (
    <div className="flex gap-4 relative z-10">
      <div className={`size-[24px] flex-shrink-0 rounded-full ${iconColor} flex items-center justify-center ring-4 ring-white`}>
        {status === 'completed' ? <CheckCircle2 size={12} className="text-white" /> : status === 'active' ? <Clock size={12} className="text-white" /> : <div className="size-1 bg-slate-400 rounded-full" />}
      </div>
      <div>
        <p className={`text-[11px] font-black ${status === 'pending' ? 'text-slate-300' : 'text-slate-900 uppercase'}`}>{title}</p>
        {date && (
          <p className="text-[9px] text-slate-400 font-bold italic">
            {new Date(date.seconds * 1000).toLocaleDateString()} @ {new Date(date.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center border-b border-slate-50 py-2">
      <p className="text-[9px] font-black text-slate-400 uppercase">{label}</p>
      <p className="text-[10px] font-bold text-slate-800 text-right">{value || "---"}</p>
    </div>
  );
}