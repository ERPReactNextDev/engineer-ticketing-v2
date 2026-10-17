"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Calculator, Delete, History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/* ─────────────────────────────────────────────
   TYPES (stored on the BOQ row)
   "calculator"   = formula typed in the calculator (stays live with Qty / Cost)
   "manual"       = plain typed amount (starting state when the box is ticked)
   "reuse"/"depreciation" = legacy drafts, still supported
───────────────────────────────────────────── */
export type CustomMethod = "manual" | "calculator" | "reuse" | "depreciation";

export type CustomPricingFields = {
  customPricing?: boolean;
  customMethod?: CustomMethod;
  /** manual: typed Total Material Cost. calculator: last computed result (snapshot) */
  customAmount?: string;
  /** calculator: the formula, e.g. "Qty × Cost × 1.1 + 500" */
  customExpression?: string;
  customAngle?: "deg" | "rad";
  /** legacy */
  customUses?: string;
  customYears?: string;
  customUsableDays?: string;
  customDays?: string;
  /** Reason shown to Procurement */
  customNote?: string;
};

export type CustomPricingRow = CustomPricingFields & {
  qty: string;
  materialCost: string;
  description?: string;
  unit?: string;
};

export const CUSTOM_KEYS = [
  "customPricing",
  "customMethod",
  "customAmount",
  "customExpression",
  "customAngle",
  "customUses",
  "customYears",
  "customUsableDays",
  "customDays",
  "customNote",
] as const;

/* ─────────────────────────────────────────────
   SMALL HELPERS
───────────────────────────────────────────── */
const toNumber = (v: string | undefined) => {
  const n = parseFloat(v ?? "");
  return Number.isNaN(n) ? 0 : n;
};

const num2 = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const peso = (n: number) => `₱${num2(n)}`;

const clean = (x: number) => Math.round(x * 1e10) / 1e10;

/* ─────────────────────────────────────────────
   SAFE EXPRESSION EVALUATOR (no eval)
   Supports: + − × ÷ ^ ( ) ! %  sin cos tan asin acos atan ln log √  π e  Qty Cost
   Missing ")" at the end is auto-closed. "2(3)" and "2π" mean multiplication.
───────────────────────────────────────────── */
type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };
type EvalCtx = { qty: number; cost: number; deg: boolean };

const tokenize = (src: string): Tok[] => {
  const s = src
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/π/g, " pi ")
    .replace(/√/g, " sqrt ")
    .replace(/,/g, "");

  const out: Tok[] = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const v = parseFloat(s.slice(i, j));
      if (Number.isNaN(v)) throw new Error("Format error");
      out.push({ t: "num", v });
      i = j;
    } else if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      out.push({ t: "id", v: s.slice(i, j).toLowerCase() });
      i = j;
    } else if ("+-*/^()!%".includes(ch)) {
      out.push({ t: "op", v: ch });
      i++;
    } else {
      throw new Error("Format error");
    }
  }
  return out;
};

const factorial = (n: number) => {
  if (n < 0 || !Number.isInteger(n) || n > 170) throw new Error("Format error");
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
};

export const evaluateExpression = (src: string, ctx: EvalCtx): number => {
  const toks = tokenize(src);
  if (toks.length === 0) throw new Error("Empty");

  let p = 0;
  const isOp = (v: string) => toks[p]?.t === "op" && (toks[p] as any).v === v;

  const toRad = (x: number) => (ctx.deg ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (ctx.deg ? (x * 180) / Math.PI : x);

  const FUNCS: Record<string, (x: number) => number> = {
    sin: (x) => Math.sin(toRad(x)),
    cos: (x) => Math.cos(toRad(x)),
    tan: (x) => Math.tan(toRad(x)),
    asin: (x) => fromRad(Math.asin(x)),
    acos: (x) => fromRad(Math.acos(x)),
    atan: (x) => fromRad(Math.atan(x)),
    ln: Math.log,
    log: Math.log10,
    sqrt: Math.sqrt,
  };

  const startsFactor = () => {
    const t = toks[p];
    if (!t) return false;
    return t.t === "num" || t.t === "id" || (t.t === "op" && t.v === "(");
  };

  const closeParen = () => {
    if (isOp(")")) p++;
    else if (p < toks.length) throw new Error("Format error");
  };

  const expr = (): number => {
    let v = term();
    while (isOp("+") || isOp("-")) {
      const o = (toks[p++] as any).v;
      const r = term();
      v = o === "+" ? v + r : v - r;
    }
    return v;
  };

  const term = (): number => {
    let v = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const o = (toks[p++] as any).v;
        const r = unary();
        if (o === "/") {
          if (r === 0) throw new Error("Can't divide by 0");
          v = v / r;
        } else v = v * r;
      } else if (startsFactor()) {
        v = v * unary(); // implicit multiplication
      } else break;
    }
    return v;
  };

  const unary = (): number => {
    if (isOp("-")) {
      p++;
      return -unary();
    }
    if (isOp("+")) {
      p++;
      return unary();
    }
    return power();
  };

  const power = (): number => {
    const base = postfix();
    if (isOp("^")) {
      p++;
      return Math.pow(base, unary());
    }
    return base;
  };

  const postfix = (): number => {
    let v = primary();
    while (isOp("!") || isOp("%")) {
      const o = (toks[p++] as any).v;
      v = o === "!" ? factorial(v) : v / 100;
    }
    return v;
  };

  const primary = (): number => {
    const t = toks[p++];
    if (!t) throw new Error("Format error");

    if (t.t === "num") return t.v;

    if (t.t === "op" && t.v === "(") {
      const v = expr();
      closeParen();
      return v;
    }

    if (t.t === "id") {
      if (t.v === "pi") return Math.PI;
      if (t.v === "e") return Math.E;
      if (t.v === "qty") return ctx.qty;
      if (t.v === "cost") return ctx.cost;

      const fn = FUNCS[t.v];
      if (fn) {
        let arg: number;
        if (isOp("(")) {
          p++;
          arg = expr();
          closeParen();
        } else {
          arg = power();
        }
        return clean(fn(arg));
      }
    }
    throw new Error("Format error");
  };

  const result = expr();
  if (p < toks.length) throw new Error("Format error");
  if (!Number.isFinite(result)) throw new Error("Math error");
  return clean(result);
};

/* ─────────────────────────────────────────────
   CALCULATION (exported: the form uses these)
───────────────────────────────────────────── */
export const customMethodOf = (r: CustomPricingFields): CustomMethod => r.customMethod ?? "manual";

export const customMethodLabel = (m: CustomMethod) =>
  m === "calculator"
    ? "Calculator"
    : m === "reuse"
    ? "Reuse"
    : m === "depreciation"
    ? "Depreciation"
    : "Manual amount";

/** Total Material Cost of a custom-priced row */
export const computeCustomMaterial = (r: CustomPricingRow): number => {
  const qty = toNumber(r.qty);
  const cost = toNumber(r.materialCost);

  switch (customMethodOf(r)) {
    case "calculator": {
      try {
        return evaluateExpression(r.customExpression ?? "", { qty, cost, deg: r.customAngle !== "rad" });
      } catch {
        return 0;
      }
    }
    case "reuse": {
      const uses = toNumber(r.customUses);
      return uses > 0 ? (cost * qty) / uses : 0;
    }
    case "depreciation": {
      const lifeDays = toNumber(r.customYears) * toNumber(r.customUsableDays);
      return lifeDays > 0 ? (cost / lifeDays) * toNumber(r.customDays) * qty : 0;
    }
    default:
      return toNumber(r.customAmount);
  }
};

/** Short "how was this computed" text */
export const describeCustomFormula = (r: CustomPricingRow): string => {
  const qty = num2(toNumber(r.qty));
  const cost = peso(toNumber(r.materialCost));

  switch (customMethodOf(r)) {
    case "calculator":
      return r.customExpression?.trim() || "Empty formula";
    case "reuse":
      return `${cost} × ${qty} ÷ ${toNumber(r.customUses) || 0} uses`;
    case "depreciation":
      return `${cost} ÷ (${toNumber(r.customYears) || 0} yrs × ${toNumber(r.customUsableDays) || 0} days) × ${
        toNumber(r.customDays) || 0
      } project days × ${qty}`;
    default:
      return "Typed amount (Material Cost is not used)";
  }
};

/** What the display shows when the calculator opens */
const initialExpression = (r: CustomPricingRow): string => {
  if (r.customExpression?.trim()) return r.customExpression;

  const m = customMethodOf(r);
  if (m === "reuse") return `Cost × Qty ÷ ${toNumber(r.customUses) || 1}`;
  if (m === "depreciation")
    return `Cost ÷ (${toNumber(r.customYears) || 1} × ${toNumber(r.customUsableDays) || 1}) × ${
      toNumber(r.customDays) || 1
    } × Qty`;

  const auto = toNumber(r.qty) * toNumber(r.materialCost);
  const typed = toNumber(r.customAmount);
  if (typed > 0 && Math.abs(typed - auto) > 0.005) return String(typed);
  return auto > 0 ? "Qty × Cost" : "";
};

/* ─────────────────────────────────────────────
   KEYPAD BUTTON (module-level component)
───────────────────────────────────────────── */
type KeyKind = "fn" | "num" | "eq" | "active";

const KEY_STYLE: Record<KeyKind, string> = {
  fn: "bg-blue-100/70 text-slate-800 hover:bg-blue-100",
  num: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  eq: "bg-blue-600 text-white hover:bg-blue-700",
  active: "bg-blue-200 text-blue-800 hover:bg-blue-300",
};

function Key({
  label,
  onClick,
  kind = "fn",
  disabled,
}: {
  label: React.ReactNode;
  onClick: () => void;
  kind?: KeyKind;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-11 rounded-full text-[13px] font-semibold transition-colors disabled:opacity-50 ${KEY_STYLE[kind]}`}
    >
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────
   DIALOG
───────────────────────────────────────────── */
interface CustomPricingCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The BOQ row being priced (null while closed) */
  row: CustomPricingRow | null;
  /** View-only (Procurement / locked form) */
  readOnly?: boolean;
  /** Label of the amount being priced (default: Total Material Cost) */
  targetLabel?: string;
  /**
   * Receives only the custom fields. The parent merges them into the row AND closes the dialog
   * (this component does not call onOpenChange on Apply).
   */
  onApply: (patch: CustomPricingFields) => void;
}

export function CustomPricingCalculator({
  open,
  onOpenChange,
  row,
  readOnly = false,
  targetLabel = "Total Material Cost",
  onApply,
}: CustomPricingCalculatorProps) {
  const [expr, setExpr] = useState("");
  const [angle, setAngle] = useState<"deg" | "rad">("deg");
  const [inv, setInv] = useState(false);
  const [ans, setAns] = useState(0);
  const [history, setHistory] = useState<{ expr: string; result: number }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [note, setNote] = useState("");

  // Snapshot of the row every time the dialog opens (edits stay local until Apply)
  useEffect(() => {
    if (!open || !row) return;
    setExpr(initialExpression(row));
    setAngle(row.customAngle === "rad" ? "rad" : "deg");
    setInv(false);
    setAns(computeCustomMaterial(row));
    setHistory([]);
    setShowHistory(false);
    setNote(row.customNote ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const qty = toNumber(row?.qty);
  const cost = toNumber(row?.materialCost);
  const automatic = qty * cost;

  const live = useMemo(() => {
    if (!expr.trim()) return { ok: false as const, msg: "" };
    try {
      return { ok: true as const, value: evaluateExpression(expr, { qty, cost, deg: angle === "deg" }) };
    } catch (e) {
      return { ok: false as const, msg: (e as Error).message === "Empty" ? "" : (e as Error).message };
    }
  }, [expr, angle, qty, cost]);

  const diff = live.ok ? live.value - automatic : 0;

  /* ── keypad actions ── */
  const put = (s: string) => setExpr((e) => e + s);
  const putFn = (s: string) => {
    put(s);
    setInv(false);
  };

  const backspace = () => setExpr((e) => e.slice(0, -1));
  const clearAll = () => setExpr("");

  const equals = () => {
    if (!live.ok) return;
    setAns(live.value);
    setHistory((h) => [{ expr, result: live.value }, ...h].slice(0, 20));
    // keep the formula when it uses Qty / Cost (so it stays live), otherwise collapse to the result
    if (!/qty|cost/i.test(expr)) setExpr(String(live.value));
  };

  const handleApply = () => {
    if (!live.ok) return;
    onApply({
      customPricing: true,
      customMethod: "calculator",
      customExpression: expr.trim(),
      customAmount: live.value.toFixed(2),
      customAngle: angle,
      customNote: note,
    });
  };

  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] !max-w-[560px] max-h-[92vh] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3 pr-6">
            <div className="size-9 bg-amber-500 rounded-lg flex items-center justify-center text-white">
              <Calculator size={16} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[14px] font-black uppercase tracking-tight text-slate-900">
                Custom Pricing Calculator
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                {row.description?.trim() || "Untitled item"} · {targetLabel}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Display */}
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                aria-label="History"
                className="text-slate-500 hover:text-slate-900"
              >
                <History size={16} />
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={backspace}
                  aria-label="Backspace"
                  className="text-slate-500 hover:text-slate-900"
                >
                  <Delete size={16} />
                </button>
              )}
            </div>

            {showHistory && (
              <div className="mt-2 max-h-28 overflow-y-auto rounded-lg bg-slate-50 p-2 space-y-1">
                {history.length === 0 ? (
                  <p className="text-[10px] font-bold text-slate-400">No history yet</p>
                ) : (
                  history.map((h, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={readOnly}
                      onClick={() => {
                        setExpr(h.expr);
                        setShowHistory(false);
                      }}
                      className="block w-full text-right text-[11px] tabular-nums text-slate-600 hover:text-slate-900"
                    >
                      {h.expr} = <span className="font-bold">{num2(h.result)}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            <input
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  equals();
                }
              }}
              readOnly={readOnly}
              placeholder="0"
              aria-label="Expression"
              spellCheck={false}
              className="mt-1 w-full bg-transparent text-right text-3xl font-medium tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
            />
            <p className="h-4 text-right text-[11px] font-bold tabular-nums text-slate-400">
              {live.ok ? `= ${num2(live.value)}` : live.msg}
            </p>
          </div>

          {/* Row values (insert into the formula) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => put("Qty")}
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            >
              Qty = {num2(qty)}
              {row.unit ? ` ${row.unit}` : ""}
            </button>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => put("Cost")}
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            >
              Cost = {peso(cost)}
            </button>
            <span className="text-[10px] font-bold text-slate-400">
              Tap to insert. Formulas with Qty / Cost stay live.
            </span>
          </div>

          {/* Keypad */}
          {!readOnly && (
            <div className="grid grid-cols-7 gap-2">
              {/* Row 1 */}
              <div className="col-span-2 flex h-11 overflow-hidden rounded-full bg-blue-100/70">
                <button
                  type="button"
                  onClick={() => setAngle("deg")}
                  className={`flex-1 text-[13px] font-semibold ${angle === "deg" ? "text-blue-700" : "text-slate-800"}`}
                >
                  Deg
                </button>
                <span className="my-2.5 w-px bg-blue-200" />
                <button
                  type="button"
                  onClick={() => setAngle("rad")}
                  className={`flex-1 text-[13px] font-semibold ${angle === "rad" ? "text-blue-700" : "text-slate-800"}`}
                >
                  Rad
                </button>
              </div>
              <Key label="x!" onClick={() => put("!")} />
              <Key label="(" onClick={() => put("(")} />
              <Key label=")" onClick={() => put(")")} />
              <Key label="%" onClick={() => put("%")} />
              <Key label="AC" onClick={clearAll} />

              {/* Row 2 */}
              <Key label="Inv" kind={inv ? "active" : "fn"} onClick={() => setInv((v) => !v)} />
              <Key label={inv ? "sin⁻¹" : "sin"} onClick={() => putFn(inv ? "asin(" : "sin(")} />
              <Key label={inv ? "eˣ" : "ln"} onClick={() => putFn(inv ? "e^(" : "ln(")} />
              <Key label="7" kind="num" onClick={() => put("7")} />
              <Key label="8" kind="num" onClick={() => put("8")} />
              <Key label="9" kind="num" onClick={() => put("9")} />
              <Key label="÷" onClick={() => put("÷")} />

              {/* Row 3 */}
              <Key label="π" onClick={() => put("π")} />
              <Key label={inv ? "cos⁻¹" : "cos"} onClick={() => putFn(inv ? "acos(" : "cos(")} />
              <Key label={inv ? "10ˣ" : "log"} onClick={() => putFn(inv ? "10^(" : "log(")} />
              <Key label="4" kind="num" onClick={() => put("4")} />
              <Key label="5" kind="num" onClick={() => put("5")} />
              <Key label="6" kind="num" onClick={() => put("6")} />
              <Key label="×" onClick={() => put("×")} />

              {/* Row 4 */}
              <Key label="e" onClick={() => put("e")} />
              <Key label={inv ? "tan⁻¹" : "tan"} onClick={() => putFn(inv ? "atan(" : "tan(")} />
              <Key label={inv ? "x²" : "√"} onClick={() => putFn(inv ? "^2" : "√(")} />
              <Key label="1" kind="num" onClick={() => put("1")} />
              <Key label="2" kind="num" onClick={() => put("2")} />
              <Key label="3" kind="num" onClick={() => put("3")} />
              <Key label="−" onClick={() => put("−")} />

              {/* Row 5 */}
              <Key label="Ans" onClick={() => put(String(clean(ans)))} />
              <Key label="EXP" onClick={() => put("×10^")} />
              <Key label="xʸ" onClick={() => put("^")} />
              <Key label="0" kind="num" onClick={() => put("0")} />
              <Key label="." kind="num" onClick={() => put(".")} />
              <Key label="=" kind="eq" onClick={equals} />
              <Key label="+" onClick={() => put("+")} />
            </div>
          )}

          {/* Reason / note */}
          <div className="space-y-1.5">
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
              Reason / note (shown to Procurement)
            </span>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. supplier quote + 10% handling, tool depreciation, rental from ABC"
              disabled={readOnly}
              rows={2}
              className="rounded-xl text-[12px] font-medium disabled:opacity-100 disabled:bg-slate-50"
            />
          </div>

          {/* Result vs automatic */}
          <div className="rounded-xl bg-slate-900 text-white px-4 py-3 space-y-1">
            <div className="flex items-end justify-between gap-4">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                {targetLabel}
              </span>
              <span className="text-2xl font-black tabular-nums text-emerald-400 whitespace-nowrap">
                {live.ok ? peso(live.value) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold tabular-nums border-t border-white/10 pt-1">
              <span className="text-slate-400">vs automatic (Qty × Cost) {peso(automatic)}</span>
              <span className={diff > 0 ? "text-red-400" : diff < 0 ? "text-emerald-400" : "text-slate-400"}>
                {!live.ok || diff === 0 ? "No difference" : `${diff > 0 ? "+" : "-"}${peso(Math.abs(diff))}`}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 shrink-0 flex-row justify-end gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 px-5 text-[10px] font-black uppercase tracking-wider"
          >
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button
              type="button"
              onClick={handleApply}
              disabled={!live.ok}
              className="h-10 px-6 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider"
            >
              <Calculator size={12} />
              Apply
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CustomPricingCalculator;