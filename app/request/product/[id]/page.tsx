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
  DollarSign, BarChart2, Copy, ExternalLink, Globe, Zap,
  RotateCcw, XCircle, ArrowRight, ArrowUpDown, ArrowUp,
  Calendar, Activity, Percent, Building2, Settings2,
  HelpCircle, Info, Lightbulb, MousePointer2, Sparkles,
  MessageSquare,
} from "lucide-react";

import { dbCollab } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { CollaborationHub } from "@/components/collaboration-hub";

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
  productName: string;
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
  itemCode: string;
  priceValidity: string;
  tds: string;
  dimDrawing: string;
  illuDrawing: string;
  finalUnitCost: string;
  finalSubtotal: string;
  commercialType: string;
  spfRemarksPd: string;
  spfRemarksProcurement: string;
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

function parseLightMultiplePackaging(packaging: string) {
  if (!packaging || packaging === "-") return [];
  
  // Parse format: itemName\nQty: X\nL × W × H\nCost: X.XX USD
  const lines = packaging.split('\n').map(l => l.trim()).filter(Boolean);
  const items: Array<{ itemName: string; qty: string; dimensions: string; cost: string }> = [];
  
  let currentItem: any = {};
  
  for (const line of lines) {
    if (line.startsWith('Qty:')) {
      currentItem.qty = line.replace('Qty:', '').trim();
    } else if (line.includes('×') || line.includes('x')) {
      currentItem.dimensions = line;
    } else if (line.includes('USD')) {
      currentItem.cost = line;
    } else {
      // This is the item name
      if (Object.keys(currentItem).length > 0) {
        items.push({ ...currentItem });
        currentItem = {};
      }
      currentItem.itemName = line;
    }
  }
  
  // Push the last item
  if (Object.keys(currentItem).length > 0) {
    items.push(currentItem);
  }
  
  return items;
}
//test
function getBaseItemCode(itemCode: string) {
  const c = (itemCode || "").trim().toUpperCase();
  if (!c || c === "-") return "";
  const m = c.match(/^(.*)-([A-Z])$/);
  return m ? m[1] : c;
}

function getOptionSuffix(itemCode: string) {
  const c = (itemCode || "").trim().toUpperCase();
  const m = c.match(/-([A-Z])$/);
  return m ? m[1] : "";
}

function groupProductsIntoRowsByItemCode(products: ProductCell[][]): ProductCell[][] {
  const flat: Array<{ cell: ProductCell; origIndex: number; groupKey: string; optionSuffix: string }> = [];
  let idx = 0;
  for (const row of products) {
    for (const cell of row) {
      const base = getBaseItemCode(cell.itemCode);
      const groupKey = base || `__ROW_${cell.rowIndex}`;
      flat.push({ cell, origIndex: idx++, groupKey, optionSuffix: getOptionSuffix(cell.itemCode) });
    }
  }

  const order: string[] = [];
  const map = new Map<string, Array<{ cell: ProductCell; origIndex: number; optionSuffix: string }>>();

  for (const it of flat) {
    if (!map.has(it.groupKey)) {
      map.set(it.groupKey, []);
      order.push(it.groupKey);
    }
    map.get(it.groupKey)!.push({ cell: it.cell, origIndex: it.origIndex, optionSuffix: it.optionSuffix });
  }

  return order.map((key, rowIndex) => {
    const items = map.get(key)!;
    items.sort((a, b) => {
      const ar = a.optionSuffix ? a.optionSuffix.charCodeAt(0) : 999;
      const br = b.optionSuffix ? b.optionSuffix.charCodeAt(0) : 999;
      if (ar !== br) return ar - br;
      return a.origIndex - b.origIndex;
    });
    return items.map((it, productIndex) => ({
      ...it.cell,
      rowIndex,
      productIndex,
    }));
  });
}

function parseAllProducts(offers: any, exchangeRate: string): ProductCell[][] {
  if (!offers?.product_offer_image) return [];
  const rate = parseFloat(exchangeRate) || 60;
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
  const rowItemCodes = split(offers.item_code ?? "");
  const rowPriceValidity = split(offers.price_validity ?? "");
  const rowTDS = split(offers.tds ?? "");
  const rowDimDrawings = split(offers.dimensional_drawing ?? "");
  const rowIlluDrawings = split(offers.illuminance_drawing ?? "");
  const rowFinalUnitCosts = split(offers.final_unit_cost ?? "");
  const rowFinalSubtotals = split(offers.final_subtotal ?? "");
  const rowCommercialTypes = split(offers.commercial_type ?? "");
  const rowProductNames = split(offers.product_name ?? "");
  const rowSpfRemarksPd = offers.spf_remarks_pd ? offers.spf_remarks_pd.split("|ROW|") : [];
  const rowSpfRemarksProcurement = offers.spf_remarks_procurement ? offers.spf_remarks_procurement.split("|ROW|") : [];

  const parsed = rowImages.map((rowStr, rIdx) =>
    rowStr.split("|ROW|").map((img, pIdx) => {
      const packagingStr = rowPackaging[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "";
      const dims = extractDimensions(packagingStr);
      const qtyStr = rowQtys[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "0";
      const unitCostStr = rowUnitCosts[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "0";
      const finalUnitCostStr = rowFinalUnitCosts[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? unitCostStr;
      
      const qty = parseFloat(qtyStr) || 0;
      const unitCost = (finalUnitCostStr === "-" || finalUnitCostStr === "") ? (parseFloat(unitCostStr) || 0) : (parseFloat(finalUnitCostStr) || 0);
      const pdUnitCost = parseFloat(unitCostStr) || 0;
      
      // Calculate subtotal in PHP: qty * unitCost (USD) * exchangeRate
      const calculatedSubtotal = (qty * unitCost * rate).toString();
      const calculatedPdSubtotal = (qty * pdUnitCost * rate).toString();
      
      const dbPdSubtotal = rowSubtotals[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "0";

      // Calculate flat index for remarks (remarks use |ROW| separator for all products)
      let flatIndex = 0;
      for (let r = 0; r < rIdx; r++) {
        flatIndex += rowImages[r]?.split("|ROW|").length || 0;
      }
      flatIndex += pIdx;

      return {
        image: img.trim(),
        productName: rowProductNames[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        qty: qtyStr,
        specs: parseSpecs(rowSpecs[rIdx]?.split(" || ")[pIdx] ?? ""),
        unitCost: unitCostStr,
        packaging: packagingStr,
        factory: rowFactories[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        port: rowPorts[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        subtotal: (dbPdSubtotal === "-" || parseFloat(dbPdSubtotal) === qty * pdUnitCost) 
          ? calculatedPdSubtotal 
          : dbPdSubtotal,
        supplierBrand: rowBrands[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        companyName: rowCompanies[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        contactName: rowContactNames[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        contactNumber: rowContactNums[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        sellingCost: rowSelling[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        leadTime: rowLeadTimes[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        l_db: dims.l,
        w_db: dims.w,
        h_db: dims.h,
        pcs_carton_db: rowPcsCartons[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "",
        itemCode: rowItemCodes[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        priceValidity: rowPriceValidity[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        tds: rowTDS[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        dimDrawing: rowDimDrawings[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        illuDrawing: rowIlluDrawings[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        finalUnitCost: (finalUnitCostStr === "-" || finalUnitCostStr === "") ? unitCostStr : finalUnitCostStr,
        finalSubtotal: (rowFinalSubtotals[rIdx]?.split("|ROW|")[pIdx]?.trim() === "-" || !rowFinalSubtotals[rIdx]?.split("|ROW|")[pIdx] || parseFloat(rowFinalSubtotals[rIdx]?.split("|ROW|")[pIdx]) === qty * unitCost)
          ? calculatedSubtotal
          : rowFinalSubtotals[rIdx]?.split("|ROW|")[pIdx]?.trim(),
        commercialType: rowCommercialTypes[rIdx]?.split("|ROW|")[pIdx]?.trim() ?? "-",
        spfRemarksPd: rowSpfRemarksPd[flatIndex]?.trim() ?? "-",
        spfRemarksProcurement: rowSpfRemarksProcurement[flatIndex]?.trim() ?? "-",
        rowIndex: rIdx,
        productIndex: pIdx,
      };
    })
  );

  return groupProductsIntoRowsByItemCode(parsed);
}

function rebuildStr(rows: ProductCell[][], get: (p: ProductCell) => string) {
  return rows.map(r => r.map(get).join("|ROW|")).join("|ROW|");
}

function rebuildRemarksStr(rows: ProductCell[][], get: (p: ProductCell) => string) {
  // For remarks fields, always use |ROW| separator regardless of row/product structure
  return rows.flatMap(r => r.map(get)).join("|ROW|");
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

  // Calculator States
  const [showCalc, setShowCalc] = useState<Record<string, boolean>>({});
  const [calcStates, setCalcStates] = useState<Record<string, any>>({});
  const [globalSettings, setGlobalSettings] = useState({
    exchangeRate: "60",
    shipmentCost: "520000",
    cbmContainer: "65",
    invoicePct: "1.01",
    gp: "75",
    lpc_containerCost: "600000",
    lpc_invoicePct: "1.01",
    lpc_gp: "54",
    nc_multiplier: "1.65",
    nc_gp: "45",
    ll_multiplier: "1.25",
    llp_multiplier: "1.25",
    llp_deliveryFee: "5000",
  });
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [supplierAdjustments, setSupplierAdjustments] = useState<Record<string, string>>({});
  const [showGuide, setShowGuide] = useState(false);
  const [verifiedOptions, setVerifiedStatus] = useState<Record<string, boolean>>({});
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});

  // Chat/Collaboration States
  const [userContext, setUserContext] = useState({
    role: "", id: "", name: "", profilePicture: ""
  });
  const [chatData, setChatData] = useState<any>(null);

  const id = params?.id as string
  const [userId, setUserId] = React.useState<string | null>(null)
  const [userDept, setUserDept] = React.useState("")

  // Collaboration Hub Sync - Use SPF number for chat syncing
  useEffect(() => {
    let unsubscribe: () => void;
    // Wait until we have both the SPF number and userId
    // IMPORTANT: Only sync when SPF number exists to prevent creating wrong document IDs
    if (!spfData?.spf_number || !userId) {
      console.log('⚠️ Collaboration Hub Sync: Waiting for SPF number...', {
        hasSPFNumber: !!spfData?.spf_number,
        spfNumber: spfData?.spf_number,
        hasUserId: !!userId,
        offerId: id
      });
      return;
    }

    console.log('✅ Collaboration Hub Sync: Starting with SPF number', {
      spfNumber: spfData.spf_number,
      offerId: id,
      documentPath: `spf_creations/${spfData.spf_number}`
    });

    const loadUserAndChat = async () => {
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        const user = await res.json();
        setUserContext({
          role: (user.Department || "staff").toLowerCase(),
          id: userId,
          name: `${user.Firstname || ""} ${user.Lastname || ""}`.trim(),
          profilePicture: user.profilePicture || ""
        });

        // CRITICAL: Always use SPF number as document ID for collaboration
        // This ensures all systems (espiron, taskflow, engiconnect) use the same chat document
        const docRef = doc(dbCollab, "spf_creations", spfData.spf_number);
        console.log('📡 Listening to Firebase document:', `spf_creations/${spfData.spf_number}`);
        
        unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            console.log('💬 Chat messages received:', docSnap.data().messages?.length || 0);
            setChatData(docSnap.data());
          } else {
            console.log('📭 No chat document found yet');
          }
        });
      } catch (err) {
        console.error("Chat sync failed", err);
      }
    };

    loadUserAndChat();
    return () => unsubscribe?.();
  }, [spfData?.spf_number, userId, id]);

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
        setGlobalSettings(prev => ({ ...prev, exchangeRate: currentRate }));

        const { data: offer, error } = await supabase
          .from("spf_creation")
          .select("*")
          .eq("id", params.id)
          .single();

        if (error) throw error;
        setSpfData(offer);

        const parsed = parseAllProducts(offer, currentRate);
        setRows(parsed);

        const initCalcs: Record<string, any> = {};
        parsed.forEach((r, ri) =>
          r.forEach((p, pi) => {
            initCalcs[`${ri}-${pi}`] = {
              formulaType: "spf_china",
              // SPF China
              l: p.l_db || "",
              w: p.w_db || "",
              h: p.h_db || "",
              qtyPerBox: p.pcs_carton_db || "",
              shipmentCost: "520000",
              cbmContainer: "65",
              invoicePct: "1.01",
              exchangeRate: currentRate,
              gp: "75",
              // Lamp Post China
              lpc_containerCost: "600000",
              lpc_pcsPerContainer: "",
              lpc_invoicePct: "1.01",
              lpc_exchangeRate: currentRate,
              lpc_gp: "54",
              // SPF Non-China
              nc_multiplier: "1.65",
              nc_exchangeRate: currentRate,
              nc_gp: "45",
              // SPF Local Lighting
              ll_srpVatInc: "",
              ll_multiplier: "1.25",
              // SPF Local Lamp Post
              llp_srpVatInc: "",
              llp_multiplier: "1.25",
              llp_deliveryFee: "5000",
            };
          })
        );
        setCalcStates(initCalcs);

        const exp: Record<number, boolean> = {};
        parsed.forEach((_, i) => { exp[i] = true; });
        setExpandedRows(exp);

        if (offer?.spf_number) {
          const { data: req } = await supabase
            .from("spf_request")
            .select("*")
            .eq("spf_number", offer.spf_number)
            .single();
          setRequestData(req ?? null);
        }
      } catch {
        toast.error("Failed to load procurement record");
      } finally {
        setLoading(false);
      }
    }
    if (params.id) load();
  }, [params.id]);

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
  const grandTotalFinalPD = allCells.reduce((sum, p) => sum + (parseFloat(p.finalSubtotal) || 0), 0);
  const grandTotalProfit = grandTotalSelling - grandTotalFinalPD;
  const avgMarginPct = grandTotalSelling > 0 ? (grandTotalProfit / grandTotalSelling) * 100 : 0;
  
  const projectHealth = avgMarginPct >= 45 ? "excellent" : avgMarginPct >= 30 ? "good" : avgMarginPct > 0 ? "warning" : "critical";
  const healthColors = {
    excellent: "bg-emerald-500 text-white shadow-emerald-200",
    good: "bg-blue-500 text-white shadow-blue-200",
    warning: "bg-amber-500 text-white shadow-amber-200",
    critical: "bg-rose-500 text-white shadow-rose-200",
  };

  const itemDescriptions = (requestData?.item_description || "").split(",").map((s: string) => s.trim());
  const itemPhotos = (requestData?.item_photo || "").split(",").map((s: string) => s.trim());

  const statusKey = getStatusKey(spfData?.status ?? "");
  const statusMeta = getStatusMeta(spfData?.status ?? "");
  const activeStep = getActiveStep(statusKey);
  const isApproved = statusKey === "APPROVED";
  const isRejected = statusKey === "REJECTED";
  const isLocked = isApproved || isRejected;

  /* ── EDIT ── */
  const updateCell = (rIdx: number, pIdx: number, field: "sellingCost" | "leadTime" | "finalUnitCost" | "spfRemarksProcurement", value: string) => {
    if (isLocked) return;
    setRows(prev => {
      const next = prev.map(r => r.map(p => ({ ...p })));
      next[rIdx][pIdx][field] = value;

      // Auto-calculate finalSubtotal if finalUnitCost changes
      if (field === "finalUnitCost") {
        const qty = parseFloat(next[rIdx][pIdx].qty) || 0;
        const pdUnitCost = parseFloat(next[rIdx][pIdx].unitCost) || 0;
        const rate = parseFloat(liveExchangeRate) || 60;
        // If input is empty or "-", use PD cost
        const effectiveUnitCost = (value === "-" || value === "") ? pdUnitCost : parseFloat(value) || 0;
        next[rIdx][pIdx].finalSubtotal = (qty * effectiveUnitCost * rate).toString();
      }

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
          formulaType: "spf_china",
          l: "", w: "", h: "", qtyPerBox: "",
          ...globalSettings
        }),
        [field]: val
      }
    }));
  };

  const calculateSRP = (unitCost: string, calc: any) => {
    if (!calc) return { landed: 0, srp: 0, breakdown: null };
    const formulaType = calc.formulaType || "spf_china";
    const unitPrice = parseFloat(unitCost) || 0;

    if (formulaType === "spf_china") {
      const l = parseFloat(calc.l) || 0;
      const w = parseFloat(calc.w) || 0;
      const h = parseFloat(calc.h) || 0;
      const qtyPerBox = parseFloat(calc.qtyPerBox) || 0;
      const shipmentCost = parseFloat(calc.shipmentCost) || 0;
      const cbmContainer = parseFloat(calc.cbmContainer) || 0;
      const invoicePct = parseFloat(calc.invoicePct) || 0;
      const exchangeRate = parseFloat(calc.exchangeRate) || 0;
      const gpRaw = (parseFloat(calc.gp) || 0) / 100;
      const gp = Math.min(gpRaw, 0.95); // hard cap at 95% to prevent division-near-zero SRP explosion
      if (!l || !w || !h || !qtyPerBox || !cbmContainer || gpRaw >= 1) return { landed: 0, srp: 0, breakdown: null };
      const cbmPerBox = (l * w * h) / 1000000;
      const boxesPerContainer = cbmContainer / cbmPerBox;
      const totalItems = boxesPerContainer * qtyPerBox;
      const shippingPerItem = shipmentCost / totalItems;
      const baseCostPHP = unitPrice * exchangeRate;
      const landedCost = (baseCostPHP + shippingPerItem) * invoicePct;
      const srp = landedCost / (1 - gp);
      const gpActual = srp > 0 ? ((srp - landedCost) / srp) * 100 : 0;
      return {
        landed: landedCost,
        srp,
        breakdown: {
          baseCostPHP,
          shippingPerItem,
          invoiceFee: landedCost - (baseCostPHP + shippingPerItem),
          margin: srp - landedCost,
          gpActual,
        }
      };
    }

    if (formulaType === "lamp_post_china") {
      const exchangeRate = parseFloat(calc.lpc_exchangeRate) || 0;
      const containerCost = parseFloat(calc.lpc_containerCost) || 0;
      const pcsPerContainer = parseFloat(calc.lpc_pcsPerContainer) || 0;
      const invoicePct = parseFloat(calc.lpc_invoicePct) || 0;
      const gpRaw = (parseFloat(calc.lpc_gp) || 0) / 100;
      const gp = Math.min(gpRaw, 0.95);
      if (!pcsPerContainer || gpRaw >= 1) return { landed: 0, srp: 0, breakdown: null };
      const baseCostPHP = unitPrice * exchangeRate;
      const shippingPerItem = containerCost / pcsPerContainer;
      const landedCost = (baseCostPHP + shippingPerItem) * invoicePct;
      const srp = landedCost / (1 - gp);
      const gpActual = srp > 0 ? ((srp - landedCost) / srp) * 100 : 0;
      return {
        landed: landedCost,
        srp,
        breakdown: {
          baseCostPHP,
          shippingPerItem,
          invoiceFee: landedCost - (baseCostPHP + shippingPerItem),
          margin: srp - landedCost,
          gpActual,
        }
      };
    }

    if (formulaType === "spf_non_china") {
      const multiplier = parseFloat(calc.nc_multiplier) || 0;
      const exchangeRate = parseFloat(calc.nc_exchangeRate) || 0;
      const gpRaw = (parseFloat(calc.nc_gp) || 0) / 100;
      const gp = Math.min(gpRaw, 0.95);
      if (gpRaw >= 1) return { landed: 0, srp: 0, breakdown: null };
      const baseCostPHP = unitPrice * exchangeRate;
      const landedCost = baseCostPHP * multiplier;
      const srp = landedCost / (1 - gp);
      const gpActual = srp > 0 ? ((srp - landedCost) / srp) * 100 : 0;
      return {
        landed: landedCost,
        srp,
        breakdown: {
          baseCostPHP,
          multiplierEffect: landedCost - baseCostPHP,
          margin: srp - landedCost,
          gpActual,
        }
      };
    }

    if (formulaType === "local_lighting") {
      const srpVatInc = parseFloat(calc.ll_srpVatInc) || 0;
      const multiplier = parseFloat(calc.ll_multiplier) || 0;
      const srp = srpVatInc * multiplier;
      return {
        landed: 0,
        srp,
        breakdown: {
          supplierPrice: srpVatInc,
          markup: srp - srpVatInc,
        }
      };
    }

    if (formulaType === "local_lamp_post") {
      const srpVatInc = parseFloat(calc.llp_srpVatInc) || 0;
      const multiplier = parseFloat(calc.llp_multiplier) || 0;
      const deliveryFee = parseFloat(calc.llp_deliveryFee) || 0;
      const srp = (srpVatInc + deliveryFee) * multiplier;
      return {
        landed: 0,
        srp,
        breakdown: {
          supplierPrice: srpVatInc,
          deliveryFee,
          markup: srp - (srpVatInc + deliveryFee),
        }
      };
    }

    return { landed: 0, srp: 0, breakdown: null };
  };

  const calculateMaxUnitCost = (targetSRP: string, calc: any) => {
    if (!calc) return 0;
    const target = parseFloat(targetSRP) || 0;
    const formulaType = calc.formulaType || "spf_china";
    const exchangeRate = parseFloat(calc.exchangeRate || calc.lpc_exchangeRate || calc.nc_exchangeRate || liveExchangeRate) || 1;
    const gpRaw = (parseFloat(calc.gp || calc.lpc_gp || calc.nc_gp) || 0) / 100;
    const gp = Math.min(gpRaw, 0.95);
    const invoicePct = parseFloat(calc.invoicePct || calc.lpc_invoicePct) || 1;

    if (formulaType === "spf_china") {
      const l = parseFloat(calc.l) || 0;
      const w = parseFloat(calc.w) || 0;
      const h = parseFloat(calc.h) || 0;
      const qtyPerBox = parseFloat(calc.qtyPerBox) || 0;
      const shipmentCost = parseFloat(calc.shipmentCost) || 0;
      const cbmContainer = parseFloat(calc.cbmContainer) || 0;
      if (!l || !w || !h || !qtyPerBox || !cbmContainer || gp >= 1) return 0;
      
      const cbmPerBox = (l * w * h) / 1000000;
      const boxesPerContainer = cbmContainer / cbmPerBox;
      const totalItems = boxesPerContainer * qtyPerBox;
      const shippingPerItem = shipmentCost / totalItems;
      
      // UnitCost = ((SRP * (1 - GP) / InvoicePct) - ShippingPerItem) / Rate
      const maxUnitCost = ((target * (1 - gp) / invoicePct) - shippingPerItem) / exchangeRate;
      return Math.max(0, maxUnitCost);
    }

    if (formulaType === "lamp_post_china") {
      const containerCost = parseFloat(calc.lpc_containerCost) || 0;
      const pcsPerContainer = parseFloat(calc.lpc_pcsPerContainer) || 0;
      if (!pcsPerContainer || gp >= 1) return 0;
      const shippingPerItem = containerCost / pcsPerContainer;
      const maxUnitCost = ((target * (1 - gp) / invoicePct) - shippingPerItem) / exchangeRate;
      return Math.max(0, maxUnitCost);
    }

    if (formulaType === "spf_non_china") {
      const multiplier = parseFloat(calc.nc_multiplier) || 1;
      if (gp >= 1 || multiplier === 0) return 0;
      const maxUnitCost = (target * (1 - gp)) / (multiplier * exchangeRate);
      return Math.max(0, maxUnitCost);
    }

    if (formulaType === "local_lighting") {
      const multiplier = parseFloat(calc.ll_multiplier) || 1;
      if (multiplier === 0) return 0;
      return target / multiplier;
    }

    if (formulaType === "local_lamp_post") {
      const multiplier = parseFloat(calc.llp_multiplier) || 1;
      const deliveryFee = parseFloat(calc.llp_deliveryFee) || 0;
      if (multiplier === 0) return 0;
      return (target / multiplier) - deliveryFee;
    }

    return 0;
  };

  /* ── SAVE ── */
  const handleSave = async (markCostingDone: boolean) => {
    if (isLocked) return;
    setIsSaving(true);
    try {
      const update: any = {
        final_selling_cost: rebuildStr(rows, p => p.sellingCost),
        proj_lead_time: rebuildStr(rows, p => p.leadTime),
        final_unit_cost: rebuildStr(rows, p => p.finalUnitCost),
        final_subtotal: rebuildStr(rows, p => p.finalSubtotal),
        commercial_type: rebuildStr(rows, p => p.commercialType),
        spf_remarks_pd: rebuildRemarksStr(rows, p => p.spfRemarksPd),
        spf_remarks_procurement: rebuildRemarksStr(rows, p => p.spfRemarksProcurement),
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
      setSpfData((prev: any) => ({ ...prev, ...update }));
      toast.success(markCostingDone ? "Saved & marked Approved By Procurement ✓" : "Costing saved ✓");
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
      {/* ── HELP GUIDE MODAL ── */}
      {showGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-100 scale-in-center animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="p-6 md:p-8 bg-zinc-900 text-white relative">
              <div className="relative z-10 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-500 rounded-xl text-white">
                      <Info size={18} />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Procurement Pro Guide</h2>
                  </div>
                  <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest ml-1">Mastering the costing engine</p>
                </div>
                <button 
                  onClick={() => setShowGuide(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-zinc-400 transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
              
              {/* Feature 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 size-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                  <Settings2 size={20} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-black uppercase tracking-tight text-zinc-800">1. Global Parameters</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                    Set project-wide defaults for <span className="font-bold text-zinc-700 underline decoration-blue-200">Exchange Rates, Shipment Costs, and Target GP</span>. 
                    Use the <strong>"Sync All Options"</strong> button to instantly update every item in the request.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 size-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                  <Percent size={20} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-black uppercase tracking-tight text-zinc-800">2. Bulk Supplier Adjustments</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                    Negotiated a project discount? Select a supplier in the Global panel and apply a <span className="font-bold text-emerald-600">-5% or +10%</span> adjustment to 
                    all their products simultaneously.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 size-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                  <Activity size={20} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-black uppercase tracking-tight text-zinc-800">3. Risk Sensitivity Analysis</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                    Check the "Analysis Breakdown" inside each calculator. It shows exactly how a <span className="font-bold text-amber-600">±1 PHP change</span> in exchange rate 
                    impacts your final SRP, helping you manage currency risk.
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 size-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                  <TrendingUp size={20} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-black uppercase tracking-tight text-zinc-800">4. Negotiation Helper</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                    Need to hit a specific price? Use the <span className="font-bold text-blue-600 italic">Negotiation Helper</span> inside any calculator. Enter a target SRP to instantly see the 
                    <strong>Maximum Unit Cost</strong> you can afford to pay the supplier.
                  </p>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 size-10 rounded-2xl bg-violet-50 flex items-center justify-center text-violet-600 border border-violet-100">
                  <MousePointer2 size={20} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-black uppercase tracking-tight text-zinc-800">5. Override & Verification</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                    Blue values are overrides. Use the <strong>"Verify"</strong> toggle on each option to track your progress. Once done, use <strong>"Mark All as Verified"</strong> in the Global panel.
                  </p>
                </div>
              </div>

              {/* Feature 6 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 size-10 rounded-2xl bg-zinc-900 flex items-center justify-center text-white border border-zinc-800">
                  <BarChart2 size={20} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-black uppercase tracking-tight text-zinc-800">6. Project Health Analytics</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                    Watch the <span className="font-bold text-zinc-900">Project Health</span> ticker in the sidebar. It monitors your weighted average margin and alerts you if the overall project profitability is at risk.
                  </p>
                </div>
              </div>

              {/* Warning */}
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                <AlertTriangle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-rose-700 leading-normal uppercase tracking-tight">
                  <span className="font-black">Landed Cost Guardrail:</span> Row backgrounds turn light red if your Selling Cost falls below the calculated Landed Cost. Always check the "BELOW LANDED" warning.
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end">
              <Button 
                onClick={() => setShowGuide(false)}
                className="h-11 px-8 rounded-2xl bg-zinc-900 text-white font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform"
              >
                Proceed to Costing
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FIX: defaultOpen={true} so sidebar shows on desktop; 
          SidebarProvider must wrap AppSidebar + SidebarInset together */}
      <SidebarProvider defaultOpen={false}>
        <AppSidebar userId={userId} />

        <SidebarInset className="bg-[#F8FAFA] min-h-screen m-0 rounded-none border-none shadow-none overflow-visible">
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
                            TSM: {staffNames[spfData.tsm] || spfData.tsm}
                          </span>
                        )}
                        {spfData?.referenceid && (
                          <span className="text-[9px] font-black text-zinc-400 uppercase bg-zinc-100 px-2 py-0.5 rounded-lg">
                            Ref: {staffNames[spfData.referenceid] || spfData.referenceid}
                          </span>
                        )}
                        {spfData?.manager && (
                          <span className="text-[9px] font-black text-blue-400 uppercase bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <ShieldCheck size={8} /> Manager: {staffNames[spfData.manager] || spfData.manager}
                          </span>
                        )}
                        <button
                          onClick={copySpfNumber}
                          className="text-[9px] font-mono font-black text-zinc-400 uppercase bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          {spfData?.spf_number}
                          <Copy size={8} className="text-zinc-300" />
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
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-zinc-200/60 rounded-2xl px-3 py-2.5 md:px-4 shadow-sm gap-3">
                    <div className="flex items-center justify-between sm:justify-start gap-4">
                      <div className="flex items-center gap-2">
                        <DollarSign size={13} className="text-emerald-500" />
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Live USD/PHP</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-zinc-800">₱{liveExchangeRate}</p>
                        <button
                          onClick={refreshRate}
                          disabled={rateLoading}
                          className="p-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition-colors"
                        >
                          <RefreshCw size={10} className={cn("text-zinc-400", rateLoading && "animate-spin")} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar py-0.5">
                      {rateLastUpdated && (
                        <p className="text-[8px] text-zinc-300 font-bold hidden lg:block">
                          Updated {rateLastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                      <div className="hidden sm:block w-px h-4 bg-zinc-100 mx-1" />
                      <button
                        onClick={() => setShowGuide(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all text-[9px] font-black uppercase tracking-widest border border-blue-100 whitespace-nowrap"
                      >
                        <HelpCircle size={10} />
                        Quick Guide
                      </button>
                      <div className="w-px h-4 bg-zinc-100 mx-0.5 sm:mx-1" />
                      <button
                        onClick={() => setShowGlobalSettings(!showGlobalSettings)}
                        className={cn(
                          "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest whitespace-nowrap",
                          showGlobalSettings ? "bg-zinc-900 text-white shadow-md" : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100"
                        )}
                      >
                        <Calculator size={10} />
                        Global Parameters
                        {showGlobalSettings ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    </div>
                  </div>

                  {/* ── GLOBAL SETTINGS PANEL ── */}
                  {showGlobalSettings && (
                    <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-lg p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between mb-5">
                        <SectionHeader icon={Globe} title="Global Pricing Parameters" />
                        <Button
                          onClick={() => {
                            setCalcStates(prev => {
                              const next = { ...prev };
                              Object.keys(next).forEach(k => {
                                next[k] = { 
                                  ...next[k], 
                                  ...globalSettings,
                                  // Keep unique fields like dimensions and formula type
                                  l: next[k].l, w: next[k].w, h: next[k].h, 
                                  qtyPerBox: next[k].qtyPerBox,
                                  formulaType: next[k].formulaType,
                                  lpc_pcsPerContainer: next[k].lpc_pcsPerContainer,
                                  ll_srpVatInc: next[k].ll_srpVatInc,
                                  llp_srpVatInc: next[k].llp_srpVatInc,
                                };
                              });
                              return next;
                            });
                            toast.success("Global parameters applied to all options ✓");
                          } }
                          className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest"
                        >
                          Sync All Options
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 1. Global Defaults */}
                        <div className="md:col-span-2 space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Settings2 size={12} className="text-blue-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Global Formula Defaults</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-3 p-4 bg-zinc-50/50 rounded-2xl border border-zinc-100">
                              <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">China SPF Defaults</p>
                              <div className="grid grid-cols-2 gap-3">
                                <CalcInput label="Shipment (₱)" value={globalSettings.shipmentCost} onChange={(e: any) => setGlobalSettings(prev => ({...prev, shipmentCost: e.target.value}))} icon={Truck} />
                                <CalcInput label="CBM/Cont." value={globalSettings.cbmContainer} onChange={(e: any) => setGlobalSettings(prev => ({...prev, cbmContainer: e.target.value}))} icon={Layers} />
                            <CalcInput label="Target GP" value={globalSettings.gp} onChange={(e: any) => setGlobalSettings(prev => ({...prev, gp: e.target.value}))} icon={TrendingUp} suffix="%" />
                            <CalcInput label="Invoice %" value={globalSettings.invoicePct} onChange={(e: any) => setGlobalSettings(prev => ({...prev, invoicePct: e.target.value}))} icon={FileText} />
                              </div>
                            </div>
                            <div className="space-y-3 p-4 bg-zinc-50/50 rounded-2xl border border-zinc-100">
                              <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Non-China / Lamp Post</p>
                              <div className="grid grid-cols-2 gap-3">
                                <CalcInput label="NC Multiplier" value={globalSettings.nc_multiplier} onChange={(e: any) => setGlobalSettings(prev => ({...prev, nc_multiplier: e.target.value}))} icon={RefreshCw} />
                            <CalcInput label="NC Target GP" value={globalSettings.nc_gp} onChange={(e: any) => setGlobalSettings(prev => ({...prev, nc_gp: e.target.value}))} icon={TrendingUp} suffix="%" />
                            <CalcInput label="LP Cont. Cost" value={globalSettings.lpc_containerCost} onChange={(e: any) => setGlobalSettings(prev => ({...prev, lpc_containerCost: e.target.value}))} icon={Truck} />
                            <CalcInput label="LP Target GP" value={globalSettings.lpc_gp} onChange={(e: any) => setGlobalSettings(prev => ({...prev, lpc_gp: e.target.value}))} icon={TrendingUp} suffix="%" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2. Supplier Bulk Adjustment (New Feature) */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Percent size={12} className="text-emerald-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Bulk Supplier Adjustment</p>
                          </div>
                          <div className="p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100/50 space-y-4">
                            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest leading-tight">
                              Apply a percentage discount/markup to all items from a specific company
                            </p>
                            
                            {(() => {
                              const uniqueSuppliers = Array.from(new Set(allCells.map(p => p.companyName).filter(c => c !== "-")));
                              if (uniqueSuppliers.length === 0) return <p className="text-[9px] text-zinc-400 italic">No suppliers found</p>;
                              
                              return (
                                <div className="space-y-3">
                                  <select 
                                    className="w-full h-10 px-3 rounded-xl border border-zinc-200 bg-white text-[11px] font-bold text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    onChange={(e) => {
                                      const supplier = e.target.value;
                                      if (!supplier) return;
                                      const pct = prompt(`Enter percentage adjustment for ${supplier} (e.g., -5 for 5% discount, 10 for 10% markup):`);
                                      if (pct && !isNaN(parseFloat(pct))) {
                                        const factor = 1 + (parseFloat(pct) / 100);
                                        const rate = parseFloat(liveExchangeRate) || 60;
                                        setRows(prev => prev.map(r => r.map(p => {
                                          if (p.companyName === supplier) {
                                            const newCost = (parseFloat(p.finalUnitCost || p.unitCost) * factor).toFixed(2);
                                            return { 
                                              ...p, 
                                              finalUnitCost: newCost,
                                              finalSubtotal: (parseFloat(p.qty) * parseFloat(newCost) * rate).toString()
                                            };
                                          }
                                          return p;
                                        })));
                                        toast.success(`Applied ${pct}% adjustment to all items from ${supplier} ✓`);
                                      }
                                    }}
                                  >
                                    <option value="">Select a supplier...</option>
                                    {uniqueSuppliers.map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                  <div className="flex items-start gap-2 text-[8px] text-emerald-600/70 italic leading-none">
                                    <Activity size={10} />
                                    <span>This updates the Final Unit Cost across all matching products.</span>
                                  </div>
                                  <div className="h-px bg-emerald-100/50 my-2" />
                                  <Button
                                    onClick={() => {
                                      const nextStatus: Record<string, boolean> = {};
                                      allCells.forEach(p => {
                                        nextStatus[`${p.rowIndex}-${p.productIndex}`] = true;
                                      });
                                      setVerifiedStatus(nextStatus);
                                      toast.success("All options marked as verified ✓");
                                    }}
                                    className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2"
                                  >
                                    <CheckCircle2 size={12} />
                                    Mark All as Verified
                                  </Button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      <p className="text-[8px] text-zinc-400 mt-4 italic">
                        * Values changed here will be used as the starting point for new calculations. Click "Sync All Options" to update existing items.
                      </p>
                    </div>
                  )}
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
                                  formulaType: "spf_china",
                                  l: p.l_db || "", w: p.w_db || "", h: p.h_db || "", qtyPerBox: p.pcs_carton_db || "",
                                  ...globalSettings
                                };
                                const calcResult = calculateSRP(p.unitCost, currentCalc);
                                const isLowMargin = !isLocked && p.sellingCost !== "-" && calcResult.landed > 0 && parseFloat(p.sellingCost) < calcResult.landed;

                                return (
                                  <div key={pIdx} className={cn(
                                    "transition-all",
                                    !isLocked && !optionFilled ? "bg-amber-50/5" : "bg-white",
                                    isLowMargin && "bg-rose-50/20"
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
                                        <button
                                          onClick={() => setVerifiedStatus(prev => ({ ...prev, [calcKey]: !prev[calcKey] }))}
                                          className={cn(
                                            "flex items-center gap-1.5 px-2 py-0.5 rounded-lg border transition-all text-[8px] font-black uppercase tracking-widest",
                                            verifiedOptions[calcKey] 
                                              ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" 
                                              : "bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300"
                                          )}
                                        >
                                          {verifiedOptions[calcKey] ? <CheckCircle2 size={10} /> : <div className="size-2 rounded-full border border-zinc-300" />}
                                          {verifiedOptions[calcKey] ? "Verified" : "Verify"}
                                        </button>
                                        {p.supplierBrand !== "-" && (
                                          <span className="text-[11px] font-black text-zinc-800">{p.supplierBrand}</span>
                                        )}
                                        {p.itemCode !== "-" && (
                                          <span className="text-[9px] font-mono bg-zinc-50 text-zinc-500 px-2 py-0.5 rounded-md border border-zinc-100 uppercase tracking-tighter">
                                            {p.itemCode}
                                          </span>
                                        )}
                                        {p.companyName !== "-" && (
                                          <span className="text-[10px] text-zinc-400 font-bold truncate">· {p.companyName}</span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-400 font-bold">
                                        {p.priceValidity !== "-" && (
                                          <span className="flex items-center gap-1 text-rose-500/70 bg-rose-50 px-2 py-0.5 rounded-lg text-[9px]">
                                            <Calendar size={9} /> Valid until: {new Date(p.priceValidity).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                          </span>
                                        )}
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

                                    {/* ── TECHNICAL ASSETS ── */}
                                    {p.tds !== "-" && (
                                      <div className="px-4 py-2.5 bg-white border-b border-zinc-50 flex flex-wrap items-center gap-3">
                                        <p className="text-[8px] font-black text-zinc-300 uppercase tracking-widest mr-1">Technical Files:</p>
                                        <TechAssetLink icon={FileText} label="TDS" url={p.tds} disabled />
                                      </div>
                                    )}

                                    {/* Image + specs */}
                                    <div className="p-3 md:p-4 border-b border-zinc-50 bg-zinc-50/20">
                                      <div className="flex gap-3 md:gap-4">
                                        <div className="flex-shrink-0">
                                          <div className="size-20 md:size-28 bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
                                            {p.image && p.image !== "-"
                                              ? <img src={p.image} alt="Product" className="w-full h-full object-contain" />
                                              : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={20} className="text-zinc-200" /></div>
                                            }
                                          </div>
                                          {p.productName && p.productName !== "-" && (
                                            <p className="text-[9px] font-bold text-zinc-600 text-center mt-2 leading-tight px-1">
                                              {p.productName}
                                            </p>
                                          )}
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
                                    <div className="p-4 md:p-6 space-y-6">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                        
                                        {/* 1. Qty & Packaging */}
                                        <div className="space-y-3 bg-zinc-50/50 p-3 rounded-2xl border border-zinc-100">
                                          <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-zinc-200 rounded-lg text-zinc-500">
                                              <Box size={12} />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Inventory</p>
                                          </div>
                                          <div className="space-y-1">
                                            <p className="text-sm font-black text-zinc-900">{p.qty} <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest ml-1">Units</span></p>
                                            {(() => {
                                              const isLightMultiple = p.commercialType === "Light (Multiple)";
                                              if (isLightMultiple) {
                                                const items = parseLightMultiplePackaging(p.packaging);
                                                return (
                                                  <div className="space-y-2">
                                                    {items.map((item, idx) => (
                                                      <div key={idx} className="space-y-0.5">
                                                        <p className="text-xs font-bold text-zinc-900">{item.itemName}</p>
                                                        <p className="text-[10px] text-zinc-600">Qty: {item.qty}</p>
                                                        <p className="text-[10px] text-zinc-600">Packaging Dimension</p>
                                                        <p className="text-[10px] text-zinc-700">{item.dimensions}</p>
                                                        <p className="text-[10px] text-zinc-600">Cost: {item.cost}</p>
                                                      </div>
                                                    ))}
                                                  </div>
                                                );
                                              }
                                              return (
                                                <p className="text-sm text-zinc-700 font-medium break-words flex items-start gap-1.5">
                                                  <Truck size={10} className="text-zinc-400 mt-0.5 flex-shrink-0" /> {p.packaging}
                                                </p>
                                              );
                                            })()}
                                          </div>
                                        </div>

                                        {/* 2. Unit Cost (PD vs Procurement) */}
                                        <div className="space-y-3 lg:col-span-2">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                                                <Receipt size={12} />
                                              </div>
                                              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Unit Cost (USD)</p>
                                            </div>
                                            <div className="text-[11px] font-bold text-zinc-700 flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                                              <span className="uppercase tracking-widest text-blue-600 font-black">PD Orig:</span>
                                              <span className="font-black text-blue-700 text-lg">${parseFloat(p.unitCost || "0").toFixed(2)}</span>
                                            </div>
                                          </div>
                                          
                                          <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none z-10">
                                              <span className="text-sm font-black text-blue-500">$</span>
                                            </div>
                                            <Input
                                              type="text"
                                              inputMode="decimal"
                                              placeholder="Update Unit Cost..."
                                              disabled={isLocked}
                                              value={p.finalUnitCost === "-" || parseFloat(p.finalUnitCost) === parseFloat(p.unitCost) ? "" : p.finalUnitCost}
                                              onChange={e => {
                                                const val = e.target.value;
                                                if (val === "" || val === "-" || /^\d*\.?\d*$/.test(val)) {
                                                  updateCell(rIdx, pIdx, "finalUnitCost", val || "-");
                                                }
                                              }}
                                              className={cn(
                                                "h-12 pl-10 pr-12 rounded-2xl font-black text-sm transition-all",
                                                isLocked 
                                                  ? "bg-zinc-50 border-zinc-200 text-zinc-500" 
                                                  : (p.finalUnitCost !== "-" && parseFloat(p.finalUnitCost) !== parseFloat(p.unitCost))
                                                    ? "bg-blue-50 border-blue-200 ring-2 ring-blue-500/10 focus-visible:ring-blue-500"
                                                    : "bg-white border-zinc-200 hover:border-zinc-300 focus-visible:ring-zinc-900"
                                              )}
                                            />
                                            {/* Reset to PD button */}
                                            {!isLocked && p.finalUnitCost !== "-" && parseFloat(p.finalUnitCost) !== parseFloat(p.unitCost) && (
                                              <button
                                                onClick={() => updateCell(rIdx, pIdx, "finalUnitCost", p.unitCost)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white border border-blue-100 text-blue-500 hover:bg-blue-50 transition-colors shadow-sm"
                                                title="Reset to PD original"
                                              >
                                                <RotateCcw size={12} />
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {/* 3. Subtotal Display */}
                                        <div className="space-y-3 lg:col-span-2">
                                          <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600">
                                              <BadgeDollarSign size={12} />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Final Subtotal (PHP)</p>
                                          </div>
                                          
                                          <div className="h-12 flex items-center justify-between px-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl relative overflow-hidden group">
                                            {/* Analysis indicator */}
                                            {(() => {
                                              const pdVal = parseFloat(p.unitCost) || 0;
                                              const finalVal = (p.finalUnitCost === "-" || p.finalUnitCost === "") ? pdVal : parseFloat(p.finalUnitCost) || 0;
                                              const diff = finalVal - pdVal;
                                              const pct = pdVal > 0 ? (diff / pdVal) * 100 : 0;
                                              
                                              if (Math.abs(diff) < 0.01) return (
                                                <div className="flex items-center gap-1.5">
                                                  <p className="text-base font-black text-emerald-700">{formatPHP(p.finalSubtotal)}</p>
                                                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 bg-white px-1.5 py-0.5 rounded border border-zinc-100">Default (PD)</span>
                                                </div>
                                              );

                                              return (
                                                <div className="flex flex-col">
                                                  <p className="text-base font-black text-emerald-700">{formatPHP(p.finalSubtotal)}</p>
                                                  <div className={cn(
                                                    "flex items-center gap-1 text-[8px] font-black uppercase tracking-widest",
                                                    diff > 0 ? "text-rose-500" : "text-emerald-600"
                                                  )}>
                                                    {diff > 0 ? <ChevronUp size={8} /> : <ChevronDown size={8} />}
                                                    {Math.abs(pct).toFixed(1)}% {diff > 0 ? "increase" : "savings"}
                                                  </div>
                                                </div>
                                              );
                                            })()}
                                            
                                            <div className="text-right">
                                              <p className="text-[7px] font-black uppercase tracking-[0.2em] text-zinc-300 mb-0.5">Original PD Subtotal</p>
                                              <p className="text-[10px] font-black text-zinc-400 line-through decoration-zinc-300">{formatPHP(p.subtotal)}</p>
                                            </div>
                                          </div>
                                        </div>

                                      </div>

                                      <div className="grid grid-cols-2 gap-4">
                                        <InfoChip icon={Factory} label="Factory Address" value={p.factory} />
                                        <InfoChip icon={Anchor} label="Port of Discharge" value={p.port} />
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
                                              {isLowMargin && (
                                                <span className="text-[8px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md animate-pulse ml-1">
                                                  ⚠ BELOW LANDED
                                                </span>
                                              )}
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
                                              type="text"
                                              inputMode="decimal"
                                              placeholder="e.g. 12500"
                                              value={p.sellingCost === "-" ? "" : p.sellingCost}
                                              onChange={e => {
                                                const val = e.target.value;
                                                if (val === "" || val === "-" || /^\d*\.?\d*$/.test(val)) {
                                                  updateCell(rIdx, pIdx, "sellingCost", val || "-");
                                                }
                                              }}
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

                                      {/* ── REMARKS FIELDS ── */}
                                      <div className="mt-4 pt-4 border-t border-zinc-100 space-y-4">
                                        {/* Commercial Type - Read Only */}
                                        <div className="space-y-1.5">
                                          <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                            <Building2 size={9} />
                                            Commercial Type
                                          </label>
                                          <div className="h-10 px-3 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center">
                                            <p className="text-[11px] font-bold text-zinc-700">
                                              {p.commercialType || "-"}
                                            </p>
                                          </div>
                                        </div>

                                        {/* SPF Remarks PD - Read Only */}
                                        <div className="space-y-1.5">
                                          <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                            <MessageSquare size={9} />
                                            SPF Remarks (PD)
                                          </label>
                                          <div className="min-h-15 px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50">
                                            <p className="text-[11px] font-medium text-zinc-700 leading-relaxed whitespace-pre-wrap">
                                              {p.spfRemarksPd || "-"}
                                            </p>
                                          </div>
                                        </div>

                                        {/* SPF Remarks Procurement - Editable */}
                                        <div className="space-y-1.5">
                                          <label className={cn(
                                            "flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest",
                                            isLocked ? "text-zinc-400" : "text-blue-600"
                                          )}>
                                            <MessageSquare size={9} />
                                            SPF Remarks (Procurement)
                                            {isLocked && <Lock size={8} className="text-zinc-300" />}
                                          </label>
                                          {isLocked ? (
                                            <div className="min-h-15 px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50">
                                              <p className="text-[11px] font-medium text-zinc-700 leading-relaxed whitespace-pre-wrap">
                                                {p.spfRemarksProcurement || "-"}
                                              </p>
                                            </div>
                                          ) : (
                                            <textarea
                                              value={p.spfRemarksProcurement}
                                              onChange={e => updateCell(rIdx, pIdx, "spfRemarksProcurement", e.target.value)}
                                              placeholder="Enter procurement remarks..."
                                              className="w-full min-h-20 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-[11px] font-medium text-zinc-700 leading-relaxed resize-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 outline-none transition-all"
                                            />
                                          )}
                                        </div>
                                      </div>

                                      {/* ── CALCULATOR PANEL ── */}
                                      {!isLocked && showCalc[calcKey] && (
                                        <div className="mt-3 p-4 md:p-6 rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50/40 via-white to-white shadow-sm ring-1 ring-blue-50/50">
                                          <div className="flex items-center justify-between mb-5">
                                            <div className="flex items-center gap-2.5">
                                              <div className="p-2 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-200">
                                                <Calculator size={14} />
                                              </div>
                                              <div>
                                                <p className="text-[11px] font-black uppercase tracking-widest text-zinc-900">Landed Cost & SRP Calculator</p>
                                                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter">Precision pricing engine</p>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => {
                                                const defaultCalc = {
                                                  formulaType: currentCalc.formulaType,
                                                  l: p.l_db || "", w: p.w_db || "", h: p.h_db || "", qtyPerBox: p.pcs_carton_db || "",
                                                  lpc_pcsPerContainer: "",
                                                  ll_srpVatInc: "",
                                                  llp_srpVatInc: "",
                                                  ...globalSettings
                                                };
                                                setCalcStates(prev => ({ ...prev, [calcKey]: defaultCalc }));
                                                toast.success("Calculator reset to global defaults");
                                              }}
                                              className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors mr-1"
                                              title="Reset to Global Defaults"
                                            >
                                              <RotateCcw size={14} />
                                            </button>
                                            <button
                                              onClick={() => toggleCalc(calcKey)}
                                              className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors"
                                            >
                                              <XCircle size={14} />
                                            </button>
                                          </div>

                                          {/* ── FORMULA TYPE SELECTOR ── */}
                                          <div className="mb-5 overflow-x-auto no-scrollbar -mx-1 px-1">
                                            <div className="flex sm:grid sm:grid-cols-5 gap-2 min-w-max sm:min-w-0">
                                              {[
                                                { key: "spf_china", label: "China", icon: Box },
                                                { key: "lamp_post_china", label: "Lamp Post", icon: Truck },
                                                { key: "spf_non_china", label: "Non-China", icon: Globe },
                                                { key: "local_lighting", label: "Local Light", icon: Zap },
                                                { key: "local_lamp_post", label: "Local LP", icon: MapPin },
                                              ].map(ft => (
                                                <button
                                                  key={ft.key}
                                                  type="button"
                                                  onClick={() => updateCalc(calcKey, "formulaType", ft.key)}
                                                  className={cn(
                                                    "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all gap-1.5 flex-shrink-0 w-[85px] sm:w-auto",
                                                    currentCalc.formulaType === ft.key
                                                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100 -translate-y-0.5"
                                                      : "bg-white border-zinc-100 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"
                                                  )}
                                                >
                                                  <ft.icon size={14} className={currentCalc.formulaType === ft.key ? "text-blue-100" : "text-zinc-400"} />
                                                  <p className="text-[9px] font-black uppercase tracking-tight leading-none">{ft.label}</p>
                                                </button>
                                              ))}
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                                            {/* Inputs Section */}
                                            <div className="lg:col-span-3 space-y-4">
                                              {/* ── SPF CHINA INPUTS ── */}
                                              {currentCalc.formulaType === "spf_china" && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                                  <div className="bg-white/50 p-4 rounded-2xl border border-zinc-100/80">
                                                    <div className="flex items-center gap-2 mb-3">
                                                      <Layers size={10} className="text-zinc-400" />
                                                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Dimensions</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                      <CalcInput label="L (cm)" value={currentCalc.l} onChange={(e: any) => updateCalc(calcKey, 'l', e.target.value)} icon={ArrowRight} />
                                                      <CalcInput label="W (cm)" value={currentCalc.w} onChange={(e: any) => updateCalc(calcKey, 'w', e.target.value)} icon={ArrowUpDown} />
                                                      <CalcInput label="H (cm)" value={currentCalc.h} onChange={(e: any) => updateCalc(calcKey, 'h', e.target.value)} icon={ArrowUp} />
                                                      <CalcInput label="Pcs/Box" value={currentCalc.qtyPerBox} onChange={(e: any) => updateCalc(calcKey, 'qtyPerBox', e.target.value)} icon={Box} />
                                                    </div>
                                                  </div>
                                                  <div className="bg-white/50 p-4 rounded-2xl border border-zinc-100/80">
                                                    <div className="flex items-center gap-2 mb-3">
                                                      <TrendingUp size={10} className="text-zinc-400" />
                                                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Logistics & Rates</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                      <CalcInput label="Shipment (₱)" value={currentCalc.shipmentCost} onChange={(e: any) => updateCalc(calcKey, 'shipmentCost', e.target.value)} icon={Truck} isOverridden={currentCalc.shipmentCost !== globalSettings.shipmentCost} />
                                                      <CalcInput label="CBM/Cont." value={currentCalc.cbmContainer} onChange={(e: any) => updateCalc(calcKey, 'cbmContainer', e.target.value)} icon={Layers} isOverridden={currentCalc.cbmContainer !== globalSettings.cbmContainer} />
                                                      <CalcInput label="Invoice %" value={currentCalc.invoicePct} onChange={(e: any) => updateCalc(calcKey, 'invoicePct', e.target.value)} icon={FileText} isOverridden={currentCalc.invoicePct !== globalSettings.invoicePct} />
                                                      <CalcInput label="Exch. Rate" value={currentCalc.exchangeRate} onChange={(e: any) => updateCalc(calcKey, 'exchangeRate', e.target.value)} icon={DollarSign} isOverridden={currentCalc.exchangeRate !== globalSettings.exchangeRate} />
                                                      <CalcInput label="Target GP" value={currentCalc.gp} onChange={(e: any) => updateCalc(calcKey, 'gp', e.target.value)} icon={TrendingUp} isOverridden={currentCalc.gp !== globalSettings.gp} suffix="%" />
                                                    </div>
                                                  </div>
                                                </div>
                                              )}

                                              {/* ── LAMP POST CHINA INPUTS ── */}
                                              {currentCalc.formulaType === "lamp_post_china" && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                                  <div className="bg-white/50 p-4 rounded-2xl border border-zinc-100/80">
                                                    <div className="flex items-center gap-2 mb-3">
                                                      <Truck size={10} className="text-zinc-400" />
                                                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Container Details</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                      <CalcInput label="Cont. Cost (₱)" value={currentCalc.lpc_containerCost} onChange={(e: any) => updateCalc(calcKey, 'lpc_containerCost', e.target.value)} icon={BadgeDollarSign} isOverridden={currentCalc.lpc_containerCost !== globalSettings.lpc_containerCost} />
                                                      <CalcInput label="Pcs / Cont." value={currentCalc.lpc_pcsPerContainer} onChange={(e: any) => updateCalc(calcKey, 'lpc_pcsPerContainer', e.target.value)} icon={Box} />
                                                      <CalcInput label="Invoice %" value={currentCalc.lpc_invoicePct} onChange={(e: any) => updateCalc(calcKey, 'lpc_invoicePct', e.target.value)} icon={FileText} isOverridden={currentCalc.lpc_invoicePct !== globalSettings.lpc_invoicePct} />
                                                      <CalcInput label="Exch. Rate" value={currentCalc.lpc_exchangeRate} onChange={(e: any) => updateCalc(calcKey, 'lpc_exchangeRate', e.target.value)} icon={DollarSign} isOverridden={currentCalc.lpc_exchangeRate !== globalSettings.exchangeRate} />
                                                      <CalcInput label="Target GP" value={currentCalc.lpc_gp} onChange={(e: any) => updateCalc(calcKey, 'lpc_gp', e.target.value)} icon={TrendingUp} isOverridden={currentCalc.lpc_gp !== globalSettings.lpc_gp} suffix="%" />
                                                    </div>
                                                  </div>
                                                </div>
                                              )}

                                              {/* ── SPF NON-CHINA INPUTS ── */}
                                              {currentCalc.formulaType === "spf_non_china" && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                                  <div className="bg-white/50 p-4 rounded-2xl border border-zinc-100/80">
                                                    <div className="flex items-center gap-2 mb-3">
                                                      <Globe size={10} className="text-zinc-400" />
                                                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Multiplier & Rates</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                      <CalcInput label="Multiplier" value={currentCalc.nc_multiplier} onChange={(e: any) => updateCalc(calcKey, 'nc_multiplier', e.target.value)} icon={RefreshCw} isOverridden={currentCalc.nc_multiplier !== globalSettings.nc_multiplier} />
                                                      <CalcInput label="Exch. Rate" value={currentCalc.nc_exchangeRate} onChange={(e: any) => updateCalc(calcKey, 'nc_exchangeRate', e.target.value)} icon={DollarSign} isOverridden={currentCalc.nc_exchangeRate !== globalSettings.exchangeRate} />
                                                      <CalcInput label="Target GP" value={currentCalc.nc_gp} onChange={(e: any) => updateCalc(calcKey, 'nc_gp', e.target.value)} icon={TrendingUp} isOverridden={currentCalc.nc_gp !== globalSettings.nc_gp} suffix="%" />
                                                    </div>
                                                  </div>
                                                </div>
                                              )}

                                              {/* ── LOCAL LIGHTING INPUTS ── */}
                                              {currentCalc.formulaType === "local_lighting" && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                                  <div className="bg-white/50 p-4 rounded-2xl border border-zinc-100/80">
                                                    <div className="flex items-center gap-2 mb-3">
                                                      <Zap size={10} className="text-zinc-400" />
                                                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Local Details</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                      <CalcInput label="Supplier SRP (VAT-Inc)" value={currentCalc.ll_srpVatInc} onChange={(e: any) => updateCalc(calcKey, 'll_srpVatInc', e.target.value)} icon={Receipt} />
                                                      <CalcInput label="Multiplier" value={currentCalc.ll_multiplier} onChange={(e: any) => updateCalc(calcKey, 'll_multiplier', e.target.value)} icon={RefreshCw} isOverridden={currentCalc.ll_multiplier !== globalSettings.ll_multiplier} />
                                                    </div>
                                                  </div>
                                                </div>
                                              )}

                                              {/* ── LOCAL LAMP POST INPUTS ── */}
                                              {currentCalc.formulaType === "local_lamp_post" && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                                  <div className="bg-white/50 p-4 rounded-2xl border border-zinc-100/80">
                                                    <div className="flex items-center gap-2 mb-3">
                                                      <MapPin size={10} className="text-zinc-400" />
                                                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Local LP Details</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                      <CalcInput label="Supplier SRP (VAT-Inc)" value={currentCalc.llp_srpVatInc} onChange={(e: any) => updateCalc(calcKey, 'llp_srpVatInc', e.target.value)} icon={Receipt} />
                                                      <CalcInput label="Delivery Fee (₱)" value={currentCalc.llp_deliveryFee} onChange={(e: any) => updateCalc(calcKey, 'llp_deliveryFee', e.target.value)} icon={Truck} isOverridden={currentCalc.llp_deliveryFee !== globalSettings.llp_deliveryFee} />
                                                      <CalcInput label="Multiplier" value={currentCalc.llp_multiplier} onChange={(e: any) => updateCalc(calcKey, 'llp_multiplier', e.target.value)} icon={RefreshCw} isOverridden={currentCalc.llp_multiplier !== globalSettings.llp_multiplier} />
                                                    </div>
                                                  </div>
                                                </div>
                                              )}
                                              {/* ── NEGOTIATION HELPER (NEW) ── */}
                                              <div className="bg-blue-600 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden mt-4">
                                                <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none rotate-12">
                                                  <TrendingUp size={80} />
                                                </div>
                                                <div className="relative z-10 space-y-4">
                                                  <div className="flex items-center gap-2.5">
                                                    <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-md">
                                                      <Activity size={14} className="text-white" />
                                                    </div>
                                                    <div>
                                                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Negotiation Helper</p>
                                                      <p className="text-[7px] font-bold text-blue-200 uppercase tracking-tighter">Reverse Calculator for Target SRP</p>
                                                    </div>
                                                  </div>
                                                  <div className="space-y-2">
                                                    <p className="text-[8px] font-black text-blue-100 uppercase tracking-widest">If Target Selling Price is:</p>
                                                    <div className="relative group">
                                                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none z-10">
                                                        <span className="text-sm font-black text-white/40">₱</span>
                                                      </div>
                                                      <Input
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder="Enter target SRP..."
                                                        className="h-12 pl-8 rounded-2xl bg-white/10 border-white/20 text-white placeholder:text-white/30 font-black text-sm focus-visible:ring-white/40 focus-visible:bg-white/20 transition-all shadow-inner"
                                                        onChange={(e) => {
                                                          const val = e.target.value;
                                                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                                            const maxCost = calculateMaxUnitCost(val, currentCalc);
                                                            const display = document.getElementById(`max-cost-${calcKey}`);
                                                            if (display) display.innerText = `$${maxCost.toFixed(2)}`;
                                                          }
                                                        }}
                                                      />
                                                    </div>
                                                  </div>
                                                  <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                                                    <div className="space-y-0.5">
                                                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-200">Maximum Allowed Unit Cost</p>
                                                      <p className="text-[7px] font-bold text-blue-300 italic opacity-60">* To maintain {currentCalc.gp || currentCalc.lpc_gp || currentCalc.nc_gp}% margin</p>
                                                    </div>
                                                    <p id={`max-cost-${calcKey}`} className="text-2xl font-black text-white tracking-tighter drop-shadow-sm">$0.00</p>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Results / Breakdown Section */}
                                            <div className="lg:col-span-2 space-y-4">
                                              <div className="bg-zinc-900 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden h-full flex flex-col">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                                                
                                                <div className="flex items-center justify-between mb-6">
                                                  <div className="flex items-center gap-2">
                                                    <BarChart2 size={12} className="text-blue-400" />
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Analysis Breakdown</p>
                                                  </div>
                                                  <button
                                                    onClick={() => {
                                                      const text = `
Analysis for ${p.supplierBrand}
---
Base Cost: ${formatPHP(calcResult.breakdown?.baseCostPHP || 0)}
Logistics: ${formatPHP(calcResult.breakdown?.shippingPerItem || 0)}
Invoice Fee: ${formatPHP(calcResult.breakdown?.invoiceFee || 0)}
Landed Cost: ${formatPHP(calcResult.landed)}
Recommended SRP: ${formatPHP(calcResult.srp)}
                                                      `.trim();
                                                      navigator.clipboard.writeText(text);
                                                      toast.success("Analysis copied to clipboard");
                                                    }}
                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                                                    title="Copy breakdown to clipboard"
                                                  >
                                                    <Copy size={12} />
                                                  </button>
                                                </div>

                                                <div className="space-y-3 flex-1">
                                                  {calcResult.breakdown ? (
                                                    <>
                                                      {/* Sensitivity Analysis (New Advanced Feature) */}
                                                      <div className="mb-4 p-3 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                          <div className="flex items-center gap-1.5">
                                                            <Activity size={10} className="text-blue-400" />
                                                            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Risk Sensitivity (Rate ±1)</p>
                                                          </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                          <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-rose-500/5 border border-rose-500/10">
                                                            <p className="text-[7px] font-black text-rose-400/60 uppercase tracking-tighter">If Rate +1 (₱{ (parseFloat(currentCalc.exchangeRate || "0") + 1).toFixed(1) })</p>
                                                            <p className="text-[11px] font-black text-rose-400">
                                                              {formatPHP(calculateSRP(p.unitCost, { ...currentCalc, exchangeRate: (parseFloat(currentCalc.exchangeRate || "0") + 1).toString() }).srp)}
                                                            </p>
                                                          </div>
                                                          <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                                            <p className="text-[7px] font-black text-emerald-400/60 uppercase tracking-tighter">If Rate -1 (₱{ (parseFloat(currentCalc.exchangeRate || "0") - 1).toFixed(1) })</p>
                                                            <p className="text-[11px] font-black text-emerald-400">
                                                              {formatPHP(calculateSRP(p.unitCost, { ...currentCalc, exchangeRate: (parseFloat(currentCalc.exchangeRate || "0") - 1).toString() }).srp)}
                                                            </p>
                                                          </div>
                                                        </div>
                                                      </div>

                                                      {(calcResult.breakdown.baseCostPHP ?? 0) > 0 && (
                                                        <CostRow label="Base Product Cost" value={formatPHP(calcResult.breakdown.baseCostPHP)} icon={Package} />
                                                      )}
                                                      {(calcResult.breakdown.shippingPerItem ?? 0) > 0 && (
                                                        <CostRow label="Allocated Shipping" value={formatPHP(calcResult.breakdown.shippingPerItem)} icon={Truck} />
                                                      )}
                                                      {(calcResult.breakdown.invoiceFee ?? 0) > 0 && (
                                                        <CostRow label="Invoice Fees" value={formatPHP(calcResult.breakdown.invoiceFee)} icon={FileText} />
                                                      )}
                                                      {(calcResult.breakdown.multiplierEffect ?? 0) > 0 && (
                                                        <CostRow label="Multiplier Adjustment" value={formatPHP(calcResult.breakdown.multiplierEffect)} icon={RefreshCw} />
                                                      )}
                                                      {(calcResult.breakdown.deliveryFee ?? 0) > 0 && (
                                                        <CostRow label="Delivery Fee" value={formatPHP(calcResult.breakdown.deliveryFee)} icon={MapPin} />
                                                      )}
                                                      
                                                      <div className="pt-4 mt-4 border-t border-white/10">
                                                        {calcResult.landed > 0 && (
                                                          <div className="flex items-center justify-between mb-4 bg-white/5 p-3 rounded-2xl">
                                                            <div className="flex items-center gap-2">
                                                              <ShieldCheck size={12} className="text-emerald-400" />
                                                              <p className="text-[9px] font-black uppercase text-zinc-400">Total Landed</p>
                                                            </div>
                                                            <p className="text-sm font-black text-white">{formatPHP(calcResult.landed)}</p>
                                                          </div>
                                                        )}
                                                        
                                                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                                                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1">Recommended SRP</p>
                                                          <p className="text-2xl font-black text-emerald-400">{formatPHP(calcResult.srp)}</p>
                                                          {(calcResult.breakdown.margin ?? 0) > 0 && (
                                                            <p className="text-[8px] font-bold text-emerald-500/60 mt-1 uppercase tracking-widest">
                                                              Estimated Margin: {formatPHP(calcResult.breakdown.margin)}{" "}
                                                              <span className="text-emerald-400/80">
                                                                ({(calcResult.breakdown.gpActual ?? 0).toFixed(1)}% GP)
                                                              </span>
                                                            </p>
                                                          )}
                                                          {(() => {
                                                            const gpEntered = parseFloat(
                                                              currentCalc.gp || currentCalc.lpc_gp || currentCalc.nc_gp || "0"
                                                            );
                                                            if (gpEntered > 95) return (
                                                              <p className="text-[8px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2 py-1 mt-2 uppercase tracking-widest">
                                                                ⚠ GP capped at 95% — entered {gpEntered}% is too high
                                                              </p>
                                                            );
                                                            return null;
                                                          })()}
                                                        </div>
                                                      </div>
                                                    </>
                                                  ) : (
                                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-10">
                                                      <AlertTriangle size={24} className="mb-2 text-zinc-500" />
                                                      <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Waiting for complete<br/>input parameters</p>
                                                    </div>
                                                  )}
                                                </div>

                                                  <Button
                                                    type="button"
                                                    onClick={() => {
                                                      if (calcResult.srp > 0) {
                                                        updateCell(rIdx, pIdx, "sellingCost", calcResult.srp.toFixed(2).toString());
                                                        toggleCalc(calcKey);
                                                        toast.success(`₱${calcResult.srp.toLocaleString()} applied to Selling Cost ✓`);
                                                      } else {
                                                        toast.error("Please fill in all required fields first.");
                                                      }
                                                    }}
                                                    disabled={!(calcResult.srp > 0)}
                                                    className={cn(
                                                      "w-full h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest mt-6 transition-all",
                                                      calcResult.srp > 0 
                                                        ? "bg-white text-zinc-900 hover:bg-emerald-500 hover:text-white hover:scale-[1.02] shadow-lg" 
                                                        : "bg-white/5 text-white/20 border border-white/10"
                                                    )}
                                                  >
                                                    {calcResult.srp > 0 ? (
                                                      <div className="flex items-center gap-2">
                                                        <CheckCircle2 size={14} className="text-emerald-500 group-hover:text-white" />
                                                        Apply ₱{calcResult.srp.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                      </div>
                                                    ) : (
                                                      "Fill details to apply"
                                                    )}
                                                  </Button>
                                              </div>
                                            </div>
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
                        <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">PD Original Total</p>
                        <p className="text-[10px] font-bold text-zinc-400 line-through">{formatPHP(grandTotalPD)}</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">PD Final Total</p>
                        <p className="text-[12px] font-black text-blue-300">{formatPHP(grandTotalFinalPD)}</p>
                      </div>
                      <div className="h-px bg-white/10" />
                      <div className="flex justify-between items-center">
                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Selling Total</p>
                        <p className={cn("text-[14px] font-black", grandTotalSelling > 0 ? "text-emerald-300" : "text-zinc-500")}>
                          {grandTotalSelling > 0 ? formatPHP(grandTotalSelling) : "—"}
                        </p>
                      </div>
                      {grandTotalSelling > 0 && grandTotalFinalPD > 0 && (
                        <>
                          <div className="h-px bg-white/10" />
                          <div className="flex justify-between items-center">
                            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Margin (Final PD)</p>
                            <p className="text-[11px] font-black text-violet-300">
                              {(((grandTotalSelling - grandTotalFinalPD) / grandTotalSelling) * 100).toFixed(1)}%
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

                  {/* Collaboration Hub - Only show when SPF number is available */}
                  {spfData?.spf_number && (
                    <div className="bg-white rounded-[24px] border border-zinc-200/60 shadow-sm overflow-hidden">
                      <CollaborationHub
                        requestId={id}
                        spfNumber={spfData.spf_number}
                        collectionName="spf_creations"
                        messages={chatData?.messages || []}
                        currentUserId={userContext.id}
                        userName={userContext.name}
                        profilePicture={userContext.profilePicture}
                        userRole={userContext.role}
                        status={spfData?.status || "PENDING"}
                        title={spfData.spf_number}
                        userDepartment={userDept}
                      />
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ── MOBILE SUMMARY ── */}
            <div className="lg:hidden bg-white rounded-[24px] border border-zinc-200/60 shadow-sm p-4 space-y-3">
              <SectionHeader icon={BadgeDollarSign} title="Summary" />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-zinc-50 rounded-2xl p-3 border border-zinc-100">
                  <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">PD Original</p>
                  <p className="text-[11px] font-bold text-zinc-400 line-through leading-none">{formatPHP(grandTotalPD)}</p>
                  <div className="h-px bg-zinc-200 my-1.5" />
                  <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">PD Final</p>
                  <p className="text-[13px] font-black text-blue-700 leading-none">{formatPHP(grandTotalFinalPD)}</p>
                </div>
                <div className={cn("rounded-2xl p-3 border flex flex-col justify-center", isApproved ? "bg-emerald-50 border-emerald-100" : "bg-zinc-50 border-zinc-100")}>
                  <p className={cn("text-[8px] font-black uppercase tracking-widest mb-1", isApproved ? "text-emerald-600" : "text-zinc-400")}>
                    Selling Total
                  </p>
                  <p className={cn("text-[13px] font-black", isApproved ? "text-emerald-700" : "text-zinc-700")}>
                    {grandTotalSelling > 0 ? formatPHP(grandTotalSelling) : "—"}
                  </p>
                </div>
                {grandTotalSelling > 0 && grandTotalFinalPD > 0 && (
                  <div className="col-span-2 bg-violet-50 rounded-2xl p-3 border border-violet-100">
                    <p className="text-[8px] font-black text-violet-600 uppercase tracking-widest mb-1">Margin (Final PD)</p>
                    <p className="text-[13px] font-black text-violet-700">
                      {(((grandTotalSelling - grandTotalFinalPD) / grandTotalSelling) * 100).toFixed(1)}%
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

              {/* Mobile Collaboration Hub - Only show when SPF number is available */}
              {spfData?.spf_number && (
                <div className="mt-4 pt-4 border-t border-zinc-100">
                  <CollaborationHub
                    requestId={id}
                    spfNumber={spfData.spf_number}
                    collectionName="spf_creations"
                    messages={chatData?.messages || []}
                    currentUserId={userContext.id}
                    userName={userContext.name}
                    profilePicture={userContext.profilePicture}
                    userRole={userContext.role}
                    status={spfData?.status || "PENDING"}
                    title={spfData.spf_number}
                    userDepartment={userDept}
                  />
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

    </ProtectedPageWrapper>
  );
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */
function TechAssetLink({ icon: Icon, label, url, disabled }: { icon: any; label: string; url: string; disabled?: boolean }) {
  if (disabled) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-zinc-100 bg-zinc-50 text-zinc-400 text-[9px] font-black uppercase tracking-tighter cursor-not-allowed opacity-60">
        <Icon size={10} />
        {label}
        <Lock size={8} className="opacity-50" />
      </div>
    );
  }
  const cleanUrl = url.replace(/`| /g, "");
  return (
    <a
      href={cleanUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-blue-100 bg-blue-50/30 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all text-[9px] font-black uppercase tracking-tighter"
    >
      <Icon size={10} />
      {label}
      <ExternalLink size={8} className="opacity-50" />
    </a>
  );
}

function CostRow({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-2">
        <Icon size={10} className="text-zinc-600 group-hover:text-blue-400 transition-colors" />
        <p className="text-[9px] font-black uppercase text-zinc-500">{label}</p>
      </div>
      <p className="text-[10px] font-mono font-bold text-zinc-300">{value}</p>
    </div>
  );
}

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

function CalcInput({ label, value, onChange, placeholder = "", icon: Icon, isOverridden, suffix }: { label: string; value: any; onChange: (e: any) => void; placeholder?: string; icon?: any; isOverridden?: boolean; suffix?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon size={9} className={cn(isOverridden ? "text-blue-500" : "text-zinc-400")} />}
          <label className={cn("text-[8px] font-black uppercase tracking-widest", isOverridden ? "text-blue-600" : "text-zinc-400")}>{label}</label>
        </div>
        {isOverridden && (
          <span className="text-[7px] font-black text-blue-500 bg-blue-50 px-1 rounded uppercase">Custom</span>
        )}
      </div>
      <div className="relative group">
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "" || /^\d*\.?\d*$/.test(val)) {
              onChange(e);
            }
          }}
          placeholder={placeholder}
          className={cn(
            "h-9 text-[11px] font-bold rounded-xl border-zinc-200 transition-all pl-3",
            suffix ? "pr-7" : "pr-3",
            isOverridden ? "bg-blue-50/50 border-blue-200 ring-1 ring-blue-500/10" : "bg-zinc-50/50",
            "focus-visible:ring-blue-500 focus-visible:bg-white"
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-400 pointer-events-none">{suffix}</span>
        )}
        {value && value !== "0" && !suffix && (
          <div className={cn("absolute right-2 top-1/2 -translate-y-1/2 size-1.5 rounded-full", isOverridden ? "bg-blue-500" : "bg-blue-400/20")} />
        )}
      </div>
    </div>
  );
}
