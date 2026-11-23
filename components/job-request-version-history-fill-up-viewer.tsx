"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Eye } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type JsonRecord = Record<string, unknown>;

type PdDatabaseItem = {
  imageUrl: string;
  itemCode: string;
  quantity: string;
  description: string;
};

type PreferredDateFinish = {
  from: unknown;
  to: unknown;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function getValue(record: JsonRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function numericValue(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: unknown): string {
  const amount = numericValue(value);
  return amount === null
    ? "—"
    : `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function firstValue(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function formatPreferredDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function Detail({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white p-3">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words whitespace-pre-wrap text-xs text-slate-800">{displayValue(value)}</dd>
    </div>
  );
}

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
];

function SummaryTableRow({
  label,
  children,
  tone = "slate",
  variant = "plain",
}: {
  label: ReactNode;
  children: ReactNode;
  tone?: "slate" | "amber";
  variant?: "plain" | "strong" | "red";
}) {
  const borderColor = tone === "amber" ? "border-amber-300" : "border-slate-300";
  return (
    <div
      className={`grid grid-cols-[1fr_200px] border-b last:border-b-0 ${borderColor} ${
        variant === "red" ? "bg-red-600 text-white" : "bg-white text-slate-900"
      }`}
    >
      <div className="flex items-center justify-end gap-2 px-3 py-2 text-right text-[11px] font-black uppercase tracking-wide">
        {label}
      </div>
      <div
        className={`flex items-center justify-end border-l px-3 py-2 text-right text-[13px] tabular-nums ${
          tone === "amber" ? "border-amber-300" : "border-slate-300"
        } ${variant === "plain" ? "font-medium" : "font-black"} ${
          variant === "red" ? "bg-white text-slate-900" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function ReadOnlySetting({ value, suffix }: { value: unknown; suffix: string }) {
  return (
    <span className="inline-flex items-center gap-1 normal-case">
      <span className="inline-flex h-7 min-w-16 items-center justify-end rounded-md border border-amber-300 bg-amber-50 px-2 text-[12px] font-bold tabular-nums text-amber-900">
        {displayValue(value)}
      </span>
      <span className="text-[11px] font-bold">{suffix}</span>
    </span>
  );
}

function EngineeringCostSummary({
  summary,
  totalWorkingDays,
}: {
  summary: JsonRecord;
  totalWorkingDays: unknown;
}) {
  if (Object.keys(summary).length === 0) return null;
  const unitCount = getValue(summary, "unitCount", "unit_count");
  const unitCountNumber = numericValue(unitCount);
  return (
    <section className="mt-5 space-y-3">
      <h3 className="border-b border-slate-200 pb-2 text-xs font-extrabold uppercase tracking-wide text-slate-800">
        Engineering Cost Summary
      </h3>
      <div className="overflow-hidden rounded-md border-2 border-slate-900">
        <div className="grid grid-cols-[1fr_200px] border-b border-emerald-200 bg-emerald-50">
          <div className="flex items-center justify-end px-3 py-2 text-right text-[11px] font-black uppercase tracking-wide text-emerald-800">
            Number of Days
          </div>
          <div className="border-l border-emerald-200 px-3 py-1.5">
            <div className="flex h-8 items-center justify-end rounded-md border border-emerald-300 bg-white px-2 text-[13px] font-black tabular-nums text-emerald-700">
              {displayValue(totalWorkingDays)}
            </div>
          </div>
        </div>
        <SummaryTableRow label="Material Cost">{money(firstValue(getValue(summary, "materialCost", "material_cost"), 0))}</SummaryTableRow>
        <SummaryTableRow label="Labor Cost">{money(firstValue(getValue(summary, "laborCost", "labor_cost"), 0))}</SummaryTableRow>
        <SummaryTableRow label="Consumables">{money(firstValue(getValue(summary, "consumables"), 0))}</SummaryTableRow>
        <SummaryTableRow label="Direct Cost" variant="strong">{money(firstValue(getValue(summary, "directCost", "direct_cost"), 0))}</SummaryTableRow>
        <SummaryTableRow
          label={(
            <>
              Contingency
              <span className="inline-flex items-center gap-1 normal-case">
                <span className="inline-flex h-7 min-w-16 items-center justify-end rounded-md border border-emerald-300 bg-emerald-50 px-2 text-[12px] font-bold tabular-nums text-emerald-900">
                  {displayValue(firstValue(getValue(summary, "contingencyPct", "contingency_pct"), 0))}
                </span>
                <span className="text-[11px] font-bold">%</span>
              </span>
            </>
          )}
        >
          <span className="italic">{money(firstValue(getValue(summary, "contingency"), 0))}</span>
        </SummaryTableRow>
        <SummaryTableRow label="Total Project Cost" variant="red">
          {money(firstValue(getValue(summary, "totalProjectCost", "total_project_cost"), 0))}
        </SummaryTableRow>
      </div>
      <div className="overflow-hidden rounded-md border-2 border-slate-900">
        <SummaryTableRow
          label={(
            <>
              Cost Per Item
              <span className="inline-flex items-center gap-1 normal-case font-bold">
                <span className="text-[10px] opacity-90">÷ No. of units</span>
                <span className="inline-flex h-7 min-w-16 items-center justify-end rounded-md border border-emerald-300 bg-emerald-50 px-2 text-[12px] tabular-nums text-emerald-900">
                  {displayValue(unitCount)}
                </span>
              </span>
            </>
          )}
          variant="red"
        >
          {unitCountNumber !== null && unitCountNumber > 0
            ? money(getValue(summary, "costPerItem", "cost_per_item"))
            : "—"}
        </SummaryTableRow>
      </div>
    </section>
  );
}

function ProcurementCostSummary({
  summary,
  procurement,
}: {
  summary: JsonRecord;
  procurement: JsonRecord;
}) {
  if (Object.keys(summary).length === 0) return null;
  const warrantyPct = firstValue(
    getValue(procurement, "warrantyPct", "warranty_pct"),
    getValue(summary, "warrantyPct", "warranty_pct"),
    0,
  );
  const contingencyPct = firstValue(
    getValue(procurement, "contingencyPct", "contingency_pct"),
    getValue(summary, "contingencyPct", "contingency_pct"),
    0,
  );
  const markup = firstValue(getValue(procurement, "markup"), getValue(summary, "markup"), 0);
  const sayRoundTo = String(getValue(procurement, "sayRoundTo", "say_round_to") ?? "");
  const sayRoundingLabel = SAY_ROUNDING_OPTIONS.find((option) => option.value === sayRoundTo)?.label ?? sayRoundTo;

  return (
    <section className="mt-5 overflow-hidden rounded-md border-2 border-amber-500">
      <div className="bg-amber-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">
        Procurement Cost Summary
      </div>
      <SummaryTableRow tone="amber" label="Total" variant="strong">
        {money(firstValue(getValue(summary, "total"), 0))}
      </SummaryTableRow>
      <SummaryTableRow
        tone="amber"
        label={<>Warranty <ReadOnlySetting value={warrantyPct} suffix="%" /></>}
      >
        {money(firstValue(getValue(summary, "warranty"), 0))}
      </SummaryTableRow>
      <SummaryTableRow
        tone="amber"
        label={<>Contingencies <ReadOnlySetting value={contingencyPct} suffix="%" /></>}
      >
        {money(firstValue(getValue(summary, "contingency"), 0))}
      </SummaryTableRow>
      <SummaryTableRow tone="amber" label="Direct Cost" variant="strong">
        {money(firstValue(getValue(summary, "directCost", "direct_cost"), 0))}
      </SummaryTableRow>
      <SummaryTableRow tone="amber" label="VAT 12%">
        {money(firstValue(getValue(summary, "vat"), 0))}
      </SummaryTableRow>
      <SummaryTableRow
        tone="amber"
        label={<>W/ Mark-up <ReadOnlySetting value={markup} suffix="×" /></>}
      >
        {money(firstValue(getValue(summary, "withMarkup", "with_markup"), 0))}
      </SummaryTableRow>
      <SummaryTableRow
        tone="amber"
        label={(
          <>
            Say
            <span className="inline-flex items-center gap-1 normal-case font-bold">
              <span className="text-[9px] opacity-75">round up to nearest</span>
              <span className="inline-flex h-7 max-w-[190px] items-center rounded-md border border-amber-300 bg-amber-50 px-2 text-[10px] font-bold text-amber-900">
                {sayRoundingLabel || "—"}
              </span>
            </span>
          </>
        )}
        variant="strong"
      >
        {money(firstValue(getValue(summary, "say"), 0))}
      </SummaryTableRow>
    </section>
  );
}

function BoqSectionView({
  section,
  procurementRows,
  showProcurement,
}: {
  section: JsonRecord;
  procurementRows: JsonRecord;
  showProcurement: boolean;
}) {
  const title = displayValue(getValue(section, "title")) === "—"
    ? "BOQ section"
    : displayValue(getValue(section, "title"));
  const rows = getArray(getValue(section, "rows")).map(asRecord);
  if (rows.length === 0) return null;

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-slate-200">
      <h3 className="bg-emerald-50 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-emerald-900">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className={`w-full ${showProcurement ? "min-w-[1150px]" : "min-w-[850px]"} border-collapse text-left text-[11px]`}>
          <thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">Description</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2">Unit</th>
              <th className="p-2 text-right">Material</th>
              <th className="p-2 text-right">Total Material</th>
              <th className="p-2 text-right">Labor</th>
              <th className="p-2 text-right">Total Labor</th>
              <th className="p-2 text-right">Consumable</th>
              <th className="p-2 text-right">Total Consumable</th>
              <th className="p-2 text-right">Total Amount</th>
              {showProcurement ? (
                <>
                  <th className="border-l border-amber-200 p-2 text-right text-amber-700">Procurement Qty</th>
                  <th className="p-2 text-right text-amber-700">Acquired Cost</th>
                  <th className="p-2 text-right text-amber-700">Procurement Total</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rowId = String(getValue(row, "id") ?? "");
              const procurement = asRecord(procurementRows[rowId]);
              const qty = numericValue(getValue(procurement, "qty"));
              const cost = numericValue(getValue(procurement, "cost"));
              const mobDemob = numericValue(getValue(procurement, "mobDemob", "mob_demob")) ?? 0;
              const procurementTotal = firstValue(
                getValue(procurement, "totalAmount", "total_amount", "total"),
                qty !== null && cost !== null ? (qty * cost + mobDemob) * 1.12 : undefined,
              );
              return (
                <tr key={rowId || index} className="border-t border-slate-100 align-top">
                  <td className="p-2 font-semibold">{index + 1}</td>
                  <td className="max-w-64 whitespace-pre-wrap p-2">{displayValue(getValue(row, "description"))}</td>
                  <td className="p-2 text-right">{displayValue(getValue(row, "qty"))}</td>
                  <td className="p-2">{displayValue(getValue(row, "unit"))}</td>
                  <td className="p-2 text-right">{money(getValue(row, "materialCost", "material_cost"))}</td>
                  <td className="p-2 text-right">{money(getValue(row, "totalMaterialCost", "total_material_cost"))}</td>
                  <td className="p-2 text-right">{money(getValue(row, "laborCost", "labor_cost"))}</td>
                  <td className="p-2 text-right">{money(getValue(row, "totalLaborCost", "total_labor_cost"))}</td>
                  <td className="p-2 text-right">{money(getValue(row, "consumableCost", "consumable_cost"))}</td>
                  <td className="p-2 text-right">{money(getValue(row, "totalConsumable", "total_consumable"))}</td>
                  <td className="p-2 text-right font-semibold">{money(getValue(row, "totalAmount", "total_amount"))}</td>
                  {showProcurement ? (
                    <>
                      <td className="border-l border-amber-100 p-2 text-right">{displayValue(getValue(procurement, "qty"))}</td>
                      <td className="p-2 text-right">{money(getValue(procurement, "cost"))}</td>
                      <td className="p-2 text-right font-semibold text-amber-800">{money(procurementTotal)}</td>
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function VersionHistoryFillUpViewer({
  value,
  preferredDateFinish,
  pdDatabaseItems,
  department,
}: {
  value: unknown;
  preferredDateFinish: PreferredDateFinish;
  pdDatabaseItems: PdDatabaseItem[];
  department: string;
}) {
  const [open, setOpen] = useState(false);
  const form = asRecord(value);
  const values = asRecord(getValue(form, "values"));
  const boqVersions = getArray(getValue(form, "boqs")).map(asRecord);
  const [activeBoqIndex, setActiveBoqIndex] = useState(0);
  const activeBoq = boqVersions[activeBoqIndex] ?? {};
  const fallbackVersion = boqVersions.length === 0 ? form : {};
  const boqSections = getArray(
    getValue(activeBoq, "boqSections", "boq_sections")
      ?? getValue(fallbackVersion, "boqSections", "boq_sections"),
  ).map(asRecord);
  const summary = asRecord(
    getValue(activeBoq, "summary") ?? getValue(fallbackVersion, "summary"),
  );
  const procurement = asRecord(
    getValue(activeBoq, "procurement")
      ?? getValue(fallbackVersion, "procurement")
      ?? getValue(form, "procurement"),
  );
  const procurementSummary = asRecord(getValue(procurement, "summary"));
  const procurementRows = asRecord(getValue(procurement, "rows"));
  const showProcurement = department.trim().toLowerCase() !== "engineering";
  const valuesToShow = ([
    ["JR Number", getValue(values, "jrNumber", "jr_number")],
    ["Date Requested", getValue(values, "dateRequested", "date_requested")],
    ["Agent Number", getValue(values, "agentName", "agent_name")],
    ["Project Title", getValue(values, "projectTitle", "project_title")],
    ["Project / Site Name", getValue(values, "projectName", "project_name")],
    ["Client Name", getValue(values, "clientName", "client_name")],
    ["Address", getValue(values, "address")],
    ["Scope of Work", getValue(values, "scopeOfWork", "scope_of_work")],
    ["Number of Days", getValue(values, "totalWorkingDays", "total_working_days")],
  ] as [string, unknown][]).filter(([, fieldValue]) => fieldValue !== undefined && fieldValue !== null && fieldValue !== "");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-[10px] font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
      >
        <Eye className="size-3.5" />
        View fill up form
      </button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setActiveBoqIndex(0);
        }}
      >
        <DialogContent className="flex max-h-[88vh] w-[calc(100%-2rem)] max-w-7xl flex-col gap-0 overflow-hidden p-0 sm:max-w-7xl">
          <DialogHeader className="shrink-0 border-b bg-slate-50 px-5 py-4 text-left">
            <DialogTitle className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
              Fill Up Form
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Saved version · read only{form.savedBy ? ` · ${String(form.savedBy)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            {valuesToShow.length > 0 ? (
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {valuesToShow.map(([label, fieldValue]) => (
                  <Detail key={label} label={label} value={fieldValue} />
                ))}
              </dl>
            ) : null}
            {preferredDateFinish.from || preferredDateFinish.to ? (
              <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <h2 className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Preferred Date Finish
                </h2>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Detail label="From" value={formatPreferredDate(preferredDateFinish.from)} />
                  <Detail label="To" value={formatPreferredDate(preferredDateFinish.to)} />
                </dl>
              </section>
            ) : null}
            {pdDatabaseItems.length > 0 ? (
              <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  PD Database Items
                </h2>
                <div className="grid gap-2 md:grid-cols-2">
                  {pdDatabaseItems.map((item, index) => (
                    <article
                      key={`${item.itemCode}-${index}`}
                      className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 p-2.5"
                    >
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.itemCode || `PD Database item ${index + 1}`}
                          width={56}
                          height={56}
                          unoptimized
                          className="size-14 shrink-0 rounded-md border object-cover"
                        />
                      ) : (
                        <div className="grid size-14 shrink-0 place-items-center rounded-md border bg-slate-50 text-[8px] font-bold text-slate-400">
                          No image
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-bold text-slate-800">
                          {item.itemCode || "PD Database item"}
                        </p>
                        <p className="text-[9px] text-blue-700">Item code: {item.itemCode || "—"}</p>
                        <p className="text-[9px] font-semibold text-slate-600">Quantity: {item.quantity || "—"}</p>
                        {item.description ? (
                          <p className="mt-1 whitespace-pre-wrap break-words text-[9px] text-slate-600">
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            {boqSections.length > 0 ? (
              <>
                <h2 className="mt-6 border-b border-slate-200 pb-2 text-xs font-extrabold uppercase tracking-wide text-slate-900">
                  Bill of Quantities · {showProcurement ? "Engineering & Procurement" : "Engineering"}
                </h2>
                {boqSections.map((section, index) => (
                  <BoqSectionView
                    key={String(getValue(section, "id") ?? index)}
                    section={section}
                    procurementRows={procurementRows}
                    showProcurement={showProcurement}
                  />
                ))}
              </>
            ) : (
              <p className="mt-6 rounded-md border border-dashed p-4 text-sm text-slate-500">
                No BOQ sections were saved in this fill-up form version.
              </p>
            )}
            <EngineeringCostSummary
              summary={summary}
              totalWorkingDays={getValue(values, "totalWorkingDays", "total_working_days")}
            />
            {showProcurement ? (
              <ProcurementCostSummary
                summary={procurementSummary}
                procurement={procurement}
              />
            ) : null}
          </div>
          {boqVersions.length > 1 ? (
            <div className="flex shrink-0 items-center justify-center gap-3 border-t bg-white px-4 py-2">
              <button
                type="button"
                onClick={() => setActiveBoqIndex((index) => Math.max(0, index - 1))}
                disabled={activeBoqIndex === 0}
                className="rounded border px-3 py-1 text-xs disabled:opacity-40"
              >
                Previous BOQ
              </button>
              <span className="text-xs font-semibold text-slate-600">
                BOQ {activeBoqIndex + 1} of {boqVersions.length}
              </span>
              <button
                type="button"
                onClick={() => setActiveBoqIndex((index) => Math.min(boqVersions.length - 1, index + 1))}
                disabled={activeBoqIndex >= boqVersions.length - 1}
                className="rounded border px-3 py-1 text-xs disabled:opacity-40"
              >
                Next BOQ
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
