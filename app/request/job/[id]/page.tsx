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
  Radio, Cpu, ShieldAlert, Wrench, LayoutGrid, Ruler, Handshake, Construction,
  UploadCloud, Minus
} from "lucide-react";


// DATABASE
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, setDoc, writeBatch, serverTimestamp, deleteField } from "firebase/firestore";

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
import { Dialog, DialogContent } from "@/components/ui/dialog";

// CUSTOM COMPONENTS
import { PageHeader } from "@/components/page-header";
import { CollaborationHub } from "@/components/collaboration-hub";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import {
  JobFillUpFormDialog,
  type FillUpDraft,
  type JobFillUpFormValues,
  type BoqSection,
  type BoqSummary,
  type ProcurementData,
} from "../../../../components/job-fill-up-form-dialog";

/** Collection where the Fill Up Form is saved (doc id = job request id) */
const FILL_UPS_COLLECTION = "job_fill_ups";

/** Approval flow order: Member -> Leader -> Manager -> Procurement -> Procurement Approved */
const STATUS_ORDER = [
  "JR FORM FORWARD TO ENGINEERING",
  "JR FORM FORWARD TO ENGINEERING LEADER",
  "JR FORM FORWARD TO ENGINEERING MANAGER",
  "JR FORM FORWARD TO PROCUREMENT",
  "JR FORM APPROVED BY PROCUREMENT",
];

export default function JobDetailsPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  // Internal notes: one per role
  const [memberNotes, setMemberNotes] = useState("");
  const [leaderNotes, setLeaderNotes] = useState("");
  const [managerNotes, setManagerNotes] = useState("");
  const [procurementNotes, setProcurementNotes] = useState("");
  const [userContext, setUserContext] = useState({ id: "", referenceId: "", name: "", role: "", profilePicture: "", department: "", engiconnectRole: "" });
  const [elapsedTime, setElapsedTime] = useState("0h 0m");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState("00:00:00");
  const [isOverdue, setIsOverdue] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [signedJRForm, setSignedJRForm] = useState<File | null>(null);
  const [scopeOfWork, setScopeOfWork] = useState<File | null>(null);
  const [isUploadingPDFs, setIsUploadingPDFs] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [agentFullName, setAgentFullName] = useState("");
  // Fill Up Form: dialog state, saved draft (from job_fill_ups) and the draft snapshot loaded into the dialog
  const [fillUpFormOpen, setFillUpFormOpen] = useState(false);
  const [fillUpDraft, setFillUpDraft] = useState<FillUpDraft | null>(null);
  const [draftToLoad, setDraftToLoad] = useState<FillUpDraft | null>(null);

  const status = data?.status?.toUpperCase() || "JR FORM FORWARD TO ENGINEERING";
  const isAdmin = userContext.role === "admin" || userContext.role === "it";
  const isEngineering = userContext.department === "engineering";
  const isProcurement = userContext.department === "procurement";
  const isSales = userContext.department === "sales";
  const isEngineeringManager = isEngineering && userContext.engiconnectRole?.toUpperCase() === "MANAGER";
  const isEngineeringMember = isEngineering && userContext.engiconnectRole?.toUpperCase() === "MEMBER";
  const isEngineeringLeader = isEngineering && userContext.engiconnectRole?.toUpperCase() === "LEADER";
  // 0 = Engineering, 1 = Eng Leader, 2 = Eng Manager, 3 = Procurement, 4 = Procurement Approved
  const stepIndex = status === "COMPLETED" ? 3 : Math.max(0, STATUS_ORDER.indexOf(status));
  const isAtProcurementStage = status === "JR FORM FORWARD TO PROCUREMENT";
  const isApprovedByProcurement = status === "JR FORM APPROVED BY PROCUREMENT";
  // Who can edit which internal notes (IT/Admin can edit all, Procurement can only edit its own)
  // Notes become read-only when status has progressed past their approval stage
  // Each role can only edit their own notes while the request is at THEIR stage.
  // Once they click approval, the status moves forward and their notes become read-only.
  const canEditMemberNotes = !isProcurement && (isAdmin || (isEngineeringMember && status === "JR FORM FORWARD TO ENGINEERING"));
  const canEditLeaderNotes = !isProcurement && (isAdmin || (isEngineeringLeader && status === "JR FORM FORWARD TO ENGINEERING LEADER"));
  const canEditManagerNotes = !isProcurement && (isAdmin || (isEngineeringManager && status === "JR FORM FORWARD TO ENGINEERING MANAGER"));
  // Procurement edits only its own notes, only while the request is at the procurement stage. IT/Admin can edit all.
  const canEditProcurementNotes = isAdmin || (isProcurement && status === "JR FORM FORWARD TO PROCUREMENT");
  // Show console for: IT (always), all Engineering roles (always to see all remarks across all statuses), Procurement
  const showEngineerConsole =
    isAdmin ||
    isEngineering ||
    isProcurement;

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (userId) {
      fetch(`/api/user?id=${userId}`)
        .then(res => res.json())
        .then(user => setUserContext({
          id: userId,
          referenceId: user.ReferenceID || "",
          name: `${user.Firstname} ${user.Lastname}`,
          role: user.Department?.toLowerCase() || "",
          profilePicture: user.profilePicture || "",
          department: user.Department?.toLowerCase() || "",
          engiconnectRole: user.engiconnect_role?.trim().toLowerCase() || ""
        }));
    }

    const docRef = doc(db, "job_requests", params.id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const jobData = docSnap.data();
        setData(jobData);
        // adminNotes = legacy single notes field, used as fallback for member notes
        setMemberNotes(jobData.memberNotes || jobData.adminNotes || "");
        setLeaderNotes(jobData.leaderNotes || "");
        setManagerNotes(jobData.managerNotes || "");
        setProcurementNotes(jobData.procurementNotes || "");
        if (jobData.attachments?.[0] && !selectedImage) {
          setSelectedImage(jobData.attachments[0]);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [params.id]);

  // Listen to the saved Fill Up Form draft (job_fill_ups/{requestId})
  useEffect(() => {
    const draftRef = doc(db, FILL_UPS_COLLECTION, params.id);
    const unsubscribe = onSnapshot(
      draftRef,
      (snap) => {
        setFillUpDraft(snap.exists() ? (snap.data() as FillUpDraft) : null);
      },
      (err) => {
        console.error("FILL_UP_DRAFT_LISTEN_ERROR", err);
        setFillUpDraft(null);
      }
    );

    return () => unsubscribe();
  }, [params.id]);

  // Resolve Agent ReferenceID -> First + Last name (users table)
  useEffect(() => {
    const ref = data?.agentName?.trim();
    if (!ref) {
      setAgentFullName("");
      return;
    }

    let cancelled = false;
    fetch(`/api/user-by-reference?referenceid=${encodeURIComponent(ref)}`)
      .then(res => res.json())
      .then(result => {
        if (!cancelled) setAgentFullName(result?.name || "");
      })
      .catch(err => {
        console.error("AGENT_NAME_FETCH_ERROR", err);
        if (!cancelled) setAgentFullName("");
      });

    return () => {
      cancelled = true;
    };
  }, [data?.agentName]);

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

  const uploadPDF = async (file: File, folder: string): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const response = await fetch("/api/upload-job-pdf", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Upload failed");
    }

    const result = await response.json();
    return result.secure_url;
  };

  // "Fill Up Form" opens it empty (null), "Load Draft" opens it pre-filled with the saved draft
  const openFillUpForm = (draft: FillUpDraft | null) => {
    setDraftToLoad(draft);
    setFillUpFormOpen(true);
  };

  // Determine if Fill Up Form should be read-only based on status and user role
  // Read-only when:
  // - status is LEADER for Engineering Member or Leader
  // - status is MANAGER for Engineering Member, Leader, or Manager
  // - status is PROCUREMENT for all Engineering roles
  // - status is APPROVED BY PROCUREMENT for all Engineering roles
  // - user is Procurement (only the procurement columns are editable, see procurementEditable)
  const isFillUpFormReadOnly =
    isProcurement ||
    (status === "JR FORM FORWARD TO ENGINEERING LEADER" && (isEngineeringMember || isEngineeringLeader)) ||
    (status === "JR FORM FORWARD TO ENGINEERING MANAGER" && (isEngineeringMember || isEngineeringLeader || isEngineeringManager)) ||
    (status === "JR FORM FORWARD TO PROCUREMENT" && isEngineering) ||
    (isApprovedByProcurement && isEngineering);

  // Draft that procurement can view: the job_fill_ups draft, or the copy saved
  // inside the job request (fillUpForm) as a fallback
  const viewableFillUp: FillUpDraft | null =
    fillUpDraft ??
    (data?.fillUpForm
      ? ({
          values: data.fillUpForm.values,
          boqSections: data.fillUpForm.boqSections,
          summary: data.fillUpForm.summary,
          createdByName: data.fillUpForm.savedBy || "",
        } as FillUpDraft)
      : null);

  /**
   * Fill Up Form -> Submit.
   * Saves the inputs to the "job_fill_ups" collection (one doc per job request, id = request id)
   * as a draft. If a draft already exists (Load Draft -> edit -> Submit) it is updated.
   * Throwing here makes the dialog stay open and show an error toast.
   * `procurement` is only passed by IT/Admin (Engineering never sends it, so it is never overwritten).
   */
  const handleSaveFillUpDraft = async (
    values: JobFillUpFormValues,
    boqSections: BoqSection[],
    summary: BoqSummary,
    procurement?: ProcurementData
  ) => {
    // JSON round-trip strips `undefined` values, which Firestore does not accept
    const payload = JSON.parse(
      JSON.stringify({
        values,
        boqSections,
        summary,
        ...(procurement ? { procurement: { ...procurement, savedBy: userContext.name } } : {}),
      })
    );

    const draftRef = doc(db, FILL_UPS_COLLECTION, params.id);

    if (fillUpDraft) {
      // Update the existing draft (keeps createdBy / createdAt)
      await updateDoc(draftRef, {
        ...payload,
        updatedBy: userContext.name,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    await setDoc(draftRef, {
      ...payload,
      requestId: params.id,
      status: "draft",
      createdBy: userContext.id,
      createdByName: userContext.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  /**
   * Procurement columns of the Fill Up Form -> job_fill_ups/{id}.procurement
   * Kept separate from boqSections and NOT copied into job_requests.fillUpForm,
   * so Engineering / Sales never get it.
   */
  const handleSaveProcurement = async (procurement: ProcurementData) => {
    const clean = JSON.parse(JSON.stringify({ ...procurement, savedBy: userContext.name }));
    // Legacy case: no job_fill_ups doc yet, only the copy inside the job request
    const base =
      !fillUpDraft && viewableFillUp
        ? JSON.parse(
            JSON.stringify({
              values: viewableFillUp.values,
              boqSections: viewableFillUp.boqSections,
              summary: viewableFillUp.summary,
              requestId: params.id,
              status: "completed",
            })
          )
        : {};

    await setDoc(
      doc(db, FILL_UPS_COLLECTION, params.id),
      {
        ...base,
        procurement: { ...clean, savedAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      const docRef = doc(db, "job_requests", params.id);
      const updateData: any = {
        status: newStatus,
        // Only save the notes this user is allowed to edit, so other roles' notes are never overwritten
        ...(canEditMemberNotes ? { memberNotes } : {}),
        ...(canEditLeaderNotes ? { leaderNotes } : {}),
        ...(canEditManagerNotes ? { managerNotes } : {}),
        ...(canEditProcurementNotes ? { procurementNotes } : {}),
        updatedAt: serverTimestamp(),
        [`${newStatus.toLowerCase()}At`]: serverTimestamp(),
        [`${newStatus.toLowerCase()}By`]: userContext.name
      };

      const isForwardToProcurement = newStatus === "JR Form Forward to Procurement";
      const isForwardToEngineeringManager = newStatus === "JR FORM FORWARD TO ENGINEERING MANAGER";
      const isForwardToEngineeringLeader = newStatus === "JR FORM FORWARD TO ENGINEERING LEADER";

      // Save the approval of the stage being COMPLETED by the person who clicked
      // (Member -> Leader button, Leader -> Manager button, Manager -> Procurement button)
      const saveApproval = async (role: "Member" | "Leader" | "Manager") => {
        updateData[`engineering${role}ApprovedAt`] = serverTimestamp();
        updateData[`approvedByEngineering${role}`] = userContext.referenceId;
        try {
          const res = await fetch(
            `/api/user-by-reference?referenceid=${encodeURIComponent(userContext.referenceId)}`
          );
          const userData = await res.json();
          if (userData?.signatureImage) {
            updateData[`approvedByEngineering${role}Signature`] = userData.signatureImage;
          }
        } catch (err) {
          console.error(`Failed to fetch ${role.toLowerCase()} signature:`, err);
        }
      };

      // NEW: remove approval fields of stages that haven't happened yet
      const clearApproval = (role: "Leader" | "Manager") => {
        updateData[`engineering${role}ApprovedAt`] = deleteField();
        updateData[`approvedByEngineering${role}`] = deleteField();
        updateData[`approvedByEngineering${role}Signature`] = deleteField();
      };

      if (isForwardToEngineeringLeader && status === "JR FORM FORWARD TO ENGINEERING") {
        await saveApproval("Member");
        clearApproval("Leader");   // NEW
        clearApproval("Manager");  // NEW
      }
      if (isForwardToEngineeringManager) {
        await saveApproval("Leader");
        clearApproval("Manager");  // NEW
      }
      if (isForwardToProcurement) {
        await saveApproval("Manager");
        updateData.completedAt = serverTimestamp();
      }

      // Procurement approval
      if (newStatus === "JR FORM APPROVED BY PROCUREMENT") {
        updateData.procurementApprovedAt = serverTimestamp();
        updateData.approvedByProcurement = userContext.referenceId;
        updateData.approvedByProcurementName = userContext.name;
        // SAY (rounded total) is copied here so Sales can read it from the job request
        updateData.procurementSay = fillUpDraft?.procurement?.summary?.say ?? null;
// Full procurement computation snapshot (summary only, no per-item rows)
if (fillUpDraft?.procurement) {
  updateData.procurementSummary = JSON.parse(
    JSON.stringify({
      ...fillUpDraft.procurement.summary,
      warrantyPct: fillUpDraft.procurement.warrantyPct,
      contingencyPct: fillUpDraft.procurement.contingencyPct,
      markup: fillUpDraft.procurement.markup,
    })
  );
}
        try {
          const res = await fetch(
            `/api/user-by-reference?referenceid=${encodeURIComponent(userContext.referenceId)}`
          );
          const userData = await res.json();
          if (userData?.signatureImage) updateData.approvedByProcurementSignature = userData.signatureImage;
        } catch (err) {
          console.error("Failed to fetch procurement signature:", err);
        }
      }

      // Upload PDFs and add URLs if marking as JR Form Forward to Procurement, Engineering Manager or Engineering Leader
      if (isForwardToProcurement || isForwardToEngineeringManager || isForwardToEngineeringLeader) {
        if (signedJRForm) {
          try {
            const signedJRFormUrl = await uploadPDF(signedJRForm, "job-signed-jr-forms");
            updateData.signedJRFormUrl = signedJRFormUrl;
            updateData.signedJRFormViewerUrl = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(signedJRFormUrl)}`;
          } catch (error) {
            console.error("Failed to upload Signed JR Form:", error);
            toast.error("Failed to upload Signed JR Form");
          }
        }

        if (scopeOfWork) {
          try {
            const scopeOfWorkUrl = await uploadPDF(scopeOfWork, "job-scope-of-work");
            updateData.scopeOfWorkUrl = scopeOfWorkUrl;
            updateData.scopeOfWorkViewerUrl = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(scopeOfWorkUrl)}`;
          } catch (error) {
            console.error("Failed to upload Scope of Work:", error);
            toast.error("Failed to upload Scope of Work");
          }
        }

        // Copy the saved Fill Up Form draft into the job request (column: fillUpForm)
        // NOTE: procurement data is intentionally NOT copied here.
        if (fillUpDraft) {
          updateData.fillUpForm = {
            values: fillUpDraft.values,
            boqSections: fillUpDraft.boqSections,
            summary: fillUpDraft.summary,
            savedBy: fillUpDraft.createdByName || "",
            savedAt: fillUpDraft.createdAt ?? null,
          };
        }
      }

      // One atomic write: the job request update + marking the draft as completed
      const batch = writeBatch(db);
      batch.update(docRef, updateData);
      if (isForwardToProcurement && fillUpDraft) {
        batch.update(doc(db, FILL_UPS_COLLECTION, params.id), {
          status: "completed",
          completedAt: serverTimestamp(),
          completedBy: userContext.name,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();

      toast.success(`Request marked as ${newStatus.toLowerCase()}`);
    } catch (err) {
      console.error("UPDATE_STATUS_ERROR", err);
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const hasImages = data?.attachments?.length > 0 || data?.attachmentUrl;

  const isRequestor = userContext.id === data?.createdBy;
  const isEngineeringLegacy = isAdmin || isEngineering;

  // Requestor slot: show Agent Name (resolved to first + last name) if there is one, else the Requestor
  const hasAgent = !!data?.agentName?.trim();
  const requestorLabel = hasAgent ? "Agent Name" : "Requestor";
  const requestorValue = hasAgent
    ? (agentFullName || data.agentName)
    : (data?.submittedByName || "UNKNOWN");

  const getStatusInsight = () => {
    if (isApprovedByProcurement) return {
      responsibility: "APPROVED BY PROCUREMENT",
      tip: "Procurement has approved this JR form.",
      color: "text-emerald-500",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      iconBg: "bg-emerald-500",
      label: "System Status"
    };

    if (status === "JR FORM FORWARD TO PROCUREMENT" || status === "COMPLETED") return {
      responsibility: "FORWARDED TO PROCUREMENT",
      tip: isRequestor ? "JR form forwarded to procurement team." : "Documents uploaded and forwarded to procurement.",
      color: "text-emerald-500",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      iconBg: "bg-emerald-500",
      label: "System Status"
    };

    if (isOverdue) return {
      responsibility: isEngineering ? "YOUR ACTION" : isProcurement ? "PROCUREMENT REVIEW" : "ENGINEERING MGMT",
      tip: isEngineering ? "URGENT: This ticket is past its 24h limit!" : isProcurement ? "Review pending job request for procurement." : "We're sorry for the delay. We are expediting this.",
      color: "text-red-500",
      bg: "bg-red-50",
      border: "border-red-100",
      iconBg: "bg-red-500",
      label: isEngineering ? "SLA Breach" : "Delay Alert"
    };

    if (status === "JR FORM FORWARD TO ENGINEERING LEADER") return {
      responsibility: "ENGINEERING LEADER REVIEW",
      tip: isEngineering ? "Pending Engineering Leader approval." : isProcurement ? "Awaiting Engineering Leader approval before procurement." : "Awaiting Engineering Leader review.",
      color: "text-violet-500",
      bg: "bg-violet-50",
      border: "border-violet-100",
      iconBg: "bg-violet-500",
      label: "System Status"
    };

    if (status === "JR FORM FORWARD TO ENGINEERING MANAGER") return {
      responsibility: "ENGINEERING MANAGER REVIEW",
      tip: isEngineering ? "Pending Engineering Manager approval." : isProcurement ? "Awaiting Engineering Manager approval before procurement." : "Awaiting Engineering Manager review.",
      color: "text-amber-500",
      bg: "bg-amber-50",
      border: "border-amber-100",
      iconBg: "bg-amber-500",
      label: "System Status"
    };

    if (status === "JR FORM FORWARD TO ENGINEERING") return {
      responsibility: "FORWARDED TO ENGINEERING",
      tip: isEngineering ? "Review the job request and prepare documents." : isProcurement ? "Job request is with Engineering team." : "Your request has been forwarded to engineering team.",
      color: "text-blue-500",
      bg: "bg-blue-50",
      border: "border-blue-100",
      iconBg: "bg-blue-500",
      label: "System Status"
    };

    return {
      responsibility: isEngineering ? "YOUR ACTION" : isProcurement ? "PROCUREMENT REVIEW" : "ASSIGNED ENGINEER",
      tip: isEngineering ? "Work is underway. Remember to update the console." : isProcurement ? "Review job request details." : "The engineer is currently on-site for your project.",
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
      iconBg: "bg-blue-600",
      label: isEngineering ? "Ongoing Work" : "Live Update"
    };
  };

  const insight = getStatusInsight();

  // Internal notes (Member / Leader / Manager / Procurement).
  // - Everyone in Engineering (and Admin) sees all notes.
  // - Each role edits only their own note; the others are read-only.
  // - Procurement can view all notes and edits only the Procurement note.
  const renderRoleNotes = (compact: boolean) => {
    // All notes are visible to every Engineering role + Admin + Procurement.
    // Each role can only EDIT their own field (see canEdit*Notes above); the rest are read-only.
    const fields = [
      { key: "member", label: "Member Notes", value: memberNotes, setValue: setMemberNotes, editable: canEditMemberNotes },
      { key: "leader", label: "Leader Notes", value: leaderNotes, setValue: setLeaderNotes, editable: canEditLeaderNotes },
      { key: "manager", label: "Manager Notes", value: managerNotes, setValue: setManagerNotes, editable: canEditManagerNotes },
      { key: "procurement", label: "Procurement Notes", value: procurementNotes, setValue: setProcurementNotes, editable: canEditProcurementNotes },
    ];

    return (
      <div className={compact ? "space-y-2" : "space-y-3"}>
        {fields.map(f => (
          <div key={f.key} className="space-y-1">
            <Label className={cn("font-black text-slate-400 uppercase tracking-widest", compact ? "text-[8px]" : "text-[9px]")}>
              {f.label}{!f.editable && " (read only)"}
            </Label>
            <Textarea
              value={f.value}
              onChange={(e) => f.setValue(e.target.value)}
              readOnly={!f.editable}
              className={cn(
                "rounded-lg border-white/10 leading-tight",
                compact ? "min-h-[50px] text-[11px] placeholder:text-slate-700" : "min-h-[80px] text-[12px] text-white",
                f.editable ? "bg-black/30" : "bg-black/10 text-slate-400 cursor-default focus-visible:ring-0"
              )}
              placeholder={f.editable ? `${f.label}...` : "No notes yet"}
            />
          </div>
        ))}
      </div>
    );
  };

  const hasCoords = !!data?.locationCoordinates?.lat && !!data?.locationCoordinates?.lng;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${data.locationCoordinates.lat},${data.locationCoordinates.lng}`
    : data?.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.location)}`
    : "";

  const locationNode = data?.location ? (
    <span className="flex flex-col gap-1">
      <span>{data.location}</span>
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 hover:underline normal-case"
        >
          <MapPin size={10} /> Open in Google Maps <ExternalLink size={9} />
        </a>
      )}
    </span>
  ) : null;

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
                        status === "JR FORM FORWARD TO PROCUREMENT" || status === "COMPLETED" || status === "JR FORM APPROVED BY PROCUREMENT" ? "bg-emerald-500 shadow-emerald-500/10" : status === "JR FORM FORWARD TO ENGINEERING LEADER" ? "bg-violet-500 shadow-violet-500/10" : "bg-blue-500 shadow-blue-500/10"
                    )}>
                        {status === "JR FORM FORWARD TO PROCUREMENT" || status === "COMPLETED" || status === "JR FORM APPROVED BY PROCUREMENT" ? <CheckCircle2 size={16} /> : <Activity size={16} />}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] font-black uppercase tracking-tight text-slate-900 leading-none mb-1 whitespace-nowrap">{status}</span>
                        <div className="flex items-center gap-1">
                            <TimerIcon size={8} className={cn(isOverdue ? "text-red-500" : "text-blue-500")} />
                            <span className={cn("text-[8px] font-mono font-black tabular-nums", isOverdue ? "text-red-600" : "text-slate-600")}>{countdown}</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex items-center px-6 relative min-w-[420px]">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-50 -translate-y-1/2 z-0" />
                    <div
                        className="absolute top-1/2 left-0 h-0.5 bg-blue-500 -translate-y-1/2 z-0 transition-all duration-1000"
                        style={{ width: `${(stepIndex / 4) * 100}%` }}
                    />
                    <div className="flex items-center justify-between w-full relative z-10">
                        <MiniStep active={stepIndex === 0} completed={stepIndex > 0} label="JR FORM FORWARD TO ENGINEERING" />
                        <MiniStep active={stepIndex === 1} completed={stepIndex > 1} label="JR FORM FORWARD TO ENGINEERING LEADER" />
                        <MiniStep active={stepIndex === 2} completed={stepIndex > 2} label="JR FORM FORWARD TO ENGINEERING MANAGER" />
                        <MiniStep active={stepIndex === 3} completed={stepIndex > 3} label="JR FORM FORWARD TO PROCUREMENT" />
                        <MiniStep active={stepIndex === 4} completed={stepIndex >= 4} label="JR FORM APPROVED BY PROCUREMENT" />
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
                <CompactStat className="hidden md:flex" label={hasAgent ? "AGENT" : "REQUESTOR"} value={hasAgent ? requestorValue : (data?.submittedByName || "USER")} icon={User} />
                <CompactStat className="hidden md:flex" label="REF ID" value={params.id.slice(-8).toUpperCase()} icon={Fingerprint} />
            </section>


            
            {/* --- MAIN CONTENT: COMMAND CENTER --- */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {/* DESKTOP VIEW: 3-COLUMN HUB */}
              <div className="hidden lg:grid grid-cols-12 gap-2 h-full">
                
                {/* LEFT (3): CONTROLS & JOURNEY */}
                <div className="col-span-3 flex flex-col gap-2 overflow-hidden h-full">
                  {/* SAY console: Sales only, after Procurement approval */}
                  {isSales && isApprovedByProcurement && (
                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-white/5 shrink-0">
                      <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
                        <Cpu size={12} className="text-emerald-500" />
                        <h3 className="text-[9px] font-black uppercase tracking-tight">Procurement Approved</h3>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SAY</span>
                        <span className="text-xl font-black tabular-nums text-emerald-400 whitespace-nowrap">
                          {typeof data?.procurementSay === "number"
                            ? `₱${data.procurementSay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  )}

                  {showEngineerConsole && (
                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-white/5 shrink-0">
                      <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
                        <Cpu size={12} className="text-blue-500" />
                        <h3 className="text-[9px] font-black uppercase tracking-tight">{isProcurement ? "Procurement Console" : "Engineer's Console"}</h3>
                      </div>
                      <div className="space-y-2">
{renderRoleNotes(true)}

                        {/* Procurement: view-only Fill Up Form */}
                        {isProcurement && (
                          <Button
                            type="button"
                            onClick={() => openFillUpForm(viewableFillUp)}
                            disabled={!viewableFillUp}
                            className="w-full h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-400 text-white font-black rounded-lg uppercase tracking-widest text-[9px] shadow-lg shadow-blue-900/20"
                          >
                            <Eye size={10} />
                            {viewableFillUp ? "View Fill Up Form" : "No Fill Up Form Yet"}
                          </Button>
                        )}

                        {/* Procurement / Admin: approve once the request is at the procurement stage */}
                        {/* Procurement / Admin: stays visible once at procurement stage, disabled after approval */}
                        {(isProcurement || isAdmin) && (isAtProcurementStage || isApprovedByProcurement) && (
                          <Button
                            onClick={() => handleUpdateStatus("JR FORM APPROVED BY PROCUREMENT")}
                            disabled={isUpdating || isApprovedByProcurement}
                            className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                          >
                            {isUpdating ? "Saving..." : "JR Form Approved by Procurement"}
                          </Button>
                        )}

                        {/* PDF Upload Fields - Hidden for Procurement */}
                        {!isProcurement && (
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Signed JR Form (Optional)</Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => setSignedJRForm(e.target.files?.[0] || null)}
                                className="hidden"
                                id="signed-jr-form-upload"
                              />
                              <label
                                htmlFor="signed-jr-form-upload"
                                className="flex-1 flex items-center justify-center gap-2 px-2 py-1.5 bg-black/30 border border-white/10 rounded-lg cursor-pointer hover:bg-black/40 transition-all text-[9px] text-slate-300"
                              >
                                <UploadCloud size={10} />
                                <span>{signedJRForm ? signedJRForm.name : "Upload PDF"}</span>
                              </label>
                              {signedJRForm && (
                                <button
                                  onClick={() => setSignedJRForm(null)}
                                  className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Scope of Work (Optional)</Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => setScopeOfWork(e.target.files?.[0] || null)}
                                className="hidden"
                                id="scope-of-work-upload"
                              />
                              <label
                                htmlFor="scope-of-work-upload"
                                className="flex-1 flex items-center justify-center gap-2 px-2 py-1.5 bg-black/30 border border-white/10 rounded-lg cursor-pointer hover:bg-black/40 transition-all text-[9px] text-slate-300"
                              >
                                <UploadCloud size={10} />
                                <span>{scopeOfWork ? scopeOfWork.name : "Upload PDF"}</span>
                              </label>
                              {scopeOfWork && (
                                <button
                                  onClick={() => setScopeOfWork(null)}
                                  className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        )}

                        {/* Load Draft (only when a Fill Up Form draft exists) + Action Buttons - Hidden for Procurement */}
                        {!isProcurement && (
                        <div className="flex flex-col gap-2">
                          {fillUpDraft && (isEngineering || isAdmin) && !isProcurement && (
                            <Button
                              type="button"
                              onClick={() => openFillUpForm(fillUpDraft)}
                              className="w-full h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg uppercase tracking-widest text-[9px] shadow-lg shadow-blue-900/20"
                            >
                              <Eye size={10} />
                              Load Draft
                            </Button>
                          )}
                          {/* IT/Admin: Show all buttons */}
                          {isAdmin && !isProcurement && (
                            <>
                              <Button
                                onClick={() => handleUpdateStatus("JR FORM FORWARD TO ENGINEERING LEADER")}
                                disabled={isUpdating || status !== "JR FORM FORWARD TO ENGINEERING"}
                                className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                              >
                                {isUpdating ? "Saving..." : "For Approval of Engineering Leader"}
                              </Button>
                              <Button
                                onClick={() => handleUpdateStatus("JR FORM FORWARD TO ENGINEERING MANAGER")}
                                disabled={isUpdating || status !== "JR FORM FORWARD TO ENGINEERING LEADER"}
                                className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                              >
                                {isUpdating ? "Saving..." : "For Approval of Engineering Manager"}
                              </Button>
                              <Button
                                onClick={() => handleUpdateStatus("JR Form Forward to Procurement")}
                                disabled={isUpdating || status !== "JR FORM FORWARD TO ENGINEERING MANAGER"}
                                className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                              >
                                {isUpdating ? "Saving..." : "Mark as Finished"}
                              </Button>
                            </>
                          )}
                          {/* Engineering + MEMBER: Show "For Approval of Engineering Leader" */}
                          {isEngineeringMember && (
                            <Button
                              onClick={() => handleUpdateStatus("JR FORM FORWARD TO ENGINEERING LEADER")}
                              disabled={isUpdating || status !== "JR FORM FORWARD TO ENGINEERING"}
                              className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                            >
                              {isUpdating ? "Saving..." : "For Approval of Engineering Leader"}
                            </Button>
                          )}
                          {/* Engineering + LEADER: Show "For Approval of Engineering Manager" */}
                          {isEngineeringLeader && (
                            <Button
                              onClick={() => handleUpdateStatus("JR FORM FORWARD TO ENGINEERING MANAGER")}
                              disabled={isUpdating || status !== "JR FORM FORWARD TO ENGINEERING LEADER"}
                              className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                            >
                              {isUpdating ? "Saving..." : "For Approval of Engineering Manager"}
                            </Button>
                          )}
                          
                          {isEngineeringManager && (
                            <Button
                              onClick={() => handleUpdateStatus("JR Form Forward to Procurement")}
                              disabled={isUpdating || status !== "JR FORM FORWARD TO ENGINEERING MANAGER"}
                              className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                            >
                              {isUpdating ? "Saving..." : "Mark as Finished"}
                            </Button>
                          )}
                        </div>
                        )}

                        {/* Fill Up Form Button - Engineering & IT Only. Hidden once a draft exists */}
                        {(isEngineering || isAdmin) && !fillUpDraft && !isProcurement && (
                          <Button
                            onClick={() => openFillUpForm(null)}
                            className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg uppercase tracking-widest text-[9px] shadow-lg shadow-blue-900/20"
                          >
                            Fill Up Form
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="bg-white border border-slate-200/50 rounded-xl shadow-sm flex flex-col flex-1 min-h-0">
                    <div className="bg-slate-50/50 px-2.5 py-1.5 border-b border-slate-100 flex items-center gap-1 text-slate-500 shrink-0">
                      <History size={10} /> <span className="text-[8px] font-black uppercase tracking-widest">Progress Tracker</span>
                    </div>
                    <div className="p-3 overflow-y-auto flex-1 scrollbar-hide">
                      <TimelineItem label="JR FORM FORWARD TO ENGINEERING" time={data?.createdAt} status="done" desc="Forwarded to Engineering" />
                      <TimelineItem label="JR FORM FORWARD TO ENGINEERING LEADER" time={data?.engineeringLeaderApprovedAt} status={stepIndex >= 1 ? "done" : "pending"} desc="Engineering Leader Approval" />
                      <TimelineItem label="JR FORM FORWARD TO ENGINEERING MANAGER" time={data?.engineeringManagerApprovedAt} status={stepIndex >= 2 ? "done" : "pending"} desc="Engineering Manager Approval" />
                      <TimelineItem label="JR FORM FORWARD TO PROCUREMENT" time={data?.completedAt} status={stepIndex >= 3 ? "done" : "pending"} desc="Forwarded to Procurement" />
                      <TimelineItem label="JR FORM APPROVED BY PROCUREMENT" time={data?.procurementApprovedAt} status={stepIndex >= 4 ? "done" : "pending"} desc="Approved by Procurement" isLast />
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
                        <ManifestItem label={requestorLabel} value={requestorValue} icon={hasAgent ? Fingerprint : User} />
                      </div>

                      <Separator className="bg-slate-50" />

                      {/* Section 1.1: Title, Location & Contact */}
                      <ManifestItem label="Project Title" value={data?.projectTitle} icon={FileText} />
                      <ManifestItem label="Location" value={locationNode} icon={MapPin} isLongText />

                      {(data?.contactPerson || data?.email || data?.contactNumber) && (
                        <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-4">
                          <ManifestItem label="Contact Person" value={data?.contactPerson} icon={User} />
                          <ManifestItem label="Email" value={data?.email} icon={Send} canCopy />
                          <ManifestItem label="Contact No." value={data?.contactNumber} icon={Radio} canCopy />
                        </div>
                      )}

                      <Separator className="bg-slate-50" />

                      {/* Section 2: Core Details */}
                      <div className="grid grid-cols-3 gap-2">
                        <ManifestItem label="Client Name" value={data?.clientName || "GENERAL"} icon={Building2} />
                        <ManifestItem label="Urgency" value={data?.priority} icon={ShieldAlert} color={data?.priority === 'HIGH' ? 'text-red-600' : 'text-blue-600'} />
                        <ManifestItem 
                          label="Work Hours" 
                          value={
                            (data?.workingTimeFrom || data?.workingTimeTo)
                              ? `${data?.workingTimeFrom ? new Date(data.workingTimeFrom).toLocaleString() : 'N/A'} - ${data?.workingTimeTo ? new Date(data.workingTimeTo).toLocaleString() : 'N/A'}`
                              : data?.workingTime || "N/A"
                          } 
                          icon={Clock} 
                        />
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

                      {/* Section 7: Uploaded PDFs (Signed JR Form & Scope of Work) */}
                      {(data?.signedJRFormViewerUrl || data?.scopeOfWorkViewerUrl) && (
                        <>
                          <Separator className="bg-slate-50" />
                          <div className="space-y-3 pt-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <FileText size={12} /> Completed Documents
                            </Label>
                            <div className="space-y-2">
                              {data?.signedJRFormViewerUrl && (
                                <a
                                  href={data.signedJRFormViewerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-all group"
                                >
                                  <FileText size={14} className="text-blue-600" />
                                  <span className="text-[10px] font-black text-blue-600 uppercase">View Signed JR Form</span>
                                  <ExternalLink size={10} className="text-blue-400 group-hover:text-blue-600 ml-auto" />
                                </a>
                              )}
                              {data?.scopeOfWorkViewerUrl && (
                                <a
                                  href={data.scopeOfWorkViewerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-all group"
                                >
                                  <FileText size={14} className="text-blue-600" />
                                  <span className="text-[10px] font-black text-blue-600 uppercase">View Scope of Work</span>
                                  <ExternalLink size={10} className="text-blue-400 group-hover:text-blue-600 ml-auto" />
                                </a>
                              )}
                            </div>
                          </div>
                        </>
                      )}
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
                          <div
                            className="bg-slate-100 rounded-lg overflow-hidden h-[150px] relative flex items-center justify-center ring-1 ring-slate-200/50 cursor-pointer hover:ring-blue-300 transition-all"
                            onClick={() => { setPreviewImage(selectedImage); setImagePreviewOpen(true); }}
                          >
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
                                onClick={() => { setSelectedImage(img); setPreviewImage(img); setImagePreviewOpen(true); }}
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
                      {hasAgent && (
                        <div className="space-y-1 col-span-2">
                          <span className="text-[7px] font-black text-slate-400 uppercase">Agent Name</span>
                          <p className="text-[11px] font-bold truncate">{requestorValue}</p>
                        </div>
                      )}
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
                    {/* Title, Location & Contact */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-50 pb-1.5">
                        <MapPin size={10} className="text-slate-400" />
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Project & Location</span>
                      </div>
                      <ManifestItem label={requestorLabel} value={requestorValue} icon={hasAgent ? Fingerprint : User} />
                      <ManifestItem label="Project Title" value={data?.projectTitle} icon={FileText} />
                      <ManifestItem label="Location" value={locationNode} icon={MapPin} isLongText />
                      {(data?.contactPerson || data?.email || data?.contactNumber) && (
                        <div className="space-y-3">
                          <ManifestItem label="Contact Person" value={data?.contactPerson} icon={User} />
                          <ManifestItem label="Email" value={data?.email} icon={Send} canCopy />
                          <ManifestItem label="Contact No." value={data?.contactNumber} icon={Radio} canCopy />
                        </div>
                      )}
                    </div>

                    {/* Work Schedule */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-50 pb-1.5">
                        <Clock size={10} className="text-slate-400" />
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Work Schedule</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <ManifestItem 
                          label="Hours" 
                          value={
                            (data?.workingTimeFrom || data?.workingTimeTo)
                              ? `${data?.workingTimeFrom ? new Date(data.workingTimeFrom).toLocaleString() : 'N/A'} - ${data?.workingTimeTo ? new Date(data.workingTimeTo).toLocaleString() : 'N/A'}`
                              : data?.workingTime || "N/A"
                          } 
                          icon={Clock} 
                        />
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

                    {/* Uploaded PDFs (Signed JR Form & Scope of Work) */}
                    {(data?.signedJRFormViewerUrl || data?.scopeOfWorkViewerUrl) && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-50 pb-1.5">
                          <FileText size={10} className="text-slate-400" />
                          <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Completed Documents</span>
                        </div>
                        <div className="space-y-2">
                          {data?.signedJRFormViewerUrl && (
                            <a
                              href={data.signedJRFormViewerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-all group"
                            >
                              <FileText size={14} className="text-blue-600" />
                              <span className="text-[10px] font-black text-blue-600 uppercase">View Signed JR Form</span>
                              <ExternalLink size={10} className="text-blue-400 group-hover:text-blue-600 ml-auto" />
                            </a>
                          )}
                          {data?.scopeOfWorkViewerUrl && (
                            <a
                              href={data.scopeOfWorkViewerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-all group"
                            >
                              <FileText size={14} className="text-blue-600" />
                              <span className="text-[10px] font-black text-blue-600 uppercase">View Scope of Work</span>
                              <ExternalLink size={10} className="text-blue-400 group-hover:text-blue-600 ml-auto" />
                            </a>
                          )}
                        </div>
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
                        <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden relative border border-slate-200 cursor-pointer hover:border-blue-300 transition-all" onClick={() => { setPreviewImage(selectedImage); setImagePreviewOpen(true); }}>
                          <img src={selectedImage || ""} className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all flex items-center justify-center opacity-0 hover:opacity-100">
                            <Eye size={24} className="text-white drop-shadow-lg" />
                          </div>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                          {data.attachments?.map((img: string, idx: number) => (
                            <button key={idx} onClick={() => { setSelectedImage(img); setPreviewImage(img); setImagePreviewOpen(true); }} className={cn("size-14 rounded-lg border-2 shrink-0 transition-all cursor-pointer hover:scale-105", selectedImage === img ? "border-blue-500 scale-95" : "border-slate-200 opacity-60")}>
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

{/* SAY console: Sales only, after Procurement approval */}
{isSales && isApprovedByProcurement && (
  <div className="bg-slate-900 text-white rounded-xl shadow-lg overflow-hidden border border-white/5">
    <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
      <Cpu size={12} className="text-emerald-500" />
      <h3 className="text-[10px] font-black uppercase tracking-widest">Procurement Approved</h3>
    </div>
    <div className="p-4 flex flex-col gap-1">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">SAY</span>
      <span className="text-3xl font-black tabular-nums text-emerald-400">
        {typeof data?.procurementSay === "number"
          ? `₱${data.procurementSay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "—"}
      </span>
    </div>
  </div>
)}

                {/* Section 4: Progress Tracker */}
                <div className="bg-white border border-slate-200/50 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-slate-50/50 px-3 py-2 border-b border-slate-100 flex items-center gap-2">
                    <History size={12} className="text-blue-500" />
                    <h3 className="text-[9px] font-black uppercase text-slate-900 tracking-widest">Progress Tracker</h3>
                  </div>
                  <div className="p-4">
                    <TimelineItem label="JR FORM FORWARD TO ENGINEERING" time={data?.createdAt} status="done" desc="Forwarded to Engineering" />
                    <TimelineItem label="JR FORM FORWARD TO ENGINEERING LEADER" time={data?.engineeringLeaderApprovedAt} status={stepIndex >= 1 ? "done" : "pending"} desc="Engineering Leader Approval" />
                    <TimelineItem label="JR FORM FORWARD TO ENGINEERING MANAGER" time={data?.engineeringManagerApprovedAt} status={stepIndex >= 2 ? "done" : "pending"} desc="Engineering Manager Approval" />
                    <TimelineItem label="JR FORM FORWARD TO PROCUREMENT" time={data?.completedAt} status={stepIndex >= 3 ? "done" : "pending"} desc="Forwarded to Procurement" />
                    <TimelineItem label="JR FORM APPROVED BY PROCUREMENT" time={data?.procurementApprovedAt} status={stepIndex >= 4 ? "done" : "pending"} desc="Approved by Procurement" isLast />
                  </div>
                </div>

                {/* Section 5: Engineer Console (For Engineering, Admin & Procurement) */}
                {showEngineerConsole && (
                  
                  <div className="bg-slate-900 text-white rounded-xl shadow-lg overflow-hidden border border-white/5">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                      <Cpu size={12} className="text-blue-500" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest">{isProcurement ? "Procurement Console" : "Engineer's Console"}</h3>
                    </div>
                    <div className="p-4 space-y-4">
{renderRoleNotes(false)}

                      {/* Procurement: view-only Fill Up Form */}
                      {isProcurement && (
                        <Button
                          type="button"
                          onClick={() => openFillUpForm(viewableFillUp)}
                          disabled={!viewableFillUp}
                          className="w-full h-12 gap-1.5 bg-blue-600 disabled:bg-slate-700 disabled:text-slate-400 text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-blue-900/40"
                        >
                          <Eye size={12} />
                          {viewableFillUp ? "View Fill Up Form" : "No Fill Up Form Yet"}
                        </Button>
                      )}

                      {/* Procurement / Admin: approve once the request is at the procurement stage */}
                      {(isProcurement || isAdmin) && (isAtProcurementStage || isApprovedByProcurement) && (
                        <Button
                          onClick={() => handleUpdateStatus("JR FORM APPROVED BY PROCUREMENT")}
                          disabled={isUpdating || isApprovedByProcurement}
                          className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                        >
                          {isUpdating ? "Saving..." : "JR Form Approved by Procurement"}
                        </Button>
                      )}

                      {/* PDF Upload Fields - Hidden for Procurement */}
                      {!isProcurement && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Signed JR Form (Optional)</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => setSignedJRForm(e.target.files?.[0] || null)}
                              className="hidden"
                              id="signed-jr-form-upload-mobile"
                            />
                            <label
                              htmlFor="signed-jr-form-upload-mobile"
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-black/30 border border-white/10 rounded-lg cursor-pointer hover:bg-black/40 transition-all text-[10px] text-slate-300"
                            >
                              <UploadCloud size={12} />
                              <span>{signedJRForm ? signedJRForm.name : "Upload PDF"}</span>
                            </label>
                            {signedJRForm && (
                              <button
                                onClick={() => setSignedJRForm(null)}
                                className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Scope of Work (Optional)</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => setScopeOfWork(e.target.files?.[0] || null)}
                              className="hidden"
                              id="scope-of-work-upload-mobile"
                            />
                            <label
                              htmlFor="scope-of-work-upload-mobile"
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-black/30 border border-white/10 rounded-lg cursor-pointer hover:bg-black/40 transition-all text-[10px] text-slate-300"
                            >
                              <UploadCloud size={12} />
                              <span>{scopeOfWork ? scopeOfWork.name : "Upload PDF"}</span>
                            </label>
                            {scopeOfWork && (
                              <button
                                onClick={() => setScopeOfWork(null)}
                                className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      )}

                      {/* Load Draft (only when a Fill Up Form draft exists) + Action Buttons - Hidden for Procurement */}
                      {!isProcurement && (
                      <div className="flex flex-col gap-2">
                        {fillUpDraft && (isEngineering || isAdmin) && (
                          <Button
                            type="button"
                            onClick={() => openFillUpForm(fillUpDraft)}
                            className="w-full h-12 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-blue-900/40"
                          >
                            <Eye size={12} />
                            Load Draft
                          </Button>
                        )}
                        {/* IT/Admin: Show all buttons */}
                        {isAdmin && (
                          <>
                            <Button
                              onClick={() => handleUpdateStatus("JR FORM FORWARD TO ENGINEERING LEADER")}
                              disabled={isUpdating || status !== "JR FORM FORWARD TO ENGINEERING"}
                              className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                            >
                              {isUpdating ? "Saving..." : "For Approval of Engineering Leader"}
                            </Button>
                            <Button
                              onClick={() => handleUpdateStatus("JR FORM FORWARD TO ENGINEERING MANAGER")}
                              disabled={isUpdating || status !== "JR FORM FORWARD TO ENGINEERING LEADER"}
                              className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                            >
                              {isUpdating ? "Saving..." : "For Approval of Engineering Manager"}
                            </Button>
                            <Button
                              onClick={() => handleUpdateStatus("JR Form Forward to Procurement")}
                              disabled={isUpdating || status !== "JR FORM FORWARD TO ENGINEERING MANAGER"}
                              className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                            >
                              {isUpdating ? "Saving..." : "Mark as Finished"}
                            </Button>
                          </>
                        )}
                        {/* Engineering + MEMBER: Show "For Approval of Engineering Leader" */}
                        {isEngineeringMember && (
                          <Button
                            onClick={() => handleUpdateStatus("JR FORM FORWARD TO ENGINEERING LEADER")}
                            disabled={isUpdating || status !== "JR FORM FORWARD TO ENGINEERING"}
                            className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                          >
                            {isUpdating ? "Saving..." : "For Approval of Engineering Leader"}
                          </Button>
                        )}
                        {/* Engineering + LEADER: Show "For Approval of Engineering Manager" */}
                        {isEngineeringLeader && (
                          <Button
                            onClick={() => handleUpdateStatus("JR FORM FORWARD TO ENGINEERING MANAGER")}
                            disabled={isUpdating || status !== "JR FORM FORWARD TO ENGINEERING LEADER"}
                            className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                          >
                            {isUpdating ? "Saving..." : "For Approval of Engineering Manager"}
                          </Button>
                        )}
                        {/* Engineering + MANAGER: Show "Mark as Finished" only when status is "JR FORM FORWARD TO ENGINEERING MANAGER" */}
                      {/* Engineering + MANAGER: always visible, enabled only while it's the Manager's turn */}
                      {isEngineeringManager && (
                        <Button
                          onClick={() => handleUpdateStatus("JR Form Forward to Procurement")}
                          disabled={isUpdating || status !== "JR FORM FORWARD TO ENGINEERING MANAGER"}
                          className="w-full h-12 bg-[#00C853] disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-emerald-900/40"
                        >
                          {isUpdating ? "Saving..." : "Mark as Finished"}
                        </Button>
                      )}
                      </div>
                      )}

                      {/* Fill Up Form Button - Engineering & IT Only. Hidden once a draft exists */}
                      {(isEngineering || isAdmin) && !fillUpDraft && !isProcurement && (
                        <Button onClick={() => openFillUpForm(null)} className="w-full h-12 bg-blue-600 text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-blue-900/40">
                          Fill Up Form
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>

          <CollaborationHub
            requestId={params.id}
            spfNumber={params.id}
            collectionName="job_requests"
            messages={data?.messages || []}
            currentUserId={userContext.id}
            userName={userContext.name}
            profilePicture={userContext.profilePicture}
            userRole={userContext.role}
            status={status}
            title={data?.jobRequestNo || params.id.slice(-8).toUpperCase() || "dsiconnect"}
            userDepartment={userContext.department}
          />

          {/* Fill Up Form Dialog - "Load Draft" pre-fills it with the saved draft, Submit saves to job_fill_ups.
              Procurement columns are only shown to Procurement + IT/Admin. */}
          <JobFillUpFormDialog
            open={fillUpFormOpen}
            onOpenChange={setFillUpFormOpen}
            requestId={params.id}
            draft={draftToLoad}
            onSubmit={handleSaveFillUpDraft}
            readOnly={isFillUpFormReadOnly}
            showProcurement={isProcurement || isAdmin}
            procurementEditable={canEditProcurementNotes}
            onSaveProcurement={handleSaveProcurement}
          />
          
          {/* Image Preview Dialog */}
          <ImagePreviewDialog
            open={imagePreviewOpen}
            onOpenChange={setImagePreviewOpen}
            imageUrl={previewImage}
          />
        </SidebarInset>
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}

const STEP_SHORT_LABELS: Record<string, string> = {
  "JR FORM FORWARD TO ENGINEERING": "Engineering",
  "JR FORM FORWARD TO ENGINEERING LEADER": "Eng. Leader",
  "JR FORM FORWARD TO ENGINEERING MANAGER": "Eng. Manager",
  "JR FORM FORWARD TO PROCUREMENT": "Procurement",
  "JR FORM APPROVED BY PROCUREMENT": "Proc. Approved",
};

function MiniStep({ active, completed, label }: any) {
  return (
      <div className="flex flex-col items-center gap-1.5 relative z-10 min-w-[80px]">
          <div className={cn(
              "size-6 rounded-full flex items-center justify-center border-2 transition-all duration-500 shadow-sm",
              completed ? "bg-blue-500 border-blue-500 text-white" : 
              active ? "bg-white border-blue-500 text-blue-600 ring-2 ring-blue-50" : 
              "bg-white border-slate-200 text-slate-300"
          )}>
              {completed ? <CheckCircle2 size={12} /> : <div className="size-1.5 bg-current rounded-full" />}
          </div>
          <span className={cn(
              "text-[9px] font-black uppercase tracking-wide whitespace-nowrap",
              completed || active ? "text-slate-900" : "text-slate-400"
          )}>
              {STEP_SHORT_LABELS[label] || label}
          </span>
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
      <div className="flex flex-col gap-2 group min-w-0">
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
                  "block leading-snug font-bold uppercase break-words [overflow-wrap:anywhere]",
                  isHighlight ? "text-lg md:text-xl text-blue-600 font-black tracking-tight" : "text-[13px] text-slate-700"
              )}>
                  {value || "N/A"}
              </span>
          </div>
      </div>
  )
}

function ImagePreviewDialog({ open, onOpenChange, imageUrl }: { open: boolean; onOpenChange: (open: boolean) => void; imageUrl: string | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full p-0 bg-black/95 border-none shadow-2xl">
        <div className="relative w-full h-[80vh] bg-black overflow-hidden">
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            wheel={{ step: 0.1 }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <TransformComponent>
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                  )}
                </TransformComponent>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
                  <button
                    onClick={() => zoomIn()}
                    className="p-2 hover:bg-white/10 rounded-full transition-all text-white"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={() => zoomOut()}
                    className="p-2 hover:bg-white/10 rounded-full transition-all text-white"
                  >
                    <Minus size={16} />
                  </button>
                  <button
                    onClick={() => resetTransform()}
                    className="p-2 hover:bg-white/10 rounded-full transition-all text-white"
                  >
                    <RefreshCcw size={16} />
                  </button>
                </div>
              </>
            )}
          </TransformWrapper>
        </div>
      </DialogContent>
    </Dialog>
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