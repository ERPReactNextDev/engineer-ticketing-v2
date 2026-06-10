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
  DollarSign, BarChart2, Copy, ExternalLink, GitBranch, Eye,
  Timer, Play, Pause, RotateCcw,
} from "lucide-react";

import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PageHeader } from "@/components/page-header";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
interface ProductCell {
  image: string;
  qty: string;
  specs: { title: string; details: string[] }[];
  unitCost: string;
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

const formatPHP = (val: any) => {
  const num = parseFloat(val) || 0;
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(num);
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

  return rowImages.map((rowStr, rIdx) =>
    rowStr.split(",").map((img, pIdx) => {
      const packagingStr = rowPackaging[rIdx]?.split(",")[pIdx]?.trim() ?? "";
      const dims = extractDimensions(packagingStr);
      return {
        image: img.trim(),
        qty: rowQtys[rIdx]?.split(",")[pIdx]?.trim() ?? "0",
        specs: parseSpecs(rowSpecs[rIdx]?.split(" || ")[pIdx] ?? ""),
        unitCost: rowUnitCosts[rIdx]?.split(",")[pIdx]?.trim() ?? "0",
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

function rebuildStr(rows: ProductCell[][], get: (p: ProductCell) => string) {
  return rows.map(r => r.map(get).join("|ROW|")).join("|ROW|");
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function ProcurementDetailPage() {
  const params = useParams() as { id: string };

  const [spfData, setSpfData] = useState<any>(null);
  const [requestData, setRequestData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rows, setRows] = useState<ProductCell[][]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [liveExchangeRate, setLiveExchangeRate] = useState("60");
  const [rateLastUpdated, setRateLastUpdated] = useState<Date | null>(null);
  const [rateLoading, setRateLoading] = useState(false);

  // NEW: Version History
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  // NEW: Processing Timer
  const [processingTime, setProcessingTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [timerStartTime, setTimerStartTime] = useState<number>(Date.now());

  // Calculator States
  const [showCalc, setShowCalc] = useState<Record<string, boolean>>({});
  const [calcStates, setCalcStates] = useState<Record<string, any>>({});

  const id = params?.id as string
  const [userId, setUserId] = React.useState<string | null>(null)
  const [userDept, setUserDept] = React.useState("")

  React.useEffect(() => {
    const storedId = localStorage.getItem("userId")
    setUserId(storedId)

    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(storedId || "")}`)
        const data = await res.json()
        setUserDept(data.Department?.toLowerCase() || data.department?.toLowerCase() || "sales")
      } catch (e) { console.error(e) }
    }

    fetchProfile()
    // fetchEntry()
  }, [id])

  /* ── FETCH ── */
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        let currentRate = "60";
        try {
          const rateRes = await fetch("https://open.er-api.com/v6/latest/USD");
          const rateData = await rateRes.json();
          if (rateData?.rates?.PHP) {
            currentRate = rateData.rates.PHP.toFixed(4);
            setRateLastUpdated(new Date());
          }
        } catch (e) {
          console.error("Primary exchange rate failed", e);
        }
        if (!currentRate || currentRate === "60") {
          try {
            const res = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=PHP");
            const data = await res.json();
            if (data?.rates?.PHP) {
              currentRate = data.rates.PHP.toFixed(4);
              setRateLastUpdated(new Date());
            }
          } catch (e) {
            console.error("Fallback exchange rate failed", e);
          }
        }
        setLiveExchangeRate(currentRate);

        const { data: offer, error } = await supabase
          .from("spf_creation")
          .select("*")
          .eq("id", params.id)
          .single();

        if (error) throw error;
        setSpfData(offer);

        const parsed = parseAllProducts(offer);
        setRows(parsed);

        const initCalcs: Record<string, any> = {};
        parsed.forEach((r, ri) =>
          r.forEach((p, pi) => {
            initCalcs[`${ri}-${pi}`] = {
              l: p.l_db || "",
              w: p.w_db || "",
              h: p.h_db || "",
              qtyPerBox: p.pcs_carton_db || "",
              shipmentCost: "520000",
              cbmContainer: "65",
              invoicePct: "1.01",
              exchangeRate: currentRate,
              gp: "0.75",
            };
          })
        );
        setCalcStates(initCalcs);

        const exp: Record<number, boolean> = {};
        parsed.forEach((_, i) => { exp[i] = true; });
        setExpandedRows(exp);

        if (offer?.spf_number) {
          setRequestData(offer ?? null);
          await fetchVersionHistory(offer.spf_number);
          // alert(offer.spf_number);
        }
      } catch {
        toast.error("Failed to load procurement record");
      } finally {
        setLoading(false);
      }
    }
    if (params.id) load();
  }, [params.id]);

  async function fetchVersionHistory(spfNumber: string) {
    try {
      const { data, error } = await supabase
        .from("spf_creation_history")
        .select("*")
        .eq("spf_number", spfNumber)
        .order("version_number", { ascending: false });

      if (error) throw error;
      setVersionHistory(data || []);
    } catch (err: any) {
      console.error("Failed to fetch version history:", err);
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

      setSpfData(data);
      setSelectedVersion(versionId);

      const parsed = parseAllProducts(data);
      setRows(parsed);

      toast.success(`Loaded version ${data.version_number}`);
    } catch (err: any) {
      toast.error("Failed to load version: " + err.message);
    }
  }

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



  function resetTimer() {
    setProcessingTime(0);
    setTimerStartTime(Date.now());
  }

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

  // Auto-refresh exchange rate
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        const data = await res.json();
        if (data?.rates?.PHP) {
          setLiveExchangeRate(data.rates.PHP.toFixed(4));
          setRateLastUpdated(new Date());
        }
      } catch (e) {
        console.error("Auto refresh exchange rate failed", e);
      }
    }, 1000 * 60);
    return () => clearInterval(interval);
  }, []);

  // Manual rate refresh
  const refreshRate = async () => {
    setRateLoading(true);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await res.json();
      if (data?.rates?.PHP) {
        const newRate = data.rates.PHP.toFixed(4);
        setLiveExchangeRate(newRate);
        setRateLastUpdated(new Date());
        // Also update all calc states with new rate
        setCalcStates(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(k => {
            next[k] = { ...next[k], exchangeRate: newRate };
          });
          return next;
        });
        toast.success(`Exchange rate updated: ₱${newRate}/USD`);
      }
    } catch {
      toast.error("Rate refresh failed");
    } finally {
      setRateLoading(false);
    }
  };

  /* ── DERIVED STATE ── */
  const allCells = useMemo(() => rows.flat(), [rows]);
  const filledCount = allCells.filter(p =>
    p.sellingCost && p.sellingCost !== "-" && p.leadTime && p.leadTime !== "-"
  ).length;
  const totalCount = allCells.length;
  const allFilled = filledCount === totalCount && totalCount > 0;
  const progressPct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
  const grandTotalSelling = allCells.reduce((sum, p) => sum + (parseFloat(p.sellingCost) || 0), 0);
  const grandTotalPD = allCells.reduce((sum, p) => sum + (parseFloat(p.subtotal) || 0), 0);

  const itemDescriptions = (requestData?.item_description || "").split(",").map((s: string) => s.trim());
  const itemPhotos = (requestData?.item_photo || "").split(",").map((s: string) => s.trim());

  const statusKey = getStatusKey(spfData?.status ?? "");
  const statusMeta = getStatusMeta(spfData?.status ?? "");
  const activeStep = getActiveStep(statusKey);
  const isApproved = statusKey === "APPROVED";
  const isRejected = statusKey === "REJECTED";
  const isLocked = isApproved || isRejected;

  /* ── EDIT ── */
  const updateCell = (rIdx: number, pIdx: number, field: "sellingCost" | "leadTime", value: string) => {
    if (isLocked) return;
    setRows(prev => {
      const next = prev.map(r => r.map(p => ({ ...p })));
      next[rIdx][pIdx][field] = value;
      return next;
    });
  };

  /* ── CALCULATOR LOGIC ── */
  const toggleCalc = (key: string) => setShowCalc(prev => ({ ...prev, [key]: !prev[key] }));

  const updateCalc = (key: string, field: string, val: string) => {
    setCalcStates(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {
          l: "", w: "", h: "", qtyPerBox: "",
          shipmentCost: "520000", cbmContainer: "65",
          invoicePct: "1.01", exchangeRate: liveExchangeRate, gp: "0.75"
        }),
        [field]: val
      }
    }));
  };

  const calculateSRP = (unitCost: string, calc: any) => {
    if (!calc) return { landed: 0, srp: 0 };
    const l = parseFloat(calc.l) || 0;
    const w = parseFloat(calc.w) || 0;
    const h = parseFloat(calc.h) || 0;
    const qtyPerBox = parseFloat(calc.qtyPerBox) || 0;
    const shipmentCost = parseFloat(calc.shipmentCost) || 0;
    const cbmContainer = parseFloat(calc.cbmContainer) || 0;
    const invoicePct = parseFloat(calc.invoicePct) || 0;
    const exchangeRate = parseFloat(calc.exchangeRate) || 0;
    const gp = parseFloat(calc.gp) || 0;
    const unitPrice = parseFloat(unitCost) || 0;
    if (!l || !w || !h || !qtyPerBox || !cbmContainer || gp >= 1) return { landed: 0, srp: 0 };
    const cbmPerBox = (l * w * h) / 1000000;
    const boxesPerContainer = cbmContainer / cbmPerBox;
    const totalItems = boxesPerContainer * qtyPerBox;
    const shippingPerItem = shipmentCost / totalItems;
    const baseCost = unitPrice * exchangeRate;
    const landedCost = (baseCost + shippingPerItem) * invoicePct;
    const srp = landedCost / (1 - gp);
    return { landed: landedCost, srp };
  };

  /* ── SAVE ── */
  const handleSave = async (markCostingDone: boolean) => {
    if (isLocked) return;
    setIsSaving(true);
    try {
      const update: any = {
        final_selling_cost: rebuildStr(rows, p => p.sellingCost),
        proj_lead_time: rebuildStr(rows, p => p.leadTime),
        date_updated: new Date().toISOString(),
      };
      if (markCostingDone) {
        update.status = "Approved By Procurement";
      }
      const { error } = await supabase
        .from("spf_creation")
        .update(update)
        .eq("id", params.id);
      if (error) throw error;

      // NEW: Save to history
      const currentVersion = versionHistory.length > 0 ? versionHistory[0].version_number : 0;
      const newVersion = currentVersion + 1;

      const historyPayload: any = {
        ...spfData,
        ...update,
        spf_number: spfData.spf_number,
        version_number: newVersion,
        version_label: `${spfData.spf_number}_v${newVersion}`,
        edited_by: "PROCUREMENT_USER", // TODO: Replace with actual user
        created_at: new Date().toISOString(),
        changes_summary: `${markCostingDone ? 'Approved' : 'Updated'} costing with ${processingTime}s processing time`
      };
      delete historyPayload.id;

      const { error: historyError } = await supabase
        .from("spf_creation_history")
        .insert(historyPayload);

      if (historyError) console.error("Failed to save history:", historyError);

      setSpfData((prev: any) => ({ ...prev, ...update }));
      await fetchVersionHistory(spfData.spf_number);
      toast.success(markCostingDone ? "Saved & marked Approved By Procurement ✓" : "Costing saved ✓");
      resetTimer(); // Reset timer after successful save
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setIsSaving(false);
      setShowConfirm(false);
    }
  };

  /* ── COPY SPF NUMBER ── */
  const copySpfNumber = () => {
    if (spfData?.spf_number) {
      navigator.clipboard.writeText(spfData.spf_number);
      toast.success("SPF number copied");
    }
  };

  /* ── LOADING ── */
  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#F8FAFA] gap-4">
      <div className="relative">
        <div className="size-12 rounded-2xl bg-zinc-900 flex items-center justify-center">
          <Package size={20} className="text-white" />
        </div>
        <Loader2 className="size-5 animate-spin text-zinc-400 absolute -bottom-1.5 -right-1.5 bg-[#F8FAFA] rounded-full p-0.5" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading Record...</p>
    </div>
  );

  return (
    <ProtectedPageWrapper>
      {/* FIX: defaultOpen={true} so sidebar shows on desktop; 
          SidebarProvider must wrap AppSidebar + SidebarInset together */}
      <SidebarProvider defaultOpen={false}>
        <AppSidebar userId={userId} />

        <SidebarInset className={cn(
          "bg-[#F8FAFA] min-h-screen",
          !isLocked ? "pb-28 lg:pb-10" : "pb-10"
        )}>
          <PageHeader
            title={`PROCUREMENT / ${spfData?.spf_number ?? "---"}`}
            version="V1.0"
            showBackButton
            trigger={<SidebarTrigger className="mr-2" />}
          />

          <main className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full space-y-3 md:space-y-4">

            {/* ── STATUS BANNERS ── */}
            {isApproved && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 shadow-sm shadow-emerald-100">
                <CheckCircle2 className="size-4 text-emerald-500 flex-shrink-0" />
                <p className="text-[11px] font-black text-emerald-700">
                  This SPF has been approved by Procurement. Costing is locked and cannot be edited.
                </p>
              </div>
            )}
            {isRejected && (
              <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 shadow-sm shadow-rose-100">
                <AlertCircle className="size-4 text-rose-500 flex-shrink-0" />
                <p className="text-[11px] font-black text-rose-700">
                  This SPF has been rejected. Costing is locked.
                </p>
              </div>
            )}

            {/* ── HEADER CARD ── */}
            <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm overflow-hidden">
              {/* Top accent bar */}
              <div className={cn(
                "h-1 w-full",
                isApproved ? "bg-gradient-to-r from-emerald-400 to-emerald-600" :
                  isRejected ? "bg-gradient-to-r from-rose-400 to-rose-600" :
                    "bg-gradient-to-r from-zinc-800 to-zinc-600"
              )} />
              <div className="p-4 md:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className={cn(
                      "size-11 md:size-12 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0",
                      isApproved ? "bg-emerald-600" : isRejected ? "bg-rose-600" : "bg-zinc-900"
                    )}>
                      {isApproved ? <CheckCircle2 size={20} /> : isRejected ? <AlertCircle size={20} /> : <Package size={20} />}
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-base md:text-lg font-black text-zinc-900 uppercase tracking-tighter truncate">
                        {requestData?.customer_name ?? spfData?.spf_number}
                      </h1>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {spfData?.tsm && (
                          <span className="text-[9px] font-black text-zinc-400 uppercase bg-zinc-100 px-2 py-0.5 rounded-lg">
                            TSM: {spfData.tsm}
                          </span>
                        )}
                        {spfData?.referenceid && (
                          <span className="text-[9px] font-black text-zinc-400 uppercase bg-zinc-100 px-2 py-0.5 rounded-lg">
                            Ref: {spfData.referenceid}
                          </span>
                        )}
                        <button
                          onClick={copySpfNumber}
                          className="text-[9px] font-mono font-black text-zinc-400 uppercase bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          {spfData?.spf_number}
                          <Copy size={8} className="text-zinc-300" />
                        </button>

                        {/* Processing Timer */}
                        {!isLocked && (
                          <div className={cn(
                            "flex items-center gap-2 px-2 py-0.5 rounded-lg border transition-all bg-blue-50 border-blue-200"
                          )}>
                            <Timer size={10} className="text-blue-600" />
                            <span className="text-[9px] font-black tabular-nums text-blue-700">
                              {formatTime(processingTime)}
                            </span>
                            <div className="flex gap-1 ml-1 border-l border-blue-200 pl-1">
                              <Play size={10} className="text-blue-600" />
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => setShowVersionHistory(true)}
                          className="text-[9px] font-black text-zinc-400 uppercase bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <GitBranch size={8} className="text-zinc-300" />
                          History ({versionHistory.length})
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-2xl border self-start sm:self-auto flex-shrink-0 shadow-sm",
                    statusMeta.bg, statusMeta.border
                  )}>
                    <div className={cn("size-2 rounded-full animate-pulse", statusMeta.dot)} />
                    <span className={cn("text-[9px] md:text-[10px] font-black uppercase tracking-widest", statusMeta.color)}>
                      {spfData?.status ?? "---"}
                    </span>
                  </div>
                </div>

                {/* ── COSTING PROGRESS BAR ── */}
                {!isApproved && !isRejected && (
                  <div className="mt-4 pt-4 border-t border-zinc-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Costing Progress</p>
                      <p className="text-[9px] font-black text-zinc-600">
                        {filledCount} / {totalCount} options filled
                        {allFilled && <span className="text-emerald-600 ml-1">· Complete ✓</span>}
                      </p>
                    </div>
                    <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700 ease-out",
                          allFilled ? "bg-gradient-to-r from-emerald-400 to-emerald-600" :
                            progressPct > 0 ? "bg-gradient-to-r from-blue-400 to-blue-600" : "bg-zinc-200"
                        )}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    {progressPct > 0 && !allFilled && (
                      <p className="text-[8px] text-zinc-400 mt-1">{progressPct}% complete</p>
                    )}
                  </div>
                )}

                {/* ── APPROVED SUMMARY ── */}
                {isApproved && (
                  <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-500" />
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        Approved
                      </p>
                    </div>
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5">
                      <p className="text-[9px] text-emerald-700 font-black uppercase tracking-widest">Selling Total</p>
                      <p className="text-sm font-black text-emerald-700">{formatPHP(grandTotalSelling)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── WORKFLOW TIMELINE ── */}
            <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-4 md:p-5">
              <SectionHeader icon={History} title="Workflow Timeline" />

              {/* Desktop — horizontal */}
              <div className="hidden md:flex items-center mt-5 overflow-x-auto pb-2 gap-0">
                {WORKFLOW_STEPS.map((step, i) => {
                  const done = i < activeStep;
                  const active = i === activeStep;
                  const Icon = step.icon;
                  const isRejectedStep = isRejected && active;
                  return (
                    <React.Fragment key={step.key}>
                      <div className="flex flex-col items-center flex-shrink-0 w-[90px]">
                        <div className={cn(
                          "size-10 rounded-2xl flex items-center justify-center border-2 transition-all",
                          done ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200" :
                            isRejectedStep ? "bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-200" :
                              active ? "bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-200 ring-4 ring-blue-100" :
                                "bg-zinc-50 border-zinc-200 text-zinc-300"
                        )}>
                          {done ? <CheckCircle2 size={16} /> : <Icon size={15} />}
                        </div>
                        <p className={cn(
                          "text-[8px] font-black uppercase tracking-wide text-center mt-2 leading-tight",
                          done ? "text-emerald-600" :
                            isRejectedStep ? "text-rose-600" :
                              active ? "text-blue-600" : "text-zinc-300"
                        )}>
                          {step.label}
                        </p>
                        <p className={cn(
                          "text-[7px] font-bold text-center mt-0.5",
                          done ? "text-emerald-400" :
                            isRejectedStep ? "text-rose-400" :
                              active ? "text-blue-400" : "text-zinc-200"
                        )}>
                          {step.dept}
                        </p>
                      </div>
                      {i < WORKFLOW_STEPS.length - 1 && (
                        <div className={cn(
                          "flex-1 h-0.5 mx-1 min-w-[12px] transition-all rounded-full",
                          done ? "bg-emerald-300" : "bg-zinc-100"
                        )} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Mobile — compact horizontal scroll */}
              <div className="md:hidden mt-4 overflow-x-auto pb-2">
                <div className="flex items-start gap-0 min-w-max">
                  {WORKFLOW_STEPS.map((step, i) => {
                    const done = i < activeStep;
                    const active = i === activeStep;
                    const Icon = step.icon;
                    const isRejectedStep = isRejected && active;
                    return (
                      <React.Fragment key={step.key}>
                        <div className="flex flex-col items-center w-[64px] flex-shrink-0">
                          <div className={cn(
                            "size-8 rounded-xl flex items-center justify-center border-2 flex-shrink-0",
                            done ? "bg-emerald-500 border-emerald-500 text-white" :
                              isRejectedStep ? "bg-rose-500 border-rose-500 text-white" :
                                active ? "bg-blue-500 border-blue-500 text-white ring-4 ring-blue-100" :
                                  "bg-zinc-50 border-zinc-200 text-zinc-300"
                          )}>
                            {done ? <CheckCircle2 size={12} /> : <Icon size={11} />}
                          </div>
                          <p className={cn(
                            "text-[7px] font-black uppercase text-center mt-1.5 leading-tight px-0.5",
                            done ? "text-emerald-600" :
                              isRejectedStep ? "text-rose-600" :
                                active ? "text-blue-600" : "text-zinc-300"
                          )}>
                            {step.label}
                          </p>
                        </div>
                        {i < WORKFLOW_STEPS.length - 1 && (
                          <div className={cn(
                            "h-0.5 w-4 mt-4 flex-shrink-0",
                            done ? "bg-emerald-300" : "bg-zinc-100"
                          )} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── MAIN 2-COL GRID ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">

              {/* ── LEFT: Product Offers ── */}
              <div className="lg:col-span-2 space-y-3 md:space-y-4">

                {/* Exchange Rate Ticker */}
                <div className="flex items-center justify-between bg-white border border-zinc-200/60 rounded-2xl px-4 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign size={13} className="text-emerald-500" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Live USD/PHP</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-black text-zinc-800">₱{liveExchangeRate}</p>
                    {rateLastUpdated && (
                      <p className="text-[8px] text-zinc-300 font-bold hidden sm:block">
                        Updated {rateLastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    <button
                      onClick={refreshRate}
                      disabled={rateLoading}
                      className="p-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition-colors"
                    >
                      <RefreshCw size={10} className={cn("text-zinc-400", rateLoading && "animate-spin")} />
                    </button>
                  </div>
                </div>

                {/* PD Offer Panel */}
                <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-4 md:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <SectionHeader
                      icon={isLocked ? Lock : Layers}
                      title={isLocked ? "PD Offer — View Only" : "PD Offer — Costing Input"}
                    />
                    {!isLocked && !allFilled && totalCount > 0 && (
                      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 flex-shrink-0">
                        <AlertTriangle size={10} className="text-amber-500" />
                        <span className="text-[9px] font-black text-amber-700">{totalCount - filledCount} remaining</span>
                      </div>
                    )}
                    {isLocked && (
                      <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 flex-shrink-0">
                        <Lock size={9} className="text-zinc-400" />
                        <span className="text-[9px] font-black text-zinc-500 uppercase">Locked</span>
                      </div>
                    )}
                  </div>

                  {!isLocked && (
                    <p className="text-[10px] text-zinc-400 mt-2 ml-9">
                      Fill <span className="font-black text-zinc-700">Selling Cost</span> &amp; <span className="font-black text-zinc-700">Lead Time</span> per option below.
                    </p>
                  )}

                  <div className="mt-5 space-y-5">
                    {rows.length === 0 ? (
                      <div className="py-16 text-center border-2 border-dashed border-zinc-100 rounded-2xl bg-zinc-50/50">
                        <Package className="size-8 text-zinc-200 mx-auto mb-2" />
                        <p className="text-zinc-300 text-[10px] font-black uppercase tracking-[0.2em]">No Product Offers Found</p>
                      </div>
                    ) : rows.map((products, rIdx) => {
                      const isExpanded = expandedRows[rIdx] ?? true;
                      const rowFilled = products.every(p =>
                        p.sellingCost && p.sellingCost !== "-" && p.leadTime && p.leadTime !== "-"
                      );
                      const rowDoneCount = products.filter(p => p.sellingCost !== "-" && p.leadTime !== "-").length;

                      return (
                        <div key={rIdx} className="border border-zinc-100 rounded-[20px] overflow-hidden shadow-sm hover:shadow-md transition-shadow">

                          {/* Collapsible row header */}
                          <button
                            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50/80 hover:bg-zinc-100/60 transition-colors text-left"
                            onClick={() => setExpandedRows(prev => ({ ...prev, [rIdx]: !prev[rIdx] }))}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                                Item Row #{rIdx + 1}
                              </span>
                              <span className="text-[9px] font-mono font-black text-zinc-400 bg-white border border-zinc-200 px-2 py-0.5 rounded-md">
                                {spfData?.spf_number}-{String(rIdx + 1).padStart(3, "0")}
                              </span>
                              <span className={cn(
                                "text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border",
                                rowFilled
                                  ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                                  : isLocked
                                    ? "text-zinc-400 bg-zinc-50 border-zinc-200"
                                    : "text-amber-600 bg-amber-50 border-amber-200"
                              )}>
                                {rowFilled ? "✓ Filled" : isLocked ? "—" : `${rowDoneCount}/${products.length} done`}
                              </span>
                            </div>
                            {isExpanded
                              ? <ChevronUp size={14} className="text-zinc-400 flex-shrink-0" />
                              : <ChevronDown size={14} className="text-zinc-400 flex-shrink-0" />
                            }
                          </button>

                          {isExpanded && (
                            <div className="divide-y divide-zinc-50">

                              {/* Client request context */}
                              {(itemDescriptions[rIdx] || itemPhotos[rIdx]) && (
                                <div className="flex gap-3 p-4 bg-amber-50/30">
                                  {itemPhotos[rIdx] && itemPhotos[rIdx] !== "-" && (
                                    <div className="size-16 rounded-xl border border-amber-100 overflow-hidden flex-shrink-0 bg-white">
                                      <img src={itemPhotos[rIdx]} alt="Client item" className="w-full h-full object-contain" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-amber-600 mb-1 flex items-center gap-1">
                                      <FileText size={8} /> Client Request
                                    </p>
                                    <p className="text-[11px] text-zinc-700 font-bold leading-snug whitespace-pre-wrap">
                                      {itemDescriptions[rIdx]?.replace(/\|/g, "\n") || "—"}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Product options */}
                              {products.map((p, pIdx) => {
                                const optionFilled = p.sellingCost !== "-" && p.sellingCost !== "" && p.leadTime !== "-" && p.leadTime !== "";
                                const calcKey = `${rIdx}-${pIdx}`;
                                const currentCalc = calcStates[calcKey] || {
                                  l: p.l_db || "", w: p.w_db || "", h: p.h_db || "", qtyPerBox: p.pcs_carton_db || "",
                                  shipmentCost: "520000", cbmContainer: "65",
                                  invoicePct: "1.01", exchangeRate: liveExchangeRate, gp: "0.75"
                                };
                                const calcResult = calculateSRP(p.unitCost, currentCalc);

                                return (
                                  <div key={pIdx} className={cn(
                                    "transition-all",
                                    !isLocked && !optionFilled ? "bg-amber-50/5" : "bg-white"
                                  )}>
                                    {/* Supplier header */}
                                    <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 border-b border-zinc-50">
                                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                                        <span className={cn(
                                          "text-[9px] font-black px-2.5 py-1 rounded-full uppercase flex-shrink-0",
                                          optionFilled ? "bg-emerald-600 text-white" : "bg-zinc-900 text-white"
                                        )}>
                                          Option {pIdx + 1}
                                        </span>
                                        {p.supplierBrand !== "-" && (
                                          <span className="text-[11px] font-black text-zinc-800">{p.supplierBrand}</span>
                                        )}
                                        {p.companyName !== "-" && (
                                          <span className="text-[10px] text-zinc-400 font-bold truncate">· {p.companyName}</span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-400 font-bold">
                                        {p.contactName !== "-" && (
                                          <span className="flex items-center gap-1"><User size={9} /> {p.contactName}</span>
                                        )}
                                        {p.contactNumber !== "-" && (
                                          <a href={`tel:${p.contactNumber}`} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                                            <Phone size={9} /> {p.contactNumber}
                                          </a>
                                        )}
                                      </div>
                                    </div>

                                    {/* Image + specs */}
                                    <div className="p-3 md:p-4 border-b border-zinc-50 bg-zinc-50/20">
                                      <div className="flex gap-3 md:gap-4">
                                        <div className="size-20 md:size-28 bg-white rounded-2xl border border-zinc-100 overflow-hidden flex-shrink-0 shadow-sm">
                                          {p.image && p.image !== "-"
                                            ? <img src={p.image} alt="Product" className="w-full h-full object-contain" />
                                            : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={20} className="text-zinc-200" /></div>
                                          }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-2">Technical Specs</p>
                                          {p.specs.length > 0 ? (
                                            <div className="space-y-1.5">
                                              {p.specs.map((g, gi) => (
                                                <div key={gi}>
                                                  {g.title && <p className="text-[8px] font-black uppercase text-amber-600 mb-0.5">{g.title}</p>}
                                                  <ul className="space-y-0.5">
                                                    {g.details.slice(0, 5).map((d, di) => (
                                                      <li key={di} className="text-[10px] text-zinc-500 flex gap-1.5 leading-tight">
                                                        <span className="text-zinc-300 flex-shrink-0 mt-0.5">•</span>
                                                        <span>{d}</span>
                                                      </li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              ))}
                                            </div>
                                          ) : <p className="text-[10px] text-zinc-300 italic">No specs available.</p>}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Commercials */}
                                    <div className="p-3 md:p-4 space-y-3">
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                                        <CommItem icon={Receipt} label="Unit Cost (USD)" value={`$${parseFloat(p.unitCost || "0").toFixed(2)}`} hi />
                                        <CommItem icon={Box} label="Qty" value={`${p.qty} units`} />
                                        <CommItem icon={Truck} label="Packaging" value={p.packaging} />
                                        <CommItem icon={BadgeDollarSign} label="PD Subtotal" value={formatPHP(p.subtotal)} hi />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <InfoChip icon={Factory} label="Factory" value={p.factory} />
                                        <InfoChip icon={Anchor} label="Port" value={p.port} />
                                      </div>

                                      {/* ── COSTING FIELDS ── */}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-zinc-100">
                                        {/* Selling Cost */}
                                        <div className="space-y-1.5 flex flex-col justify-end">
                                          <div className="flex items-center justify-between h-[20px]">
                                            <label className={cn(
                                              "flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest",
                                              isLocked ? "text-zinc-400" : "text-blue-600"
                                            )}>
                                              <BadgeDollarSign size={9} />
                                              Selling Cost (PHP)
                                              {optionFilled && <CheckCircle2 size={9} className="text-emerald-500" />}
                                              {isLocked && <Lock size={8} className="text-zinc-300" />}
                                            </label>
                                            {!isLocked && (
                                              <button
                                                type="button"
                                                onClick={() => toggleCalc(calcKey)}
                                                className="text-[8px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 transition-colors px-2 py-1 rounded-lg"
                                              >
                                                <Calculator size={9} />
                                                {showCalc[calcKey] ? "Hide" : "Formula"}
                                              </button>
                                            )}
                                          </div>
                                          {isLocked ? (
                                            <div className="h-12 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 flex items-center">
                                              <p className="text-sm font-black text-zinc-700">
                                                {p.sellingCost !== "-" ? formatPHP(p.sellingCost) : "—"}
                                              </p>
                                            </div>
                                          ) : (
                                            <Input
                                              type="number" min={0} step="any"
                                              placeholder="e.g. 12500"
                                              value={p.sellingCost === "-" ? "" : p.sellingCost}
                                              onChange={e => updateCell(rIdx, pIdx, "sellingCost", e.target.value || "-")}
                                              className="h-12 rounded-2xl border-zinc-200 bg-blue-50/40 focus-visible:ring-blue-500 font-bold text-sm"
                                            />
                                          )}
                                        </div>

                                        {/* Lead Time */}
                                        <div className="space-y-1.5 flex flex-col justify-end">
                                          <div className="flex items-center h-[20px]">
                                            <label className={cn(
                                              "flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest",
                                              isLocked ? "text-zinc-400" : "text-violet-600"
                                            )}>
                                              <Clock size={9} />
                                              Lead Time
                                              {optionFilled && <CheckCircle2 size={9} className="text-emerald-500" />}
                                              {isLocked && <Lock size={8} className="text-zinc-300" />}
                                            </label>
                                          </div>
                                          {isLocked ? (
                                            <div className="h-12 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 flex items-center">
                                              <p className="text-sm font-black text-zinc-700">
                                                {p.leadTime !== "-" ? p.leadTime : "—"}
                                              </p>
                                            </div>
                                          ) : (
                                            <Input
                                              type="text"
                                              placeholder="e.g. 30 days"
                                              value={p.leadTime === "-" ? "" : p.leadTime}
                                              onChange={e => updateCell(rIdx, pIdx, "leadTime", e.target.value || "-")}
                                              className="h-12 rounded-2xl border-zinc-200 bg-violet-50/40 focus-visible:ring-violet-500 font-bold text-sm"
                                            />
                                          )}
                                        </div>
                                      </div>

                                      {/* ── CALCULATOR PANEL ── */}
                                      {!isLocked && showCalc[calcKey] && (
                                        <div className="mt-3 p-4 md:p-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/60 to-white shadow-inner">
                                          <div className="flex items-center gap-2 mb-4">
                                            <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                                              <Calculator size={12} />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-800">Landed Cost & SRP Calculator</p>
                                          </div>

                                          <div className="space-y-3">
                                            <div className="bg-white p-3 rounded-xl border border-zinc-100">
                                              <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-2">Packaging Dimensions (From PD)</p>
                                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                <CalcInput label="L (cm)" value={currentCalc.l} onChange={(e: any) => updateCalc(calcKey, 'l', e.target.value)} />
                                                <CalcInput label="W (cm)" value={currentCalc.w} onChange={(e: any) => updateCalc(calcKey, 'w', e.target.value)} />
                                                <CalcInput label="H (cm)" value={currentCalc.h} onChange={(e: any) => updateCalc(calcKey, 'h', e.target.value)} />
                                                <CalcInput label="Pcs/Carton" value={currentCalc.qtyPerBox} onChange={(e: any) => updateCalc(calcKey, 'qtyPerBox', e.target.value)} />
                                              </div>
                                            </div>

                                            <div className="bg-white p-3 rounded-xl border border-zinc-100">
                                              <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-2">Logistics & Rates</p>
                                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                                                <CalcInput label="Shipment Cost" value={currentCalc.shipmentCost} onChange={(e: any) => updateCalc(calcKey, 'shipmentCost', e.target.value)} />
                                                <CalcInput label="CBM/Container" value={currentCalc.cbmContainer} onChange={(e: any) => updateCalc(calcKey, 'cbmContainer', e.target.value)} />
                                                <CalcInput label="Invoice %" value={currentCalc.invoicePct} onChange={(e: any) => updateCalc(calcKey, 'invoicePct', e.target.value)} />
                                                <CalcInput label="Exch. Rate" value={currentCalc.exchangeRate} onChange={(e: any) => updateCalc(calcKey, 'exchangeRate', e.target.value)} />
                                                <CalcInput label="Target GP" value={currentCalc.gp} onChange={(e: any) => updateCalc(calcKey, 'gp', e.target.value)} />
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-3 p-4 bg-white rounded-xl border border-emerald-100">
                                            <div className="flex gap-6">
                                              <div>
                                                <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Landed Cost</p>
                                                <p className="text-sm font-black text-zinc-700">{formatPHP(calcResult.landed)}</p>
                                              </div>
                                              <div>
                                                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Target SRP</p>
                                                <p className="text-lg font-black text-emerald-600">{formatPHP(calcResult.srp)}</p>
                                              </div>
                                            </div>
                                            <Button
                                              type="button"
                                              onClick={() => {
                                                if (calcResult.srp > 0) {
                                                  updateCell(rIdx, pIdx, "sellingCost", calcResult.srp.toFixed(2).toString());
                                                  toggleCalc(calcKey);
                                                  toast.success("SRP applied to Selling Cost ✓");
                                                } else {
                                                  toast.error("Invalid calculation. Please check inputs.");
                                                }
                                              }}
                                              className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest w-full sm:w-auto"
                                            >
                                              Apply SRP
                                            </Button>
                                          </div>
                                        </div>
                                      )}

                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── LOGISTICS ── */}
                {requestData && (
                  <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-4 md:p-6">
                    <SectionHeader icon={MapPin} title="Logistics & Delivery" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                      <InfoBlock label="Delivery Site" value={requestData.delivery_address} icon={MapPin} fullWidth />
                      <InfoBlock label="Contact Person" value={requestData.contact_person} icon={User} />
                      <InfoBlock label="Mobile Number" value={requestData.contact_number} icon={Phone} />
                      <InfoBlock label="Payment Terms" value={requestData.payment_terms} icon={CreditCard} />
                      <InfoBlock label="Warranty" value={requestData.warranty} icon={ShieldCheck} />
                    </div>
                  </div>
                )}
              </div>

              {/* ── RIGHT: DESKTOP SIDEBAR ── */}
              <div className="hidden lg:flex flex-col gap-4">
                <div className="sticky top-4 space-y-4">

                  {/* Actions / Summary card */}
                  <div className={cn(
                    "p-5 rounded-[24px] shadow-xl text-white relative overflow-hidden",
                    isApproved ? "bg-emerald-700" : isRejected ? "bg-rose-700" : "bg-zinc-900"
                  )}>
                    {/* Decorative blur */}
                    <div className="absolute -right-10 -top-10 size-40 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -left-6 -bottom-6 size-24 bg-white/3 rounded-full blur-2xl pointer-events-none" />

                    <SectionHeader icon={isLocked ? Lock : BarChart2} title={isLocked ? "Summary" : "Actions"} light />

                    {/* Totals */}
                    <div className="mt-4 space-y-2 p-3 bg-white/5 rounded-2xl border border-white/10">
                      <div className="flex justify-between items-center">
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">PD Total</p>
                        <p className="text-[11px] font-black text-zinc-300">{formatPHP(grandTotalPD)}</p>
                      </div>
                      <div className="h-px bg-white/10" />
                      <div className="flex justify-between items-center">
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Selling Total</p>
                        <p className={cn("text-[14px] font-black", grandTotalSelling > 0 ? "text-emerald-300" : "text-zinc-500")}>
                          {grandTotalSelling > 0 ? formatPHP(grandTotalSelling) : "—"}
                        </p>
                      </div>
                      {grandTotalSelling > 0 && grandTotalPD > 0 && (
                        <>
                          <div className="h-px bg-white/10" />
                          <div className="flex justify-between items-center">
                            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Margin</p>
                            <p className="text-[11px] font-black text-violet-300">
                              {(((grandTotalSelling - grandTotalPD) / grandTotalSelling) * 100).toFixed(1)}%
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Progress for active state */}
                    {!isLocked && totalCount > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between items-center mb-1.5">
                          <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Completion</p>
                          <p className="text-[9px] font-black text-zinc-300">{filledCount}/{totalCount}</p>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700",
                              allFilled ? "bg-emerald-400" : progressPct > 0 ? "bg-blue-400" : "bg-white/20"
                            )}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isLocked && (
                      <div className="mt-4 space-y-2">
                        <Button
                          onClick={() => setShowConfirm(true)}
                          disabled={isSaving}
                          className={cn(
                            "w-full rounded-2xl h-12 font-black text-[10px] uppercase tracking-widest",
                            allFilled
                              ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                              : "bg-white text-zinc-900 hover:bg-zinc-100"
                          )}
                        >
                          {isSaving
                            ? <Loader2 className="size-4 animate-spin" />
                            : <><Save className="size-3.5 mr-2" />{allFilled ? "Save & Finalize" : "Save Costing"}</>
                          }
                        </Button>
                        <Button
                          disabled
                          variant="outline"
                          className="w-full border-white/20 text-white/30 bg-transparent rounded-2xl h-10 font-black text-[9px] uppercase tracking-widest cursor-not-allowed"
                        >
                          <FileDown className="size-3.5 mr-2" /> Export PDF (Coming Soon)
                        </Button>
                      </div>
                    )}

                    {isLocked && (
                      <div className="mt-4">
                        <Button
                          disabled
                          variant="outline"
                          className="w-full border-white/20 text-white/30 bg-transparent rounded-2xl h-10 font-black text-[9px] uppercase tracking-widest cursor-not-allowed"
                        >
                          <FileDown className="size-3.5 mr-2" /> Export PDF (Coming Soon)
                        </Button>
                      </div>
                    )}

                    {/* Meta info */}
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Status</p>
                        <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-xl border", statusMeta.bg, statusMeta.border)}>
                          <div className={cn("size-1.5 rounded-full", statusMeta.dot)} />
                          <span className={cn("text-[8px] font-black uppercase", statusMeta.color)}>
                            {spfData?.status ?? "---"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Created</p>
                        <p className="text-[9px] font-bold text-zinc-400">
                          {spfData?.date_created
                            ? new Date(spfData.date_created).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                            : "---"}
                        </p>
                      </div>
                      {spfData?.date_updated && (
                        <div className="flex items-center justify-between">
                          <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Last Saved</p>
                          <p className="text-[9px] font-bold text-zinc-400">
                            {new Date(spfData.date_updated).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      )}
                    </div>

                    {!isLocked && !allFilled && totalCount > 0 && (
                      <div className="mt-3 flex items-start gap-2 p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <AlertTriangle size={10} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[9px] text-zinc-400 leading-relaxed">
                          {totalCount - filledCount} option{totalCount - filledCount !== 1 ? "s" : ""} still need costing.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Special instructions */}
                  {requestData?.special_instructions && (
                    <div className="bg-amber-50/60 p-4 rounded-[20px] border border-amber-100">
                      <SectionHeader icon={AlertCircle} title="Special Instructions" />
                      <p className="mt-3 text-zinc-600 text-[11px] leading-relaxed italic">
                        "{requestData.special_instructions}"
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ── MOBILE SUMMARY ── */}
            <div className="lg:hidden bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-4 space-y-3">
              <SectionHeader icon={BadgeDollarSign} title="Summary" />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-zinc-50 rounded-2xl p-3">
                  <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">PD Total</p>
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
                  <div className="col-span-2 bg-violet-50 rounded-2xl p-3 border border-violet-100">
                    <p className="text-[8px] font-black text-violet-600 uppercase tracking-widest mb-1">Estimated Margin</p>
                    <p className="text-[13px] font-black text-violet-700">
                      {(((grandTotalSelling - grandTotalPD) / grandTotalSelling) * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
              {requestData?.special_instructions && (
                <div className="bg-amber-50/60 rounded-2xl p-3 border border-amber-100">
                  <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <AlertCircle size={8} /> Special Instructions
                  </p>
                  <p className="text-[11px] text-zinc-600 italic leading-relaxed">"{requestData.special_instructions}"</p>
                </div>
              )}
            </div>

          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* ── MOBILE STICKY BOTTOM BAR — only when not locked ── */}
      {!isLocked && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-zinc-200 px-4 py-3 flex gap-2.5 shadow-2xl shadow-zinc-900/10">
          {/* Progress pill */}
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-2xl px-3 flex-shrink-0">
            <div className="size-1.5 rounded-full bg-zinc-300" />
            <p className="text-[9px] font-black text-zinc-500 whitespace-nowrap">{filledCount}/{totalCount}</p>
          </div>
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={isSaving}
            className={cn(
              "flex-1 h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest",
              allFilled ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-zinc-900 hover:bg-zinc-800 text-white"
            )}
          >
            {isSaving
              ? <Loader2 className="size-4 animate-spin" />
              : <><Save className="size-3.5 mr-1.5" /> {allFilled ? "Save & Finalize" : "Save Costing"}</>
            }
          </Button>
        </div>
      )}

      {/* ── CONFIRM DIALOG ── */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        {/* Added max-w-md for better desktop scaling and ensured padding is consistent */}
        <DialogContent className="rounded-[24px] max-w-[400px] w-full p-6 overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0">
                <Save size={16} className="text-white" />
              </div>
              <DialogTitle className="text-[13px] font-black uppercase tracking-widest">
                Save Costing
              </DialogTitle>
            </div>

            <div className="space-y-3">
              <DialogDescription className="text-sm text-zinc-500 leading-relaxed">
                Save selling costs and lead times for this SPF.
                Choosing <span className="font-black text-emerald-600">Save + Approve</span> will mark this SPF as approved by procurement.
              </DialogDescription>

              {!allFilled && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-amber-600">
                  <span className="text-[14px]">⚠</span>
                  <span className="font-bold text-[11px] leading-tight">
                    {totalCount - filledCount} option{totalCount - filledCount !== 1 ? "s" : ""} still need costing filled in.
                  </span>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Enforced flex-col and removed default sm:flex-row behavior */}
          <div className="flex flex-col gap-2 mt-6">
            <Button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest h-12 shadow-sm"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 mr-1.5" />
                  Save + Approved By Procurement
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="w-full rounded-2xl border-zinc-200 font-black text-[10px] uppercase tracking-widest h-12 hover:bg-zinc-50"
            >
              Save Only (Keep Pending)
            </Button>

            <Button
              variant="ghost"
              onClick={() => setShowConfirm(false)}
              className="w-full rounded-2xl font-black text-[10px] uppercase tracking-widest h-10 text-zinc-400 hover:text-zinc-600"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-w-2xl rounded-[24px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0">
                <GitBranch size={16} className="text-white" />
              </div>
              <DialogTitle className="text-[13px] font-black uppercase tracking-widest">
                Version History
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-zinc-500">
              Review previous versions of this SPF.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-1 mt-4">
            <ul className="space-y-3">
              {versionHistory.length === 0 ? (
                <li className="text-center py-8 text-zinc-400 text-sm">No versions found.</li>
              ) : versionHistory.map((v) => (
                <li key={v.id} className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-black text-[12px] text-zinc-900 uppercase tracking-tight">
                        Version {v.version_number}
                      </p>
                      {v.id === selectedVersion && (
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-blue-100 text-blue-700">
                          Viewing
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                      {v.edited_by} · {new Date(v.created_at).toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-500 border border-zinc-200">
                        {v.status}
                      </span>
                    </div>
                    {v.changes_summary && (
                      <p className="text-[11px] text-zinc-500 mt-2 italic leading-relaxed">
                        "{v.changes_summary}"
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadVersion(v.id)}
                    disabled={v.id === selectedVersion}
                    className="rounded-xl border-zinc-200 font-black text-[9px] uppercase tracking-widest h-9 px-4 hover:bg-white"
                  >
                    <Eye size={12} className="mr-1.5" />
                    View
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>

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

function InfoChip({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-zinc-50 p-2.5 rounded-xl">
      <Icon size={10} className="text-zinc-300 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[7px] font-bold text-zinc-400 uppercase">{label}</p>
        <p className="text-[10px] font-bold text-zinc-600 truncate">{value}</p>
      </div>
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

function CalcInput({ label, value, onChange, placeholder = "" }: { label: string; value: any; onChange: (e: any) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{label}</label>
      <Input
        type="number"
        step="any"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-9 text-[11px] font-bold rounded-lg border-zinc-200 bg-zinc-50/50"
      />
    </div>
  );
} 