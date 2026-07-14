"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Clock, CheckCircle2, History, Loader2, ShieldCheck,
  Image as ImageIcon, MapPin, AlertCircle, Package,
  CreditCard, Phone, User, Layers, Box, BadgeDollarSign,
  Receipt, Truck, Factory, Anchor, Save, FileDown,
  FileText, ChevronDown, ChevronUp, Users, ClipboardList,
  AlertTriangle, TrendingUp, Lock, Calculator, RefreshCw,
  DollarSign, BarChart2, Copy, ExternalLink, Building2,
  Mail, Globe, Calendar, Timer, Play, Pause, RotateCcw,
  GitBranch, Eye, EyeOff, TrendingDown, ArrowUpCircle,
} from "lucide-react";

import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PageHeader } from "@/components/page-header";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RevisionApprovalPopup } from "@/components/revision-approval-popup";

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
interface ProductCell {
  image: string;
  qty: string;
  specs: { title: string; details: string[] }[];
  unitCost: string; // PD Unit Cost (original)
  procurementUnitCost?: string; // NEW: Procurement's updated unit cost
  packaging: string;
  factory: string;
  port: string;
  subtotal: string;
  supplierBrand: string;
  companyName: string;
  contactName: string;
  contactNumber: string;
  sellingCost: string;
  leadTime: string;
  rowIndex: number;
  productIndex: number;
  l_db: string;
  w_db: string;
  h_db: string;
  pcs_carton_db: string;
}

interface VersionHistoryItem {
  id: number;
  version_number: number;
  version_label: string;
  created_at: string;
  edited_by: string;
  status: string;
  changes_summary?: string;
}

/* ─────────────────────────────────────────────
   UTILITY FUNCTIONS
───────────────────────────────────────────── */

// Round up function (pataas)
const roundUpPHP = (value: any): number => {
  const num = parseFloat(value) || 0;
  return Math.ceil(num);
};

const formatPHP = (val: any, useRounding: boolean = true) => {
  const num = parseFloat(val) || 0;
  const rounded = useRounding ? roundUpPHP(num) : num;
  return new Intl.NumberFormat("en-PH", { 
    style: "currency", 
    currency: "PHP", 
    maximumFractionDigits: 0 
  }).format(rounded);
};

const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  } else if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

/* ─────────────────────────────────────────────
   STATUS HELPERS
───────────────────────────────────────────── */
const getStatusMeta = (status: string) => {
  const s = (status || "").toUpperCase().trim();
  if (s.includes("APPROVED BY PROCUREMENT") || s.includes("APPROVED"))
    return { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", glow: "shadow-emerald-200" };
  if (s.includes("COSTING DONE"))
    return { color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", dot: "bg-violet-500", glow: "shadow-violet-200" };
  if (s.includes("REJECTED"))
    return { color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500", glow: "shadow-rose-200" };
  if (s.includes("PROCUREMENT"))
    return { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500", glow: "shadow-blue-200" };
  return { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400", glow: "shadow-amber-200" };
};

const getStatusKey = (status: string) => {
  const s = (status || "").toUpperCase().trim();
  if (s.includes("COSTING DONE")) return "COSTING_DONE";
  if (s.includes("APPROVED")) return "APPROVED";
  if (s.includes("REJECTED")) return "REJECTED";
  if (s.includes("PROCUREMENT")) return "PROCUREMENT";
  return "UNKNOWN";
};

/* ─────────────────────────────────────────────
   WORKFLOW TIMELINE
───────────────────────────────────────────── */
const WORKFLOW_STEPS = [
  { key: "sales", label: "Sales Request", icon: ClipboardList, dept: "Sales" },
  { key: "tsm", label: "TSM Review", icon: Users, dept: "TSM" },
  { key: "saleshead", label: "Sales Head", icon: Users, dept: "Sales Head" },
  { key: "pd", label: "PD Recommendation", icon: Package, dept: "PD" },
  { key: "procurement", label: "Procurement", icon: TrendingUp, dept: "Procurement" },
  { key: "approved", label: "Approved", icon: CheckCircle2, dept: "Management" },
  { key: "agent", label: "Agent Requester", icon: Users, dept: "Agent" },
];

function getActiveStep(statusKey: string): number {
  switch (statusKey) {
    case "PROCUREMENT": return 4;
    case "COSTING_DONE": return 5;
    case "APPROVED": return 6;
    case "REJECTED": return 4;
    default: return 3;
  }
}

/* ─────────────────────────────────────────────
   DATA HELPERS
───────────────────────────────────────────── */
const parseSpecs = (raw: string) => {
  if (!raw || raw === "-") return [];
  if (raw.includes("~~")) {
    return raw.split("@@").map(chunk => {
      const [titlePart, rest = ""] = chunk.split("~~");
      return { title: titlePart.trim(), details: rest.split(";;").map(s => s.trim()).filter(Boolean) };
    });
  }
  const flat = raw.split(" | ").map(s => s.trim()).filter(Boolean);
  return flat.length ? [{ title: "", details: flat }] : [];
};

function extractDimensions(packaging: string) {
  if (!packaging) return { l: "", w: "", h: "" };
  const match = packaging.match(/(\d+)\s*cm\s*x\s*(\d+)\s*cm\s*x\s*(\d+)\s*cm/i);
  if (!match) return { l: "", w: "", h: "" };
  return { l: match[1], w: match[2], h: match[3] };
}

function parseAllProducts(offers: any): ProductCell[][] {
  if (!offers?.product_offer_image) return [];
  const split = (s: string | null | undefined) => (s ?? "").split("|ROW|");
  const rowImages = split(offers.product_offer_image);
  const rowQtys = split(offers.product_offer_qty);
  const rowSpecs = split(offers.product_offer_technical_specification);
  const rowUnitCosts = split(offers.product_offer_unit_cost);
  const rowPackaging = split(offers.product_offer_packaging_details);
  const rowFactories = split(offers.product_offer_factory_address);
  const rowPorts = split(offers.product_offer_port_of_discharge);
  const rowSubtotals = split(offers.product_offer_subtotal);
  const rowBrands = split(offers.supplier_brand);
  const rowCompanies = split(offers.company_name);
  const rowContactNames = split(offers.contact_name);
  const rowContactNums = split(offers.contact_number);
  const rowSelling = split(offers.final_selling_cost);
  const rowLeadTimes = split(offers.proj_lead_time);
  const rowPcsCartons = split(offers.product_offer_pcs_per_carton ?? "");
  const rowProcurementCosts = split(offers.procurement_unit_cost ?? ""); // NEW

  return rowImages.map((rowStr, rIdx) =>
    rowStr.split(",").map((img, pIdx) => {
      const packagingStr = rowPackaging[rIdx]?.split(",")[pIdx]?.trim() ?? "";
      const dims = extractDimensions(packagingStr);
      return {
        image: img.trim(),
        qty: rowQtys[rIdx]?.split(",")[pIdx]?.trim() ?? "0",
        specs: parseSpecs(rowSpecs[rIdx]?.split(" || ")[pIdx] ?? ""),
        unitCost: rowUnitCosts[rIdx]?.split(",")[pIdx]?.trim() ?? "0",
        procurementUnitCost: rowProcurementCosts[rIdx]?.split(",")[pIdx]?.trim() ?? "",
        packaging: packagingStr,
        factory: rowFactories[rIdx]?.split(",")[pIdx]?.trim() ?? "-",
        port: rowPorts[rIdx]?.split(",")[pIdx]?.trim() ?? "-",
        subtotal: rowSubtotals[rIdx]?.split(",")[pIdx]?.trim() ?? "0",
        supplierBrand: rowBrands[rIdx]?.split(",")[pIdx]?.trim() ?? "-",
        companyName: rowCompanies[rIdx]?.split(",")[pIdx]?.trim() ?? "-",
        contactName: rowContactNames[rIdx]?.split(",")[pIdx]?.trim() ?? "-",
        contactNumber: rowContactNums[rIdx]?.split(",")[pIdx]?.trim() ?? "-",
        sellingCost: rowSelling[rIdx]?.split(",")[pIdx]?.trim() ?? "-",
        leadTime: rowLeadTimes[rIdx]?.split(",")[pIdx]?.trim() ?? "-",
        l_db: dims.l,
        w_db: dims.w,
        h_db: dims.h,
        pcs_carton_db: rowPcsCartons[rIdx]?.split(",")[pIdx]?.trim() ?? "",
        rowIndex: rIdx,
        productIndex: pIdx,
      };
    })
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function ProcurementCostingPage() {
  const params = useParams() as { id: string };
  const spfNumber = params.id;

  const [requestData, setRequestData] = useState<any>(null);
  const [offersData, setOffersData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // NEW: Version History
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [latestRevision, setLatestRevision] = useState<any>(null);

  // NEW: Processing Timer
  const [processingTime, setProcessingTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [userId, setUserId] = useState<string>("");

  const allProducts = useMemo(() => parseAllProducts(offersData), [offersData]);

  useEffect(() => {
    setUserId(localStorage.getItem("userId") || "");
  }, []);

  // Local state for selling costs, lead times, and procurement unit costs
  const [localSelling, setLocalSelling] = useState<Record<string, string>>({});
  const [localLeadTimes, setLocalLeadTimes] = useState<Record<string, string>>({});
  const [localProcurementCosts, setLocalProcurementCosts] = useState<Record<string, string>>({});

  const isApproved = offersData?.status?.toUpperCase().includes("APPROVED BY PROCUREMENT");
  const isLocked = isApproved;

  useEffect(() => {
    if (spfNumber) fetchData();
  }, [spfNumber]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && timerStartTime) {
      interval = setInterval(() => {
        setProcessingTime(Math.floor((Date.now() - timerStartTime) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerStartTime]);

  async function fetchData() {
    try {
      setLoading(true);
      const { data: req, error: errReq } = await supabase
        .from("spf_request")
        .select("*")
        .eq("spf_number", spfNumber)
        .single();
      if (errReq) throw errReq;
      setRequestData(req);

      const { data: offers, error: errOff } = await supabase
        .from("spf_creation")
        .select("*")
        .eq("spf_number", spfNumber)
        .order("date_updated", { ascending: false })
        .limit(1);
      if (errOff) throw errOff;
      const off = offers?.[0];
      setOffersData(off);

      // Initialize local states
      if (off) {
        const tempSelling: Record<string, string> = {};
        const tempLeadTimes: Record<string, string> = {};
        const tempProcCosts: Record<string, string> = {};
        const rows = parseAllProducts(off);
        rows.forEach((row) => {
          row.forEach((cell) => {
            const key = `${cell.rowIndex}-${cell.productIndex}`;
            tempSelling[key] = cell.sellingCost !== "-" ? cell.sellingCost : "";
            tempLeadTimes[key] = cell.leadTime !== "-" ? cell.leadTime : "";
            tempProcCosts[key] = cell.procurementUnitCost || "";
          });
        });
        setLocalSelling(tempSelling);
        setLocalLeadTimes(tempLeadTimes);
        setLocalProcurementCosts(tempProcCosts);
      }

      // Fetch version history
      await fetchVersionHistory();
      await fetchLatestRevision(); // NEW

    } catch (err: any) {
      toast.error("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchVersionHistory() {
    try {
      const { data, error } = await supabase
        .from("spf_creation_history")
        .select("id, version_number, version_label, created_at, edited_by, status")
        .eq("spf_number", spfNumber)
        .order("version_number", { ascending: false });

      if (error) throw error;
      setVersionHistory(data || []);
    } catch (err: any) {
      console.error("Failed to fetch version history:", err);
    }
  }

  // NEW: Fetch latest pending revision
  async function fetchLatestRevision() {
    try {
      const { data, error } = await supabase
        .from("spf_revision_requests") // 🔧 palitan kung ibang table name
        .select("*")
        .eq("spf_number", spfNumber)
        .order("revision_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLatestRevision(data && data.revision_result === "Pending" ? data : null);
    } catch (err: any) {
      console.error("Failed to fetch latest revision:", err);
    }
  }

  // NEW: Approve/Reject revision handlers
  async function handleRevisionApprove() {
    try {
      const { error } = await supabase
        .from("spf_revision_requests")
        .update({ revision_result: "Approved" })
        .eq("id", latestRevision.id);
      if (error) throw error;
      toast.success("Revision approved");
      setLatestRevision(null);
      await fetchData();
    } catch (err: any) {
      toast.error("Failed to approve revision: " + err.message);
    }
  }

  async function handleRevisionReject() {
    try {
      const { error } = await supabase
        .from("spf_revision_requests")
        .update({ revision_result: "Rejected" })
        .eq("id", latestRevision.id);
      if (error) throw error;
      toast.success("Revision rejected");
      setLatestRevision(null);
      await fetchData();
    } catch (err: any) {
      toast.error("Failed to reject revision: " + err.message);
    }
  }

  async function loadVersion(versionId: number) {
    try {
      const { data, error } = await supabase
        .from("spf_creation_history")
        .select("*")
        .eq("id", versionId)
        .single();

      if (error) throw error;
      
      setOffersData(data);
      setSelectedVersion(versionId);
      
      // Re-initialize local states for this version
      const tempSelling: Record<string, string> = {};
      const tempLeadTimes: Record<string, string> = {};
      const tempProcCosts: Record<string, string> = {};
      const rows = parseAllProducts(data);
      rows.forEach((row) => {
        row.forEach((cell) => {
          const key = `${cell.rowIndex}-${cell.productIndex}`;
          tempSelling[key] = cell.sellingCost !== "-" ? cell.sellingCost : "";
          tempLeadTimes[key] = cell.leadTime !== "-" ? cell.leadTime : "";
          tempProcCosts[key] = cell.procurementUnitCost || "";
        });
      });
      setLocalSelling(tempSelling);
      setLocalLeadTimes(tempLeadTimes);
      setLocalProcurementCosts(tempProcCosts);
      
      toast.success(`Loaded version ${data.version_number}`);
    } catch (err: any) {
      toast.error("Failed to load version: " + err.message);
    }
  }

  function startTimer() {
    setTimerStartTime(Date.now() - processingTime * 1000);
    setIsTimerRunning(true);
  }

  function pauseTimer() {
    setIsTimerRunning(false);
  }

  function resetTimer() {
    setProcessingTime(0);
    setIsTimerRunning(false);
    setTimerStartTime(null);
  }

  const { filledCount, totalCount, allFilled } = useMemo(() => {
    let total = 0;
    let filled = 0;
    allProducts.forEach((row) => {
      row.forEach((cell) => {
        total++;
        const k = `${cell.rowIndex}-${cell.productIndex}`;
        const hasSelling = localSelling[k] && localSelling[k] !== "";
        const hasLead = localLeadTimes[k] && localLeadTimes[k] !== "";
        if (hasSelling && hasLead) filled++;
      });
    });
    return { filledCount: filled, totalCount: total, allFilled: filled === total };
  }, [allProducts, localSelling, localLeadTimes]);

  const { grandTotalPD, grandTotalSelling } = useMemo(() => {
    let pd = 0;
    let sell = 0;
    allProducts.forEach((row) => {
      row.forEach((cell) => {
        const k = `${cell.rowIndex}-${cell.productIndex}`;
        // Use procurement unit cost if available, otherwise use PD unit cost
        const unitCost = localProcurementCosts[k] && parseFloat(localProcurementCosts[k]) > 0 
          ? parseFloat(localProcurementCosts[k])
          : parseFloat(cell.unitCost);
        const qty = parseFloat(cell.qty) || 0;
        pd += roundUpPHP(unitCost * qty);

        const sellVal = localSelling[k];
        if (sellVal && sellVal !== "") {
          sell += roundUpPHP(parseFloat(sellVal));
        }
      });
    });
    return { grandTotalPD: pd, grandTotalSelling: sell };
  }, [allProducts, localSelling, localProcurementCosts]);

  async function handleSave(approve: boolean) {
    try {
      setIsSaving(true);
      pauseTimer(); // Pause timer when saving

      const finalSellingArray: string[] = [];
      const finalLeadTimeArray: string[] = [];
      const finalProcurementCostArray: string[] = [];

      allProducts.forEach((row) => {
        const rowSelling: string[] = [];
        const rowLeadTime: string[] = [];
        const rowProcCost: string[] = [];
        row.forEach((cell) => {
          const k = `${cell.rowIndex}-${cell.productIndex}`;
          rowSelling.push(localSelling[k] || "-");
          rowLeadTime.push(localLeadTimes[k] || "-");
          rowProcCost.push(localProcurementCosts[k] || cell.unitCost); // Keep original if not set
        });
        finalSellingArray.push(rowSelling.join(","));
        finalLeadTimeArray.push(rowLeadTime.join(","));
        finalProcurementCostArray.push(rowProcCost.join(","));
      });

      const finalSellingStr = finalSellingArray.join("|ROW|");
      const finalLeadTimeStr = finalLeadTimeArray.join("|ROW|");
      const finalProcurementCostStr = finalProcurementCostArray.join("|ROW|");

      let newStatus = offersData?.status || "";
      if (approve) {
        newStatus = "Approved by Procurement";
      }

      const updatePayload: any = {
        final_selling_cost: finalSellingStr,
        proj_lead_time: finalLeadTimeStr,
        procurement_unit_cost: finalProcurementCostStr,
        status: newStatus,
        date_updated: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("spf_creation_rows")
        .update(updatePayload)
        .eq("spf_number", spfNumber);

      if (error) throw error;

      // Save to history
      const currentVersion = versionHistory.length > 0 ? versionHistory[0].version_number : 0;
      const newVersion = currentVersion + 1;
      
      const { error: historyError } = await supabase
        .from("spf_creation_history_rows")
        .insert({
          ...offersData,
          ...updatePayload,
          version_number: newVersion,
          version_label: `${spfNumber}_v${newVersion}`,
          edited_by: "PROCUREMENT_USER", // Replace with actual user
          created_at: new Date().toISOString(),
          changes_summary: `${approve ? 'Approved' : 'Updated'} costing with ${processingTime}s processing time`
        });

      if (historyError) console.error("Failed to save history:", historyError);

      toast.success(approve ? "✅ Costing saved and approved!" : "💾 Costing saved!");
      setShowConfirm(false);
      await fetchData();
      await fetchVersionHistory();
      resetTimer(); // Reset timer after successful save

    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const statusMeta = getStatusMeta(offersData?.status || "");
  const statusKey = getStatusKey(offersData?.status || "");
  const activeStep = getActiveStep(statusKey);

  if (loading) {
    return (
      <ProtectedPageWrapper>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-50">
          <div className="text-center space-y-4">
            <Loader2 className="size-12 animate-spin text-zinc-300 mx-auto" />
            <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Loading...</p>
          </div>
        </div>
      </ProtectedPageWrapper>
    );
  }

  if (!requestData || !offersData) {
    return (
      <ProtectedPageWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <AlertCircle className="size-12 text-amber-400 mx-auto" />
            <p className="text-sm font-bold text-zinc-600">SPF not found</p>
          </div>
        </div>
      </ProtectedPageWrapper>
    );
  }

  return (
    <ProtectedPageWrapper>
      <SidebarProvider>
        <AppSidebar userId={userId} />
        <SidebarInset className="bg-gradient-to-br from-zinc-50 via-white to-zinc-50">
          
          <PageHeader 
            title={`PROCUREMENT / ${spfNumber}`} 
            version="V2.8" 
            showBackButton={true}
            trigger={<SidebarTrigger className="mr-2" />}
            actions={
              <div className="flex items-center gap-2">
                {/* Processing Timer */}
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all",
                  isTimerRunning 
                    ? "bg-blue-50 border-blue-200" 
                    : "bg-zinc-50 border-zinc-200"
                )}>
                  <Timer size={12} className={cn(
                    isTimerRunning ? "text-blue-600" : "text-zinc-400"
                  )} />
                  <span className={cn(
                    "text-[11px] font-black tabular-nums",
                    isTimerRunning ? "text-blue-700" : "text-zinc-600"
                  )}>
                    {formatTime(processingTime)}
                  </span>
                  <div className="flex gap-1">
                    {!isTimerRunning && processingTime === 0 && (
                      <button
                        onClick={startTimer}
                        className="p-1 hover:bg-blue-100 rounded transition-colors"
                        title="Start timer"
                      >
                        <Play size={10} className="text-blue-600" />
                      </button>
                    )}
                    {isTimerRunning && (
                      <button
                        onClick={pauseTimer}
                        className="p-1 hover:bg-blue-100 rounded transition-colors"
                        title="Pause timer"
                      >
                        <Pause size={10} className="text-blue-600" />
                      </button>
                    )}
                    {!isTimerRunning && processingTime > 0 && (
                      <>
                        <button
                          onClick={startTimer}
                          className="p-1 hover:bg-blue-100 rounded transition-colors"
                          title="Resume timer"
                        >
                          <Play size={10} className="text-blue-600" />
                        </button>
                        <button
                          onClick={resetTimer}
                          className="p-1 hover:bg-zinc-100 rounded transition-colors"
                          title="Reset timer"
                        >
                          <RotateCcw size={10} className="text-zinc-600" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Version History Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVersionHistory(true)}
                  className="rounded-xl font-black text-[9px] uppercase tracking-widest h-8 px-3"
                >
                  <GitBranch size={12} className="mr-1.5" />
                  History ({versionHistory.length})
                </Button>

                {isLocked && (
                  <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <Lock size={12} className="text-emerald-600" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700">
                      Approved
                    </span>
                  </div>
                )}

                {/* Progress Badge */}
                {!isLocked && (
                  <div className="flex items-center gap-2 bg-zinc-50 px-3 py-1.5 rounded-xl border border-zinc-200">
                    <div className="size-1.5 rounded-full bg-zinc-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                      {filledCount}/{totalCount}
                    </span>
                  </div>
                )}

                {!isLocked && (
                  <Button
                    onClick={() => setShowConfirm(true)}
                    disabled={isSaving}
                    className={cn(
                      "rounded-xl font-black text-[9px] uppercase tracking-widest h-8 px-4",
                      allFilled
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-zinc-900 hover:bg-zinc-800"
                    )}
                  >
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="size-3.5 mr-1.5" />
                        {allFilled ? "Finalize" : "Save"}
                      </>
                    )}
                  </Button>
                )}
              </div>
            }
          />

          <div className="px-4 lg:px-8 py-4 hidden lg:block border-b border-zinc-100 bg-white/50">
            <div className="flex items-center justify-between gap-2">
              {WORKFLOW_STEPS.map((step, idx) => {
                const isActive = idx <= activeStep;
                const isCurrent = idx === activeStep;
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                        <div
                          className={cn(
                            "size-8 rounded-xl flex items-center justify-center transition-all mb-2",
                            isActive
                              ? "bg-gradient-to-br from-zinc-900 to-zinc-800 shadow-lg shadow-zinc-900/20"
                              : "bg-zinc-100",
                            isCurrent && "ring-2 ring-zinc-900 ring-offset-2"
                          )}
                        >
                          <Icon
                            size={14}
                            className={cn(isActive ? "text-white" : "text-zinc-300")}
                          />
                        </div>
                        <p
                          className={cn(
                            "text-[8px] font-black uppercase tracking-wider text-center",
                            isActive ? "text-zinc-900" : "text-zinc-300"
                          )}
                        >
                          {step.label}
                        </p>
                        <p className="text-[7px] font-bold text-zinc-400 mt-0.5">
                          {step.dept}
                        </p>
                      </div>
                      {idx < WORKFLOW_STEPS.length - 1 && (
                        <div
                          className={cn(
                            "h-0.5 flex-1 mx-2 transition-all",
                            isActive && idx < activeStep
                              ? "bg-gradient-to-r from-zinc-900 to-zinc-700"
                              : "bg-zinc-200"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          {/* ── MAIN CONTENT ── */}
          <main className="p-4 lg:p-8 space-y-6 pb-32 lg:pb-8">

            {/* Status Card */}
            <div
              className={cn(
                "rounded-[32px] p-6 border-2 shadow-xl",
                statusMeta.bg,
                statusMeta.border,
                statusMeta.glow
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn("size-3 rounded-full animate-pulse", statusMeta.dot)} />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">
                      Current Status
                    </p>
                    <p className={cn("text-[15px] font-black uppercase", statusMeta.color)}>
                      {offersData.status || "Pending"}
                    </p>
                  </div>
                </div>
                {selectedVersion && (
                  <Badge variant="outline" className="bg-violet-50 border-violet-200 text-violet-700">
                    <Eye size={10} className="mr-1" />
                    Viewing History
                  </Badge>
                )}
              </div>
            </div>

            {/* SPF Details */}
            <div className="bg-white rounded-[32px] border-2 border-zinc-200 p-6 shadow-lg space-y-4">
              <SectionHeader icon={FileText} title="SPF Details" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoBlock label="Customer" value={requestData.customer_name} icon={Building2} />
                <InfoBlock label="Contact Person" value={requestData.contact_person} icon={User} />
                <InfoBlock label="Contact Number" value={requestData.contact_number} icon={Phone} />
                <InfoBlock label="Sales Person" value={requestData.sales_person} />
                <InfoBlock label="Delivery Date" value={requestData.delivery_date} icon={Calendar} />
                <InfoBlock label="Payment Terms" value={requestData.payment_terms} icon={CreditCard} />
              </div>
            </div>

            {/* Product Options */}
            {allProducts.map((row, rowIdx) => (
              <div
                key={rowIdx}
                className="bg-white rounded-[32px] border-2 border-zinc-200 p-6 shadow-lg space-y-6"
              >
                <div className="flex items-center justify-between">
                  <SectionHeader icon={Package} title={`Option ${rowIdx + 1}`} />
                  <Badge className="bg-zinc-900 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1">
                    {row.length} Product{row.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="space-y-6">
                  {row.map((cell, pIdx) => {
                    const key = `${cell.rowIndex}-${cell.productIndex}`;
                    const sellVal = localSelling[key] || "";
                    const leadVal = localLeadTimes[key] || "";
                    const procCostVal = localProcurementCosts[key] || "";
                    
                    const hasData = sellVal !== "" && leadVal !== "";
                    
                    // Calculate subtotals with procurement cost if available
                    const pdUnitCost = parseFloat(cell.unitCost) || 0;
                    const procUnitCost = procCostVal && parseFloat(procCostVal) > 0 
                      ? parseFloat(procCostVal) 
                      : pdUnitCost;
                    const qty = parseFloat(cell.qty) || 0;
                    const pdSubtotal = roundUpPHP(pdUnitCost * qty);
                    const procSubtotal = roundUpPHP(procUnitCost * qty);
                    const sellSubtotal = sellVal && parseFloat(sellVal) > 0 
                      ? roundUpPHP(parseFloat(sellVal))
                      : 0;

                    return (
                      <div
                        key={pIdx}
                        className={cn(
                          "rounded-2xl border-2 p-5 transition-all",
                          hasData
                            ? "border-emerald-200 bg-emerald-50/30"
                            : "border-zinc-200 bg-zinc-50/30"
                        )}
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          
                          {/* Product Image & Basic Info */}
                          <div className="lg:col-span-4 space-y-4">
                            <div className="aspect-square rounded-2xl overflow-hidden bg-white border-2 border-zinc-200 shadow-sm">
                              {cell.image ? (
                                <img
                                  src={cell.image}
                                  alt="Product"
                                  className="w-full h-full object-contain p-4"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon size={48} className="text-zinc-200" />
                                </div>
                              )}
                            </div>

                            {/* Supplier Details Card */}
                            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border-2 border-blue-100 space-y-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Building2 size={12} className="text-blue-600" />
                                <p className="text-[8px] font-black uppercase tracking-widest text-blue-600">
                                  Supplier Details
                                </p>
                              </div>
                              
                              <CommItem
                                icon={Building2}
                                label="Company"
                                value={cell.companyName}
                                hi
                              />
                              <CommItem
                                icon={Layers}
                                label="Brand"
                                value={cell.supplierBrand}
                              />
                              <CommItem
                                icon={User}
                                label="Contact Person"
                                value={cell.contactName}
                              />
                              <CommItem
                                icon={Phone}
                                label="Contact Number"
                                value={cell.contactNumber}
                                hi
                              />
                              <div className="pt-2 border-t border-blue-200">
                                <CommItem
                                  icon={Factory}
                                  label="Factory"
                                  value={cell.factory}
                                />
                              </div>
                              <CommItem
                                icon={Anchor}
                                label="Port"
                                value={cell.port}
                              />
                            </div>
                          </div>

                          {/* Specs & Pricing */}
                          <div className="lg:col-span-8 space-y-4">
                            {/* Technical Specs */}
                            {cell.specs.length > 0 && (
                              <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200">
                                <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-3">
                                  Technical Specifications
                                </p>
                                <div className="space-y-3">
                                  {cell.specs.map((spec, specIdx) => (
                                    <div key={specIdx}>
                                      {spec.title && (
                                        <p className="text-[9px] font-black text-zinc-900 uppercase mb-1.5">
                                          {spec.title}
                                        </p>
                                      )}
                                      <div className="space-y-1">
                                        {spec.details.map((detail, detIdx) => (
                                          <p
                                            key={detIdx}
                                            className="text-[11px] font-medium text-zinc-600 leading-relaxed"
                                          >
                                            • {detail}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Packaging Info */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white rounded-2xl p-3 border border-zinc-200">
                                <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                                  Quantity
                                </p>
                                <p className="text-[15px] font-black text-zinc-900">
                                  {cell.qty} pcs
                                </p>
                              </div>
                              <div className="bg-white rounded-2xl p-3 border border-zinc-200">
                                <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                                  Packaging
                                </p>
                                <p className="text-[11px] font-bold text-zinc-600 leading-tight">
                                  {cell.packaging || "-"}
                                </p>
                              </div>
                            </div>

                            {/* Pricing Section */}
                            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-5 border-2 border-violet-200 space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Calculator size={14} className="text-violet-600" />
                                  <p className="text-[9px] font-black uppercase tracking-widest text-violet-600">
                                    Cost Breakdown
                                  </p>
                                </div>
                                {procCostVal && parseFloat(procCostVal) !== pdUnitCost && (
                                  <Badge className="bg-amber-100 text-amber-700 text-[7px]">
                                    <ArrowUpCircle size={8} className="mr-1" />
                                    Procurement Updated
                                  </Badge>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* PD Unit Cost (Original) */}
                                <div className="bg-white/70 rounded-xl p-3 border border-violet-200">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Package size={10} className="text-violet-400" />
                                    <p className="text-[7px] font-black uppercase tracking-widest text-violet-400">
                                      PD Unit Cost
                                    </p>
                                  </div>
                                  <p className="text-[13px] font-black text-violet-700">
                                    {formatPHP(pdUnitCost)}
                                  </p>
                                  <p className="text-[8px] text-violet-500 mt-0.5">
                                    Subtotal: {formatPHP(pdSubtotal)}
                                  </p>
                                </div>

                                {/* Procurement Unit Cost (Editable) */}
                                <div className="bg-white/70 rounded-xl p-3 border border-amber-200">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <TrendingUp size={10} className="text-amber-600" />
                                    <p className="text-[7px] font-black uppercase tracking-widest text-amber-600">
                                      Procurement Unit Cost
                                    </p>
                                  </div>
                                  {!isLocked ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={procCostVal}
                                      onChange={(e) => {
                                        setLocalProcurementCosts((prev) => ({
                                          ...prev,
                                          [key]: e.target.value,
                                        }));
                                      }}
                                      placeholder={formatPHP(pdUnitCost, false)}
                                      className="h-8 text-[11px] font-bold rounded-lg border-amber-300 bg-white mt-1"
                                    />
                                  ) : (
                                    <p className="text-[13px] font-black text-amber-700">
                                      {formatPHP(procUnitCost)}
                                    </p>
                                  )}
                                  <p className="text-[8px] text-amber-600 mt-1">
                                    Subtotal: {formatPHP(procSubtotal)}
                                  </p>
                                </div>

                                {/* Selling Cost */}
                                <div className="bg-white/70 rounded-xl p-3 border border-emerald-200">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <BadgeDollarSign size={10} className="text-emerald-600" />
                                    <p className="text-[7px] font-black uppercase tracking-widest text-emerald-600">
                                      Selling Cost
                                    </p>
                                  </div>
                                  {!isLocked ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={sellVal}
                                      onChange={(e) => {
                                        setLocalSelling((prev) => ({
                                          ...prev,
                                          [key]: e.target.value,
                                        }));
                                      }}
                                      placeholder="Enter selling cost"
                                      className="h-8 text-[11px] font-bold rounded-lg border-emerald-300 bg-white mt-1"
                                    />
                                  ) : (
                                    <p className="text-[13px] font-black text-emerald-700">
                                      {sellVal ? formatPHP(sellVal) : "—"}
                                    </p>
                                  )}
                                  {sellSubtotal > 0 && (
                                    <p className="text-[8px] text-emerald-600 mt-1">
                                      Total: {formatPHP(sellSubtotal)}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Margin Indicator */}
                              {sellSubtotal > 0 && procSubtotal > 0 && (
                                <div className="bg-violet-100/50 rounded-xl p-3 border border-violet-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <BarChart2 size={10} className="text-violet-600" />
                                      <p className="text-[8px] font-black uppercase tracking-widest text-violet-600">
                                        Estimated Margin
                                      </p>
                                    </div>
                                    <p className="text-[13px] font-black text-violet-700">
                                      {(((sellSubtotal - procSubtotal) / sellSubtotal) * 100).toFixed(1)}%
                                    </p>
                                  </div>
                                  <div className="mt-2 h-2 bg-violet-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                                      style={{
                                        width: `${Math.min(
                                          ((sellSubtotal - procSubtotal) / sellSubtotal) * 100,
                                          100
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Lead Time */}
                              <div className="bg-white/70 rounded-xl p-3 border border-blue-200">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Clock size={10} className="text-blue-600" />
                                  <p className="text-[7px] font-black uppercase tracking-widest text-blue-600">
                                    Projected Lead Time (Days)
                                  </p>
                                </div>
                                {!isLocked ? (
                                  <Input
                                    type="number"
                                    value={leadVal}
                                    onChange={(e) => {
                                      setLocalLeadTimes((prev) => ({
                                        ...prev,
                                        [key]: e.target.value,
                                      }));
                                    }}
                                    placeholder="Enter lead time"
                                    className="h-8 text-[11px] font-bold rounded-lg border-blue-300 bg-white"
                                  />
                                ) : (
                                  <p className="text-[13px] font-black text-blue-700">
                                    {leadVal || "—"} days
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Grand Totals */}
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-[32px] p-6 shadow-2xl shadow-zinc-900/30">
              <div className="flex items-center gap-3 mb-5">
                <Calculator size={16} className="text-white" />
                <h3 className="text-[11px] font-black uppercase tracking-widest text-white">
                  Grand Totals
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl p-3 border bg-zinc-50 border-zinc-100">
                  <p className="text-[8px] font-black uppercase tracking-widest mb-1 text-zinc-400">
                    Total Cost (Procurement)
                  </p>
                  <p className="text-[13px] font-black text-zinc-700">{formatPHP(grandTotalPD)}</p>
                </div>
                <div className={cn("rounded-2xl p-3 border", isApproved ? "bg-emerald-50 border-emerald-100" : "bg-zinc-50 border-zinc-100")}>
                  <p className={cn("text-[8px] font-black uppercase tracking-widest mb-1", isApproved ? "text-emerald-600" : "text-zinc-400")}>
                    Selling Total
                  </p>
                  <p className={cn("text-[13px] font-black", isApproved ? "text-emerald-700" : "text-zinc-700")}>
                    {grandTotalSelling > 0 ? formatPHP(grandTotalSelling) : "—"}
                  </p>
                </div>
                {grandTotalSelling > 0 && grandTotalPD > 0 && (
                  <>
                    <div className="bg-violet-50 rounded-2xl p-3 border border-violet-100">
                      <p className="text-[8px] font-black text-violet-600 uppercase tracking-widest mb-1">Estimated Margin</p>
                      <p className="text-[13px] font-black text-violet-700">
                        {(((grandTotalSelling - grandTotalPD) / grandTotalSelling) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-2xl p-3 border border-blue-100">
                      <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Profit</p>
                      <p className="text-[13px] font-black text-blue-700">
                        {formatPHP(grandTotalSelling - grandTotalPD)}
                      </p>
                    </div>
                  </>
                )}
              </div>
              {requestData?.special_instructions && (
                <div className="bg-amber-50/60 rounded-2xl p-3 border border-amber-100 mt-4">
                  <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <AlertCircle size={8} /> Special Instructions
                  </p>
                  <p className="text-[11px] text-zinc-600 italic leading-relaxed">"{requestData.special_instructions}"</p>
                </div>
              )}
            </div>

          </main>
        </SidebarInset>

        {/* ── VERSION HISTORY DIALOG ── */}
        <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
          <DialogContent className="rounded-[24px] max-w-2xl mx-4 p-6 max-h-[80vh] overflow-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="size-10 rounded-2xl bg-violet-600 flex items-center justify-center">
                  <GitBranch size={16} className="text-white" />
                </div>
                <DialogTitle className="text-[13px] font-black uppercase tracking-widest">Version History</DialogTitle>
              </div>
              <DialogDescription className="text-sm text-zinc-500 leading-relaxed">
                View and restore previous versions of this SPF costing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-4">
              {versionHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History size={32} className="mx-auto text-zinc-300 mb-2" />
                  <p className="text-sm text-zinc-400">No version history yet</p>
                </div>
              ) : (
                versionHistory.map((version, idx) => {
                  const isLatest = idx === 0;
                  const isCurrent = version.id === selectedVersion;
                  const versionMeta = getStatusMeta(version.status);
                  
                  return (
                    <div
                      key={version.id}
                      className={cn(
                        "rounded-2xl border-2 p-4 transition-all cursor-pointer hover:shadow-md",
                        isCurrent ? "border-violet-300 bg-violet-50" : "border-zinc-200 bg-white"
                      )}
                      onClick={() => {
                        if (!isCurrent) {
                          loadVersion(version.id);
                          setShowVersionHistory(false);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={cn(
                              "text-[8px] font-black uppercase tracking-widest",
                              isCurrent ? "bg-violet-600 text-white" : "bg-zinc-900 text-white"
                            )}>
                              v{version.version_number}
                            </Badge>
                            {isLatest && !isCurrent && (
                              <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 text-[7px]">
                                Latest
                              </Badge>
                            )}
                            {isCurrent && (
                              <Badge variant="outline" className="bg-violet-100 border-violet-300 text-violet-700 text-[7px]">
                                <Eye size={8} className="mr-1" />
                                Viewing
                              </Badge>
                            )}
                          </div>
                          
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest mb-2",
                            versionMeta.bg,
                            versionMeta.border,
                            versionMeta.color
                          )}>
                            <div className={cn("size-1.5 rounded-full", versionMeta.dot)} />
                            {version.status}
                          </div>

                          <p className="text-[10px] text-zinc-500 mb-1">
                            <span className="font-bold">Created:</span>{" "}
                            {new Date(version.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          
                          {version.edited_by && (
                            <p className="text-[10px] text-zinc-500">
                              <span className="font-bold">By:</span> {version.edited_by}
                            </p>
                          )}

                          {version.changes_summary && (
                            <p className="text-[10px] text-zinc-600 mt-2 italic">
                              {version.changes_summary}
                            </p>
                          )}
                        </div>

                        {!isCurrent && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl font-black text-[8px] uppercase tracking-widest"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadVersion(version.id);
                              setShowVersionHistory(false);
                            }}
                          >
                            <Eye size={10} className="mr-1" />
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedVersion && (
              <div className="mt-4 p-3 bg-violet-50 border border-violet-200 rounded-2xl">
                <p className="text-[9px] font-black uppercase tracking-widest text-violet-600 mb-1">
                  <AlertCircle size={10} className="inline mr-1" />
                  Currently Viewing History
                </p>
                <p className="text-[10px] text-violet-700">
                  You're viewing a historical version. To return to the latest version, click "Back to Latest" below.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    setSelectedVersion(null);
                    await fetchData();
                    setShowVersionHistory(false);
                  }}
                  className="mt-2 rounded-xl font-black text-[8px] uppercase tracking-widest"
                >
                  <RefreshCw size={10} className="mr-1" />
                  Back to Latest
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── CONFIRM DIALOG ── */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="rounded-[24px] max-w-sm mx-4 p-6">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="size-10 rounded-2xl bg-zinc-900 flex items-center justify-center">
                  <Save size={16} className="text-white" />
                </div>
                <DialogTitle className="text-[13px] font-black uppercase tracking-widest">Save Costing</DialogTitle>
              </div>
              <DialogDescription className="text-sm text-zinc-500 leading-relaxed">
                Save selling costs, lead times, and procurement unit costs for this SPF.
                Choosing <span className="font-black text-emerald-600">Save + Approve</span> will mark this SPF as approved by procurement.
                {!allFilled && (
                  <span className="block mt-2 text-amber-600 font-bold text-[11px] bg-amber-50 border border-amber-100 rounded-xl p-2">
                    ⚠ {totalCount - filledCount} option{totalCount - filledCount !== 1 ? "s" : ""} still need costing filled in.
                  </span>
                )}
                {processingTime > 0 && (
                  <span className="block mt-2 text-blue-600 font-bold text-[11px] bg-blue-50 border border-blue-100 rounded-xl p-2 flex items-center gap-1.5">
                    <Timer size={12} />
                    Processing time: {formatTime(processingTime)}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col gap-2 mt-4">
              <Button
                onClick={() => handleSave(true)}
                disabled={isSaving || !!latestRevision}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest h-12"
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <><CheckCircle2 className="size-3.5 mr-1.5" /> Save + Approved By Procurement</>}
              </Button>
              {latestRevision && (
                <p className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-xl p-2 text-center -mt-1">
                  ⚠ May pending revision request pa — asikasuhin muna 'yan bago mag-approve.
                </p>
              )}
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="w-full rounded-2xl font-black text-[10px] uppercase tracking-widest h-12"
              >
                Save Only (Keep Pending)
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowConfirm(false)}
                className="w-full rounded-2xl font-black text-[10px] uppercase tracking-widest h-10 text-zinc-400"
              >
                Cancel
              </Button>
            </DialogFooter>
                    </DialogContent>
        </Dialog>

        {/* NEW: Revision Approval Popup */}
        {latestRevision && (
          <RevisionApprovalPopup
            latestRevision={latestRevision}
            onApprove={handleRevisionApprove}
            onReject={handleRevisionReject}
          />
        )}
      </SidebarProvider>
    </ProtectedPageWrapper>
  );
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */
function SectionHeader({ icon: Icon, title, light }: { icon: any; title: string; light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn("p-2 rounded-xl", light ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-400")}>
        <Icon size={14} />
      </div>
      <h2 className={cn("text-[10px] font-black uppercase tracking-[0.18em]", light ? "text-white" : "text-zinc-400")}>
        {title}
      </h2>
    </div>
  );
}

function CommItem({ icon: Icon, label, value, hi }: { icon: any; label: string; value: string; hi?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1">
        <Icon size={9} className="text-zinc-300" />
        <p className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className={cn("text-[11px] font-black leading-tight break-words", hi ? "text-zinc-900" : "text-zinc-600")}>{value}</p>
    </div>
  );
}

function InfoBlock({ label, value, fullWidth, icon: Icon }: { label: string; value?: string; fullWidth?: boolean; icon?: any }) {
  return (
    <div className={cn(fullWidth ? "sm:col-span-2" : "")}>
      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-300 mb-1.5">{label}</p>
      <div className="flex items-start gap-2">
        {Icon && <Icon size={13} className="mt-0.5 text-zinc-300 flex-shrink-0" />}
        <p className="text-[13px] font-bold text-zinc-900 leading-snug">{value || "---"}</p>
      </div>
    </div>
  );
}