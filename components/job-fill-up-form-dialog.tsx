"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Send, RotateCcw, Loader2, Lock, Plus, Minus, Trash2, ChevronDown, ChevronRight, ChevronUp, Upload, Calculator } from "lucide-react";

import { toast } from "sonner";
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

// DATABASE
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

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
  { key: "agentName", label: "Agent Name", placeholder: "Agent name", span: 1 },
  { key: "projectTitle", label: "Project Title", placeholder: "Project title", required: true, span: 2 },
  { key: "clientName", label: "Client Name", placeholder: "Client name", span: 1 },
  { key: "address", label: "Address", placeholder: "Site address", required: true, span: 3 },
  { key: "projectDuration", label: "Project Duration", placeholder: "e.g. 10/14/2026 - 10/20/2026", span: 1 },
  { key: "workHours", label: "Work Hours", placeholder: "e.g. 10/14/2026, 8:00 AM - 10/14/2026, 5:00 PM", span: 2 },
  { key: "scopeOfWork", label: "Detailed Scope of Work", placeholder: "Describe the work...", multiline: true, required: true, span: 3 },
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
export type InputKey = "description" | "qty" | "unit" | "materialCost" | "laborCost" | "consumableCost";

export type BoqRow = CustomPricingFields & {
  id: string;
  description: string;
  qty: string;
  unit: string;
  materialCost: string;
  laborCost: string;
  consumableCost: string;
  /** Final values — filled in on submit only */
  totalMaterialCost?: string;
  totalLaborCost?: string;
  totalConsumable?: string;
  totalAmount?: string;
};

export type BoqSection = {
  id: string;
  title: string;
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

export type ProcurementRow = { qty: string; cost: string } & CustomPricingFields;
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
  summary: ProcurementSummary;
  /** Custom pricing of the procurement SUBTOTAL, keyed by section id */
  sectionCustom?: Record<string, CustomPricingFields>;
  savedBy?: string;
  savedAt?: any;
};

/**
 * A saved fill-up form (stored in the "job_fill_ups" collection, doc id = job request id).
 * status: "draft" while waiting for engineering to finish, "completed" once it was copied
 * into the job_requests document.
 */
export type FillUpDraft = {
  values: JobFillUpFormValues;
  boqSections: BoqSection[];
  summary: BoqSummary;
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
// Procurement ON: first track = sticky group (Item No + 4 procurement cols), then the engineering columns
const BOQ_GRID_PROC =
  "grid grid-cols-[621px_minmax(280px,1fr)_90px_90px_repeat(7,125px)_40px] gap-2 items-start";

// Sticky left group wrapper (Item No + Procurement Qty/Cost/Total/Variance)
const PROC_STICKY =
  "grid grid-cols-[60px_100px_130px_135px_140px] gap-2 sticky left-0 z-10 self-stretch -ml-3 pl-3 pr-3 border-r border-slate-200 shadow-[4px_0_6px_-4px_rgba(0,0,0,0.12)]";

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
const sanitizeDecimal = (value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
};

// "4" -> "4.00" on blur
const formatDecimal = (value: string) => {
  if (!value || value === ".") return "";
  const n = parseFloat(value);
  return Number.isNaN(n) ? "" : n.toFixed(2);
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
const rowTotals = (r: BoqRow): Record<TotalKey, number> => {
  const qty = toNumber(r.qty);

  const totalMaterialCost = r.customPricing ? computeCustomMaterial(r) : qty * toNumber(r.materialCost);
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
  !r.consumableCost.trim();

/* ── SECTION FORMULA (SUBTOTAL AMOUNT) ── */
const sectionSubtotals = (s: BoqSection) =>
  (s.rows ?? []).reduce(
    (acc, r) => {
      const t = rowTotals(r);
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
const computeSummary = (sections: BoqSection[], contingencyPctStr: string, unitCountStr: string): BoqSummary => {
  const subs = sections.map(sectionSubtotals);
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
const finalizeRow = (r: BoqRow): BoqRow => {
  const t = rowTotals(r);
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
const SAY_ROUND_TO = 10000;

// Per row: plain Procurement Qty × Acquired Cost (`_row` kept so call sites don't change)
const procRowTotal = (p: ProcurementRow | undefined, _row?: BoqRow) => toNumber(p?.qty) * toNumber(p?.cost);
const procRowEntered = (p?: ProcurementRow) => !!(p?.qty?.trim() || p?.cost?.trim());

// Section subtotal BEFORE custom pricing
const sectionProcBase = (s: BoqSection, procRows: Record<string, ProcurementRow>) =>
  (s.rows ?? []).reduce((acc, r) => acc + procRowTotal(procRows[r.id], r), 0);

// Custom pricing of the procurement SUBTOTAL (same calculator): Cost = section subtotal, Qty = 1
const procSectionAsCustomRow = (
  s: BoqSection,
  procRows: Record<string, ProcurementRow>,
  custom?: CustomPricingFields
): CustomPricingRow => ({
  ...(custom ?? {}),
  description: s.title ? `${s.title} (Subtotal)` : "Section subtotal",
  unit: "",
  qty: "1",
  materialCost: String(sectionProcBase(s, procRows)),
});

const sectionProcTotal = (
  s: BoqSection,
  procRows: Record<string, ProcurementRow>,
  sectionCustom?: Record<string, CustomPricingFields>
) => {
  const custom = sectionCustom?.[s.id];
  return custom?.customPricing
    ? computeCustomMaterial(procSectionAsCustomRow(s, procRows, custom))
    : sectionProcBase(s, procRows);
};

const signedPeso = (n: number) => (n < 0 ? `-${peso(-n)}` : peso(n));
const varianceClass = (n: number) => (n < 0 ? "text-red-600" : "text-emerald-600");

const computeProcurementSummary = (
  sections: BoqSection[],
  procRows: Record<string, ProcurementRow>,
  warrantyStr: string,
  contingencyStr: string,
  markupStr: string,
  sectionCustom?: Record<string, CustomPricingFields>
): ProcurementSummary => {
  const total = sections.reduce((a, s) => a + sectionProcTotal(s, procRows, sectionCustom), 0);
  const engTotal = sections.reduce((a, s) => a + sectionSubtotals(s).total, 0);

  const warrantyPct = toNumber(warrantyStr);
  const contingencyPct = toNumber(contingencyStr);
  const markup = toNumber(markupStr);

  const warranty = total * (warrantyPct / 100);
  const contingency = total * (contingencyPct / 100);
  const directCost = total + warranty + contingency;
  const vat = directCost * (1 + VAT_RATE);
  const withMarkup = vat * markup;
  const say = Math.ceil(withMarkup / SAY_ROUND_TO) * SAY_ROUND_TO;

  return {
    total, warrantyPct, warranty, contingencyPct, contingency,
    directCost, vat, markup, withMarkup, say,
    variance: engTotal - total,
  };
};

const DEFAULT_CONTINGENCY = "7";
const DEFAULT_UNIT_COUNT = "1";

/* ─────────────────────────────────────────────
   HELPERS — map a job_requests document to form values
───────────────────────────────────────────── */
const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString() : "N/A");
const fmtDateTime = (v: any) => (v ? new Date(v).toLocaleString() : "N/A");

async function resolveAgentName(job: any): Promise<string> {
  const ref = job?.agentName?.trim();
  if (!ref) return job?.submittedByName || "";
  try {
    const res = await fetch(`/api/user-by-reference?referenceid=${encodeURIComponent(ref)}`);
    const result = await res.json();
    return result?.name || ref;
  } catch (err) {
    console.error("AGENT_NAME_FETCH_ERROR", err);
    return ref;
  }
}

async function mapJobToFormValues(job: any): Promise<JobFillUpFormValues> {
  const hasRange = job?.workingTimeFrom || job?.workingTimeTo;

  return {
    jrNumber: job?.jobRequestNo || "",
    dateRequested: job?.createdAt?.toDate
      ? job.createdAt.toDate().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "",
    agentName: await resolveAgentName(job),
    projectTitle: job?.projectTitle || "",
    clientName: job?.clientName || "GENERAL",
    address: job?.location || "",
    projectDuration: hasRange ? `${fmtDate(job?.workingTimeFrom)} - ${fmtDate(job?.workingTimeTo)}` : "",
    workHours: hasRange
      ? `${fmtDateTime(job?.workingTimeFrom)} - ${fmtDateTime(job?.workingTimeTo)}`
      : job?.workingTime || "",
    scopeOfWork: job?.scopeOfWork || "",
  };
}

interface JobFillUpFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Firestore doc id in "job_requests" (the id in /request/job/[id]). Form auto-populates from it. */
  requestId?: string;
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
    procurement?: ProcurementData
  ) => void | Promise<void>;
  /** Show the Procurement columns + summary (Procurement and IT/Admin only) */
  showProcurement?: boolean;
  /** Procurement inputs are editable */
  procurementEditable?: boolean;
  /** Save button of the procurement columns (works even when the rest of the form is read-only) */
  onSaveProcurement?: (data: ProcurementData) => void | Promise<void>;
}

export function JobFillUpFormDialog({
  open,
  onOpenChange,
  requestId,
  readOnly = false,
  draft = null,
  onSubmit,
  showProcurement = false,
  procurementEditable = false,
  onSaveProcurement,
}: JobFillUpFormDialogProps) {
  const [values, setValues] = useState<JobFillUpFormValues>(EMPTY_DATA);
  // Keys that were auto-populated with a value -> these fields are disabled
  const [lockedKeys, setLockedKeys] = useState<string[]>([]);
  const [boqSections, setBoqSections] = useState<BoqSection[]>([newBoqSection()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(false);
  // BOQ UI state: collapsed sections + which new section to scroll to
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  // Summary inputs
  const [contingencyPct, setContingencyPct] = useState(DEFAULT_CONTINGENCY);
  const [unitCount, setUnitCount] = useState(DEFAULT_UNIT_COUNT);
  // Procurement (keyed by BOQ row id)
  const [procRows, setProcRows] = useState<Record<string, ProcurementRow>>({});
  const [procWarrantyPct, setProcWarrantyPct] = useState(DEFAULT_WARRANTY);
  const [procContingencyPct, setProcContingencyPct] = useState(DEFAULT_PROC_CONTINGENCY);
  const [procMarkup, setProcMarkup] = useState(DEFAULT_MARKUP);
  const [procSectionCustom, setProcSectionCustom] = useState<Record<string, CustomPricingFields>>({});
  const [isSavingProc, setIsSavingProc] = useState(false);

  // view mode shows the draft read-only, edit mode ("Load Draft") pre-fills the editable form
  const viewDraft = readOnly ? draft : null;
  const editDraft = readOnly ? null : draft;

  // Everything is frozen while the job request loads, and always in view mode
  const locked = isLoadingJob || readOnly;
  const canEditProc = showProcurement && procurementEditable && !isLoadingJob;
  // Header, rows and subtotal all use this so the procurement columns stay on the SAME row
  const gridClass = showProcurement ? BOQ_GRID_PROC : BOQ_GRID;

  // Populate every time the dialog opens
  useEffect(() => {
    if (!open) return;

    setCollapsedIds([]);

    const applyProc = (d?: FillUpDraft | null) => {
      setProcRows(d?.procurement?.rows ?? {});
      setProcWarrantyPct(String(d?.procurement?.warrantyPct ?? DEFAULT_WARRANTY));
      setProcContingencyPct(String(d?.procurement?.contingencyPct ?? DEFAULT_PROC_CONTINGENCY));
      setProcMarkup(String(d?.procurement?.markup ?? DEFAULT_MARKUP));
      setProcSectionCustom(d?.procurement?.sectionCustom ?? {});
    };

    // ── VIEW MODE: show the saved draft ──
    if (readOnly) {
      setValues({ ...EMPTY_DATA, ...(viewDraft?.values ?? {}) });
      setLockedKeys([]);
      setBoqSections(viewDraft?.boqSections ?? []);
      setContingencyPct(String(viewDraft?.summary?.contingencyPct ?? DEFAULT_CONTINGENCY));
      setUnitCount(String(viewDraft?.summary?.unitCount ?? DEFAULT_UNIT_COUNT));
      applyProc(viewDraft);
      return;
    }

    // ── EDIT MODE: pre-fill from the saved draft (if any), then lock the job-request fields ──
    setValues({ ...EMPTY_DATA, ...(editDraft?.values ?? {}) });
    setLockedKeys([]);
    setBoqSections(
      editDraft?.boqSections?.length
        ? editDraft.boqSections.map((s) => ({
            ...s,
            rows: (s.rows ?? []).map((r) => ({ ...r })),
          }))
        : [newBoqSection()]
    );
    setContingencyPct(String(editDraft?.summary?.contingencyPct ?? DEFAULT_CONTINGENCY));
    setUnitCount(String(editDraft?.summary?.unitCount ?? DEFAULT_UNIT_COUNT));
    applyProc(editDraft);
    if (!requestId) return;

    let cancelled = false;
    setIsLoadingJob(true);

    (async () => {
      try {
        const snap = await getDoc(doc(db, "job_requests", requestId));
        if (!snap.exists()) {
          if (!cancelled) toast.error("Job request not found");
          return;
        }
        const mapped = await mapJobToFormValues(snap.data());
        if (!cancelled) {
          // Fields that come from the job request stay locked (fresh value wins over the draft)
          const lockedFromJob = FIELDS.filter((f) => mapped[f.key]?.toString().trim()).map((f) => f.key);
          setValues({
            ...EMPTY_DATA,
            ...(editDraft?.values ?? {}),
            ...Object.fromEntries(lockedFromJob.map((k) => [k, mapped[k]])),
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
  }, [open, requestId, readOnly, viewDraft, editDraft]);

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
      prev.map((s) =>
        s.id === sectionId ? { ...s, rows: s.rows.map((r) => (r.id === rowId ? fn(r) : r)) } : s
      )
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
  } | null>(null);

  const calcRow = useMemo<CustomPricingRow | null>(() => {
    if (!calcTarget) return null;
    const sec = boqSections.find((s) => s.id === calcTarget.sectionId);
    if (!sec) return null;
    if (calcTarget.proc) return procSectionAsCustomRow(sec, procRows, procSectionCustom[sec.id]);
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

  const handleCalcApply = (patch: CustomPricingFields) => {
    if (!calcTarget) return;
    if (calcTarget.proc) {
      const { sectionId } = calcTarget;
      setProcSectionCustom((prev) => ({ ...prev, [sectionId]: { ...prev[sectionId], ...patch } }));
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
      else toggleCustom(calcTarget.sectionId, calcTarget.rowId, false);
    }
    setCalcTarget(null);
  };

  // Helper to increment/decrement numeric values
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
    const converted = convertToBoqSections(imported);

    setBoqSections((prev) => {
      if (mode === "replace") return converted;
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
    () => computeSummary(boqSections, contingencyPct, unitCount),
    [boqSections, contingencyPct, unitCount]
  );

  /* ── PROCUREMENT ── */
  const procSummary = useMemo(
    () => computeProcurementSummary(boqSections, procRows, procWarrantyPct, procContingencyPct, procMarkup, procSectionCustom),
    [boqSections, procRows, procWarrantyPct, procContingencyPct, procMarkup, procSectionCustom]
  );
  const hasAnyProc = boqSections.some((s) => s.rows.some((r) => procRowEntered(procRows[r.id])));

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
    const clean = (v?: string) => formatDecimal(sanitizeDecimal((v ?? "").replace(/[^0-9.]/g, "")));

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

  const buildProcurement = (): ProcurementData => {
    const rows: Record<string, ProcurementRow> = {};
    boqSections.forEach((s) =>
      s.rows.forEach((r) => {
        const p = procRows[r.id];
        if (procRowEntered(p)) rows[r.id] = { ...p };
      })
    );
    return {
      rows,
      warrantyPct: procWarrantyPct,
      contingencyPct: procContingencyPct,
      markup: procMarkup,
      sectionCustom: procSectionCustom,
      summary: computeProcurementSummary(boqSections, rows, procWarrantyPct, procContingencyPct, procMarkup, procSectionCustom),
    };
  };

  const handleSaveProcurement = async () => {
    setIsSavingProc(true);
    try {
      await onSaveProcurement?.(buildProcurement());
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

  const procPctInput = (value: string, setter: (v: string) => void, ariaLabel: string, suffix: string) => (
    <span className="inline-flex items-center gap-1 normal-case">
      <Input
        value={value}
        inputMode="decimal"
        onChange={(e) => setter(sanitizeDecimal(e.target.value))}
        disabled={!canEditProc}
        aria-label={ariaLabel}
        className="h-7 w-16 rounded-md text-[12px] font-bold text-right tabular-nums"
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
    setBoqSections([newBoqSection()]);
    setCollapsedIds([]);
    setContingencyPct(DEFAULT_CONTINGENCY);
    setUnitCount(DEFAULT_UNIT_COUNT);
  };

  const handleSubmit = async () => {
    const missing = FIELDS.filter((f) => f.required && !values[f.key]?.trim());
    if (missing.length > 0) {
      return toast.error(`Please fill in: ${missing.map((f) => f.label).join(", ")}`);
    }

    // Drop completely empty rows, and sections that have neither a title nor rows.
    // Computed totals are frozen into each row so they are saved with the form.
    const cleanedBoq = boqSections
      .map((s) => ({ ...s, rows: s.rows.filter((r) => !isRowEmpty(r)).map(finalizeRow) }))
      .filter((s) => s.title.trim() || s.rows.length > 0);

    const finalSummary = computeSummary(cleanedBoq, contingencyPct, unitCount);

    setIsSubmitting(true);
    try {
      await onSubmit?.(values, cleanedBoq, finalSummary, canEditProc ? buildProcurement() : undefined);
      toast.success("Fill up form saved as draft");
      onOpenChange(false);
    } catch (err) {
      console.error("FILL_UP_FORM_ERROR", err);
      toast.error("Failed to save fill up form");
    } finally {
      setIsSubmitting(false);
    }
  };

  const numericInputClass = "h-9 rounded-lg text-[12px] font-medium text-right tabular-nums";
  const autoInputClass =
    "h-9 rounded-lg text-[12px] font-bold text-right tabular-nums bg-slate-50 text-slate-700";
  const procInputClass =
    "h-9 rounded-lg text-[12px] font-medium text-right tabular-nums bg-amber-50/60 border-amber-200";
  const procAutoClass =
    "h-9 rounded-lg text-[12px] font-bold text-right tabular-nums bg-amber-50 text-amber-800 border-amber-200";
  const procCustomClass =
    "h-9 rounded-lg text-[12px] font-bold text-right tabular-nums bg-amber-100 text-amber-900 border-amber-400 disabled:opacity-100";

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
    ariaLabel,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onIncrement: () => void;
    onDecrement: () => void;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] !max-w-[1400px] max-h-[88vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col">
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
                  ? `Saved draft${viewDraft?.createdByName ? ` by ${viewDraft.createdByName}` : ""} - view only`
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
            {FIELDS.map((f) => {
              const isLocked = !readOnly && lockedKeys.includes(f.key);
              const isDisabled = locked || isLocked;

              return (
                <div key={f.key} className={`space-y-1.5 ${SPAN_CLASS[f.span ?? 1]}`}>
                  <Label
                    htmlFor={`fillup-${f.key}`}
                    className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5"
                  >
                    {f.label}
                    {f.required && !readOnly && <span className="text-red-500">*</span>}
                    {isLocked && <Lock size={9} className="text-slate-300" />}
                  </Label>
                  {f.multiline ? (
                    <Textarea
                      id={`fillup-${f.key}`}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      disabled={isDisabled}
                      className="min-h-[120px] rounded-xl text-[12px] font-medium disabled:opacity-100 disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed"
                    />
                  ) : (
                    <Input
                      id={`fillup-${f.key}`}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      disabled={isDisabled}
                      className="h-10 rounded-xl text-[12px] font-medium disabled:opacity-100 disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed"
                    />
                  )}
                </div>
              );
            })}

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
                const sub = sectionSubtotals(section);
                const isCollapsed = collapsedIds.includes(section.id);
                const procSub = sectionProcTotal(section, procRows, procSectionCustom);
                const procCustom = procSectionCustom[section.id];
                const procHas = section.rows.some((r) => procRowEntered(procRows[r.id]));
                const procVar = sub.total - procSub;

                return (
                  <div
                    key={section.id}
                    id={`boq-section-${section.id}`}
                    className="border border-slate-200 rounded-xl overflow-hidden scroll-mt-14"
                  >
                    {/* Section title bar: roman numeral + typed title */}
                    <div className="flex items-center gap-3 px-3 py-2 bg-rose-100/70 border-b border-rose-200/60">
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
                      <span className="shrink-0 min-w-[32px] text-[13px] font-black text-rose-700">
                        {toRoman(sIdx + 1)}.
                      </span>
                      <Input
                        id={`boq-title-${section.id}`}
                        value={section.title}
                        onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                        placeholder="Section title (e.g. GENERAL REQUIREMENTS)"
                        disabled={locked}
                        aria-label={`Section ${toRoman(sIdx + 1)} title`}
                        className="h-9 flex-1 rounded-lg bg-white text-[12px] font-bold uppercase"
                      />
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

                    {!isCollapsed && (
                      <>
                        <div className="overflow-x-auto">
                          <div className={showProcurement ? "min-w-[2190px]" : "min-w-[1500px]"}>
                            {/* Column header */}
                            <div className={`${gridClass} px-3 py-2 bg-slate-50 border-b border-slate-200 items-end`}>
                              {showProcurement ? (
                                <div className={`${PROC_STICKY} -my-2 py-2 items-end bg-slate-50`}>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Item No.</span>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 text-right">Procurement Qty</span>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 text-right">Procurement Acquired Cost</span>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 text-right">Procurement Total Amount</span>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 text-right pr-1">Variance</span>
                                </div>
                              ) : (
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Item No.</span>
                              )}
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Description</span>
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Quantity</span>
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Unit</span>
                              {MONEY_COLUMNS.map((c) => (
                                <span key={c.key} className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">
                                  {c.label}
                                </span>
                              ))}
                              <span />
                            </div>

                            {/* Rows */}
                            <div className="divide-y divide-slate-100">
                              {section.rows.map((row, rIdx) => {
                                const totals = rowTotals(row);

                                return (
                                  <div key={row.id} className={`${gridClass} px-3 py-2`}>
                                    <div className={showProcurement ? `${PROC_STICKY} -my-2 py-2 items-start bg-white` : "contents"}>
                                    <div className="flex flex-col items-start gap-1 pt-2">
                                      <span className="text-[11px] font-black text-slate-500">{rIdx + 1}</span>
                                      {!readOnly && (
                                        <div className="flex items-center gap-1">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => insertRowAfter(section.id, row.id)}
                                            disabled={locked}
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
                                            disabled={locked}
                                            title="Remove this item"
                                            aria-label={`Remove item ${rIdx + 1}`}
                                            className="size-6 rounded-md border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200"
                                          >
                                            <Minus size={12} />
                                          </Button>
                                        </div>
                                      )}
                                    </div>

                                    {/* Procurement columns */}
                                    {showProcurement && (
                                      <>
                                        <Input
                                          value={procRows[row.id]?.qty ?? ""}
                                          inputMode="decimal"
                                          onChange={(e) => updateProc(row.id, "qty", sanitizeDecimal(e.target.value))}
                                          onBlur={() => updateProc(row.id, "qty", formatDecimal(procRows[row.id]?.qty ?? ""))}
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
                                          onBlur={() => updateProc(row.id, "cost", formatDecimal(procRows[row.id]?.cost ?? ""))}
                                          onPaste={(e) => handleProcPaste(e, section.id, rIdx, 1)}
                                          placeholder="0.00"
                                          disabled={!canEditProc}
                                          aria-label={`Procurement acquired cost item ${rIdx + 1}`}
                                          className={procInputClass}
                                        />
                                        <Input
                                          value={num2(procRowTotal(procRows[row.id], row))}
                                          disabled
                                          title="Auto-computed (read-only)"
                                          aria-label={`Procurement total amount item ${rIdx + 1}`}
                                          className={procAutoClass}
                                        />
                                            <span
                                              className={`pt-2.5 pr-1 text-right text-[12px] font-black tabular-nums whitespace-nowrap ${
                                                procRowEntered(procRows[row.id])
                                                  ? varianceClass(totals.totalAmount - procRowTotal(procRows[row.id], row))
                                                  : ""
                                              }`}
                                            >
                                          {procRowEntered(procRows[row.id])
                                            ? signedPeso(totals.totalAmount - procRowTotal(procRows[row.id], row))
                                            : ""}
                                        </span>
                                      </>
                                    )}
                                    </div>   {/* ← closes the sticky wrapper */}

                                    <Textarea
                                      value={row.description}
                                      onChange={(e) => updateRow(section.id, row.id, "description", e.target.value)}
                                      placeholder="Item description (you can use multiple lines)"
                                      rows={2}
                                      disabled={locked}
                                      aria-label={`Description item ${rIdx + 1}`}
                                      className="min-h-[56px] rounded-lg text-[12px] font-medium"
                                    />

                                    {/* Quantity */}
                                    <Input
                                      value={row.qty}
                                      inputMode="decimal"
                                      onChange={(e) => updateRow(section.id, row.id, "qty", sanitizeDecimal(e.target.value))}
                                      onBlur={() => updateRow(section.id, row.id, "qty", formatDecimal(row.qty))}
                                      placeholder="0.00"
                                      disabled={locked}
                                      aria-label={`Quantity item ${rIdx + 1}`}
                                      className={numericInputClass}
                                    />

                                    {/* Unit (text) */}
                                    <Input
                                      value={row.unit}
                                      onChange={(e) => updateRow(section.id, row.id, "unit", e.target.value)}
                                      placeholder="pcs"
                                      disabled={locked}
                                      aria-label={`Unit item ${rIdx + 1}`}
                                      className="h-9 rounded-lg text-[12px] font-medium"
                                    />

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
                                            placeholder="0.00"
                                            disabled={locked || (c.key === "materialCost" && isManualCustom(row))}
                                            title={
                                              c.key === "materialCost" && isManualCustom(row)
                                                ? "Not used: this row has a typed Total Material Cost"
                                                : undefined
                                            }
                                            aria-label={`${c.label} item ${rIdx + 1}`}
                                            className={
                                              c.key === "materialCost" && isManualCustom(row)
                                                ? `${numericInputClass} opacity-40`
                                                : numericInputClass
                                            }
                                          />
                                        );
                                      }

                                      // Total Material Cost: auto, or editable when "Custom pricing" is ticked (manual method)
                                      if (c.key === "totalMaterialCost") {
                                        return (
                                          <div key={c.key} className="flex flex-col gap-1">
                                            {isManualCustom(row) ? (
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
                                                disabled={locked}
                                                aria-label={`${c.label} item ${rIdx + 1} (custom amount)`}
                                                className={customInputClass}
                                              />
                                            ) : (
                                              <Input
                                                value={num2(totals[c.key])}
                                                disabled={true}
                                                title={row.customPricing ? "Computed by the custom calculator" : "Auto-computed (read-only)"}
                                                aria-label={`${c.label} item ${rIdx + 1}`}
                                                className={row.customPricing ? customAutoClass : autoInputClass}
                                              />
                                            )}
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
                                          </div>
                                        );
                                      }

                                      // Auto-calculated total fields are always read-only
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
{/* Subtotal (auto-sum of the Total columns) */}
<div className={`${gridClass} px-3 py-2.5 bg-slate-50 border-t border-slate-200 items-center`}>
  {showProcurement ? (
    // Same sticky group as the header/rows, so Procurement Total + Variance sit under their columns
    <div className={`${PROC_STICKY} -my-2.5 py-2.5 items-center bg-slate-50`}>
      <span className="col-span-3 text-right pr-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
        Subtotal Amount
      </span>
      <div className="flex flex-col gap-1 py-0.5">
        <span
          className={`text-right text-[12px] font-black tabular-nums whitespace-nowrap ${
            procCustom?.customPricing ? "text-amber-900" : "text-amber-700"
          }`}
          title={procCustom?.customPricing ? "Computed by the custom calculator" : undefined}
        >
          {peso(procSub)}
        </span>
        {(canEditProc || procCustom?.customPricing) && (
          <label
            className={`flex items-center justify-end gap-1 text-[9px] font-black uppercase tracking-wider select-none ${
              procCustom?.customPricing ? "text-amber-600" : "text-slate-400"
            } ${canEditProc ? "cursor-pointer" : ""}`}
          >
            <input
              type="checkbox"
              checked={!!procCustom?.customPricing}
              disabled={!canEditProc}
              onChange={(e) => toggleProcSectionCustom(section.id, e.target.checked)}
              className="size-3 accent-amber-500"
            />
            Custom pricing
          </label>
        )}
        {procCustom?.customPricing && (
          <>
            <button
              type="button"
              onClick={() => setCalcTarget({ sectionId: section.id, rowId: "", fresh: false, proc: true })}
              title={`${describeCustomFormula(procSectionAsCustomRow(section, procRows, procCustom))} = ${peso(procSub)}`}
              className="flex w-full items-center justify-center gap-1 h-7 rounded-md border border-amber-300 bg-white text-[9px] font-black uppercase tracking-wider text-amber-700 hover:bg-amber-100"
            >
              <Calculator size={11} />
              {canEditProc ? "Calculator" : "View"}
            </button>
            <p className="text-right text-[9px] font-bold leading-tight text-amber-800 tabular-nums break-words">
              {describeCustomFormula(procSectionAsCustomRow(section, procRows, procCustom))}
            </p>
          </>
        )}
      </div>
      <span
        className={`text-right pr-1 text-[12px] font-black tabular-nums whitespace-nowrap ${
          procHas ? varianceClass(procVar) : "text-slate-300"
        }`}
      >
        {procHas ? signedPeso(procVar) : "—"}
      </span>
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
                            className="h-7 w-16 rounded-md text-[12px] font-bold text-right tabular-nums"
                            ariaLabel="Contingency percent"
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
                            className="h-7 w-16 rounded-md bg-white text-slate-900 text-[12px] font-bold text-right tabular-nums"
                            ariaLabel="Number of units"
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
                    {procLine("Say", peso(procSummary.say), true)}
                    {procLine(
                      "Variance (Eng. − Procurement)",
                      <span className={hasAnyProc ? varianceClass(procSummary.variance) : "text-slate-300"}>
                        {hasAnyProc ? signedPeso(procSummary.variance) : "—"}
                      </span>,
                      true
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

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
                  onClick={() => onOpenChange(false)}
                  className="h-10 px-5 text-[10px] font-black uppercase tracking-wider"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || isLoadingJob}
                  className="h-10 px-6 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider"
                >
                  <Send size={12} />
                  {isSubmitting ? "Saving..." : "Submit"}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>

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
          readOnly={calcTarget?.proc ? !canEditProc : readOnly}
          targetLabel={calcTarget?.proc ? "Procurement Subtotal Amount" : "Total Material Cost"}
          onApply={handleCalcApply}
        />
      </DialogContent>
    </Dialog>
  );
}

export default JobFillUpFormDialog;