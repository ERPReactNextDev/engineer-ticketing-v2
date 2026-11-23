"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { FileText, Send, RotateCcw, Loader2, Lock, Plus, Minus, Trash2, ChevronDown, ChevronRight, ChevronLeft, ChevronUp, Upload, Calculator, Info, Image as ImageIcon } from "lucide-react";
import { createPortal } from "react-dom";

import { toast } from "sonner";
import { getJobRequestById, type JobRequestRow } from "@/lib/job-request-supabase";
import { parseBoqGrid, parseTsv, readBoqFile, type ImportedSection, convertToBoqSections } from "./boq-import";
import {
  CustomPricingCalculator,
  computeCustomMaterial,
  describeCustomFormula,
  customMethodLabel,
  customMethodOf,
  CUSTOM_KEYS,
  type CustomPricingFields,
  type CustomPricingRow,
} from "./custom-pricing-calculator";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* ─────────────────────────────────────────────
   FIELD CONFIG (text only) — edit/add fields here
   span: how many of the 3 columns the field takes (desktop)
───────────────────────────────────────────── */
type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  span?: 1 | 2 | 3;
};

const SPAN_CLASS: Record<number, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
};

const FIELDS: FieldDef[] = [
  { key: "jrNumber", label: "JR Number", placeholder: "e.g. JR2026-0042", required: true, span: 1 },
  { key: "dateRequested", label: "Date Requested", placeholder: "e.g. October 14, 2026", span: 1 },
  { key: "agentName", label: "Agent Number", placeholder: "Agent number", span: 1 },
  { key: "projectTitle", label: "Project Title", placeholder: "Project title", required: true, span: 1 },
  { key: "projectName", label: "Project / Site name", placeholder: "Project / site name", span: 1 },
  { key: "clientName", label: "Client Name", placeholder: "Client name", span: 1 },
  { key: "address", label: "Address", placeholder: "Site address", required: true, span: 3 },
  { key: "scopeOfWork", label: "Detailed Scope of Work", placeholder: "Describe the work...", multiline: true, required: true, span: 3 },
  { key: "totalWorkingDays", label: "Number of Days", placeholder: "e.g. 4", span: 1 },
];

const EMPTY_DATA: Record<string, string> = Object.fromEntries(FIELDS.map((f) => [f.key, ""]));

export type JobFillUpFormValues = Record<string, string>;

/* ─────────────────────────────────────────────
   BILL OF QUANTITIES

   FORMULAS (same as the Excel sheet), per row:
     Total Material Cost = Quantity × Material Cost
     Total Labor Cost    = Quantity × Labor Cost
     Total Consumable    = Quantity × Consumable Cost
     Total Amount        = Total Material + Total Labor + Total Consumable

   Per section (SUBTOTAL AMOUNT): SUM of each "Total" column.

   Project summary:
     MATERIAL COST       = Σ section Total Material
     LABOR COST          = Σ section Total Labor
     CONSUMABLES         = Σ section Total Consumable
     DIRECT COST         = Material + Labor + Consumables
     CONTINGENCY         = Direct Cost × contingency %   (default 7%)
     TOTAL PROJECT COST  = Direct Cost + Contingency
     COST PER ITEM       = Total Project Cost ÷ No. of units

   The 4 "Total" cells are computed automatically and are read-only.
───────────────────────────────────────────── */
export type TotalKey = "totalMaterialCost" | "totalLaborCost" | "totalConsumable" | "totalAmount";
export type InputKey = "description" | "qty" | "unit" | "materialCost" | "laborCost" | "consumableCost" | "toolType" | "toolUsage" | "toolDepYears" | "toolDepFactor"| "rentalFee";

export type BoqRow = CustomPricingFields & {
  id: string;
  description: string;
  qty: string;
  unit: string;
  materialCost: string;
  laborCost: string;
  consumableCost: string;
  /** TOOLS section only: "general" | "power" | "hand" | "safety" */
  toolType?: string;
  /** Hand tools: how many usage */
  toolUsage?: string;
  /** Power tools: depreciation years */
  toolDepYears?: string;
  /** Power tools: divisor used with depreciation years (blank = 100) */
  toolDepFactor?: string;
  /** Final values — filled in on submit only */
  rentalFee?: string;
  totalMaterialCost?: string;
  totalLaborCost?: string;
  totalConsumable?: string;
  totalAmount?: string;
};

export type BoqSection = {
  id: string;
  title: string;
  /** true = title was picked from the standard dropdown (read-only) */
  titleLocked?: boolean;
  rows: BoqRow[];
};


export type BoqSummary = {
  materialCost: number;
  laborCost: number;
  consumables: number;
  directCost: number;
  contingencyPct: number;
  contingency: number;
  totalProjectCost: number;
  unitCount: number;
  costPerItem: number;
};

export type BoqVersion = {
  boqSections: BoqSection[];
  summary: BoqSummary;
  procurement?: ProcurementData;
};

export type ProcurementRow = {
  qty: string;
  cost: string;
  useEngineeringTotal?: boolean;
  /** HEAVY EQUIPMENT RENTAL only: flat mob/demob amount (blank = 0) */
  mobDemob?: string;
} & CustomPricingFields;
export type ProcurementSummary = {
  total: number;
  warrantyPct: number;
  warranty: number;
  contingencyPct: number;
  contingency: number;
  directCost: number;
  vat: number;
  markup: number;
  withMarkup: number;
  say: number;
  variance: number;
};
export type ProcurementData = {
  rows: Record<string, ProcurementRow>;
  warrantyPct: string;
  contingencyPct: string;
  markup: string;
  sayRoundTo?: string;
  summary: ProcurementSummary;
  /** Custom pricing of the procurement SUBTOTAL, keyed by section id */
  sectionCustom?: Record<string, CustomPricingFields>;
  /** Multiplier of the procurement SUBTOTAL, keyed by section id (blank = ×1) */
  sectionMultiplier?: Record<string, string>;
  savedBy?: string;
  savedAt?: any;
};

export type PdDatabaseFormItem = {
  productId: string;
  productName: string;
  itemCode: string;
  imageUrl: string;
  quantity: number;
  description: string;
};

/**
 * A saved fill-up form (stored in the "boq_draft" table, keyed by job request id).
 * status: "draft" while waiting for engineering to finish, "completed" once it was copied
 * into the job_requests document.
 */
export type FillUpDraft = {
  values: JobFillUpFormValues;
  boqSections: BoqSection[];
  summary: BoqSummary;
  boqs?: BoqVersion[];
  procurement?: ProcurementData;
  status?: "draft" | "completed" | string;
  requestId?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: any;
  updatedAt?: any;
};

const uid = () => Math.random().toString(36).slice(2, 10);

const newBoqRow = (): BoqRow => ({
  id: uid(),
  description: "",
  qty: "",
  unit: "",
  materialCost: "",
  laborCost: "",
  consumableCost: "",
});

const newBoqSection = (): BoqSection => ({ id: uid(), title: "", rows: [newBoqRow()] });

const STANDARD_SECTION_TITLES = [
  "GENERAL REQUIREMENTS",
  "CIVIL WORKS",
  "EE WORKS",
  "LABOR",
  "TOOLS",
  "HEAVY EQUIPMENT RENTAL",
] as const;

const isStandardTitle = (t: string) =>
  (STANDARD_SECTION_TITLES as readonly string[]).includes((t ?? "").trim().toUpperCase());

const TOOL_TYPES = [
  { value: "general", label: "General" },
  { value: "power", label: "Power Tools" },
  { value: "hand", label: "Hand Tools" },
  { value: "safety", label: "Safety Equipment / Miscellaneous" },
] as const;

const isToolsSection = (s: { title: string }) => (s.title ?? "").trim().toUpperCase() === "TOOLS";
const isRentalSection = (s: { title: string }) =>
  (s.title ?? "").trim().toUpperCase() === "HEAVY EQUIPMENT RENTAL";
const isEngineeringFullEditSection = (s: { title: string; titleLocked?: boolean }) =>
  !!s.titleLocked && ["GENERAL REQUIREMENTS", "LABOR"].includes((s.title ?? "").trim().toUpperCase());

// Paste order = Excel BOQ order. null = auto-computed total column (skipped when pasting)
const ENG_PASTE_COLS = ["description", "qty", "unit", "materialCost", null, "laborCost", null, "consumableCost"] as const;
const ENG_COL_INDEX = { description: 0, qty: 1, unit: 2, materialCost: 3, laborCost: 5, consumableCost: 7 } as const;

type ColumnDef =
  | { key: "qty" | "materialCost" | "laborCost" | "consumableCost"; label: string; kind: "input" }
  | { key: TotalKey; label: string; kind: "total" };

// Money columns in display order (Quantity and Unit are rendered separately before these)
const MONEY_COLUMNS: ColumnDef[] = [
  { key: "materialCost", label: "Material Cost", kind: "input" },
  { key: "totalMaterialCost", label: "Total Material Cost", kind: "total" },
  { key: "laborCost", label: "Labor Cost", kind: "input" },
  { key: "totalLaborCost", label: "Total Labor Cost", kind: "total" },
  { key: "consumableCost", label: "Consumable Cost", kind: "input" },
  { key: "totalConsumable", label: "Total Consumable", kind: "total" },
  { key: "totalAmount", label: "Total Amount", kind: "total" },
];

// 12 columns: No | Description | Qty | Unit | 7 money columns | delete button
const BOQ_GRID =
  "grid grid-cols-[60px_minmax(280px,1fr)_90px_90px_repeat(7,125px)_40px] gap-2 items-start";
// Procurement ON: first track = sticky group (Item No + 3 procurement cols), then the engineering columns
const BOQ_GRID_PROC =
  "grid grid-cols-[473px_minmax(280px,1fr)_90px_90px_repeat(7,125px)_40px] gap-2 items-start";

// Same grids, plus 3 tool columns (Tool Type 190px | Usage 110px | Depreciation Years 130px) after Unit
const BOQ_GRID_TOOLS =
  "grid grid-cols-[60px_minmax(280px,1fr)_90px_90px_190px_110px_130px_110px_repeat(7,125px)_40px] gap-2 items-start";
const BOQ_GRID_PROC_TOOLS =
  "grid grid-cols-[473px_minmax(280px,1fr)_90px_90px_190px_110px_130px_110px_repeat(7,125px)_40px] gap-2 items-start";
const BOQ_GRID_RENTAL =
  "grid grid-cols-[60px_minmax(280px,1fr)_90px_90px_130px_repeat(7,125px)_40px] gap-2 items-start";
const BOQ_GRID_PROC_RENTAL =
  "grid grid-cols-[601px_minmax(280px,1fr)_90px_90px_130px_repeat(7,125px)_40px] gap-2 items-start";
// Sticky left group wrapper (Item No + Procurement Qty/Cost/Total)
// Rental version: Item No | Qty | Cost | Mob/Demob | Total
const PROC_STICKY_RENTAL =
  "grid grid-cols-[60px_100px_130px_120px_135px] gap-2 sticky left-0 z-10 self-stretch -ml-3 pl-3 pr-3 border-r border-slate-200 shadow-[4px_0_6px_-4px_rgba(0,0,0,0.12)]";
const PROC_STICKY =
  "grid grid-cols-[60px_100px_130px_135px] gap-2 sticky left-0 z-10 self-stretch -ml-3 pl-3 pr-3 border-r border-slate-200 shadow-[4px_0_6px_-4px_rgba(0,0,0,0.12)]";

/* ─────────────────────────────────────────────
   FIELD COLOR CODE (who edits what)
     GREEN  = Engineering-editable fields
     AMBER  = Procurement-editable fields
     GRAY   = auto-computed / read-only / not applicable
───────────────────────────────────────────── */
type FieldOwner = "eng" | "proc";

const ENG_TONE =
  "bg-emerald-50 border-emerald-300 text-emerald-900 focus-visible:ring-emerald-500 disabled:opacity-100 disabled:cursor-default";
const PROC_TONE =
  "bg-amber-50 border-amber-300 text-amber-900 focus-visible:ring-amber-500 disabled:opacity-100 disabled:cursor-default";
const AUTO_TONE =
  "bg-slate-100 border-slate-200 text-slate-600 placeholder:text-slate-400 disabled:opacity-100 disabled:cursor-default";

const NUM_BASE = "h-9 rounded-lg text-[12px] font-medium text-right tabular-nums";
const engNumClass = `${NUM_BASE} ${ENG_TONE}`;
const procNumClass = `${NUM_BASE} ${PROC_TONE}`;
const autoNumClass = `h-9 rounded-lg text-[12px] font-bold text-right tabular-nums ${AUTO_TONE}`;

// notApplicable = the field doesn't apply to this row (e.g. Usage on a Power Tool) -> gray
const ownerNumClass = (owner: FieldOwner, notApplicable = false) =>
  notApplicable ? autoNumClass : owner === "eng" ? engNumClass : procNumClass;

const toRoman = (num: number): string => {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let n = num;
  let out = "";
  for (const [value, symbol] of map) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out;
};

// Allow digits and a single decimal point only
const sanitizeDecimal = (value: string | undefined) => {
  const cleaned = (value ?? "").replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
};

// "4" -> "4.00", pero "1966.666667" ay mananatiling buo (walang early rounding)
const formatDecimal = (value: string | number | undefined) => {
  if (value === "" || value === "." || value === undefined || value === null) return "";
  const n = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(n)) return "";
  if (typeof value === "string") {
    const decimals = value.includes(".") ? value.split(".")[1].length : 0;
    if (decimals > 2) return value; // keep full precision
  }
  return n.toFixed(2);
};

const toNumber = (value: string | undefined) => {
  const n = parseFloat(value ?? "");
  return Number.isNaN(n) ? 0 : n;
};

const num2 = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const peso = (n: number) => `₱${num2(n)}`;

/* ── CUSTOM PRICING HELPERS (calculation lives in custom-pricing-calculator.tsx) ── */
const stripCustom = (r: BoqRow): BoqRow => {
  const next: BoqRow = { ...r };
  CUSTOM_KEYS.forEach((k) => delete next[k]);
  return next;
};

const isManualCustom = (r: BoqRow) => !!r.customPricing && customMethodOf(r) === "manual";

/* ── ROW FORMULAS ── */
const rowTotals = (r: BoqRow, workingDays = 0, isTools = false, isRental = false): Record<TotalKey, number> => {
  const qty = toNumber(r.qty);
  const material = toNumber(r.materialCost);

  let totalMaterialCost = qty * material;
  if (isTools) {
    if (r.toolType === "general") {
      // General tools use the standard quantity × cost calculation.
      totalMaterialCost = qty * material;
    } else if (r.toolType === "hand") {
      // Qty x Cost / Usage
      const usage = toNumber(r.toolUsage);
      if (usage > 0) totalMaterialCost = (qty * material) / usage;
    } else if (r.toolType === "power" || r.toolType === "safety") {
      // (Cost / (Depreciation Years x 100)) x Total Working Days x Qty
      const factor = toNumber(r.toolDepFactor) > 0 ? toNumber(r.toolDepFactor) : 100;
      const denom = toNumber(r.toolDepYears) * factor;
      if (denom > 0) totalMaterialCost = (material / denom) * workingDays * qty;
    }
  }
  if (isRental) {
    // (Qty × Cost) + Mobilization Fee
    totalMaterialCost = qty * material + toNumber(r.rentalFee);
  }
  const totalLaborCost = qty * toNumber(r.laborCost);
  const totalConsumable = qty * toNumber(r.consumableCost);
  const totalAmount = totalMaterialCost + totalLaborCost + totalConsumable;

  return { totalMaterialCost, totalLaborCost, totalConsumable, totalAmount };
};

const isRowEmpty = (r: BoqRow) =>
  !r.description.trim() &&
  !r.unit.trim() &&
  !r.qty.trim() &&
  !r.materialCost.trim() &&
  !r.laborCost.trim() &&
  !r.consumableCost.trim() &&
  !(r.rentalFee ?? "").trim();

/* ── SECTION FORMULA (SUBTOTAL AMOUNT) ── */
const sectionSubtotals = (s: BoqSection, workingDays = 0) =>
  (s.rows ?? []).reduce(
    (acc, r) => {
      const t = rowTotals(r, workingDays, isToolsSection(s), isRentalSection(s));
      return {
        material: acc.material + t.totalMaterialCost,
        labor: acc.labor + t.totalLaborCost,
        consumable: acc.consumable + t.totalConsumable,
        total: acc.total + t.totalAmount,
      };
    },
    { material: 0, labor: 0, consumable: 0, total: 0 }
  );

/* ── PROJECT SUMMARY FORMULAS ── */
const computeSummary = (sections: BoqSection[], contingencyPctStr: string, unitCountStr: string, workingDays = 0): BoqSummary => {
  const subs = sections.map((s) => sectionSubtotals(s, workingDays));
  const materialCost = subs.reduce((a, s) => a + s.material, 0);
  const laborCost = subs.reduce((a, s) => a + s.labor, 0);
  const consumables = subs.reduce((a, s) => a + s.consumable, 0);

  const directCost = materialCost + laborCost + consumables;
  const contingencyPct = toNumber(contingencyPctStr);
  const contingency = directCost * (contingencyPct / 100);
  const totalProjectCost = directCost + contingency;

  const unitCount = toNumber(unitCountStr);
  const costPerItem = unitCount > 0 ? totalProjectCost / unitCount : 0;

  return {
    materialCost,
    laborCost,
    consumables,
    directCost,
    contingencyPct,
    contingency,
    totalProjectCost,
    unitCount,
    costPerItem,
  };
};

// Freeze the computed totals into the row (used on submit)
const finalizeRow = (r: BoqRow, workingDays = 0, isTools = false, isRental = false): BoqRow => {
  const t = rowTotals(r, workingDays, isTools, isRental);
  return {
    ...r,
    totalMaterialCost: t.totalMaterialCost.toFixed(2),
    totalLaborCost: t.totalLaborCost.toFixed(2),
    totalConsumable: t.totalConsumable.toFixed(2),
    totalAmount: t.totalAmount.toFixed(2),
  };
};

/* ── PROCUREMENT (hidden from Engineering / Sales) ── */
const DEFAULT_WARRANTY = "5";
const DEFAULT_PROC_CONTINGENCY = "4";
const DEFAULT_MARKUP = "2";
const VAT_RATE = 0.12;
const DEFAULT_SAY_ROUND_TO = "10000";
const SAY_ROUNDING_OPTIONS = [
  { value: "0.01", label: "Hundredths (₱0.01)" },
  { value: "0.1", label: "Tenths (₱0.10)" },
  { value: "1", label: "Ones (₱1)" },
  { value: "10", label: "Tens (₱10)" },
  { value: "100", label: "Hundreds (₱100)" },
  { value: "1000", label: "Thousands (₱1,000)" },
  { value: "10000", label: "Ten thousands (₱10,000)" },
  { value: "100000", label: "Hundred thousands (₱100,000)" },
  { value: "1000000", label: "Millions (₱1,000,000)" },
] as const;

// Per row: plain Procurement Qty × Acquired Cost (`_row` kept so call sites don't change)
const procRowAsCustomRow = (p?: ProcurementRow, row?: BoqRow): CustomPricingRow => ({
  ...(p || {}),
  description: row?.description ?? "",
  unit: row?.unit ?? "",
  qty: p?.qty ?? "",
  materialCost: p?.cost ?? "",
});
const usesEngineeringTotalForProcurement = (row?: BoqRow) =>
  toNumber(row?.toolDepYears) > 0 || toNumber(row?.toolUsage) > 0;

const RENTAL_VAT_EXE = 1.12; // fixed

const procRowTotal = (
  p: ProcurementRow | undefined,
  row?: BoqRow,
  workingDays = 0,
  isTools = false,
  isRental = false
) =>
  isTools && row && usesEngineeringTotalForProcurement(row) && p?.useEngineeringTotal !== false
    ? rowTotals(row, workingDays, true).totalMaterialCost
    : isTools && row && usesEngineeringTotalForProcurement(row)
    ? (() => {
        const qty = toNumber(p?.qty);
        const cost = toNumber(p?.cost);
        return qty * cost;
      })()
    : p?.customPricing
    ? computeCustomMaterial(procRowAsCustomRow(p, row))
    : isRental
    ? // (Qty × Cost + Mob/Demob) × 1.12
      (toNumber(p?.qty) * toNumber(p?.cost) + toNumber(p?.mobDemob)) * RENTAL_VAT_EXE
    : toNumber(p?.qty) * toNumber(p?.cost);
const procRowEntered = (p?: ProcurementRow, row?: BoqRow) =>
  !!(
    usesEngineeringTotalForProcurement(row) ||
    p?.useEngineeringTotal ||
    p?.customPricing ||
    p?.qty?.trim() ||
    p?.cost?.trim() ||
    p?.mobDemob?.trim()
  );

// Section subtotal BEFORE custom pricing
const sectionProcBase = (s: BoqSection, procRows: Record<string, ProcurementRow>, workingDays = 0) =>
  (s.rows ?? []).reduce(
    (acc, r) =>
      acc + procRowTotal(procRows[r.id], r, workingDays, isToolsSection(s), isRentalSection(s)),
    0
  );

// Custom pricing of the procurement SUBTOTAL (same calculator): Cost = section subtotal, Qty = 1
const procSectionAsCustomRow = (
  s: BoqSection,
  procRows: Record<string, ProcurementRow>,
  custom?: CustomPricingFields,
  workingDays = 0
): CustomPricingRow => ({
  ...(custom ?? {}),
  description: s.title ? `${s.title} (Subtotal)` : "Section subtotal",
  unit: "",
  qty: "1",
  materialCost: String(sectionProcBase(s, procRows, workingDays)),
});

const sectionProcTotal = (
  s: BoqSection,
  procRows: Record<string, ProcurementRow>,
  sectionCustom?: Record<string, CustomPricingFields>,
  workingDays = 0,
  sectionMult?: Record<string, string>
) => {
  const custom = sectionCustom?.[s.id];
  const base = custom?.customPricing
    ? computeCustomMaterial(procSectionAsCustomRow(s, procRows, custom, workingDays))
    : sectionProcBase(s, procRows, workingDays);
  const m = toNumber(sectionMult?.[s.id]);
  return base * (m > 0 ? m : 1); // blank / 0 = ×1
};

const computeProcurementSummary = (
  sections: BoqSection[],
  procRows: Record<string, ProcurementRow>,
  warrantyStr: string,
  contingencyStr: string,
  markupStr: string,
  sectionCustom?: Record<string, CustomPricingFields>,
  sayRoundToStr = DEFAULT_SAY_ROUND_TO,
  workingDays = 0,
  sectionMult?: Record<string, string>
): ProcurementSummary => {
  const total = sections.reduce((a, s) => a + sectionProcTotal(s, procRows, sectionCustom, workingDays, sectionMult), 0);
  const engTotal = sections.reduce((a, s) => a + sectionSubtotals(s, workingDays).total, 0);

  const warrantyPct = toNumber(warrantyStr);
  const contingencyPct = toNumber(contingencyStr);
  const markup = toNumber(markupStr);

  const warranty = total * (warrantyPct / 100);
  const contingency = total * (contingencyPct / 100);
  const directCost = total + warranty + contingency;
  const vat = directCost * (1 + VAT_RATE);
  const withMarkup = vat * markup;
  const sayRoundToCents = Math.round(toNumber(sayRoundToStr) * 100);
  const say = sayRoundToCents > 0
    ? Math.ceil((withMarkup * 100 - 1e-8) / sayRoundToCents) * sayRoundToCents / 100
    : withMarkup;

  return {
    total, warrantyPct, warranty, contingencyPct, contingency,
    directCost, vat, markup, withMarkup, say,
    variance: engTotal - total,
  };
};

const DEFAULT_CONTINGENCY = "7";
const DEFAULT_UNIT_COUNT = "1";

/* Unsaved work survives closing the dialog (outside click / Esc / X).
   Cleared on Submit, Save Procurement, or Cancel. */
type UnsavedSnapshot = {
  values: JobFillUpFormValues;
  boqSections: BoqSection[];
  boqs: BoqVersion[];
  activeBoqIndex: number;
  contingencyPct: string;
  unitCount: string;
  procRows: Record<string, ProcurementRow>;
  procWarrantyPct: string;
  procContingencyPct: string;
  procMarkup: string;
  procSayRoundTo: string;
  procSectionCustom: Record<string, CustomPricingFields>;
  procSectionMult: Record<string, string>;
};
const UNSAVED_CACHE = new Map<string, UnsavedSnapshot>();

/* ─────────────────────────────────────────────
   HELPERS — map a job_requests row to form values
───────────────────────────────────────────── */
const formatRequestedDate = (value?: string | Date | null) => {
  if (!value) return "";
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

const formatLocalCalendarDate = (value?: string | Date | null) => {
  if (!value) return "N/A";
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "N/A"
    : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

async function mapJobToFormValues(job: JobRequestRow): Promise<JobFillUpFormValues> {
  const totalWorkingDays = typeof job.totalWorkingDays === "number"
    ? String(job.totalWorkingDays)
    : "";

  return {
    jrNumber: job.jobRequestNo || "",
    dateRequested: formatRequestedDate(job.createdAt),
    agentName: job.agentName || "",
    projectTitle: job.projectTitle || "",
    projectName: typeof job.projectName === "string" ? job.projectName : "",
    clientName: job.clientName || "GENERAL",
    address: job.location || "",
    totalWorkingDays,
    scopeOfWork: job.scopeOfWork || "",
  };
}

interface JobFillUpFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Supabase job_requests id (the id in /request/job/[id]). Form auto-populates from it. */
  requestId?: string;
  contactDetails?: {
    contactPerson?: string | null;
    designation?: string | null;
    email?: string | null;
    contactNumber?: string | null;
  };
  preferredDateFinish?: {
    from?: string | Date | null;
    to?: string | Date | null;
  };
  pdDatabaseItems?: PdDatabaseFormItem[];
  /** Allow Engineering Leader/Manager to edit the job request's total working days. */
  /**
   * View mode: shows the saved draft (see `draft`) with every input disabled and
   * no Clear / Submit buttons.
   */
  readOnly?: boolean;
  /**
   * A saved fill-up form. In edit mode ("Load Draft") the form is auto-populated with it and
   * stays editable; with `readOnly` it is shown view-only. Pass it together with `open`
   * (a snapshot taken when the dialog is opened) so later snapshots don't reset the form.
   */
  draft?: FillUpDraft | null;
  /**
   * Edit mode only: receives the form values, BOQ sections (with final totals) and the
   * project summary on submit. Throw inside it to keep the dialog open and show an error.
   */
  onSubmit?: (
    values: JobFillUpFormValues,
    boqSections: BoqSection[],
    summary: BoqSummary,
    procurement?: ProcurementData,
    boqs?: BoqVersion[]
  ) => void | FillUpDraft | Promise<void | FillUpDraft>;
  /** Workflow actions shown in the form footer. */
  advanceActions?: { label: string; status: string; disabled?: boolean }[];
  onAdvance?: (status: string, draft?: FillUpDraft | null, remarks?: string) => Promise<boolean | void>;
  remarksLabel: string;
  remarks: string;
  remarksEditable: boolean;
  /** Show the Procurement columns + summary (Procurement and IT/Admin only) */
  showProcurement?: boolean;
  /** Procurement inputs are editable */
  procurementEditable?: boolean;
  /** Engineering can edit all fields in General Requirements/Labor, and only description, quantity, and unit elsewhere. */
  engineeringMode?: boolean;
  /** Hide BOQ custom-pricing controls for roles that should not use them. */
  allowBoqCustomPricing?: boolean;
  /** Save Procurement data and the BOQ cost edits made in Procurement view. */
  onSaveProcurement?: (
    data: ProcurementData,
    boqSections: BoqSection[],
    summary: BoqSummary,
    boqs?: BoqVersion[]
  ) => void | FillUpDraft | Promise<void | FillUpDraft>;
}

/* Small "i" icon with a hover/focus tooltip (portaled so the sticky header's overflow doesn't clip it) */
function InfoTip({ children, label = "More info" }: { children: React.ReactNode; label?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 170), window.innerWidth - 170);
    setPos({ x, y: r.bottom + 6 });
  };

  return (
    <>
      <span
        tabIndex={0}
        role="button"
        aria-label={label}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={() => setPos(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setPos(null)}
        className="inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full bg-sky-500 text-white normal-case"
      >
        <Info size={10} strokeWidth={3} />
      </span>
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{ position: "fixed", left: pos.x, top: pos.y, transform: "translateX(-50%)" }}
            className="pointer-events-none z-[9999] w-[320px] rounded-lg bg-slate-900 px-3 py-2.5 text-[11px] font-medium normal-case leading-snug tracking-normal text-white shadow-xl"
          >
            {children}
          </div>,
          document.body
        )}
    </>
  );
}

export function JobFillUpFormDialog({
  open,
  onOpenChange,
  requestId,
  contactDetails,
  preferredDateFinish,
  pdDatabaseItems = [],
  readOnly = false,
  draft = null,
  onSubmit,
  advanceActions = [],
  onAdvance,
  remarksLabel,
  remarks,
  remarksEditable,
  showProcurement = false,
  procurementEditable = false,
  engineeringMode = false,
  allowBoqCustomPricing: _allowBoqCustomPricing, // ignored: BOQ custom pricing is removed
  onSaveProcurement,
}: JobFillUpFormDialogProps) {
  const [values, setValues] = useState<JobFillUpFormValues>(EMPTY_DATA);
  // Keys that were auto-populated with a value -> these fields are disabled
  const [lockedKeys, setLockedKeys] = useState<string[]>([]);
  const [boqSections, setBoqSections] = useState<BoqSection[]>([newBoqSection()]);
  const [boqs, setBoqs] = useState<BoqVersion[]>([]);
  const [activeBoqIndex, setActiveBoqIndex] = useState(0);
  const [requestedBoqCount, setRequestedBoqCount] = useState("1");
  const boqCountApplyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<"save" | "advance" | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState("");
  // BOQ UI state: collapsed sections + which new section to scroll to
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);
  const [activeBoqRowKey, setActiveBoqRowKey] = useState<string | null>(null);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  // Summary inputs
  const [contingencyPct, setContingencyPct] = useState(DEFAULT_CONTINGENCY);
  const [unitCount, setUnitCount] = useState(DEFAULT_UNIT_COUNT);
  // Procurement (keyed by BOQ row id)
  const [procRows, setProcRows] = useState<Record<string, ProcurementRow>>({});
  const [procWarrantyPct, setProcWarrantyPct] = useState(DEFAULT_WARRANTY);
  const [procContingencyPct, setProcContingencyPct] = useState(DEFAULT_PROC_CONTINGENCY);
  const [procMarkup, setProcMarkup] = useState(DEFAULT_MARKUP);
  const [procSayRoundTo, setProcSayRoundTo] = useState(DEFAULT_SAY_ROUND_TO);
  const [procSectionCustom, setProcSectionCustom] = useState<Record<string, CustomPricingFields>>({});
  const [procSectionMult, setProcSectionMult] = useState<Record<string, string>>({});
  const [isSavingProc, setIsSavingProc] = useState(false);
  const [selectedAdvanceStatus, setSelectedAdvanceStatus] = useState("");
  const previousEngineeringQty = useRef<Record<string, string> | null>(null);

  const advanceAction =
    advanceActions.find((action) => action.status === selectedAdvanceStatus) ?? advanceActions[0];

  useEffect(() => {
    if (open) setSelectedAdvanceStatus("");
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const previousBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    const previousHtmlOverflow = html.style.overflow;

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";

    return () => {
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.width = previousBodyStyles.width;
      body.style.overflow = previousBodyStyles.overflow;
      html.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // view mode shows the draft read-only, edit mode ("Load Draft") pre-fills the editable form
  const viewDraft = readOnly ? draft : null;
  const editDraft = readOnly ? null : draft;

  // Unsaved-work cache: separate slot for edit mode (Engineering) and view mode (Procurement)
  const cacheKey = `${requestId ?? draft?.requestId ?? "new"}:${readOnly ? "view" : "edit"}`;
  // true only after the open-effect finished restoring, so we never overwrite the cache with a blank reset state
  const [hydrated, setHydrated] = useState(false);

  // Everything is frozen while the job request loads, and always in view mode
  const locked = isLoadingJob || readOnly;
  const canEditProc = showProcurement && procurementEditable && !isLoadingJob;
  const workingDays = toNumber(values.totalWorkingDays);
  const allowBoqCustomPricing = false; // BOQ (Engineering) custom pricing is removed

  useEffect(() => () => {
    if (boqCountApplyTimer.current) clearTimeout(boqCountApplyTimer.current);
  }, []);

  // Populate every time the dialog opens
  useEffect(() => {
    if (!open) {
      setHydrated(false);
      return;
    }

    setCollapsedIds([]);
    setActiveBoqRowKey(null);
    const cached = UNSAVED_CACHE.get(cacheKey);
    const restoreProc = (c: UnsavedSnapshot) => {
      setBoqs(c.boqs);
      setRequestedBoqCount(String(Math.max(c.boqs.length, 1)));
      setActiveBoqIndex(c.activeBoqIndex);
      setProcRows(c.procRows);
      setProcWarrantyPct(c.procWarrantyPct);
      setProcContingencyPct(c.procContingencyPct);
      setProcMarkup(c.procMarkup);
      setProcSayRoundTo(c.procSayRoundTo);
      setProcSectionCustom(c.procSectionCustom);
      setProcSectionMult(c.procSectionMult);
    };

    const applyProc = (procurement?: ProcurementData) => {
      setProcRows(procurement?.rows ?? {});
      setProcWarrantyPct(String(procurement?.warrantyPct ?? DEFAULT_WARRANTY));
      setProcContingencyPct(String(procurement?.contingencyPct ?? DEFAULT_PROC_CONTINGENCY));
      setProcMarkup(String(procurement?.markup ?? DEFAULT_MARKUP));
      const savedSayRoundTo = String(procurement?.sayRoundTo ?? DEFAULT_SAY_ROUND_TO);
      setProcSayRoundTo(
        SAY_ROUNDING_OPTIONS.some((option) => option.value === savedSayRoundTo)
          ? savedSayRoundTo
          : DEFAULT_SAY_ROUND_TO
      );
      setProcSectionCustom(procurement?.sectionCustom ?? {});
      setProcSectionMult(procurement?.sectionMultiplier ?? {});
    };

    // ── VIEW MODE: show the saved draft ──
    if (readOnly) {
      setValues({ ...EMPTY_DATA, ...(viewDraft?.values ?? {}) });
      setLockedKeys([]);
      const versions = viewDraft?.boqs?.length
        ? viewDraft.boqs
        : viewDraft
        ? [{ boqSections: viewDraft.boqSections ?? [], summary: viewDraft.summary, procurement: viewDraft.procurement }]
        : [];
      setBoqs(versions);
      setRequestedBoqCount(String(Math.max(versions.length, 1)));
      setActiveBoqIndex(0);
      setBoqSections(versions[0]?.boqSections ?? viewDraft?.boqSections ?? []);
      setContingencyPct(String(versions[0]?.summary?.contingencyPct ?? viewDraft?.summary?.contingencyPct ?? DEFAULT_CONTINGENCY));
      setUnitCount(String(versions[0]?.summary?.unitCount ?? viewDraft?.summary?.unitCount ?? DEFAULT_UNIT_COUNT));
      applyProc(versions[0]?.procurement ?? viewDraft?.procurement);
      if (cached) restoreProc(cached); // only the procurement inputs are editable in view mode
      setHydrated(true);
      return;
    }

    // ── EDIT MODE: pre-fill from the saved draft (if any), then lock the job-request fields ──
    setValues({ ...EMPTY_DATA, ...(editDraft?.values ?? {}) });
    setLockedKeys([]);
    const versions = editDraft?.boqs?.length
      ? editDraft.boqs
      : editDraft
      ? [{ boqSections: editDraft.boqSections ?? [], summary: editDraft.summary, procurement: editDraft.procurement }]
      : [];
    setBoqs(versions);
    setRequestedBoqCount(String(Math.max(versions.length, 1)));
    setActiveBoqIndex(0);
    setBoqSections(
      versions[0]?.boqSections?.length
        ? versions[0].boqSections.map((s) => ({
            ...s,
            rows: (s.rows ?? []).map((r) => ({ ...r })),
          }))
        : [newBoqSection()]
    );
    setContingencyPct(String(versions[0]?.summary?.contingencyPct ?? editDraft?.summary?.contingencyPct ?? DEFAULT_CONTINGENCY));
    setUnitCount(String(versions[0]?.summary?.unitCount ?? editDraft?.summary?.unitCount ?? DEFAULT_UNIT_COUNT));
    applyProc(versions[0]?.procurement ?? editDraft?.procurement);
    if (cached) {
      setValues({ ...EMPTY_DATA, ...cached.values });
      setBoqSections(cached.boqSections);
      setContingencyPct(cached.contingencyPct);
      setUnitCount(cached.unitCount);
      restoreProc(cached);
    }
    setHydrated(true);
    if (!requestId) return;

    let cancelled = false;
    setIsLoadingJob(true);

    (async () => {
      try {
        const job = await getJobRequestById(requestId);
        if (!job) {
          if (!cancelled) toast.error("Job request not found");
          return;
        }
        const mapped = await mapJobToFormValues(job);
        if (!cancelled) {
          // Job-request fields stay locked, but working days remain editable in the fill-up form.
          const populatedJobFields = FIELDS.filter((f) => mapped[f.key]?.toString().trim());
          const lockedFromJob = populatedJobFields
            .filter((f) => f.key !== "totalWorkingDays")
            .map((f) => f.key);
          const editableWorkingDays = cached?.values.totalWorkingDays !== undefined
            ? cached.values.totalWorkingDays
            : editDraft?.values.totalWorkingDays;
          setValues({
            ...EMPTY_DATA,
            ...(editDraft?.values ?? {}),
            ...(cached?.values ?? {}),
            ...Object.fromEntries(populatedJobFields.map((f) => [f.key, mapped[f.key]])),
            ...(editableWorkingDays !== undefined
              ? { totalWorkingDays: editableWorkingDays }
              : {}),
          });
          setLockedKeys(lockedFromJob);
        }
      } catch (err) {
        console.error("FILL_UP_FORM_LOAD_ERROR", err);
        if (!cancelled) toast.error("Failed to load job request data");
      } finally {
        if (!cancelled) setIsLoadingJob(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, requestId, readOnly, viewDraft, editDraft, cacheKey]);

  // Keep the unsaved copy up to date while the dialog is open
  useEffect(() => {
    if (!open || !hydrated) return;
    UNSAVED_CACHE.set(cacheKey, {
      values,
      boqSections,
      boqs,
      activeBoqIndex,
      contingencyPct,
      unitCount,
      procRows,
      procWarrantyPct,
      procContingencyPct,
      procMarkup,
      procSayRoundTo,
      procSectionCustom,
      procSectionMult,
    });
  }, [
    open, hydrated, cacheKey, values, boqSections, boqs, activeBoqIndex, contingencyPct, unitCount,
    procRows, procWarrantyPct, procContingencyPct, procMarkup, procSayRoundTo,
    procSectionCustom, procSectionMult,
  ]);

  useEffect(() => {
    if (!open) {
      previousEngineeringQty.current = null;
      return;
    }
    if (!hydrated || !showProcurement) return;

    const quantities = Object.fromEntries(
      boqSections.flatMap((section) => section.rows.map((row) => [row.id, row.qty]))
    );
    const previousQuantities = previousEngineeringQty.current;
    setProcRows((current) => {
      let next = current;
      for (const section of boqSections) {
        for (const row of section.rows) {
          if (previousQuantities?.[row.id] === row.qty) continue;
          const qty = formatDecimal(row.qty);
          if ((current[row.id]?.qty ?? "") === qty) continue;
          if (next === current) next = { ...current };
          next[row.id] = {
            ...(current[row.id] ?? { qty: "", cost: "" }),
            qty,
          };
        }
      }
      return next;
    });
    previousEngineeringQty.current = quantities;
  }, [open, hydrated, showProcurement, boqSections]);

  // After adding a section: scroll to it and focus its title
  useEffect(() => {
    if (!scrollToId) return;
    const t = setTimeout(() => {
      document.getElementById(`boq-section-${scrollToId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById(`boq-title-${scrollToId}`)?.focus({ preventScroll: true });
      setScrollToId(null);
    }, 50);
    return () => clearTimeout(t);
  }, [scrollToId]);

  const setField = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  /* ── BOQ handlers ── */
  const addSection = () => {
    const created = newBoqSection();
    setBoqSections((prev) => [...prev, created]);
    setScrollToId(created.id);
  };

  const toggleCollapse = (sectionId: string) =>
    setCollapsedIds((prev) => (prev.includes(sectionId) ? prev.filter((x) => x !== sectionId) : [...prev, sectionId]));

  const collapseAll = () => setCollapsedIds(boqSections.map((s) => s.id));
  const expandAll = () => setCollapsedIds([]);

  const removeSection = (sectionId: string) =>
    setBoqSections((prev) => (prev.length === 1 ? [newBoqSection()] : prev.filter((s) => s.id !== sectionId)));

    // "" = Custom (editable) · otherwise a standard title (locked)
  const pickStandardTitle = (sectionId: string, value: string) =>
    setBoqSections((prev) =>
        prev.map((s) => {
          if (s.id !== sectionId) return s;
          const selectsFullEditSection = ["GENERAL REQUIREMENTS", "LABOR"].includes(value.trim().toUpperCase());
          const hasExistingItems = s.rows.some((row) => !isRowEmpty(row));
          if (engineeringMode && selectsFullEditSection && !isEngineeringFullEditSection(s) && hasExistingItems) {
            return s;
          }
          return value
            ? { ...s, title: value, titleLocked: true }
            : { ...s, title: "", titleLocked: false };
        })
      );

  const updateSectionTitle = (sectionId: string, title: string) =>
    setBoqSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, title } : s)));

  const addRow = (sectionId: string) =>
    setBoqSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, rows: [...s.rows, newBoqRow()] } : s))
    );

  // Insert a new empty row right below the given row
  const insertRowAfter = (sectionId: string, rowId: string) =>
    setBoqSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.rows.findIndex((r) => r.id === rowId);
        const rows = [...s.rows];
        rows.splice(idx + 1, 0, newBoqRow());
        return { ...s, rows };
      })
    );

  const removeRow = (sectionId: string, rowId: string) =>
    setBoqSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return { ...s, rows: s.rows.length === 1 ? [newBoqRow()] : s.rows.filter((r) => r.id !== rowId) };
      })
    );

  const patchRow = (sectionId: string, rowId: string, fn: (r: BoqRow) => BoqRow) =>
    setBoqSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          rows: s.rows.map((row) => {
            if (row.id !== rowId) return row;
            const updated = fn(row);
            if (!engineeringMode || isEngineeringFullEditSection(s)) return updated;
            if (isToolsSection(s)) {
              return {
                ...row,
                description: updated.description,
                qty: updated.qty,
                unit: updated.unit,
                toolType: updated.toolType,
                toolUsage: updated.toolUsage,
                toolDepYears: updated.toolDepYears,
              };
            }
            return { ...row, description: updated.description, qty: updated.qty, unit: updated.unit };
          }),
        };
      })
    );

  const updateRow = (sectionId: string, rowId: string, key: InputKey, value: string) =>
    patchRow(sectionId, rowId, (r) => ({ ...r, [key]: value }));

  /* ── CUSTOM PRICING HANDLERS ── */
  const updateCustom = (sectionId: string, rowId: string, patch: Partial<BoqRow>) =>
    patchRow(sectionId, rowId, (r) => ({ ...r, ...patch }));

  // Which row the calculator is open for (fresh = just ticked, so Cancel should untick it)
  const [calcTarget, setCalcTarget] = useState<{
    sectionId: string;
    rowId: string;
    fresh: boolean;
    proc?: boolean; // true = pricing the PROCUREMENT total amount
    procRow?: boolean;
  } | null>(null);

  const calcRow = useMemo<CustomPricingRow | null>(() => {
    if (!calcTarget) return null;
    const sec = boqSections.find((s) => s.id === calcTarget.sectionId);
    if (!sec) return null;
    if (calcTarget.proc) return procSectionAsCustomRow(sec, procRows, procSectionCustom[sec.id]);
    if (calcTarget.procRow) {
      return procRowAsCustomRow(procRows[calcTarget.rowId], sec.rows.find((row) => row.id === calcTarget.rowId));
    }
    return sec.rows.find((x) => x.id === calcTarget.rowId) ?? null;
  }, [calcTarget, boqSections, procRows, procSectionCustom]);

  // Tick -> start as "manual" (pre-filled with the automatic value) and open the calculator.
  // Untick -> drop every custom field and go back to Qty × Material Cost.
  const toggleCustom = (sectionId: string, rowId: string, checked: boolean) => {
    patchRow(sectionId, rowId, (r) => {
      if (!checked) return stripCustom(r);
      const auto = toNumber(r.qty) * toNumber(r.materialCost);
      return { ...r, customPricing: true, customMethod: "manual", customAmount: auto > 0 ? auto.toFixed(2) : "" };
    });
    if (checked) setCalcTarget({ sectionId, rowId, fresh: true });
  };

  // Procurement SUBTOTAL tick -> start as "Cost" (= unchanged subtotal) and open the calculator.
  // Untick -> drop the custom pricing of that section.
  const toggleProcSectionCustom = (sectionId: string, checked: boolean) => {
    setProcSectionCustom((prev) => {
      const next = { ...prev };
      if (!checked) {
        delete next[sectionId];
        return next;
      }
      next[sectionId] = { customPricing: true, customMethod: "calculator", customExpression: "Cost", customAmount: "" };
      return next;
    });
    if (checked) setCalcTarget({ sectionId, rowId: "", fresh: true, proc: true });
  };

  const toggleProcRowCustom = (sectionId: string, rowId: string, checked: boolean) => {
    const row = boqSections.find((section) => section.id === sectionId)?.rows.find((item) => item.id === rowId);
    if (!row) return;

    setProcRows((prev) => {
      const current = prev[rowId] ?? { qty: "", cost: "" };
      if (!checked) {
        const next = { ...current };
        CUSTOM_KEYS.forEach((key) => delete next[key]);
        return { ...prev, [rowId]: next };
      }
      const auto = toNumber(current.qty) * toNumber(current.cost);
      return {
        ...prev,
        [rowId]: {
          ...current,
          customPricing: true,
          customMethod: "manual",
          customAmount: auto > 0 ? auto.toFixed(2) : "",
        },
      };
    });
    if (checked) setCalcTarget({ sectionId, rowId, fresh: true, procRow: true });
  };

  const handleCalcApply = (patch: CustomPricingFields) => {
    if (!calcTarget) return;
    if (calcTarget.proc) {
      const { sectionId } = calcTarget;
      setProcSectionCustom((prev) => ({ ...prev, [sectionId]: { ...prev[sectionId], ...patch } }));
    } else if (calcTarget.procRow) {
      setProcRows((prev) => ({ ...prev, [calcTarget.rowId]: { ...prev[calcTarget.rowId], ...patch } }));
    } else {
      updateCustom(calcTarget.sectionId, calcTarget.rowId, patch);
    }
    setCalcTarget(null);
  };

  const handleCalcOpenChange = (isOpen: boolean) => {
    if (isOpen) return;
    // Cancelled right after ticking -> untick again
    if (calcTarget?.fresh) {
      if (calcTarget.proc) toggleProcSectionCustom(calcTarget.sectionId, false);
      else if (calcTarget.procRow) toggleProcRowCustom(calcTarget.sectionId, calcTarget.rowId, false);
      else toggleCustom(calcTarget.sectionId, calcTarget.rowId, false);
    }
    setCalcTarget(null);
  };

  // Helper to increment/decrement numeric values

  // Divisor up/down buttons: blank counts as the default 100, never goes below 1
  const adjustDepFactor = (sectionId: string, rowId: string, current: string | undefined, delta: number) => {
    const base = toNumber(current) > 0 ? toNumber(current) : 100;
    updateRow(sectionId, rowId, "toolDepFactor", formatDecimal(Math.max(1, base + delta)));
  };

  // Subtotal multiplier up/down buttons: blank counts as ×1, steps of 0.05, never below 0.01
  const adjustSectionMult = (sectionId: string, delta: number) =>
    setProcSectionMult((prev) => {
      const base = toNumber(prev[sectionId]) > 0 ? toNumber(prev[sectionId]) : 1;
      return { ...prev, [sectionId]: Math.max(0.01, base + delta).toFixed(2) };
    });

  const adjustValue = (current: string, delta: number, setter: (val: string) => void) => {
    const num = toNumber(current);
    const newVal = Math.max(0, num + delta);
    setter(formatDecimal(newVal.toString()));
  };

  /* ── BOQ IMPORT HANDLERS ── */
  const boqWrapperRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // Imported data waiting for the user to choose Replace / Add (shows the dialog)
  const [pendingImport, setPendingImport] = useState<ImportedSection[] | null>(null);

  const countItems = (list: ImportedSection[]) =>
    list.reduce((sum, s) => sum + s.rows.length, 0);

  const applyImport = (imported: ImportedSection[], mode: "replace" | "append") => {
    const converted = convertToBoqSections(imported).map((section) => (
      isStandardTitle(section.title)
        ? { ...section, titleLocked: true }
        : section
    ));

    setBoqSections((prev) => {
      if (mode === "replace") {
        const matchedSectionIds = new Set<string>();
        return converted.map((section) => {
          const normalizedTitle = section.title.trim().toLocaleUpperCase();
          const existingSection = normalizedTitle
            ? prev.find((candidate) => (
                !matchedSectionIds.has(candidate.id)
                && candidate.title.trim().toLocaleUpperCase() === normalizedTitle
              ))
            : undefined;
          if (existingSection) matchedSectionIds.add(existingSection.id);

          const fullEngineeringEdit = engineeringMode && isEngineeringFullEditSection(section);
          const rows = section.rows.map((row, index) => {
            const existingRow = existingSection?.rows[index];
            if (engineeringMode && !fullEngineeringEdit) {
              return existingRow
                ? { ...existingRow, description: row.description, qty: row.qty, unit: row.unit }
                : { ...newBoqRow(), description: row.description, qty: row.qty, unit: row.unit };
            }
            return existingRow ? { ...row, id: existingRow.id } : row;
          });

          return {
            ...section,
            ...(existingSection ? { id: existingSection.id } : {}),
            rows,
          };
        });
      }
      // keep real sections only, so the empty starter section doesn't stay on top
      const kept = prev.filter((s) => s.title.trim() || s.rows.some((r) => !isRowEmpty(r)));
      return [...kept, ...converted];
    });
    setCollapsedIds([]);
    setPendingImport(null);

    toast.success(
      `${mode === "replace" ? "Imported" : "Added"} ${imported.length} section(s) with ${countItems(imported)} item(s)`
    );
  };

  const handleImportedData = (imported: ImportedSection[]) => {
    if (imported.length === 0) {
      toast.error("No BOQ data found in the file");
      return;
    }

    const hasExistingData = boqSections.some(
      (s) => s.title.trim() || s.rows.some((r) => !isRowEmpty(r))
    );

    // BOQ already has data -> ask with the dialog below instead of window.confirm
    if (hasExistingData) {
      setPendingImport(imported);
      return;
    }

    applyImport(imported, "replace");
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    if (locked) return;

    const file = e.dataTransfer.files[0];
    if (!file) return;

    try {
      const grid = await readBoqFile(file);
      const imported = parseBoqGrid(grid);
      handleImportedData(imported);
    } catch (err) {
      console.error("BOQ_IMPORT_ERROR", err);
      toast.error("Failed to read file. Please check the format.");
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (locked) return;

    // Only handle paste if it's inside the BOQ area
    const target = e.target as HTMLElement;
    const isInBoq = target.closest('[data-boq-area="true"]');
    if (!isInBoq) return;
    if (target.closest("[data-proc-input]")) return; // procurement paste is handled separately

    const text = e.clipboardData.getData("text");
    if (!text.includes("\t")) return; // Not tab-separated (not from Excel)

    e.preventDefault();

    try {
      const grid = parseTsv(text);
      const imported = parseBoqGrid(grid);
      handleImportedData(imported);
    } catch (err) {
      console.error("BOQ_PASTE_ERROR", err);
      toast.error("Failed to parse pasted data");
    }
  };

  const handleFilePicker = async () => {
    if (locked) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const grid = await readBoqFile(file);
        const imported = parseBoqGrid(grid);
        handleImportedData(imported);
      } catch (err) {
        console.error("BOQ_IMPORT_ERROR", err);
        toast.error("Failed to read file. Please check the format.");
      }
    };
    input.click();
  };

  const summary = useMemo(
    () => computeSummary(boqSections, contingencyPct, unitCount, workingDays),
    [boqSections, contingencyPct, unitCount, workingDays]
  );

  /* ── PROCUREMENT ── */
  const procSummary = useMemo(
    () => computeProcurementSummary(
      boqSections, procRows, procWarrantyPct, procContingencyPct, procMarkup, procSectionCustom, procSayRoundTo, workingDays, procSectionMult
    ),
    [boqSections, procRows, procWarrantyPct, procContingencyPct, procMarkup, procSectionCustom, procSayRoundTo, workingDays, procSectionMult]
  );

  const updateProc = (rowId: string, key: keyof ProcurementRow, value: string) =>
    setProcRows((prev) => ({ ...prev, [rowId]: { ...prev[rowId], [key]: value } }));

  // Paste a block from Excel into the procurement columns, starting at the clicked row
  // startCol 0 = pasted into Qty (col0 = qty, col1 = cost), 1 = pasted into Cost (col0 = cost)
  const handleProcPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    sectionId: string,
    rowIdx: number,
    startCol: 0 | 1
  ) => {
    if (!canEditProc) return;

    const text = e.clipboardData.getData("text");
    // Single value -> let the normal paste happen
    if (!text.includes("\t") && !text.includes("\n")) return;

    let grid = parseTsv(text);
    while (grid.length && grid[grid.length - 1].every((c) => !c?.trim())) grid = grid.slice(0, -1);
    if (grid.length === 0 || (grid.length === 1 && grid[0].length === 1)) return;

    e.preventDefault();
    e.stopPropagation(); // don't trigger the BOQ import paste

    const section = boqSections.find((s) => s.id === sectionId);
    if (!section) return;

    // "7,800.00" / "₱780" -> "7800.00" / "780.00"
    const clean = (v?: string) => {
      const s = sanitizeDecimal((v ?? "").replace(/[^0-9.]/g, ""));
      return formatDecimal(s); // now keeps >2 decimals
    };

    const targets = section.rows.slice(rowIdx, rowIdx + grid.length);

    setProcRows((prev) => {
      const next = { ...prev };
      targets.forEach((row, i) => {
        const cells = grid[i] ?? [];
        const cur = next[row.id] ?? { qty: "", cost: "" };
        let qty = cur.qty;
        let cost = cur.cost;
        if (startCol === 0) {
          qty = clean(cells[0]);
          if (cells.length > 1) cost = clean(cells[1]);
        } else {
          cost = clean(cells[0]);
        }
        next[row.id] = { ...cur, qty, cost };
      });
      return next;
    });

    toast.success(`Pasted ${targets.length} item(s) into this section`);
    if (grid.length > targets.length) {
      toast.warning(`${grid.length - targets.length} extra pasted row(s) ignored (section has no more items)`);
    }
  };

    // Paste a block from Excel into the engineering BOQ cells, starting at the clicked row + column
  const handleBoqCellPaste = (
    e: React.ClipboardEvent<HTMLElement>,
    sectionId: string,
    rowIdx: number,
    startCol: number
  ) => {
    const procurementOnly = readOnly && canEditProc;
    if (locked && !procurementOnly) return;

    const text = e.clipboardData.getData("text");
    // Single value -> let the normal paste happen
    if (!text.includes("\t") && !text.includes("\n")) return;

    let grid = parseTsv(text);
    while (grid.length && grid[grid.length - 1].every((c) => !c?.trim())) grid = grid.slice(0, -1);
    if (grid.length === 0 || (grid.length === 1 && grid[0].length === 1)) return;

    e.preventDefault();
    e.stopPropagation(); // don't trigger the BOQ import paste

    const clean = (v?: string) => formatDecimal(sanitizeDecimal((v ?? "").replace(/[^0-9.]/g, "")));
    const procurementEditableKeys = new Set(["materialCost", "laborCost", "consumableCost"]);
    let added = 0;
    let updated = 0;
    let ignored = 0;

    setBoqSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;

        const rows = s.rows.map((r) => ({ ...r }));
        // Not enough rows below the clicked one -> add empty rows
        while (!procurementOnly && rows.length < rowIdx + grid.length) {
          rows.push(newBoqRow());
          added++;
        }

        grid.forEach((cells, i) => {
          const target = rows[rowIdx + i];
          if (!target) return;
          cells.forEach((cell, j) => {
            const key = ENG_PASTE_COLS[startCol + j];
            if (!key) return;
            if (procurementOnly && !procurementEditableKeys.has(key)) {
              if (cell?.trim()) ignored++;
              return;
            }
            if (engineeringMode && !isEngineeringFullEditSection(s) && !["description", "qty", "unit"].includes(key)) return;
            target[key] = key === "description" || key === "unit" ? (cell ?? "").trim() : clean(cell);
            updated++;
          });
        });

        return { ...s, rows };
      })
    );

    if (procurementOnly) {
      const availableRows = Math.max(0, (boqSections.find((s) => s.id === sectionId)?.rows.length ?? 0) - rowIdx);
      if (updated > 0) toast.success(`Pasted Procurement values into ${Math.min(grid.length, availableRows)} item(s)`);
      if (ignored > 0) toast.warning("Engineering and auto-calculated columns were skipped");
      if (grid.length > availableRows) {
        toast.warning(`${grid.length - availableRows} extra pasted row(s) ignored (section has no more items)`);
      }
      return;
    }

    toast.success(`Pasted ${grid.length} item(s)${added ? ` (added ${added} new row${added > 1 ? "s" : ""})` : ""}`);
  };

  const buildProcurement = (): ProcurementData => {
    const rows: Record<string, ProcurementRow> = {};
    boqSections.forEach((s) =>
      s.rows.forEach((r) => {
        const p = procRows[r.id];
        if (procRowEntered(p, r)) rows[r.id] = { ...(p ?? { qty: "", cost: "" }) };
      })
    );
    return {
      rows,
      warrantyPct: procWarrantyPct,
      contingencyPct: procContingencyPct,
      markup: procMarkup,
      sayRoundTo: procSayRoundTo,
      sectionCustom: procSectionCustom,
      sectionMultiplier: procSectionMult,
      summary: computeProcurementSummary(
        boqSections, rows, procWarrantyPct, procContingencyPct, procMarkup, procSectionCustom, procSayRoundTo, workingDays, procSectionMult
      ),
    };
  };

  const captureCurrentBoq = (): BoqVersion => {
    const sections = boqSections.map((section) => ({
      ...section,
      rows: section.rows.map((row) => ({ ...row })),
    }));
    return {
      boqSections: sections,
      summary: computeSummary(sections, contingencyPct, unitCount, workingDays),
      procurement: buildProcurement(),
    };
  };

  const restoreBoqVersion = (version: BoqVersion, index: number) => {
    setActiveBoqIndex(index);
    setBoqSections(version.boqSections.map((section) => ({
      ...section,
      rows: section.rows.map((row) => ({ ...row })),
    })));
    setContingencyPct(String(version.summary.contingencyPct ?? DEFAULT_CONTINGENCY));
    setUnitCount(String(version.summary.unitCount ?? DEFAULT_UNIT_COUNT));
    setProcRows(version.procurement?.rows ?? {});
    setProcWarrantyPct(String(version.procurement?.warrantyPct ?? DEFAULT_WARRANTY));
    setProcContingencyPct(String(version.procurement?.contingencyPct ?? DEFAULT_PROC_CONTINGENCY));
    setProcMarkup(String(version.procurement?.markup ?? DEFAULT_MARKUP));
    const savedSayRoundTo = String(version.procurement?.sayRoundTo ?? DEFAULT_SAY_ROUND_TO);
    setProcSayRoundTo(
      SAY_ROUNDING_OPTIONS.some((option) => option.value === savedSayRoundTo)
        ? savedSayRoundTo
        : DEFAULT_SAY_ROUND_TO
    );
    setProcSectionCustom(version.procurement?.sectionCustom ?? {});
    setProcSectionMult(version.procurement?.sectionMultiplier ?? {});
    setCollapsedIds([]);
  };

  const buildBoqVersions = (currentProcurement = buildProcurement()): BoqVersion[] => {
    const current = captureCurrentBoq();
    current.procurement = currentProcurement;
    const versions = [...boqs];
    while (versions.length <= activeBoqIndex) versions.push(current);
    versions[activeBoqIndex] = current;

    return versions.map((version) => {
      const sections = version.boqSections
        .map((section) => ({
          ...section,
          rows: section.rows
            .filter((row) => !isRowEmpty(row))
            .map((row) => finalizeRow(row, workingDays, isToolsSection(section), isRentalSection(section))),
        }))
        .filter((section) => section.title.trim() || section.rows.length > 0);
      return {
        ...version,
        boqSections: sections,
        summary: computeSummary(
          sections,
          String(version.summary.contingencyPct ?? DEFAULT_CONTINGENCY),
          String(version.summary.unitCount ?? DEFAULT_UNIT_COUNT),
          workingDays
        ),
      };
    });
  };

  const switchBoqVersion = (index: number) => {
    if (index < 0 || index >= boqs.length || index === activeBoqIndex) return;
    const versions = [...boqs];
    versions[activeBoqIndex] = captureCurrentBoq();
    const target = versions[index];
    setBoqs(versions);
    restoreBoqVersion(target, index);
  };

  const makeEmptyBoqVersion = (): BoqVersion => {
    const sections = [newBoqSection()];
    return {
      boqSections: sections,
      summary: computeSummary(sections, DEFAULT_CONTINGENCY, DEFAULT_UNIT_COUNT, workingDays),
    };
  };

  const applyBoqCount = (value = requestedBoqCount) => {
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1) {
      toast.error("Enter a valid BOQ count of at least 1.");
      setRequestedBoqCount(String(Math.max(boqs.length, 1)));
      return;
    }

    const versions = boqs.length ? [...boqs] : [makeEmptyBoqVersion()];
    versions[activeBoqIndex] = captureCurrentBoq();
    const nextVersions = Array.from({ length: count }, (_, index) => versions[index] ?? makeEmptyBoqVersion());
    setBoqs(nextVersions);
    setRequestedBoqCount(String(count));

    if (activeBoqIndex >= count) {
      restoreBoqVersion(nextVersions[count - 1], count - 1);
    }
    if (count < versions.length) {
      toast.warning(`Removed BOQs after ${count}, including their saved costing.`);
    }
  };

  const scheduleBoqCountApply = (value: string) => {
    if (boqCountApplyTimer.current) clearTimeout(boqCountApplyTimer.current);
    if (!value.trim() || !Number.isInteger(Number(value)) || Number(value) < 1) return;
    boqCountApplyTimer.current = setTimeout(() => {
      applyBoqCount(value);
      boqCountApplyTimer.current = null;
    }, 300);
  };

  const handleSaveProcurement = async () => {
    setIsSavingProc(true);
    try {
      const procurement = buildProcurement();
      await onSaveProcurement?.(procurement, boqSections, summary, buildBoqVersions(procurement));
      UNSAVED_CACHE.delete(cacheKey);
      toast.success("Procurement data saved");
    } catch (err) {
      console.error("PROCUREMENT_SAVE_ERROR", err);
      toast.error("Failed to save procurement data");
    } finally {
      setIsSavingProc(false);
    }
  };

  // Plain functions (NOT components) so the inputs keep focus while typing
  const procLine = (label: React.ReactNode, value: React.ReactNode, strong = false) => (
    <div className="grid grid-cols-[1fr_200px] border-b border-amber-300 last:border-b-0 bg-white text-slate-900">
      <div className="px-3 py-2 text-right text-[11px] font-black uppercase tracking-wide flex items-center justify-end gap-2">
        {label}
      </div>
      <div
        className={`px-3 py-2 text-right tabular-nums text-[13px] border-l border-amber-300 flex items-center justify-end ${
          strong ? "font-black" : "font-medium"
        }`}
      >
        {value}
      </div>
    </div>
  );

  // Procurement-editable % / multiplier input -> AMBER
  const procPctInput = (value: string, setter: (v: string) => void, ariaLabel: string, suffix: string) => (
    <span className="inline-flex items-center gap-1 normal-case">
      <Input
        value={value}
        inputMode="decimal"
        onChange={(e) => setter(sanitizeDecimal(e.target.value))}
        disabled={!canEditProc}
        aria-label={ariaLabel}
        className={`h-7 w-16 rounded-md text-[12px] font-bold text-right tabular-nums ${PROC_TONE}`}
      />
      <span className="text-[11px] font-bold">{suffix}</span>
    </span>
  );

  // Clear only resets the fields that are still editable (auto-populated ones stay) + the BOQ
  const handleClear = () => {
    setValues((prev) => {
      const next = { ...prev };
      FIELDS.forEach((f) => {
        if (!lockedKeys.includes(f.key)) next[f.key] = "";
      });
      return next;
    });
    const emptyVersion = makeEmptyBoqVersion();
    setBoqSections(emptyVersion.boqSections);
    setBoqs([emptyVersion]);
    setRequestedBoqCount("1");
    setActiveBoqIndex(0);
    setCollapsedIds([]);
    setContingencyPct(DEFAULT_CONTINGENCY);
    setUnitCount(DEFAULT_UNIT_COUNT);
    setProcSectionMult({});
  };

  const handleSubmit = async (advance = false) => {
    const missing = FIELDS.filter((f) => f.required && !values[f.key]?.trim());
    if (missing.length > 0) {
      return toast.error(`Please fill in: ${missing.map((f) => f.label).join(", ")}`);
    }

    // Drop completely empty rows, and sections that have neither a title nor rows.
    // Computed totals are frozen into each row so they are saved with the form.
    const cleanedBoq = boqSections
      .map((s) => ({
        ...s,
        rows: s.rows
          .filter((r) => !isRowEmpty(r))
          .map((r) => finalizeRow(r, workingDays, isToolsSection(s), isRentalSection(s))),
      }))
      .filter((s) => s.title.trim() || s.rows.length > 0);

    const finalSummary = computeSummary(cleanedBoq, contingencyPct, unitCount, workingDays);
    const finalBoqs = buildBoqVersions();
    finalBoqs[activeBoqIndex] = {
      ...finalBoqs[activeBoqIndex],
      boqSections: cleanedBoq,
      summary: finalSummary,
    };

    setIsSubmitting(true);
    try {
      const savedDraft = await onSubmit?.(
        values,
        cleanedBoq,
        finalSummary,
        canEditProc ? buildProcurement() : undefined,
        finalBoqs
      );
      if (advance && advanceAction) {
        const advanced = await onAdvance?.(advanceAction.status, savedDraft ?? draft, approvalRemarks);
        if (advanced === false) return;
        toast.success("Fill up form saved and request updated");
      } else {
        toast.success("Fill up form saved as draft");
      }
      UNSAVED_CACHE.delete(cacheKey);
      onOpenChange(false);
    } catch (err) {
      console.error("FILL_UP_FORM_ERROR", err);
      toast.error("Failed to save fill up form");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdvanceReadOnly = async () => {
    if (!advanceAction || !onAdvance) return;
    setIsSubmitting(true);
    try {
      let advanceDraft = draft;
      if (
        advanceAction.status === "JR FORM APPROVED BY PROCUREMENT"
        && canEditProc
        && onSaveProcurement
      ) {
        setIsSavingProc(true);
        advanceDraft = await onSaveProcurement(
          buildProcurement(),
          boqSections,
          summary,
          buildBoqVersions(),
        ) ?? advanceDraft;
      }

      const advanced = await onAdvance(advanceAction.status, advanceDraft, approvalRemarks);
      if (advanced === false) return;
      UNSAVED_CACHE.delete(cacheKey);
      onOpenChange(false);
    } finally {
      setIsSavingProc(false);
      setIsSubmitting(false);
    }
  };

  const openAdvanceConfirmation = () => {
    if (!advanceAction) return;
    setApprovalRemarks(remarks);
    setPendingConfirmation("advance");
  };

  const confirmPendingAction = async () => {
    const action = pendingConfirmation;
    if (action === "advance" && !approvalRemarks.trim()) return;
    setPendingConfirmation(null);
    if (action === "save") {
      await handleSubmit();
    } else if (action === "advance") {
      if (readOnly) await handleAdvanceReadOnly();
      else await handleSubmit(true);
    }
  };

  const renderAdvanceControl = () => {
    if (!advanceAction) return null;
    if (advanceActions.length === 1) {
      return (
        <Button
          type="button"
          onClick={openAdvanceConfirmation}
          disabled={isSubmitting || isLoadingJob || advanceAction.disabled}
          className="h-10 px-5 bg-[#00C853] hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider"
        >
          {isSubmitting ? "Saving..." : advanceAction.label}
        </Button>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Select
          value={advanceAction.status}
          onValueChange={setSelectedAdvanceStatus}
          disabled={isSubmitting || isLoadingJob}
        >
          <SelectTrigger className="h-10 w-[220px] max-w-[40vw] text-[10px] font-black uppercase tracking-wider">
            <SelectValue placeholder="Choose an action" />
          </SelectTrigger>
          <SelectContent>
            {advanceActions.map((action) => (
              <SelectItem key={action.status} value={action.status}>
                {action.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          onClick={openAdvanceConfirmation}
          disabled={isSubmitting || isLoadingJob || advanceAction.disabled}
          className="h-10 px-5 bg-[#00C853] hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider"
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </Button>
      </div>
    );
  };

  /* Input classes (see FIELD COLOR CODE at the top of the file):
       engNumClass  = Engineering-editable  (green)
       procNumClass = Procurement-editable  (amber)
       autoNumClass = auto-computed / read-only / not applicable (gray) */
  const autoInputClass = autoNumClass;
  const procInputClass = procNumClass;
  const procAutoClass = autoNumClass;

  const customInputClass =
    "h-9 rounded-lg text-[12px] font-bold text-right tabular-nums bg-amber-50 border-amber-300 text-amber-900";
  const customAutoClass =
    "h-9 rounded-lg text-[12px] font-bold text-right tabular-nums bg-amber-50 text-amber-900 border-amber-300 disabled:opacity-100";

  // Custom input with up/down arrows
  const NumberInputWithArrows = ({
    value,
    onChange,
    onIncrement,
    onDecrement,
    disabled,
    className,
    "aria-label": ariaLabel,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onIncrement: () => void;
    onDecrement: () => void;
    disabled?: boolean;
    className?: string;
    "aria-label"?: string;
  }) => (
    <div className="flex items-center">
      <Input
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
        className={className}
      />
      {!disabled && (
        <div className="flex flex-col ml-1">
          <button
            type="button"
            onClick={onIncrement}
            disabled={disabled}
            className="h-3.5 w-4 flex items-center justify-center hover:bg-slate-200 rounded-t text-slate-500 hover:text-slate-900 transition-colors"
            aria-label="Increase"
          >
            <ChevronUp size={10} strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={onDecrement}
            disabled={disabled}
            className="h-3.5 w-4 flex items-center justify-center hover:bg-slate-200 rounded-b text-slate-500 hover:text-slate-900 transition-colors"
            aria-label="Decrease"
          >
            <ChevronDown size={10} strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  );

  // In view mode keep disabled inputs fully readable (no faded look)
  const boqWrapperClass = readOnly
    ? "md:col-span-3 space-y-3 [&_input:disabled]:opacity-100 [&_textarea:disabled]:opacity-100 [&_input:disabled]:cursor-default [&_textarea:disabled]:cursor-default"
    : "md:col-span-3 space-y-3";

  // Summary table row (matches the Excel layout)
  const SummaryRow = ({
    label,
    children,
    variant = "plain",
  }: {
    label: React.ReactNode;
    children: React.ReactNode;
    variant?: "plain" | "strong" | "red";
  }) => (
    <div
      className={`grid grid-cols-[1fr_200px] border-b border-slate-300 last:border-b-0 ${
        variant === "red" ? "bg-red-600 text-white" : "bg-white text-slate-900"
      }`}
    >
      <div className="px-3 py-2 text-right text-[11px] font-black uppercase tracking-wide flex items-center justify-end gap-2">
        {label}
      </div>
      <div
        className={`px-3 py-2 text-right tabular-nums text-[13px] border-l border-slate-300 flex items-center justify-end ${
          variant === "plain" ? "font-medium" : "font-black"
        } ${variant === "red" ? "bg-white text-slate-900" : ""}`}
      >
        {children}
      </div>
    </div>
  );

  const renderField = (f: FieldDef) => {
    const isLocked = !readOnly && lockedKeys.includes(f.key);
    const isWorkingDays = f.key === "totalWorkingDays";
    const isDisabled = locked || (isLocked && !isWorkingDays);
    // Auto-populated from the job request (or view-only) -> gray. Typed by Engineering -> green.
    const fieldTone = (isLocked && !isWorkingDays) || readOnly ? AUTO_TONE : ENG_TONE;

    return (
      <div
        key={f.key}
        className={`space-y-1.5 ${SPAN_CLASS[f.span ?? 1]}`}
      >
        <Label
          htmlFor={`fillup-${f.key}`}
          className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400"
        >
          {f.label}
          {f.required && !readOnly && <span className="text-red-500">*</span>}
          {isLocked && !isWorkingDays && <Lock size={9} className="text-slate-300" />}
        </Label>
        {f.multiline ? (
          <Textarea
            id={`fillup-${f.key}`}
            value={values[f.key] ?? ""}
            onChange={(e) => setField(f.key, e.target.value)}
            placeholder={f.placeholder}
            disabled={isDisabled}
            className={`min-h-[120px] rounded-xl text-[12px] font-medium ${fieldTone}`}
          />
        ) : (
          <Input
            id={`fillup-${f.key}`}
            value={values[f.key] ?? ""}
            onChange={(e) => setField(f.key, isWorkingDays ? e.target.value.replace(/\D/g, "") : e.target.value)}
            placeholder={f.placeholder}
            disabled={isDisabled}
            inputMode={isWorkingDays ? "numeric" : undefined}
            className={`h-10 rounded-xl text-[12px] font-medium ${
              isWorkingDays
                ? "!border-emerald-300 !bg-emerald-50 !text-emerald-700 focus-visible:!ring-emerald-500 disabled:opacity-100 disabled:cursor-default"
                : fieldTone
            }`}
          />
        )}
      </div>
    );
  };
  const renderFields = (keys: string[]) =>
    FIELDS.filter((field) => keys.includes(field.key)).map(renderField);

  const contactFields = [
    { key: "person", label: "Contact person", value: contactDetails?.contactPerson },
    { key: "designation", label: "Designation", value: contactDetails?.designation },
    { key: "email", label: "Email address", value: contactDetails?.email },
    { key: "number", label: "Contact number", value: contactDetails?.contactNumber },
  ].map((field) => ({
    ...field,
    values: field.value?.split(",").map((value) => value.trim()) ?? [],
  }));
  const contactCount = Math.max(0, ...contactFields.map((field) => field.values.length));
  const hasContactDetails = contactFields.some((field) =>
    field.values.some((value) => value.length > 0),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        nonModalOverlay
        onInteractOutside={(event) => {
          if (event.composedPath().some(
            (target) => target instanceof Element && target.matches("[data-job-request-chat]")
          )) {
            event.preventDefault();
          }
        }}
        className="w-[95vw] !max-w-[1400px] max-h-[88vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col"
      >
        <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3 pr-6">
            <div className="size-9 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              {isLoadingJob ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            </div>
            <div>
              <DialogTitle className="text-[14px] font-black uppercase tracking-tight text-slate-900">
                {readOnly ? "Fill Up Form Draft" : "Fill Up Form"}
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {readOnly
                  ? `Saved draft${viewDraft?.createdByName ? ` by ${viewDraft.createdByName}` : ""} - form view only`
                  : isLoadingJob
                  ? "Loading job request..."
                  : editDraft
                  ? "Loaded from saved draft"
                  : "Auto-populated from job request"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-5 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
            {renderFields(["jrNumber", "projectTitle", "projectName"])}
            {renderFields(["dateRequested", "clientName", "agentName"])}
            {hasContactDetails && (
              <div className="grid gap-3 sm:grid-cols-2 md:col-span-3">
                {Array.from({ length: contactCount }, (_, index) => (
                  <section
                    key={index}
                    className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Contact {index + 1}
                    </p>
                    <dl className="grid gap-2">
                      {contactFields.map((field) => (
                        <div key={field.key} className="min-w-0">
                          <dt className="text-[10px] font-semibold text-slate-500">{field.label}</dt>
                          <dd className="mt-0.5 break-words text-xs text-slate-800">
                            {field.values[index] || "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            )}
            {renderFields(["scopeOfWork"])}
            {renderFields(["address"])}

            {(preferredDateFinish?.from || preferredDateFinish?.to) && (
              <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:col-span-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Preferred Date Finish</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-semibold text-slate-500">From</Label>
                    <Input value={formatLocalCalendarDate(preferredDateFinish.from)} readOnly className="h-10 rounded-lg bg-white text-xs font-semibold read-only:text-slate-700" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-semibold text-slate-500">To</Label>
                    <Input value={formatLocalCalendarDate(preferredDateFinish.to)} readOnly className="h-10 rounded-lg bg-white text-xs font-semibold read-only:text-slate-700" />
                  </div>
                </div>
              </section>
            )}

            {pdDatabaseItems.length > 0 && (
              <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 md:col-span-3">
                <div className="flex items-center gap-2">
                  <ImageIcon size={14} className="text-blue-600" />
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">PD Database Items</Label>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {pdDatabaseItems.map((item, index) => (
                    <div key={`${item.productId}-${index}`} className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 p-2.5">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.productName} width={56} height={56} unoptimized className="size-14 shrink-0 rounded-md border object-cover" />
                      ) : (
                        <div className="grid size-14 shrink-0 place-items-center rounded-md border bg-slate-50 text-[8px] font-bold text-slate-400">No image</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-bold text-slate-800">{item.productName}</p>
                        <p className="text-[9px] text-blue-700">Item code: {item.itemCode || "—"}</p>
                        <p className="text-[9px] font-semibold text-slate-600">Quantity: {item.quantity}</p>
                        {item.description && <p className="mt-1 whitespace-pre-wrap break-words text-[9px] text-slate-600">{item.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── BILL OF QUANTITIES ── */}
            <div
              ref={boqWrapperRef}
              className={boqWrapperClass}
              data-boq-area="true"
              onDragOver={(e) => {
                if (!locked) {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleFileDrop}
              onPaste={handlePaste}
              style={{
                outline: isDraggingOver ? "2px solid #3b82f6" : undefined,
                outlineOffset: isDraggingOver ? "2px" : undefined,
              }}
            >
              {/* Sticky toolbar: stays visible while scrolling through many sections */}
              <div className="sticky top-0 z-20 -mx-6 px-6 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400">
                    Bill of Quantities
                  </Label>
                  <span className="text-[10px] font-bold text-slate-400">
                    {boqSections.length} {boqSections.length === 1 ? "section" : "sections"}
                  </span>
                  {/* Color legend: who edits what */}
                  <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-300">
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                      <span className="size-3 rounded-sm border border-emerald-300 bg-emerald-50" />
                      Engineering
                    </span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-700">
                      <span className="size-3 rounded-sm border border-amber-300 bg-amber-50" />
                      Procurement
                    </span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
                      <span className="size-3 rounded-sm border border-slate-200 bg-slate-100" />
                      Auto / Read-only
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={collapseAll}
                    className="h-8 px-3 text-[10px] font-black uppercase tracking-wider text-slate-500"
                  >
                    Collapse all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={expandAll}
                    className="h-8 px-3 text-[10px] font-black uppercase tracking-wider text-slate-500"
                  >
                    Expand all
                  </Button>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleFilePicker}
                      disabled={locked}
                      className="h-8 px-3 gap-1.5 text-[10px] font-black uppercase tracking-wider border-slate-200"
                      title="Import from Excel/CSV file or paste from clipboard"
                    >
                      <Upload size={12} />
                      Import Excel
                    </Button>
                  )}
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addSection}
                      disabled={locked}
                      className="h-8 px-3 gap-1.5 text-[10px] font-black uppercase tracking-wider border-slate-200"
                    >
                      <Plus size={12} />
                      Add Section
                    </Button>
                  )}
                </div>
              </div>

              {readOnly && boqSections.length === 0 && (
                <div className="border border-dashed border-slate-200 rounded-xl py-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">
                  No bill of quantities in this draft
                </div>
              )}

              {boqSections.map((section, sIdx) => {
                const isTools = isToolsSection(section);
                const isRental = isRentalSection(section);
                const procSticky = isRental ? PROC_STICKY_RENTAL : PROC_STICKY;
                const sectionMinW = showProcurement
              ? isTools ? "min-w-[2592px]" : isRental ? "min-w-[2310px]" : "min-w-[2042px]"
              : isTools ? "min-w-[2050px]" : isRental ? "min-w-[1700px]" : "min-w-[1500px]";
                const sub = sectionSubtotals(section, workingDays);
                const sectionGrid = showProcurement
                  ? (isTools ? BOQ_GRID_PROC_TOOLS : isRental ? BOQ_GRID_PROC_RENTAL : BOQ_GRID_PROC)
                  : (isTools ? BOQ_GRID_TOOLS : isRental ? BOQ_GRID_RENTAL : BOQ_GRID);
                const isCollapsed = collapsedIds.includes(section.id);
                const procSub = sectionProcTotal(section, procRows, procSectionCustom, workingDays, procSectionMult);

                                const titleLocked = !!section.titleLocked && isStandardTitle(section.title);
                const titleKind = isStandardTitle(section.title)
                  ? "standard"
                  : section.title.trim()
                  ? "custom"
                  : "empty";
                const barClass =
                  titleKind === "standard"
                    ? "bg-emerald-100/70 border-b border-emerald-200/60"
                    : titleKind === "custom"
                    ? "bg-amber-100/70 border-b border-amber-200/60"
                    : "bg-rose-100/70 border-b border-rose-200/60";
                const numClass =
                  titleKind === "standard" ? "text-emerald-700" : titleKind === "custom" ? "text-amber-700" : "text-rose-700";

                // Money fields (Material / Labor / Consumable cost, Mobilization fee) belong to
                // Engineering only in the full-edit sections; everywhere else Procurement owns them.
                const moneyOwner: FieldOwner = isEngineeringFullEditSection(section) ? "eng" : "proc";

                return (
                  <div
                    key={section.id}
                    id={`boq-section-${section.id}`}
                    className="border border-slate-200 rounded-xl overflow-clip scroll-mt-28"
                  >
                    {/* Section title bar: roman numeral + typed title */}
                    <div className="sticky top-[49px] z-[15] bg-white">
                    <div className={`flex items-center gap-3 px-3 py-2 ${barClass}`}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleCollapse(section.id)}
                        aria-label={isCollapsed ? `Expand section ${toRoman(sIdx + 1)}` : `Collapse section ${toRoman(sIdx + 1)}`}
                        aria-expanded={!isCollapsed}
                        className="size-8 shrink-0 text-rose-500 hover:bg-white/70"
                      >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </Button>
                      <span className={`shrink-0 min-w-[32px] text-[13px] font-black ${numClass}`}>
                        {toRoman(sIdx + 1)}.
                      </span>
                      <select
                        value={titleLocked ? section.title : ""}
                        onChange={(e) => pickStandardTitle(section.id, e.target.value)}
                        disabled={locked}
                        aria-label={`Section ${toRoman(sIdx + 1)} standard title`}
                        title="Pick a standard title (locks the field) or leave on Custom to type your own"
                        className="h-9 w-[210px] shrink-0 rounded-lg border border-input bg-white px-2 text-[11px] font-bold uppercase disabled:opacity-100 disabled:cursor-default"
                      >
                        <option value="">Custom (type your own)</option>
                        {STANDARD_SECTION_TITLES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <Input
                        id={`boq-title-${section.id}`}
                        value={section.title}
                        onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                        placeholder="Custom section title (or pick a standard one on the left)"
                        disabled={locked || titleLocked}
                        aria-label={`Section ${toRoman(sIdx + 1)} title`}
                        className={`h-9 flex-1 rounded-lg text-[12px] font-bold uppercase disabled:opacity-100 disabled:cursor-default ${
                          titleKind === "standard"
                            ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                            : titleKind === "custom"
                            ? "bg-amber-50 border-amber-300 text-amber-900"
                            : "bg-white"
                        }`}
                      />
                      {titleKind !== "empty" && (
                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-wider ${
                            titleKind === "standard" ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                          }`}
                        >
                          {titleKind === "standard" ? "Standard" : "Custom"}
                        </span>
                      )}
                      {isCollapsed && (
                        <span className="shrink-0 text-[10px] font-bold text-rose-700/80 tabular-nums">
                          {section.rows.filter((r) => !isRowEmpty(r)).length} items · {peso(sub.total)}
                        </span>
                      )}
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSection(section.id)}
                          aria-label={`Remove section ${toRoman(sIdx + 1)}`}
                          className="size-9 shrink-0 text-rose-400 hover:text-red-600 hover:bg-white/70"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                    </div>

                    {!isCollapsed && (
                      <>
                        {/* Sticky column header (outside the scroller, synced with horizontal scroll) */}
                        <div
                          id={`boq-hdr-${section.id}`}
                          className="sticky top-[101px] z-[14] overflow-hidden bg-slate-50 border-b border-slate-200"
                        >
                        <div className={sectionMinW}>
                            <div className={`${sectionGrid} px-3 py-2 items-end`}>
                              {showProcurement ? (
                                <div data-hdr-sticky className={`${procSticky} -my-2 py-2 items-end bg-slate-50`}>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Item No.</span>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 text-right">Procurement Qty</span>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 text-right">Procurement Acquired Cost</span>
                                  {isRental && (
                                    <span className="flex items-end justify-end gap-1 text-[9px] font-black uppercase tracking-widest text-amber-600 text-right">
                                      Mob/Demob
                                      <InfoTip label="About Mob/Demob">
                                        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-sky-300">Heavy Equipment Rental (Procurement)</p>
                                        <p>(Qty × Acquired Cost + Mob/Demob) × 1.12</p>
                                        <p className="mt-1 text-sky-200">Mob/Demob is a flat amount added once per item (not multiplied by Qty). The 1.12 VAT applies to the whole amount, including Mob/Demob.</p>
                                      </InfoTip>
                                    </span>
                                  )}
                                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 text-right">Procurement Total Amount</span>
                                </div>
                              ) : (
                                <span
                                  data-hdr-sticky
                                  className="relative z-[3] -ml-3 -mr-2 -my-2 py-2 pl-3 pr-2 self-stretch flex items-end bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-400"
                                >
                                  Item No.
                                </span>
                              )}
                              <span
                                data-hdr-sticky
                                className={`text-[9px] font-black uppercase tracking-widest text-slate-400 ${
                                  showProcurement
                                    ? "relative z-[4] bg-slate-50 shadow-[4px_0_6px_-4px_rgba(0,0,0,0.15)]"
                                    : "relative z-[3] bg-slate-50"
                                }`}
                              >
                                Description
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Quantity</span>
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Unit</span>
                              {isTools && (
                                <>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tool Type</span>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">How Many Usage</span>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Depreciation Years</span>
                                  <span className="flex items-center justify-end gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    Divisor
                                    <InfoTip label="About the divisor">
                                      <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-sky-300">Power Tools / Safety Equipment</p>
                                      <p>(Cost ÷ (Depreciation Years × Divisor)) × Working Days ({workingDays || 0}) × Qty</p>
                                      <p className="mt-1 text-sky-200">Default divisor is 100. Leave it as is, or change it per item.</p>
                                      <p className="mt-2 mb-1 text-[10px] font-black uppercase tracking-wider text-sky-300">Hand Tools</p>
                                      <p>(Qty × Cost) ÷ Usage</p>
                                    </InfoTip>
                                  </span>
                                </>
                              )}
                              {isRental && (
                                <span className="flex items-center justify-end gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                  + Mobilization Fee
                                  <InfoTip label="About the mobilization fee">
                                    <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-sky-300">Heavy Equipment Rental</p>
                                    <p>(Qty × Material Cost) + Mobilization Fee</p>
                                    <p className="mt-1 text-sky-200">Use the Mobilization Fee for flat mobilization/demobilization charges. It is added once per item, not multiplied by Qty.</p>
                                  </InfoTip>
                                </span>
                              )}
                              {MONEY_COLUMNS.map((c) => (
                                <span key={c.key} className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">
                                  {c.label}
                                </span>
                              ))}
                              <span />
                            </div>
                          </div>
                        </div>
                        <div
                          className="overflow-x-auto"
                          onScroll={(e) => {
                            const x = e.currentTarget.scrollLeft;
                            const hdr = document.getElementById(`boq-hdr-${section.id}`);
                            const inner = hdr?.firstElementChild as HTMLElement | null;
                            if (inner) inner.style.transform = `translateX(${-x}px)`;
                            hdr?.querySelectorAll<HTMLElement>("[data-hdr-sticky]").forEach((el) => {
                              el.style.transform = `translateX(${x}px)`;
                            });
                          }}
                        >
                          <div className={sectionMinW}>

                            {/* Rows */}
                            <div className="divide-y divide-slate-100">
                              {section.rows.map((row, rIdx) => {
                                const totals = rowTotals(row, workingDays, isTools, isRental);
                                const procurementRow = procRows[row.id];
                                const procTotal = procRowTotal(procurementRow, row, workingDays, isTools, isRental);
                                const engineeringFieldLocked = locked || (
                                  engineeringMode &&
                                  !isEngineeringFullEditSection(section) &&
                                  !isTools
                                );
                                const isFieldLocked = (owner: FieldOwner) =>
                                  owner === "eng" ? engineeringFieldLocked : !canEditProc;

                                // Tool fields that don't apply to the chosen tool type -> gray
                                const usageNA = row.toolType !== "hand";
                                const depNA = row.toolType !== "power" && row.toolType !== "safety";

                                return (
                                  <div
                                    key={row.id}
                                    onClick={() => setActiveBoqRowKey(`${section.id}:${row.id}`)}
                                    onFocusCapture={() => setActiveBoqRowKey(`${section.id}:${row.id}`)}
                                    className={`${sectionGrid} px-3 py-2 transition-shadow ${
                                      activeBoqRowKey === `${section.id}:${row.id}`
                                        ? "relative rounded-lg bg-cyan-50 ring-2 ring-inset ring-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.65)]"
                                        : ""
                                    }`}
                                  >
                                    <div
                                      className={
                                        showProcurement
                                          ? `${procSticky} -my-2 py-2 items-start ${
                                              activeBoqRowKey === `${section.id}:${row.id}`
                                                ? "bg-cyan-50 ring-2 ring-inset ring-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.65)]"
                                                : "bg-white"
                                            }`
                                          : "contents"
                                      }
                                    >
                                    <div
                                      className={`flex flex-col items-start gap-1 pt-2 ${
                                        showProcurement ? "" : "sticky left-0 z-[5] -ml-3 -mr-2 -my-2 py-2 pl-3 pr-2 self-stretch bg-white"
                                      }`}
                                    >
                                      <span className="text-[11px] font-black text-slate-500">{rIdx + 1}</span>
                                      {!readOnly && (
                                        <div className="flex items-center gap-1">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => insertRowAfter(section.id, row.id)}
                                            disabled={engineeringFieldLocked}
                                            title="Add item below"
                                            aria-label={`Add item below item ${rIdx + 1}`}
                                            className="size-6 rounded-md border-slate-200 text-slate-400 hover:text-slate-900"
                                          >
                                            <Plus size={12} />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => removeRow(section.id, row.id)}
                                            disabled={engineeringFieldLocked}
                                            title="Remove this item"
                                            aria-label={`Remove item ${rIdx + 1}`}
                                            className="size-6 rounded-md border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200"
                                          >
                                            <Minus size={12} />
                                          </Button>
                                        </div>
                                      )}
                                    </div>

                                    {/* Procurement columns (AMBER = Procurement-editable, GRAY = auto) */}
                                    {showProcurement && (
                                      <>
                                        <Input
                                          value={procRows[row.id]?.qty ?? ""}
                                          inputMode="decimal"
                                          onChange={(e) => updateProc(row.id, "qty", sanitizeDecimal(e.target.value))}
                                          onBlur={(e) => updateProc(row.id, "qty", formatDecimal(e.target.value))}
                                          onPaste={(e) => handleProcPaste(e, section.id, rIdx, 0)}
                                          placeholder="0.00"
                                          disabled={!canEditProc}
                                          aria-label={`Procurement quantity item ${rIdx + 1}`}
                                          className={procInputClass}
                                        />
                                        <Input
                                          value={procRows[row.id]?.cost ?? ""}
                                          inputMode="decimal"
                                          onChange={(e) => updateProc(row.id, "cost", sanitizeDecimal(e.target.value))}
                                          onBlur={(e) => updateProc(row.id, "cost", formatDecimal(e.target.value))}
                                          onPaste={(e) => handleProcPaste(e, section.id, rIdx, 1)}
                                          placeholder="0.00"
                                          disabled={!canEditProc}
                                          aria-label={`Procurement acquired cost item ${rIdx + 1}`}
                                          className={procInputClass}
                                        />
                                        {isRental && (
                                          <Input
                                            value={procRows[row.id]?.mobDemob ?? ""}
                                            inputMode="decimal"
                                            onChange={(e) => updateProc(row.id, "mobDemob", sanitizeDecimal(e.target.value))}
                                            onBlur={(e) => updateProc(row.id, "mobDemob", formatDecimal(e.target.value))}
                                            placeholder="0.00"
                                            disabled={!canEditProc}
                                            aria-label={`Mob/Demob item ${rIdx + 1}`}
                                            className={procInputClass}
                                          />
                                        )}
                                        <div className="flex flex-col gap-1">
                                          <Input
                                            value={num2(procTotal)}
                                            disabled
                                            title={
                                              isTools && usesEngineeringTotalForProcurement(row) && procurementRow?.useEngineeringTotal !== false
                                                ? "Engineering Total Material Cost"
                                                : isRental
                                                ? "(Qty × Cost + Mob/Demob) × 1.12"
                                                : "Auto-computed (read-only)"
                                            }
                                            aria-label={`Procurement total amount item ${rIdx + 1}`}
                                            className={procAutoClass}
                                          />
                                          {isTools && usesEngineeringTotalForProcurement(row) && (
                                            <label className="flex items-start gap-1 text-[8px] font-semibold leading-tight text-slate-600">
                                              <input
                                                type="checkbox"
                                                checked={procurementRow?.useEngineeringTotal !== false}
                                                onChange={(e) =>
                                                  setProcRows((prev) => ({
                                                    ...prev,
                                                    [row.id]: {
                                                      ...(prev[row.id] ?? { qty: "", cost: "" }),
                                                      useEngineeringTotal: e.target.checked,
                                                    },
                                                  }))
                                                }
                                                disabled={!canEditProc}
                                                aria-label={`Use Engineering total material cost for item ${rIdx + 1}`}
                                                className="mt-0.5 size-3 shrink-0 accent-amber-500"
                                              />
                                              <span>Use Engineering total material cost</span>
                                            </label>
                                          )}
                                        </div>
                                      </>
                                    )}
                                    </div>   {/* ← closes the sticky wrapper */}

                                    {/* Description (Engineering-editable -> GREEN) */}
                                    <Textarea
                                      value={row.description}
                                      onChange={(e) => updateRow(section.id, row.id, "description", e.target.value)}
                                      placeholder="Item description (you can use multiple lines)"
                                      rows={2}
                                      disabled={locked}
                                      onPaste={(e) => handleBoqCellPaste(e, section.id, rIdx, ENG_COL_INDEX.description)}
                                      aria-label={`Description item ${rIdx + 1}`}
                                      className={`min-h-[56px] rounded-lg text-[12px] font-medium ${ENG_TONE} ${
                                        showProcurement
                                          ? "sticky z-[6] shadow-[4px_0_6px_-4px_rgba(0,0,0,0.15)]"
                                          : "sticky left-[80px] z-[5] shadow-[4px_0_6px_-4px_rgba(0,0,0,0.15)]"
                                      }`}
                                      style={{ left: showProcurement ? (isRental ? 609 : 481) : undefined }}
                                    />

                                    {/* Quantity (Engineering-editable -> GREEN) */}
                                    <Input
                                      value={row.qty}
                                      inputMode="decimal"
                                      onChange={(e) => updateRow(section.id, row.id, "qty", sanitizeDecimal(e.target.value))}
                                      onBlur={() => updateRow(section.id, row.id, "qty", formatDecimal(row.qty))}
                                      placeholder="0.00"
                                      disabled={locked}
                                      onPaste={(e) => handleBoqCellPaste(e, section.id, rIdx, ENG_COL_INDEX.qty)}
                                      aria-label={`Quantity item ${rIdx + 1}`}
                                      className={ownerNumClass("eng")}
                                    />

                                    {/* Unit (Engineering-editable -> GREEN) */}
                                    <Input
                                      value={row.unit}
                                      onChange={(e) => updateRow(section.id, row.id, "unit", e.target.value)}
                                      placeholder="pcs"
                                      disabled={locked}
                                      onPaste={(e) => handleBoqCellPaste(e, section.id, rIdx, ENG_COL_INDEX.unit)}
                                      aria-label={`Unit item ${rIdx + 1}`}
                                      className={`h-9 rounded-lg text-[12px] font-medium ${ENG_TONE}`}
                                    />

                                     {/* TOOLS only: Tool Type + exclusive Usage / Depreciation Years */}
                                    {isTools && (
                                      <>
                                        {/* Tool type (Engineering-editable -> GREEN) */}
                                        <select
                                          value={row.toolType ?? ""}
                                          onChange={(e) =>
                                            patchRow(section.id, row.id, (r) => ({
                                              ...r,
                                              toolType: e.target.value,
                                              toolUsage: "",
                                              toolDepYears: "",
                                              toolDepFactor: "",
                                            }))
                                          }
                                          disabled={engineeringFieldLocked}
                                          aria-label={`Tool type item ${rIdx + 1}`}
                                          className="h-9 w-full rounded-lg border border-emerald-300 bg-emerald-50 px-2 text-[11px] font-medium text-emerald-900 disabled:opacity-100 disabled:cursor-default"
                                        >
                                          <option value="">Select type</option>
                                          {TOOL_TYPES.map((t) => (
                                            <option key={t.value} value={t.value}>
                                              {t.label}
                                            </option>
                                          ))}
                                        </select>
                                        {/* How many usage (Engineering, hand tools only) */}
                                        <Input
                                          value={row.toolUsage ?? ""}
                                          inputMode="decimal"
                                          onChange={(e) => updateRow(section.id, row.id, "toolUsage", sanitizeDecimal(e.target.value))}
                                          onBlur={() => updateRow(section.id, row.id, "toolUsage", formatDecimal(row.toolUsage ?? ""))}
                                          placeholder={row.toolType === "hand" ? "0.00" : "—"}
                                          disabled={engineeringFieldLocked || usageNA}
                                          aria-label={`Usage item ${rIdx + 1}`}
                                          className={ownerNumClass("eng", usageNA)}
                                        />
                                        {/* Depreciation years (Engineering, power/safety only) */}
                                        <Input
                                          value={row.toolDepYears ?? ""}
                                          inputMode="decimal"
                                          onChange={(e) => updateRow(section.id, row.id, "toolDepYears", sanitizeDecimal(e.target.value))}
                                          onBlur={() => updateRow(section.id, row.id, "toolDepYears", formatDecimal(row.toolDepYears ?? ""))}
                                          placeholder={!depNA ? "0.00" : "—"}
                                          disabled={engineeringFieldLocked || depNA}
                                          aria-label={`Depreciation years item ${rIdx + 1}`}
                                          className={ownerNumClass("eng", depNA)}
                                        />
                                        {/* Divisor (NOT editable by Engineering -> AMBER, gray when N/A) */}
                                        <div className="flex items-center">
                                          <Input
                                            value={row.toolDepFactor ?? ""}
                                            inputMode="decimal"
                                            onChange={(e) => updateRow(section.id, row.id, "toolDepFactor", sanitizeDecimal(e.target.value))}
                                            onBlur={() => updateRow(section.id, row.id, "toolDepFactor", formatDecimal(row.toolDepFactor ?? ""))}
                                            placeholder={!depNA ? "100" : "—"}
                                            disabled={!canEditProc || depNA}
                                            aria-label={`Depreciation divisor item ${rIdx + 1}`}
                                            title="Blank = 100"
                                            className={`${ownerNumClass("proc", depNA)} min-w-0 flex-1`}
                                          />
                                          {canEditProc && !depNA && (
                                            <div className="flex flex-col ml-1">
                                              <button
                                                type="button"
                                                onClick={() => adjustDepFactor(section.id, row.id, row.toolDepFactor, 1)}
                                                className="h-3.5 w-4 flex items-center justify-center hover:bg-slate-200 rounded-t text-slate-500 hover:text-slate-900 transition-colors"
                                                aria-label="Increase divisor"
                                              >
                                                <ChevronUp size={10} strokeWidth={3} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => adjustDepFactor(section.id, row.id, row.toolDepFactor, -1)}
                                                className="h-3.5 w-4 flex items-center justify-center hover:bg-slate-200 rounded-b text-slate-500 hover:text-slate-900 transition-colors"
                                                aria-label="Decrease divisor"
                                              >
                                                <ChevronDown size={10} strokeWidth={3} />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </>
                                    )}

                                    {/* HEAVY EQUIPMENT RENTAL only: flat Mobilization Fee */}
                                    {isRental && (
                                      <Input
                                        value={row.rentalFee ?? ""}
                                        inputMode="decimal"
                                        onChange={(e) => updateRow(section.id, row.id, "rentalFee", sanitizeDecimal(e.target.value))}
                                        onBlur={() => updateRow(section.id, row.id, "rentalFee", formatDecimal(row.rentalFee ?? ""))}
                                        placeholder="0.00"
                                        disabled={isFieldLocked(moneyOwner)}
                                        aria-label={`Mobilization fee item ${rIdx + 1}`}
                                        className={ownerNumClass(moneyOwner)}
                                      />
                                    )}

                                    {/* Money columns: inputs are typed, totals are auto-computed (read-only) */}
                                    {MONEY_COLUMNS.map((c) => {
                                      if (c.kind === "input") {
                                        return (
                                          <Input
                                            key={c.key}
                                            value={row[c.key]}
                                            inputMode="decimal"
                                            onChange={(e) => updateRow(section.id, row.id, c.key, sanitizeDecimal(e.target.value))}
                                            onBlur={() => updateRow(section.id, row.id, c.key, formatDecimal(row[c.key]))}
                                            onPaste={(e) => handleBoqCellPaste(e, section.id, rIdx, ENG_COL_INDEX[c.key])}
                                            placeholder="0.00"
                                            disabled={isFieldLocked(moneyOwner)}
                                            aria-label={`${c.label} item ${rIdx + 1}`}
                                            className={ownerNumClass(moneyOwner)}
                                          />
                                        );
                                      }

                                      // Total Material Cost: auto, or editable when "Custom pricing" is ticked (manual method)
                                      if (c.key === "totalMaterialCost") {
                                        return (
                                          <div key={c.key} className="flex flex-col gap-1">
                                            {allowBoqCustomPricing && isManualCustom(row) ? (
                                              <Input
                                                value={row.customAmount ?? ""}
                                                inputMode="decimal"
                                                onChange={(e) =>
                                                  updateCustom(section.id, row.id, { customAmount: sanitizeDecimal(e.target.value) })
                                                }
                                                onBlur={() =>
                                                  updateCustom(section.id, row.id, { customAmount: formatDecimal(row.customAmount ?? "") })
                                                }
                                                placeholder="0.00"
                                                disabled={engineeringFieldLocked}
                                                aria-label={`${c.label} item ${rIdx + 1} (custom amount)`}
                                                className={customInputClass}
                                              />
                                            ) : (
                                              <Input
                                                value={num2(totals[c.key])}
                                                disabled={true}
                                                title={allowBoqCustomPricing && row.customPricing ? "Computed by the custom calculator" : "Auto-computed (read-only)"}
                                                aria-label={`${c.label} item ${rIdx + 1}`}
                                                className={allowBoqCustomPricing && row.customPricing ? customAutoClass : autoInputClass}
                                              />
                                            )}
                                            {allowBoqCustomPricing && (
                                              <>
                                                <label
                                                  className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider select-none ${
                                                    row.customPricing ? "text-amber-600" : "text-slate-400"
                                                  } ${locked ? "" : "cursor-pointer"}`}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={!!row.customPricing}
                                                    disabled={locked}
                                                    onChange={(e) => toggleCustom(section.id, row.id, e.target.checked)}
                                                    className="size-3 accent-amber-500"
                                                  />
                                                  Custom pricing
                                                </label>
                                                {row.customPricing && (
                                                  <>
                                                    <button
                                                      type="button"
                                                      onClick={() => setCalcTarget({ sectionId: section.id, rowId: row.id, fresh: false })}
                                                      title={`${customMethodLabel(customMethodOf(row))}${row.customNote ? ` · ${row.customNote}` : ""}\n${describeCustomFormula(row)} = ${peso(totals.totalMaterialCost)}`}
                                                      className="flex w-full items-center justify-center gap-1 h-7 rounded-md border border-amber-300 bg-white text-[9px] font-black uppercase tracking-wider text-amber-700 hover:bg-amber-100"
                                                    >
                                                      <Calculator size={11} />
                                                      {readOnly ? "View" : "Calculator"}
                                                    </button>
                                                    <p className="text-[9px] font-bold leading-tight text-amber-800 tabular-nums break-words">
                                                      {describeCustomFormula(row)}
                                                    </p>
                                                  </>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        );
                                      }

                                      // Auto-calculated total fields are always read-only (GRAY)
                                      return (
                                        <Input
                                          key={c.key}
                                          value={num2(totals[c.key])}
                                          disabled={true}
                                          title="Auto-computed (read-only)"
                                          aria-label={`${c.label} item ${rIdx + 1}`}
                                          className={autoInputClass}
                                        />
                                      );
                                    })}

                                    <span />
                                  </div>
                                );
                              })}
                            </div>

                            {/* Subtotal (auto-sum of the Total columns) */}
                            <div className={`${sectionGrid} px-3 py-2.5 bg-slate-50 border-t border-slate-200 items-center`}>
                              {showProcurement ? (
                                // Keep the Procurement subtotal aligned under its sticky columns.
                                <div className={`${procSticky} -my-2.5 py-2.5 items-center bg-slate-50`}>
                                  <div className={`${isRental ? "col-span-4" : "col-span-3"} flex items-center justify-end gap-1.5 pr-2 text-[10px] font-black uppercase tracking-widest text-slate-500`}>
                                    Subtotal Amount
                                    <InfoTip label="About the subtotal multiplier">
                                      <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-sky-300">Procurement Subtotal</p>
                                      <p>SUM of Procurement Total Amount × Multiplier</p>
                                      <p className="mt-1 text-sky-200">Default is ×1 (no change). Use e.g. 1.15 or 1.25 to add 15% / 25% on top of this section&apos;s sum.</p>
                                    </InfoTip>
                                    <span className="inline-flex items-center normal-case">
                                      <span className="mr-1 text-[11px] font-bold">×</span>
                                      {/* Procurement-editable multiplier -> AMBER */}
                                      <Input
                                        value={procSectionMult[section.id] ?? ""}
                                        inputMode="decimal"
                                        onChange={(e) =>
                                          setProcSectionMult((prev) => ({ ...prev, [section.id]: sanitizeDecimal(e.target.value) }))
                                        }
                                        onBlur={() =>
                                          setProcSectionMult((prev) => ({ ...prev, [section.id]: formatDecimal(prev[section.id] ?? "") }))
                                        }
                                        placeholder="1"
                                        disabled={!canEditProc}
                                        aria-label={`Subtotal multiplier section ${toRoman(sIdx + 1)}`}
                                        title="Blank = ×1"
                                        className={`h-7 w-14 rounded-md text-[12px] font-bold text-right tabular-nums ${PROC_TONE}`}
                                      />
                                      {canEditProc && (
                                        <span className="ml-1 flex flex-col">
                                          <button
                                            type="button"
                                            onClick={() => adjustSectionMult(section.id, 0.05)}
                                            className="h-3.5 w-4 flex items-center justify-center hover:bg-slate-200 rounded-t text-slate-500 hover:text-slate-900 transition-colors"
                                            aria-label="Increase multiplier"
                                          >
                                            <ChevronUp size={10} strokeWidth={3} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => adjustSectionMult(section.id, -0.05)}
                                            className="h-3.5 w-4 flex items-center justify-center hover:bg-slate-200 rounded-b text-slate-500 hover:text-slate-900 transition-colors"
                                            aria-label="Decrease multiplier"
                                          >
                                            <ChevronDown size={10} strokeWidth={3} />
                                          </button>
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-1 py-0.5">
                                    <span
                                      className="text-right text-[12px] font-black tabular-nums whitespace-nowrap text-amber-700"
                                    >
                                      {peso(procSub)}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="col-span-4 text-right pr-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                  Subtotal Amount
                                </span>
                              )}

                              {/* Description / Quantity / Unit tracks (only when the label is inside the sticky group) */}
                              {showProcurement && (
                                <>
                                  <span />
                                  <span />
                                  <span />
                                </>
                              )}

                              {isTools && (
                                <>
                                  <span />
                                  <span />
                                  <span />
                                  <span />
                                </>
                              )}
                              {isRental && <span />}

                              {/* Material Cost (input column, no subtotal) */}
                              <span />
                              <span className="text-right text-[12px] font-black tabular-nums text-slate-700">{peso(sub.material)}</span>
                              <span />
                              <span className="text-right text-[12px] font-black tabular-nums text-slate-700">{peso(sub.labor)}</span>
                              <span />
                              <span className="text-right text-[12px] font-black tabular-nums text-slate-700">{peso(sub.consumable)}</span>
                              <span className="text-right text-[12px] font-black tabular-nums text-slate-900">{peso(sub.total)}</span>
                              <span />
                            </div>
                          </div>
                        </div>

                        {!readOnly && (
                          <div className="px-3 py-2 border-t border-slate-100 bg-white">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addRow(section.id)}
                              disabled={locked}
                              className="h-8 px-3 gap-1.5 text-[10px] font-black uppercase tracking-wider border-slate-200"
                            >
                              <Plus size={12} />
                              Add Item
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {/* Add Section again at the bottom, so you don't have to scroll back up */}
              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addSection}
                  disabled={locked}
                  className="w-full h-10 gap-1.5 border-dashed border-slate-300 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-900"
                >
                  <Plus size={12} />
                  Add Section
                </Button>
              )}

              {/* ── PROJECT COST SUMMARY (all formulas) ── */}
              <div className="pt-2 space-y-3">
                <div className="border-2 border-slate-900 rounded-md overflow-hidden">
                  <div className="grid grid-cols-[1fr_200px] border-b border-emerald-200 bg-emerald-50">
                    <Label htmlFor="fillup-totalWorkingDays" className="px-3 py-2 text-right text-[11px] font-black uppercase tracking-wide text-emerald-800 flex items-center justify-end">
                      Number of Days
                    </Label>
                    <div className="px-3 py-1.5 border-l border-emerald-200">
                      <Input
                        id="fillup-totalWorkingDays"
                        value={values.totalWorkingDays ?? ""}
                        onChange={(e) => setField("totalWorkingDays", e.target.value.replace(/\D/g, ""))}
                        inputMode="numeric"
                        disabled={locked}
                        aria-label="Number of days"
                        className="h-8 border-emerald-300 bg-white text-right text-[13px] font-black tabular-nums text-emerald-700 focus-visible:ring-emerald-500 disabled:opacity-100 disabled:cursor-default"
                      />
                    </div>
                  </div>
                  <SummaryRow label="Material Cost">{peso(summary.materialCost)}</SummaryRow>
                  <SummaryRow label="Labor Cost">{peso(summary.laborCost)}</SummaryRow>
                  <SummaryRow label="Consumables">{peso(summary.consumables)}</SummaryRow>
                  <SummaryRow label="Direct Cost" variant="strong">
                    {peso(summary.directCost)}
                  </SummaryRow>
                  <SummaryRow
                    label={
                      <>
                        Contingency
                        <span className="inline-flex items-center gap-1 normal-case">
                          <NumberInputWithArrows
                            value={contingencyPct}
                            onChange={(e) => setContingencyPct(sanitizeDecimal(e.target.value))}
                            onIncrement={() => adjustValue(contingencyPct, 1, setContingencyPct)}
                            onDecrement={() => adjustValue(contingencyPct, -1, setContingencyPct)}
                            disabled={locked}
                            className={`h-7 w-16 rounded-md text-[12px] font-bold text-right tabular-nums ${ENG_TONE}`}
                            aria-label="Contingency percent"
                          />
                          <span className="text-[11px] font-bold">%</span>
                        </span>
                      </>
                    }
                  >
                    <span className="italic">{peso(summary.contingency)}</span>
                  </SummaryRow>
                  <SummaryRow label="Total Project Cost" variant="red">
                    {peso(summary.totalProjectCost)}
                  </SummaryRow>
                </div>

                <div className="border-2 border-slate-900 rounded-md overflow-hidden">
                  <SummaryRow
                    variant="red"
                    label={
                      <>
                        Cost Per Item
                        <span className="inline-flex items-center gap-1 normal-case font-bold">
                          <span className="text-[10px] opacity-90">÷ No. of units</span>
                          <NumberInputWithArrows
                            value={unitCount}
                            onChange={(e) => setUnitCount(sanitizeDecimal(e.target.value))}
                            onIncrement={() => adjustValue(unitCount, 1, setUnitCount)}
                            onDecrement={() => adjustValue(unitCount, -1, setUnitCount)}
                            disabled={locked}
                            className={`h-7 w-16 rounded-md text-[12px] font-bold text-right tabular-nums ${ENG_TONE}`}
                            aria-label="Number of units"
                          />
                        </span>
                      </>
                    }
                  >
                    {summary.unitCount > 0 ? peso(summary.costPerItem) : "—"}
                  </SummaryRow>
                </div>

                {showProcurement && (
                  <div className="border-2 border-amber-500 rounded-md overflow-hidden">
                    <div className="px-3 py-1.5 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest">
                      Procurement Cost Summary
                    </div>
                    {procLine("Total", peso(procSummary.total), true)}
                    {procLine(
                      <>Warranty {procPctInput(procWarrantyPct, setProcWarrantyPct, "Warranty percent", "%")}</>,
                      peso(procSummary.warranty)
                    )}
                    {procLine(
                      <>Contingencies {procPctInput(procContingencyPct, setProcContingencyPct, "Contingency percent", "%")}</>,
                      peso(procSummary.contingency)
                    )}
                    {procLine("Direct Cost", peso(procSummary.directCost), true)}
                    {procLine("VAT 12%", peso(procSummary.vat))}
                    {procLine(
                      <>W/ Mark-up {procPctInput(procMarkup, setProcMarkup, "Mark-up multiplier", "×")}</>,
                      peso(procSummary.withMarkup)
                    )}
                    {procLine(
                      <>
                        Say
                        <span className="inline-flex items-center gap-1 normal-case font-bold">
                          <span className="text-[9px] opacity-75">round up to nearest</span>
                          <select
                            value={procSayRoundTo}
                            onChange={(e) => setProcSayRoundTo(e.target.value)}
                            disabled={!canEditProc}
                            aria-label="Say rounding place"
                            title="Choose the place value to round the Say amount up to"
                            className="h-7 max-w-[190px] rounded-md border border-amber-300 bg-amber-50 px-2 text-[10px] font-bold text-amber-900 disabled:opacity-100 disabled:cursor-default"
                          >
                            {SAY_ROUNDING_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </span>
                      </>,
                      peso(procSummary.say),
                      true
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {(!readOnly || boqs.length > 1) && (
          <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-2">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  BOQ Versions
                </Label>
                {!readOnly && (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1">
                    <Label htmlFor="boq-count" className="text-[10px] font-black uppercase text-slate-600">
                      Number of BOQs
                    </Label>
                    <Input
                      id="boq-count"
                      type="number"
                      min={1}
                      step={1}
                      value={requestedBoqCount}
                      onChange={(event) => {
                        const value = event.target.value;
                        setRequestedBoqCount(value);
                        scheduleBoqCountApply(value);
                      }}
                      onBlur={(event) => {
                        if (boqCountApplyTimer.current) clearTimeout(boqCountApplyTimer.current);
                        boqCountApplyTimer.current = null;
                        if (event.target.value.trim()) applyBoqCount(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                      }}
                      disabled={isLoadingJob}
                      className="h-8 w-16 rounded-md px-2 text-center text-xs font-bold"
                    />
                  </div>
                )}
              </div>
              {boqs.length > 1 ? (
                <div className="flex items-center justify-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => switchBoqVersion(activeBoqIndex - 1)}
                    disabled={activeBoqIndex === 0}
                    aria-label="Previous BOQ"
                    className="size-8 border-slate-200"
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <span className="min-w-[150px] text-center text-[10px] font-black text-slate-700">
                    {values.jrNumber || "BOQ"}.{activeBoqIndex + 1}
                    <span className="ml-1 font-bold text-slate-400">
                      ({activeBoqIndex + 1}/{boqs.length})
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => switchBoqVersion(activeBoqIndex + 1)}
                    disabled={activeBoqIndex >= boqs.length - 1}
                    aria-label="Next BOQ"
                    className="size-8 border-slate-200"
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              ) : <div />}
              <div />
            </div>
          </div>
        )}

        <DialogFooter className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 shrink-0 flex-row justify-between sm:justify-between">
          {readOnly ? (
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 px-6 text-[10px] font-black uppercase tracking-wider"
              >
                Close
              </Button>
              {canEditProc && (
                <Button
                  type="button"
                  onClick={handleSaveProcurement}
                  disabled={isSavingProc}
                  className="h-10 px-6 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider"
                >
                  <Send size={12} />
                  {isSavingProc ? "Saving..." : "Save Procurement"}
                </Button>
              )}
              {renderAdvanceControl()}
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                disabled={isLoadingJob}
                className="h-10 px-4 gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500"
              >
                <RotateCcw size={12} />
                Clear
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    UNSAVED_CACHE.delete(cacheKey);
                    onOpenChange(false);
                  }}
                  className="h-10 px-5 text-[10px] font-black uppercase tracking-wider"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => setPendingConfirmation("save")}
                  disabled={isSubmitting || isLoadingJob}
                  className="h-10 px-6 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider"
                >
                  <Send size={12} />
                  {isSubmitting ? "Saving..." : "Save Draft"}
                </Button>
                {renderAdvanceControl()}
              </div>
            </>
          )}
        </DialogFooter>

        <Dialog
          open={pendingConfirmation !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isSubmitting) setPendingConfirmation(null);
          }}
        >
          <DialogContent className="w-[92vw] !max-w-[420px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-[14px] font-black uppercase tracking-tight text-slate-900">
                Confirm {pendingConfirmation === "advance" ? "Action" : "Save Draft"}
              </DialogTitle>
              <DialogDescription className="text-[12px] font-medium text-slate-500">
                {pendingConfirmation === "advance"
                  ? `Do you want to continue with "${advanceAction?.label}"? Add your remarks to continue.`
                  : "Do you want to save this Fill Up Form as a draft?"}
              </DialogDescription>
            </DialogHeader>
            {pendingConfirmation === "advance" && (
              <div className="space-y-1.5">
                <Label htmlFor="approval-remarks" className="text-[10px] font-black uppercase text-slate-400">
                  {remarksLabel} <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="approval-remarks"
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder="Enter remarks to continue..."
                  readOnly={!remarksEditable}
                  className="min-h-[110px] rounded-xl text-[12px] font-medium read-only:bg-slate-50 read-only:text-slate-600"
                />
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingConfirmation(null)}
                disabled={isSubmitting}
                className="h-10 px-5 text-[10px] font-black uppercase tracking-wider"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmPendingAction}
                disabled={isSubmitting || (pendingConfirmation === "advance" && !approvalRemarks.trim())}
                className="h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider"
              >
                {isSubmitting ? "Saving..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Import confirmation (replaces window.confirm) ── */}
        <Dialog
          open={pendingImport !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen) setPendingImport(null);
          }}
        >
          <DialogContent className="w-[92vw] !max-w-[440px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-[14px] font-black uppercase tracking-tight text-slate-900">
                Bill of Quantities already has data
              </DialogTitle>
              <DialogDescription className="text-[12px] font-medium text-slate-500">
                The file has {pendingImport?.length ?? 0} section(s) and{" "}
                {pendingImport ? countItems(pendingImport) : 0} item(s). What do you want to do with
                the existing BOQ?
              </DialogDescription>
            </DialogHeader>

            <ul className="space-y-1.5 text-[12px] text-slate-600">
              <li>
                <span className="font-black text-slate-900">Replace all</span> — remove the current
                sections and use the imported ones.
              </li>
              <li>
                <span className="font-black text-slate-900">Add to existing</span> — keep the current
                sections and add the imported ones below them.
              </li>
            </ul>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPendingImport(null)}
                className="h-10 px-4 text-[10px] font-black uppercase tracking-wider text-slate-500"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => pendingImport && applyImport(pendingImport, "append")}
                className="h-10 px-4 text-[10px] font-black uppercase tracking-wider"
              >
                Add to existing
              </Button>
              <Button
                type="button"
                onClick={() => pendingImport && applyImport(pendingImport, "replace")}
                className="h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider"
              >
                Replace all
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CustomPricingCalculator
          open={calcTarget !== null}
          onOpenChange={handleCalcOpenChange}
          row={calcRow}
          readOnly={calcTarget?.proc || calcTarget?.procRow ? !canEditProc : readOnly}
          targetLabel={
            calcTarget?.procRow
              ? "Procurement Total Amount"
              : calcTarget?.proc
              ? "Procurement Subtotal Amount"
              : "Total Material Cost"
          }
          onApply={handleCalcApply}
        />
      </DialogContent>
    </Dialog>
  );
}

export default JobFillUpFormDialog;