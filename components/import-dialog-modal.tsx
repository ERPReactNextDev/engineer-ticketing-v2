"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import {
    Upload, RefreshCw, FileJson, X,
} from "lucide-react"

/* ─────────────── Types ─────────────── */
type ImportOp = { path: string; data: any; auto?: boolean }

/* ─────────────── Regex & constants ─────────────── */
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

const isDocPath = (s: string) => s.includes("/") && s.split("/").length % 2 === 0
const isPlainObj = (v: any) => !!v && typeof v === "object" && !Array.isArray(v)
const trimSlashes = (s: string) => s.trim().replace(/^\/+|\/+$/g, "")

/* ─────────────── Helpers ─────────────── */
/**
 * Supported JSON shapes:
 *  1) { "col/docId": {...}, "col/docId/sub/id": {...} }   ← the format of the JSON download button
 *  2) { "docId": {...}, "docId2": {...} }                  → saved into the target collection
 *  3) [ {...}, {...} ]  (uses item.path or item.id if present, else auto ID) → target collection
 *  4) { ...fields }  single document → target collection, auto ID
 */
function parseImport(json: any, fileName: string, targetCol: string): ImportOp[] {
    const col = trimSlashes(targetCol) || fileName.replace(/\.json$/i, "")
    if (col.split("/").length % 2 === 0) throw new Error(`Invalid target collection "${col}"`)

    const fromItem = (item: any): ImportOp => {
        if (!isPlainObj(item)) throw new Error("Array items must be objects")
        const { path, ...rest } = item
        if (typeof path === "string" && isDocPath(trimSlashes(path))) {
            return { path: trimSlashes(path), data: rest }
        }
        if (typeof item.id === "string" && item.id && !item.id.includes("/")) {
            return { path: `${col}/${item.id}`, data: item }
        }
        return { path: col, data: item, auto: true }
    }

    if (Array.isArray(json)) return json.map(fromItem)
    if (!isPlainObj(json)) throw new Error("JSON must be an object or an array")

    const entries = Object.entries(json)
    if (entries.length === 0) return []

    if (entries.every(([k, v]) => isDocPath(trimSlashes(k)) && isPlainObj(v))) {
        return entries.map(([k, v]) => ({ path: trimSlashes(k), data: v }))
    }
    if (entries.every(([k, v]) => !k.includes("/") && isPlainObj(v))) {
        return entries.map(([k, v]) => ({ path: `${col}/${k}`, data: v }))
    }
    return [{ path: col, data: json, auto: true }]
}

/* ─────────────── Component ─────────────── */
export function ImportDialogModal({
    open,
    onOpenChange,
    dbKey,
    dbLabel,
    defaultCollection,
    onDone,
}: {
    open: boolean
    onOpenChange: (o: boolean) => void
    dbKey: "main" | "logs"
    dbLabel: string
    defaultCollection: string
    onDone: (collectionIds: string[]) => void
}) {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [targetCol, setTargetCol] = React.useState(defaultCollection)
    const [raw, setRaw] = React.useState<{ name: string; json?: any; error?: string }[]>([])
    const [merge, setMerge] = React.useState(true)
    const [restore, setRestore] = React.useState(true)
    const [importing, setImporting] = React.useState(false)
    const [progress, setProgress] = React.useState(0)

    React.useEffect(() => {
        if (open) {
            setTargetCol(defaultCollection.includes("/") ? "" : defaultCollection)
            setRaw([])
            setProgress(0)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const readFiles = async (list: FileList | null) => {
        if (!list) return
        const out: typeof raw = []
        for (const f of Array.from(list)) {
            try {
                out.push({ name: f.name, json: JSON.parse(await f.text()) })
            } catch {
                out.push({ name: f.name, error: "Not valid JSON" })
            }
        }
        setRaw(prev => [...prev, ...out])
        if (inputRef.current) inputRef.current.value = ""
    }

    const parsed = React.useMemo(
        () => raw.map(f => {
            if (f.error) return { name: f.name, ops: [] as ImportOp[], error: f.error }
            try { return { name: f.name, ops: parseImport(f.json, f.name, targetCol), error: undefined as string | undefined } }
            catch (e: any) { return { name: f.name, ops: [] as ImportOp[], error: e.message as string } }
        }),
        [raw, targetCol]
    )
    const allOps = React.useMemo(() => parsed.flatMap(p => p.ops), [parsed])

    const run = async () => {
        if (!allOps.length) return
        setImporting(true)
        setProgress(0)
        let done = 0
        try {
            const response = await fetch("/api/admin/database-fetching", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "x-device-id": localStorage.getItem("deviceId") || "",
                },
                body: JSON.stringify({
                    action: "import",
                    db: dbKey,
                    operations: allOps,
                    merge,
                    restore,
                }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || `Import failed (${response.status})`)
            done = result.imported
            setProgress(done)
            const ids = new Set<string>()
            allOps.forEach(op => {
                const segs = op.path.split("/")
                for (let i = 0; i < segs.length; i += 2) ids.add(segs[i])
            })
            toast.success(`Imported ${done.toLocaleString()} document${done > 1 ? "s" : ""}`)
            onDone(Array.from(ids))
            onOpenChange(false)
        } catch (e: any) {
            console.error(e)
            toast.error(`Import failed: ${e?.message || "unknown error"}` +
                (done ? ` (${done.toLocaleString()} already saved)` : ""))
        } finally {
            setImporting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={o => !importing && onOpenChange(o)}>
            <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-[28px] border-none shadow-2xl bg-white">
                <DialogHeader>
                    <DialogTitle className="text-[18px] font-black text-zinc-900">Import JSON to Firebase</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                        This WRITES to the live database: <span className="uppercase">{dbLabel}</span>. Export a backup first.
                    </p>

                    <div>
                        <input
                            ref={inputRef}
                            type="file"
                            multiple
                            accept=".json,application/json"
                            onChange={e => readFiles(e.target.files)}
                            className="hidden"
                        />
                        <Button variant="outline" className="rounded-xl w-full h-11 text-[12px] font-bold"
                            onClick={() => inputRef.current?.click()} disabled={importing}>
                            <Upload className="size-4 mr-2" /> Choose JSON file(s)
                        </Button>
                    </div>

                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">
                            Target collection (only for files without full paths)
                        </p>
                        <input
                            value={targetCol}
                            onChange={e => setTargetCol(e.target.value)}
                            placeholder="e.g. job_requests"
                            disabled={importing}
                            className="w-full h-9 px-3 rounded-xl bg-zinc-50 border border-zinc-200 text-[12px] font-medium outline-none focus:bg-white focus:border-zinc-400"
                        />
                    </div>

                    {parsed.length > 0 && (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {parsed.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px] border border-zinc-200 rounded-xl px-3 py-2">
                                    <FileJson className="size-3.5 shrink-0 text-zinc-400" />
                                    <span className="font-bold truncate flex-1">{p.name}</span>
                                    {p.error
                                        ? <span className="text-rose-600 font-bold shrink-0">{p.error}</span>
                                        : <span className="text-zinc-500 font-bold shrink-0">{p.ops.length.toLocaleString()} docs</span>}
                                    <button onClick={() => setRaw(prev => prev.filter((_, j) => j !== i))}
                                        disabled={importing} className="text-zinc-400 hover:text-rose-600">
                                        <X className="size-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {allOps.length > 0 && (
                        <p className="text-[10px] font-bold text-zinc-500 break-all">
                            Sample: {allOps.slice(0, 3).map(o => `/${o.path}${o.auto ? "/(auto id)" : ""}`).join(", ")}
                            {allOps.length > 3 ? ` … +${allOps.length - 3} more` : ""}
                        </p>
                    )}

                    <div className="space-y-2 text-[12px] font-bold text-zinc-700">
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input type="checkbox" checked={merge} onChange={e => setMerge(e.target.checked)} disabled={importing} className="mt-0.5" />
                            <span>Merge into existing docs
                                <span className="block text-[10px] font-medium text-zinc-400">Off = replace the whole document if it already exists.</span>
                            </span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input type="checkbox" checked={restore} onChange={e => setRestore(e.target.checked)} disabled={importing} className="mt-0.5" />
                            <span>Restore dates &amp; references
                                <span className="block text-[10px] font-medium text-zinc-400">ISO date strings → Timestamp, "ref:path" → document reference.</span>
                            </span>
                        </label>
                    </div>

                    {importing && (
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                            <div className="h-full bg-zinc-900 transition-all" style={{ width: `${allOps.length ? (progress / allOps.length) * 100 : 0}%` }} />
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={importing}>Cancel</Button>
                        <Button className="rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white" onClick={(e) => { e.preventDefault(); run(); }} disabled={!allOps.length || importing}>
                            {importing
                                ? <><RefreshCw className="size-3.5 mr-1.5 animate-spin" />{progress.toLocaleString()} / {allOps.length.toLocaleString()}</>
                                : <><Upload className="size-3.5 mr-1.5" />Import {allOps.length.toLocaleString()} docs</>}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
