"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Clock, CheckCircle2, History, Loader2,
  ShieldCheck, ChevronLeft, Image as ImageIcon, ExternalLink,
  Check, Timer, FileText, MapPin, Lightbulb, Ruler, Building2,
  Briefcase, AlertCircle, PlayCircle, Paperclip, CheckSquare,
  BadgeDollarSign, Signature, XCircle
} from "lucide-react";

// DATABASE
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";

// UI COMPONENTS
import { toast } from "sonner";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { CollaborationHub } from "@/components/collaboration-hub";

export default function DialuxRequestReviewPage() {
  const params = useParams() as { id: string };
  const router = useRouter();

  // STATE
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [userContext, setUserContext] = useState({
    role: "", id: "", name: "", profilePicture: "", department: ""
  });

  // ASSESSMENT FORM STATE
  const [assessment, setAssessment] = useState({
    ctrlNo: "",
    simulationType: "",
    size: "",
    complexity: "",
    leadTime: "",
    designerSig: "",
    managerSig: ""
  });

  // PROCUREMENT COSTING STATE
  const [costingData, setCostingData] = useState({
    amount: "",
    salesNotes: "",
    fyiNotes: "",
    procurementManagerSig: ""
  });

  // DESIGN SUBMISSION STATE
  const [designSubmission, setDesignSubmission] = useState({
    details: "",
    reportUrl: ""
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [countdown, setCountdown] = useState("03:00:00");
  const [isOverdue, setIsOverdue] = useState(false);

  // Status Helper
  const status = (data?.status || "PENDING").toUpperCase();

  // Department checks
  const isAdmin = ["it", "engineering", "admin"].includes(userContext.department);
  const isSales = userContext.department === "sales";
  const isProcurement = userContext.department === "procurement" || userContext.department === "it";

  // DYNAMIC SLA TIMER
  useEffect(() => {
    const timerInterval = setInterval(() => {
      let referenceTime = data?.createdAt;
      let hoursLimit = 3;
      let completionTime = null;

      // Terminal statuses - calculate total SLA from createdAt to completion
      const terminalStatuses = ["SIMULATION_RESULTS", "COMPLETED", "CLOSED", "DONE"];
      const isTerminal = terminalStatuses.includes(status);
      
      if (isTerminal) {
        // Total SLA for completed simulations: 120 hours (5 business days)
        referenceTime = data?.createdAt;
        hoursLimit = 120;
        // Use simulation completion time, or current time if not set
        completionTime = data?.simulationCompletedAt || data?.completedAt || data?.closedAt || { seconds: Date.now() / 1000 };
      } else if (status === "REVIEWING_ASSESSMENT") {
        referenceTime = data?.assessmentCompletedAt;
        hoursLimit = 24;
      } else if (status === "PENDING_COSTING") {
        referenceTime = data?.costingRequestedAt;
        hoursLimit = 1; 
      } else if (status === "PENDING_COST_APPROVAL") {
        referenceTime = data?.costingSubmittedAt;
        hoursLimit = 24;
      } else if (status === "IN_QUEUE") {
        referenceTime = data?.costingApprovedAt || data?.acknowledgedAt;
        hoursLimit = 1;
      } else if (status === "IN_DESIGN") {
        referenceTime = data?.designStartedAt;
        hoursLimit = 48; 
      }

      if (referenceTime) {
        const start = new Date(referenceTime.seconds * 1000).getTime();
        const limit = start + (hoursLimit * 60 * 60 * 1000);
        
        // For terminal statuses, compare completion time against limit
        // For active statuses, compare current time against limit
        const comparisonTime = isTerminal && completionTime 
          ? new Date(completionTime.seconds * 1000).getTime()
          : new Date().getTime();
        
        const diff = limit - comparisonTime;
        const absDiff = Math.abs(diff);

        const hours = Math.floor(absDiff / (1000 * 60 * 60));
        const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

        const timeString = `${diff < 0 ? '-' : ''}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        setCountdown(timeString);
        setIsOverdue(diff < 0);
      }
    }, 1000);
    
    return () => clearInterval(timerInterval);
  }, [data, status]);

  // DATA SYNC
  useEffect(() => {
    let unsubscribe: () => void;
    const loadUserAndData = async () => {
      const storedId = localStorage.getItem("userId");
      if (!storedId) return toast.error("Please log in.");

      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(storedId)}`);
        const user = await res.json();
        const dept = (user.Department || "").toLowerCase();

        setUserContext({
          role: user.Role || "staff",
          id: storedId,
          name: `${user.Firstname} ${user.Lastname}`,
          profilePicture: user.profilePicture || "",
          department: dept
        });

        const docRef = doc(db, "dialux_requests", params.id);
        unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const reqData = docSnap.data();
            setData(reqData);
            if (reqData.assessment) setAssessment(reqData.assessment);
            if (reqData.costingData) setCostingData(reqData.costingData);
            if (reqData.designSubmission) setDesignSubmission(reqData.designSubmission || { details: "", reportUrl: "" });
            if (reqData.attachments?.length > 0) setSelectedImage(reqData.attachments[0] || "");
          } else {
            toast.error("Simulation record not found.");
          }
          setLoading(false);
        });
      } catch (err) {
        toast.error("Sync failed.");
        setLoading(false);
      }
    };

    loadUserAndData();
    return () => unsubscribe?.();
  }, [params.id]);

  // STAGE 1: Engineering Submits Assessment
  const handleSubmitAssessment = async () => {
    if (!assessment.ctrlNo || !assessment.simulationType || !assessment.designerSig || !assessment.managerSig) {
      return toast.error("Please complete all required fields and signatures.");
    }

    setIsUpdating(true);
    const toastId = toast.loading("Filing engineering assessment...");

    try {
      const docRef = doc(db, "dialux_requests", params.id);
      await updateDoc(docRef, {
        assessment: assessment,
        status: "REVIEWING_ASSESSMENT", 
        updatedAt: serverTimestamp(),
        assessmentCompletedAt: serverTimestamp(), 
        processedBy: userContext.name,
      });

      toast.success("Assessment submitted for requestor review.", { id: toastId });
    } catch (error) {
      toast.error("Submission failed.", { id: toastId });
    } finally {
      setIsUpdating(false);
    }
  };

  // STAGE 2: Requestor Actions (Sales only)
  const handleRequestorAction = async () => {
    if (!assessment.designerSig || !assessment.managerSig) {
      return toast.error("Assessment is invalid: Missing signatures.");
    }

    setIsProcessingAction(true);
    const isPaid = assessment.simulationType === "PAID";
    const toastId = toast.loading(isPaid ? "Submitting Costing Request..." : "Acknowledging Assessment...");

    try {
      const docRef = doc(db, "dialux_requests", params.id);
      
      const updatePayload: any = {
        updatedAt: serverTimestamp(),
        [`${isPaid ? 'costingRequestedAt' : 'acknowledgedAt'}`]: serverTimestamp(),
      };

      if (isPaid) {
        updatePayload.status = "PENDING_COSTING"; 
      } else {
        updatePayload.status = "IN_QUEUE"; 
      }

      await updateDoc(docRef, updatePayload);
      toast.success(isPaid ? "Procurement notified for costing." : "Request moved to Execution Queue.", { id: toastId });
    } catch (error) {
      toast.error("Action failed. Please try again.", { id: toastId });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // STAGE 2.5: Procurement Submits Costing
  const handleSubmitCosting = async () => {
    if (!costingData.amount || !costingData.procurementManagerSig) {
      return toast.error("Amount and Manager Signature are required.");
    }

    setIsProcessingAction(true);
    const toastId = toast.loading("Publishing costing...");

    try {
      const docRef = doc(db, "dialux_requests", params.id);
      await updateDoc(docRef, {
        status: "PENDING_COST_APPROVAL",
        costingData: costingData,
        costingSubmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Costing published. Waiting for Sales approval.", { id: toastId });
    } catch (error) {
      toast.error("Submission failed.", { id: toastId });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // STAGE 2.7: Sales Approves/Pays Costing
  const handleApproveCosting = async (isApproved: boolean) => {
    setIsProcessingAction(true);
    const toastId = toast.loading(isApproved ? "Approving & Moving to Queue..." : "Cancelling Request...");

    try {
      const docRef = doc(db, "dialux_requests", params.id);
      await updateDoc(docRef, {
        status: isApproved ? "IN_QUEUE" : "CANCELLED",
        costingApprovedAt: isApproved ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
      toast.success(isApproved ? "Cost approved. Project is in queue." : "Request cancelled.", { id: toastId });
    } catch (error) {
      toast.error("Action failed.", { id: toastId });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // STAGE 3: Start Designing
  const handleStartDesign = async () => {
    setIsProcessingAction(true);
    const toastId = toast.loading("Moving to Design Phase...");

    try {
      const docRef = doc(db, "dialux_requests", params.id);
      await updateDoc(docRef, {
        status: "IN_DESIGN",
        designStartedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Project is now In Design.", { id: toastId });
    } catch (error) {
      toast.error("Failed to start design.", { id: toastId });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // STAGE 4: Complete Design (Engineering/Admin)
  const handleCompleteDesign = async () => {
    if (!designSubmission.details || !designSubmission.reportUrl) {
      return toast.error("Please fill in design details and attach report link.");
    }

    setIsProcessingAction(true);
    const toastId = toast.loading("Submitting simulation results...");

    try {
      const docRef = doc(db, "dialux_requests", params.id);
      await updateDoc(docRef, {
        status: "COMPLETED",
        designSubmission: designSubmission,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Simulation project completed!", { id: toastId });
    } catch (error) {
      toast.error("Submission failed.", { id: toastId });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // STAGE 5: Sales Final Acknowledgement
  const handleFinalAcknowledgement = async () => {
    setIsProcessingAction(true);
    const toastId = toast.loading("Closing project...");

    try {
      const docRef = doc(db, "dialux_requests", params.id);
      await updateDoc(docRef, {
        status: "CLOSED",
        salesAcknowledgedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Project successfully acknowledged and closed.", { id: toastId });
    } catch (error) {
      toast.error("Acknowledgement failed.", { id: toastId });
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-[#F4F7F7]">
      <Loader2 className="animate-spin text-zinc-900" size={32} />
      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">
        Loading...
      </p>
    </div>
  );

  const hasImages = data?.attachments && data.attachments.length > 0;

  // Helper to check if file is PDF
  const isPDF = (url: string): boolean => {
    return url.toLowerCase().endsWith('.pdf') || url.includes('.pdf?');
  };

  // Helper to check if PDF is stored as "raw" type (new uploads after fix)
  const isRawPDF = (url: string): boolean => {
    return url.includes('cloudinary.com') && url.includes('/raw/');
  };

  // Helper to check if PDF is stored as "image" type (old uploads before fix)
  const isOldPDF = (url: string): boolean => {
    return url.includes('cloudinary.com') && url.includes('/image/') && url.toLowerCase().endsWith('.pdf');
  };

  // Helper to get direct PDF URL (only works for new raw-type PDFs)
  const getPDFUrl = (url: string): string => {
    if (isRawPDF(url)) return url; // New PDF - direct access works
    if (isOldPDF(url)) {
      // Old PDF - try converting to raw URL (may not work, depends on Cloudinary settings)
      return url.replace('/image/', '/raw/');
    }
    return url;
  };

  // Helper to get PDF viewer URL (uses Google Docs viewer for all Cloudinary PDFs)
  // This works for both old and new PDFs
  const getPDFViewerUrl = (url: string): string => {
    if (url.includes('cloudinary.com')) {
      // Use original URL for Google Docs viewer (works with both /image/ and /raw/)
      return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar userId={userContext.id} />
      <SidebarInset className="bg-[#F4F7F7]">
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 md:px-6 sticky top-0 z-50">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <Button variant="ghost" size="icon" className="text-zinc-400 shrink-0" onClick={() => router.back()}>
              <ChevronLeft size={20} />
            </Button>
            <Separator orientation="vertical" className="h-4 hidden xs:block" />
            <div className="truncate">
              <h1 className="text-[11px] md:text-sm font-black text-zinc-900 uppercase tracking-tight truncate">
                {data?.projectName || "Dialux Request"}
              </h1>
              <p className="text-[8px] md:text-[9px] text-zinc-400 font-bold uppercase tracking-widest truncate">
                PROJECT REF: {params.id.slice(-8).toUpperCase()}
              </p>
            </div>
          </div>

          {(status !== "COMPLETED" && status !== "CLOSED" && status !== "CANCELLED") && (
             <div className={cn(
               "flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5 rounded-lg border transition-all shrink-0 ml-2",
               isOverdue ? "bg-red-50 border-red-200" : "bg-zinc-50 border-zinc-200"
             )}>
               <div className="flex flex-col items-end border-r pr-2 md:pr-3 border-zinc-200">
                 <span className={cn(
                   "text-[6px] md:text-[7px] font-black uppercase tracking-widest leading-none",
                   isOverdue ? "text-red-500" : "text-zinc-400"
                 )}>
                   {isOverdue ? (status === "COMPLETED" || status === "CLOSED" ? "Completed (Breach)" : "SLA Breach") : (status === "COMPLETED" || status === "CLOSED" ? "Total SLA" : "SLA Window")}
                 </span>
                 <span className={cn(
                   "text-[8px] md:text-[9px] font-bold uppercase mt-0.5",
                   isOverdue ? "text-red-600" : "text-zinc-500"
                 )}>
                   {status === "PENDING" ? "Engineering (3h)" : status === "PENDING_COSTING" ? "Procurement (1h)" : status === "PENDING_COST_APPROVAL" ? "Sales (24h)" : status === "IN_QUEUE" ? "Designing (1h)" : status === "IN_DESIGN" ? "Work Phase" : status === "COMPLETED" || status === "CLOSED" ? "120h (5 days)" : "Review/Sales (24h)"}
                 </span>
               </div>
               <div className="flex items-center gap-1.5 md:gap-2">
                 <Timer size={14} className={cn("shrink-0", isOverdue ? "text-red-500" : "text-blue-500")} />
                 <span className={cn(
                   "text-sm md:text-lg font-mono font-black tabular-nums leading-none tracking-tighter",
                   isOverdue ? "text-red-600" : "text-zinc-900"
                 )}>
                   {countdown}
                 </span>
               </div>
             </div>
          )}
        </header>

        <main className="p-4 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32">

          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-[24px] border border-zinc-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              <div className="p-4 border-b flex items-center justify-between bg-zinc-50/50">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                  <ImageIcon size={14} /> Room Layouts & Reference Photos
                </span>
                {selectedImage && (
                  <a href={selectedImage} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-blue-600 uppercase flex items-center gap-1">
                    View Full Res <ExternalLink size={12} />
                  </a>
                )}
              </div>
              <div className="flex-1 bg-zinc-100 flex flex-col items-center justify-center relative p-4 min-h-[450px]">
                {hasImages ? (
                  <>
                    <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
                      {selectedImage && isPDF(selectedImage) ? (
                        // PDF Preview - Show preview options
                        <div className="flex flex-col items-center justify-center gap-6">
                          <div className="flex flex-col items-center gap-3">
                            <FileText size={80} className="text-zinc-400" />
                            <p className="text-[10px] font-bold text-zinc-500 uppercase">PDF Document</p>
                            {isOldPDF(selectedImage) && (
                              <p className="text-[9px] text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                Legacy PDF - Use Google Docs for preview/download
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-3 w-full max-w-xs">
                            <a
                              href={getPDFViewerUrl(selectedImage)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-black text-white uppercase flex items-center justify-center gap-2 hover:opacity-90 px-4 py-3 bg-blue-600 rounded-lg"
                            >
                              <ExternalLink size={14} /> Preview with Google Docs
                            </a>
                            {isRawPDF(selectedImage) ? (
                              // New PDF - show download and open buttons
                              <div className="flex gap-3">
                                <a
                                  href={getPDFUrl(selectedImage)}
                                  download
                                  className="flex-1 text-[10px] font-black text-blue-600 uppercase flex items-center justify-center gap-1 hover:underline px-3 py-2 bg-blue-50 rounded-lg"
                                >
                                  Download <ExternalLink size={12} />
                                </a>
                                <a
                                  href={getPDFUrl(selectedImage)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex-1 text-[10px] font-black text-zinc-600 uppercase flex items-center justify-center gap-1 hover:underline px-3 py-2 bg-zinc-100 rounded-lg"
                                >
                                  Open <ExternalLink size={12} />
                                </a>
                              </div>
                            ) : (
                              // Old PDF - only Google Docs viewer works
                              <a
                                href={getPDFViewerUrl(selectedImage)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-black text-zinc-600 uppercase flex items-center justify-center gap-1 hover:underline px-3 py-2 bg-zinc-100 rounded-lg"
                              >
                                Download via Google Docs <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        // Image Preview
                        <div className="flex flex-col items-center justify-center h-full">
                          <TransformWrapper>
                            <TransformComponent wrapperClass="!w-full flex items-center justify-center">
                              <img
                                src={selectedImage || ""}
                                alt="Simulation Reference"
                                className="max-w-full max-h-[380px] object-contain rounded-lg shadow-sm block mx-auto"
                              />
                            </TransformComponent>
                          </TransformWrapper>
                          <a
                            href={selectedImage || ""}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 hover:underline px-4 py-2 bg-blue-50 rounded-lg"
                          >
                            Download Image <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </div>
                    {/* Attachment Thumbnails */}
                    {data.attachments.length > 1 && (
                      <div className="w-full flex gap-2 mt-4 overflow-x-auto py-2 px-1">
                        {data.attachments.map((img: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedImage(img)}
                            className={cn(
                              "size-14 rounded-md border-2 overflow-hidden flex-shrink-0 transition-all flex items-center justify-center bg-white",
                              selectedImage === img ? "border-blue-500 scale-105 shadow-md" : "border-transparent opacity-50 hover:opacity-100"
                            )}
                          >
                            {isPDF(img) ? (
                              <FileText size={24} className="text-zinc-400" />
                            ) : (
                              <img src={img} className="w-full h-full object-cover" alt={`Thumb ${idx}`} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center space-y-2">
                    <FileText size={40} className="mx-auto text-zinc-300" />
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">No Reference Uploaded</p>
                  </div>
                )}
              </div>

              <div className="p-8 bg-white border-t space-y-8">
                <div>
                  <h3 className="text-[10px] font-black uppercase text-zinc-400 mb-3 tracking-widest italic">Client & Project Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                    <DetailItem icon={Building2} label="Client Name" value={data?.clientName} />
                    <DetailItem icon={Briefcase} label="Project Type" value={data?.projectType} />
                    <DetailItem icon={MapPin} label="Site Address" value={data?.siteAddress} />
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-[10px] font-black uppercase text-zinc-400 mb-3 tracking-widest italic">Simulation Parameters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                    <DetailItem icon={Ruler} label="Mounting Height" value={data?.mountingHeight ? `${data?.mountingHeight}m` : "Not Specified"} />
                    <DetailItem icon={AlertCircle} label="Lighting Req." value={data?.lightingReq} />
                    <DetailItem icon={PlayCircle} label="Fixture Details" value={data?.fixtureDetails} />
                    <DetailItem icon={Lightbulb} label="Preferred Lux" value={data?.preferredLux} />
                  </div>
                </div>
              </div>
            </div>

            <CollaborationHub 
              requestId={params.id} 
              collectionName="dialux_requests" // Explicitly tell it which collection to use
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
            <div className="bg-white rounded-[24px] border border-zinc-200 p-8 shadow-sm">
              <h3 className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-2 tracking-widest mb-8 italic">
                <History size={14} /> Simulation Journey
              </h3>
              <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-100">
                <TimelineStep title="Request Filed" date={data?.createdAt} status="completed" />
                <TimelineStep 
                  title="Engineering Assessment" 
                  date={data?.assessmentCompletedAt} 
                  status={data?.assessmentCompletedAt ? 'completed' : 'active'} 
                />
                
                {assessment.simulationType === "PAID" && (
                  <>
                    <TimelineStep 
                      title="Procurement Costing" 
                      date={data?.costingSubmittedAt} 
                      status={data?.costingSubmittedAt ? 'completed' : (status === 'PENDING_COSTING' ? 'active' : 'pending')} 
                    />
                    <TimelineStep 
                      title="Sales Approval" 
                      date={data?.costingApprovedAt} 
                      status={data?.costingApprovedAt ? 'completed' : (status === 'PENDING_COST_APPROVAL' ? 'active' : 'pending')} 
                    />
                  </>
                )}

                <TimelineStep 
                  title="Awaiting Execution" 
                  date={data?.acknowledgedAt || data?.costingApprovedAt} 
                  status={status === 'IN_QUEUE' ? 'active' : (data?.designStartedAt ? 'completed' : 'pending')} 
                />
                <TimelineStep 
                  title="Design & Production" 
                  date={data?.designStartedAt} 
                  status={status === 'IN_DESIGN' ? 'active' : (data?.completedAt ? 'completed' : 'pending')} 
                />
                <TimelineStep 
                  title="Simulation Results" 
                  date={data?.completedAt} 
                  status={status === 'COMPLETED' ? 'active' : (data?.salesAcknowledgedAt ? 'completed' : 'pending')} 
                />
                <TimelineStep 
                  title="Closed" 
                  date={data?.salesAcknowledgedAt} 
                  status={status === 'CLOSED' ? 'completed' : 'pending'} 
                />
              </div>
            </div>

            <div className="bg-white rounded-[24px] border border-zinc-200 p-8 shadow-sm">
               <h3 className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-2 tracking-widest mb-6 italic">
                 <ShieldCheck size={14} /> Official Actions
               </h3>

               {status === "PENDING" && (
                 <div className="space-y-6">
                   {!isAdmin ? (
                     <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-center">
                       <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Engineering processing required</p>
                     </div>
                   ) : (
                     <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1.5">
                           <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Control No.</label>
                           <Input 
                             placeholder="ENG-2024-XXX" 
                             className="bg-zinc-50 border-zinc-100 text-xs font-bold"
                             value={assessment.ctrlNo}
                             onChange={(e) => setAssessment({...assessment, ctrlNo: e.target.value})}
                           />
                         </div>
                         <div className="space-y-1.5">
                           <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Simulation Type</label>
                           <Select 
                             value={assessment.simulationType} 
                             onValueChange={(v) => setAssessment({...assessment, simulationType: v})}
                           >
                             <SelectTrigger className="bg-zinc-50 border-zinc-100 text-xs font-bold">
                               <SelectValue placeholder="Select" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="FREE">Free DIAlux</SelectItem>
                               <SelectItem value="PAID">Paid DIAlux</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                       </div>

                       <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                           <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Lead Time</label>
                           <Select 
                             value={assessment.leadTime} 
                             onValueChange={(v) => setAssessment({...assessment, leadTime: v})}
                           >
                             <SelectTrigger className="bg-zinc-50 border-zinc-100 text-xs font-bold">
                               <SelectValue placeholder="Select" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="1-2 Days">1-2 Days</SelectItem>
                               <SelectItem value="3-5 Days">3-5 Days</SelectItem>
                               <SelectItem value="7+ Days">7+ Days</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                         <div className="space-y-1.5">
                           <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Complexity</label>
                           <Select 
                             value={assessment.complexity} 
                             onValueChange={(v) => setAssessment({...assessment, complexity: v})}
                           >
                             <SelectTrigger className="bg-zinc-50 border-zinc-100 text-xs font-bold">
                               <SelectValue placeholder="Select" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="Simple">Simple</SelectItem>
                               <SelectItem value="Moderate">Moderate</SelectItem>
                               <SelectItem value="Complex">Complex</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                       </div>

                       <div className="space-y-3 pt-2">
                         <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100 flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase text-zinc-400">Designer Signature</span>
                            {assessment.designerSig ? (
                              <Badge className="bg-green-50 text-[#00C853] border-[#00C853]/20 text-[8px] font-bold">SIGNED</Badge>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7 text-[8px] font-black uppercase" onClick={() => setAssessment({...assessment, designerSig: userContext.name})}>Sign</Button>
                            )}
                         </div>
                         <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100 flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase text-zinc-400">Manager Approval</span>
                            {assessment.managerSig ? (
                              <Badge className="bg-green-50 text-[#00C853] border-[#00C853]/20 text-[8px] font-bold">APPROVED</Badge>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7 text-[8px] font-black uppercase" onClick={() => setAssessment({...assessment, managerSig: userContext.name})}>Approve</Button>
                            )}
                         </div>
                       </div>

                       <Button 
                         className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-tighter h-12"
                         disabled={isUpdating}
                         onClick={handleSubmitAssessment}
                       >
                         {isUpdating ? <Loader2 className="animate-spin" size={16} /> : "Submit Engineering Assessment"}
                       </Button>
                     </div>
                   )}
                 </div>
               )}

               {(status === "REVIEWING_ASSESSMENT" || status === "CLOSED" || status === "COMPLETED" || status === "CANCELLED" || status === "PENDING_COSTING" || status === "PENDING_COST_APPROVAL" || status === "IN_QUEUE" || status === "IN_DESIGN") && assessment.ctrlNo && (
                 <div className="space-y-6">
                    <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                       <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">Engineering Assessment</h4>
                       <div className="space-y-3">
                         <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
                            <span className="text-[9px] font-bold text-zinc-400 uppercase">Ref No.</span>
                            <span className="text-[10px] font-black text-zinc-900">{assessment.ctrlNo}</span>
                         </div>
                         <div className="flex justify-between items-center pb-2 border-b border-blue-100/50">
                            <span className="text-[9px] font-bold text-zinc-400 uppercase">Work Type</span>
                            <Badge variant="outline" className="text-[8px] font-black">{assessment.simulationType} DIALUX</Badge>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-zinc-400 uppercase">Est. Lead Time</span>
                            <span className="text-[10px] font-black text-zinc-900">{assessment.leadTime}</span>
                         </div>
                       </div>
                    </div>

                    {status === "REVIEWING_ASSESSMENT" && (
                      isSales ? (
                        <Button 
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-tighter h-14 shadow-lg shadow-blue-200 group"
                          disabled={isProcessingAction}
                          onClick={handleRequestorAction}
                        >
                          {isProcessingAction ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : assessment.simulationType === "PAID" ? (
                            <span className="flex items-center gap-2">
                              Request Procurement Costing <ExternalLink size={14} className="group-hover:translate-x-1 transition-transform" />
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              Acknowledge & Start Queue <CheckSquare size={14} className="group-hover:scale-110 transition-transform" />
                            </span>
                          )}
                        </Button>
                      ) : (
                        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-center">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Waiting for Sales acknowledgement</p>
                        </div>
                      )
                    )}
                 </div>
               )}

               {status === "PENDING_COSTING" && (
                 <div className="space-y-4 pt-4">
                    {!isProcurement ? (
                      <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 text-center space-y-2">
                        <BadgeDollarSign size={24} className="mx-auto text-amber-500" />
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Costing in Progress</p>
                        <p className="text-[8px] font-bold text-amber-500/80 uppercase">Waiting for Procurement Department</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Simulation Service Fee (PHP)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-400">₱</span>
                            <Input 
                              type="number" 
                              placeholder="0.00" 
                              className="pl-7 bg-zinc-50 border-zinc-100 text-xs font-bold"
                              value={costingData.amount}
                              onChange={(e) => setCostingData({...costingData, amount: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Internal Notes (FYI Only)</label>
                          <Textarea 
                            placeholder="Procurement or technical notes..." 
                            className="bg-zinc-50 border-zinc-100 text-xs font-medium min-h-[80px]"
                            value={costingData.fyiNotes}
                            onChange={(e) => setCostingData({...costingData, fyiNotes: e.target.value})}
                          />
                        </div>
                        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] font-black uppercase text-zinc-400">Manager Signature</span>
                              <span className="text-[7px] text-zinc-400 italic">Verify and authorize fee</span>
                            </div>
                            {costingData.procurementManagerSig ? (
                              <Badge className="bg-green-50 text-[#00C853] border-[#00C853]/20 text-[8px] font-bold px-3 py-1">SIGNED</Badge>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-[8px] font-black uppercase border-zinc-200 hover:bg-white"
                                onClick={() => setCostingData({...costingData, procurementManagerSig: userContext.name})}
                              >
                                Sign & Auth
                              </Button>
                            )}
                         </div>
                         <Button 
                          className="w-full bg-zinc-900 hover:bg-black text-white font-black uppercase tracking-tighter h-12"
                          disabled={isProcessingAction}
                          onClick={handleSubmitCosting}
                        >
                          {isProcessingAction ? <Loader2 className="animate-spin" size={16} /> : "Publish Simulation Costing"}
                        </Button>
                      </div>
                    )}
                 </div>
               )}

               {(status === "PENDING_COST_APPROVAL" || status === "IN_QUEUE" || status === "IN_DESIGN" || status === "COMPLETED" || status === "CLOSED") && costingData.amount && (
                 <div className="space-y-6 pt-4">
                    <div className="p-6 bg-zinc-900 text-white rounded-[24px] shadow-xl space-y-4">
                       <div className="flex items-center gap-2 text-amber-400">
                          <BadgeDollarSign size={20} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Simulation Costing</span>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[8px] font-bold text-zinc-400 uppercase">Total Professional Fee</p>
                          <p className="text-3xl font-black tracking-tighter">₱{Number(costingData.amount).toLocaleString()}</p>
                       </div>
                    </div>

                    {status === "PENDING_COST_APPROVAL" && (
                      isSales ? (
                        <div className="grid grid-cols-2 gap-3">
                          <Button 
                            variant="outline"
                            className="h-14 border-2 border-red-100 text-red-600 hover:bg-red-50 font-black uppercase tracking-tighter gap-2"
                            disabled={isProcessingAction}
                            onClick={() => handleApproveCosting(false)}
                          >
                            <XCircle size={16} /> Cancel
                          </Button>
                          <Button 
                            className="h-14 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-tighter gap-2 shadow-lg shadow-blue-100"
                            disabled={isProcessingAction}
                            onClick={() => handleApproveCosting(true)}
                          >
                            <CheckCircle2 size={16} /> Approve & Pay
                          </Button>
                        </div>
                      ) : (
                        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-center">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Waiting for Sales Approval</p>
                        </div>
                      )
                    )}
                 </div>
               )}

               {status === "IN_QUEUE" && (
                 <div className="space-y-4 text-center pt-4">
                    <div className="p-8 bg-zinc-50/50 rounded-[24px] border border-dashed border-zinc-200 space-y-4">
                      <div className="size-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm ring-8 ring-zinc-50">
                        <Clock className="text-blue-500 animate-pulse" size={24} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">Project in Queue</p>
                        <p className="text-[8px] font-bold text-zinc-400 uppercase italic">Awaiting technical bandwidth</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <Button 
                        className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-tighter h-12"
                        disabled={isProcessingAction}
                        onClick={handleStartDesign}
                      >
                        {isProcessingAction ? <Loader2 className="animate-spin" size={16} /> : "Initialize Simulation Phase"}
                      </Button>
                    )}
                 </div>
               )}

               {status === "IN_DESIGN" && (
                 <div className="space-y-6 pt-4">
                    <div className="p-4 bg-blue-50/30 border border-blue-100 rounded-2xl text-center space-y-2">
                       <Loader2 className="animate-spin text-blue-500 mx-auto" size={24} />
                       <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Work in Progress</p>
                    </div>

                    {isAdmin && (
                      <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">Simulation Findings/Details</label>
                          <Textarea 
                            placeholder="Summarize the lighting results..." 
                            className="bg-zinc-50 border-zinc-100 text-xs font-medium"
                            value={designSubmission.details}
                            onChange={(e) => setDesignSubmission({...designSubmission, details: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase text-zinc-400 ml-1">DIAlux Report Link (Sharepoint/Gdrive)</label>
                          <Input 
                            placeholder="https://..." 
                            className="bg-zinc-50 border-zinc-100 text-xs font-bold"
                            value={designSubmission.reportUrl}
                            onChange={(e) => setDesignSubmission({...designSubmission, reportUrl: e.target.value})}
                          />
                        </div>
                        <Button 
                          className="w-full bg-[#00C853] hover:bg-[#00B24A] text-white font-black uppercase tracking-tighter h-12 shadow-lg shadow-green-100"
                          disabled={isProcessingAction}
                          onClick={handleCompleteDesign}
                        >
                          {isProcessingAction ? <Loader2 className="animate-spin" size={16} /> : "Submit Final Simulation"}
                        </Button>
                      </div>
                    )}
                 </div>
               )}

               {(status === "COMPLETED" || status === "CLOSED") && (
                 <div className="space-y-6 pt-4">
                    <div className="p-6 bg-green-50 rounded-[24px] border border-green-100 text-center space-y-3">
                       <CheckCircle2 size={32} className="mx-auto text-[#00C853]" />
                       <div>
                        <p className="text-[10px] font-black text-[#00C853] uppercase tracking-widest leading-tight">Simulation Finished</p>
                        <p className="text-[8px] font-bold text-[#00C853]/60 uppercase">Files ready for review</p>
                       </div>
                    </div>

                    <a 
                      href={data?.designSubmission?.reportUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-white border-2 border-zinc-900 text-zinc-900 font-black uppercase tracking-tighter h-14 rounded-xl hover:bg-zinc-50 transition-colors shadow-sm"
                    >
                      <FileText size={16} /> Access Simulation Report
                    </a>

                    {status === "COMPLETED" && isSales && (
                      <Button 
                        className="w-full bg-zinc-900 hover:bg-black text-white font-black uppercase tracking-tighter h-12 shadow-lg shadow-zinc-200"
                        disabled={isProcessingAction}
                        onClick={handleFinalAcknowledgement}
                      >
                        {isProcessingAction ? <Loader2 className="animate-spin" size={16} /> : "Close Request & Confirm Receipt"}
                      </Button>
                    )}
                 </div>
               )}

               {status === "CLOSED" && (
                 <div className="p-10 bg-zinc-50/50 rounded-[32px] border-2 border-dashed border-zinc-100 text-center flex flex-col items-center justify-center gap-4 mt-6">
                    <div className="size-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <Signature size={28} className="text-zinc-400" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Record Archived</p>
                      <p className="text-[8px] font-bold text-zinc-300 uppercase italic">Successfully Processed</p>
                    </div>
                 </div>
               )}

               {status === "CANCELLED" && (
                 <div className="p-10 bg-red-50 rounded-[32px] border-2 border-dashed border-red-100 text-center flex flex-col items-center justify-center gap-4 mt-6">
                    <XCircle size={32} className="text-red-400" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Request Cancelled</p>
                      <p className="text-[8px] font-bold text-red-400 uppercase italic">Rejected by Sales</p>
                    </div>
                 </div>
               )}
            </div>

            {/* QUICK STATS PANEL */}
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm flex flex-col justify-center gap-1">
                  <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">SLA Compliance</span>
                  <span className={cn("text-xs font-black uppercase", isOverdue ? "text-red-500" : "text-green-500")}>
                    {isOverdue 
                      ? (status === "COMPLETED" || status === "CLOSED" ? "COMPLETED (BREACH)" : "BREACHED")
                      : (status === "COMPLETED" || status === "CLOSED" ? "COMPLETED ON-TIME" : "ON-TIME")
                    }
                  </span>
               </div>
               <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm flex flex-col justify-center gap-1">
                  <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Sim Complexity</span>
                  <span className="text-xs font-black text-zinc-900 uppercase">
                    {assessment.complexity || "---"}
                  </span>
               </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: any, label: string, value: any }) {
  return (
    <div className="flex items-start gap-3 group">
      <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100 group-hover:bg-white group-hover:border-zinc-200 transition-colors shadow-sm">
        <Icon size={14} className="text-zinc-400" />
      </div>
      <div>
        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter italic group-hover:text-zinc-500 transition-colors">{label}</p>
        <p className="text-xs font-bold text-zinc-900">{value || "---"}</p>
      </div>
    </div>
  )
}

function TimelineStep({ title, date, status }: { title: string; date?: any; status: 'completed' | 'active' | 'pending' }) {
  const iconColor = status === 'completed' ? 'bg-[#00C853]' : status === 'active' ? 'bg-blue-500 animate-pulse shadow-[0_0_12px_rgba(59,130,246,0.3)]' : 'bg-zinc-200';
  return (
    <div className="flex gap-4 relative z-10">
      <div className={`size-[24px] flex-shrink-0 rounded-full ${iconColor} flex items-center justify-center ring-4 ring-white shadow-sm transition-all duration-500`}>
        {status === 'completed' ? <CheckCircle2 size={12} className="text-white shadow-sm" /> : <div className="size-1.5 bg-white rounded-full shadow-inner" />}
      </div>
      <div>
        <p className={cn(
          "text-[10px] font-black uppercase tracking-tight leading-none mb-1",
          status === 'pending' ? 'text-zinc-300' : 'text-zinc-900'
        )}>
          {title}
        </p>
        {date && (
          <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
            {new Date(date.seconds * 1000).toLocaleString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        )}
      </div>
    </div>
  );
}