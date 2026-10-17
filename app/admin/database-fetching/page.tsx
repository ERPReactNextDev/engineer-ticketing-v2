"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
    Database, Search, X, RefreshCw, ChevronDown, ChevronRight,
    Copy, Download, Plus, Trash2, FolderOpen, FileJson, Wand2, Upload,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { db, logsDb } from "@/lib/firebase"
import {
    collection, collectionGroup, getDocs, query, limit, startAfter,
    doc, writeBatch,
    Timestamp, GeoPoint, DocumentReference,
    type QueryDocumentSnapshot, type QuerySnapshot, type Query,
    type DocumentData, type Firestore,
} from "firebase/firestore"

/* ─────────────── Types & config ─────────────── */
type DbKey = "main" | "logs"
type ScopeMode = "group" | "root"
type Row = { id: string; path: string; data: any }
type DiscoverySource = "full" | "partial" | "probe" | "none"

const PAGE_SIZE = 500 // docs per request; loader keeps fetching until exhausted
const SCAN_BATCH = 5000 // docs (keys only) per runQuery page during full scan

// Only used by the partial/fallback scan
const SAMPLE_DOCS = 25
const MAX_DEPTH = 4
const MAX_PATHS_PER_ID = 5
const WORKERS = 3

const DBS: Record<DbKey, { label: string; instance: Firestore }> = {
    main: { label: "Main (engiconnect)", instance: db },
    logs: { label: "Logs", instance: logsDb },
}

/** Last-resort list — used only if every REST method is blocked by your rules. */
const CANDIDATE_COLLECTIONS = [
    "users", "role_permissions", "department_configs", "departments",
    "job_requests", "other_requests", "shop_drawing_requests", "product_requests",
    "site_visits", "dialux_requests", "testing_requests", "recommendations",
    "room_bookings", "meeting_rooms", "pic_assignments", "protocols", "numbers",
    "spf_collaboration", "spf_creations", "notifications", "fcmTokens",
    "activity_logs", "login_logs", "settings", "chats", "messages",
]

/* ─────────────── Helpers ─────────────── */
function serialize(value: any): any {
    if (value === null || value === undefined) return value
    if (value instanceof Timestamp) return value.toDate().toISOString()
    if (value instanceof GeoPoint) return { latitude: value.latitude, longitude: value.longitude }
    if (value instanceof DocumentReference) return `ref:${value.path}`
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.map(serialize)
    if (typeof value === "object") {
        if (typeof value.toBase64 === "function") return `bytes:${value.toBase64()}`
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]))
    }
    return value
}

const manualKey = (k: DbKey) => `dbfetch:collections:${k}`
const cacheKey = (k: DbKey) => `dbfetch:discovered:${k}`

function previewValue(v: any): string {
    if (v === null) return "null"
    if (v === undefined) return "undefined"
    if (typeof v === "object") return Array.isArray(v) ? `[${v.length} items]` : `{${Object.keys(v).length} keys}`
    const s = String(v)
    return s.length > 60 ? s.slice(0, 60) + "…" : s
}

function getRestInfo(firestore: Firestore) {
    const { projectId, apiKey } = firestore.app.options as { projectId?: string; apiKey?: string }
    if (!projectId || !apiKey) throw new Error("Missing projectId/apiKey")
    const databaseId: string = (firestore as any)._databaseId?.database || "(default)"
    return { projectId, apiKey, databaseId }
}

/**
 * COMPLETE SCAN
 * Streams EVERY document path in the database (keys only, allDescendants)
 * and extracts every collection ID at every depth from those paths.
 */
async function fullScan(
    firestore: Firestore,
    onProgress: (docs: number, collections: number) => void,
    isCancelled: () => boolean
): Promise<string[]> {
    const { projectId, apiKey, databaseId } = getRestInfo(firestore)
    const base = `projects/${projectId}/databases/${databaseId}/documents`
    const url = `https://firestore.googleapis.com/v1/${base}:runQuery?key=${apiKey}`

    const found = new Set<string>()
    let totalDocs = 0
    let cursor: string | null = null

    while (!isCancelled()) {
        const structuredQuery: any = {
            from: [{ allDescendants: true }],
            select: { fields: [{ fieldPath: "__name__" }] },
            orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }],
            limit: SCAN_BATCH,
        }
        if (cursor) structuredQuery.startAt = { values: [{ referenceValue: cursor }], before: false }

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ structuredQuery }),
        })
        if (!res.ok) throw new Error(`runQuery ${res.status}`)
        const json = await res.json()

        let count = 0
        let last: string | null = null
        for (const item of Array.isArray(json) ? json : []) {
            const name: string | undefined = item?.document?.name
            if (!name) continue
            count++
            last = name
            const segments = name.slice(base.length + 1).split("/")
            // path = col/doc/col/doc/... → collection IDs sit at even indexes
            for (let i = 0; i < segments.length; i += 2) found.add(segments[i])
        }

        totalDocs += count
        onProgress(totalDocs, found.size)
        if (count < SCAN_BATCH || !last) break
        cursor = last
    }

    return Array.from(found)
}

/** REST: list collection IDs under a parent ("" = database root, or a document path) */
async function restListCollectionIds(firestore: Firestore, parentDocPath = ""): Promise<string[]> {
    const { projectId, apiKey, databaseId } = getRestInfo(firestore)
    const parent = parentDocPath ? "/" + parentDocPath.split("/").map(encodeURIComponent).join("/") : ""
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents${parent}:listCollectionIds?key=${apiKey}`

    const ids: string[] = []
    let pageToken: string | undefined
    do {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageSize: 100, ...(pageToken ? { pageToken } : {}) }),
        })
        if (!res.ok) throw new Error(`REST ${res.status}`)
        const json = await res.json()
        if (Array.isArray(json.collectionIds)) ids.push(...json.collectionIds)
        pageToken = json.nextPageToken
    } while (pageToken)
    return ids
}

/** Fallback #2 (PARTIAL): root IDs + sampled subcollection hunt */
async function sampledScan(
    firestore: Firestore,
    rootIds: string[],
    onProgress: (collections: number) => void,
    isCancelled: () => boolean
): Promise<string[]> {
    const found = new Set<string>(rootIds)
    const queue: { path: string; depth: number }[] = rootIds.map(id => ({ path: id, depth: 1 }))
    const visited = new Set<string>()
    const perIdCount: Record<string, number> = {}

    const worker = async () => {
        while (queue.length && !isCancelled()) {
            const item = queue.shift()!
            if (visited.has(item.path)) continue
            visited.add(item.path)
            if (item.depth >= MAX_DEPTH) continue
            try {
                const snap = await getDocs(query(collection(firestore, item.path), limit(SAMPLE_DOCS)))
                await Promise.all(
                    snap.docs.map(async d => {
                        try {
                            const subIds = await restListCollectionIds(firestore, d.ref.path)
                            for (const id of subIds) {
                                if (!found.has(id)) { found.add(id); onProgress(found.size) }
                                perIdCount[id] = (perIdCount[id] || 0) + 1
                                if (perIdCount[id] <= MAX_PATHS_PER_ID) {
                                    queue.push({ path: `${d.ref.path}/${id}`, depth: item.depth + 1 })
                                }
                            }
                        } catch { /* skip doc */ }
                    })
                )
            } catch { /* skip collection */ }
        }
    }
    await Promise.all(Array.from({ length: WORKERS }, worker))
    return Array.from(found)
}

/** Fallback #3: probe known names with the client SDK */
async function probeCollections(firestore: Firestore, names: string[]): Promise<string[]> {
    const results = await Promise.all(
        names.map(async name => {
            try {
                const snap = await getDocs(query(collection(firestore, name), limit(1)))
                return snap.empty ? null : name
            } catch {
                return null
            }
        })
    )
    return results.filter((n): n is string => !!n)
}

/**
 * JSON block. Always rendered in the DOM so browser Ctrl+F can search it.
 * When collapsed it uses hidden="until-found" (Chrome/Edge) and auto-opens on a match.
 */
function JsonBlock({ data, open, onReveal }: { data: any; open: boolean; onReveal: () => void }) {
    const ref = React.useRef<HTMLPreElement>(null)

    React.useEffect(() => {
        const el = ref.current
        if (!el) return
        el.addEventListener("beforematch", onReveal)
        return () => el.removeEventListener("beforematch", onReveal)
    }, [onReveal])

    return (
        <pre
            ref={ref}
            {...(open ? {} : ({ hidden: "until-found" } as any))}
            className="bg-zinc-950 text-emerald-300 text-[11px] leading-relaxed p-4 overflow-x-auto max-h-[480px] overflow-y-auto"
        >
            {JSON.stringify(data, null, 2)}
        </pre>
    )
}

/* ─────────────── IMPORT ─────────────── */
type ImportOp = { path: string; data: any; auto?: boolean }

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/
const isDocPath = (s: string) => s.includes("/") && s.split("/").length % 2 === 0
const isPlainObj = (v: any) => !!v && typeof v === "object" && !Array.isArray(v)
const trimSlashes = (s: string) => s.trim().replace(/^\/+|\/+$/g, "")

/** Reverse of serialize(): ISO strings → Timestamp, "ref:path" → DocumentReference */
function revive(value: any, firestore: Firestore): any {
    if (typeof value === "string") {
        if (ISO_RE.test(value)) {
            const d = new Date(value)
            if (!isNaN(d.getTime())) return Timestamp.fromDate(d)
        }
        if (value.startsWith("ref:")) {
            const p = trimSlashes(value.slice(4))
            if (isDocPath(p)) return doc(firestore, p)
        }
        return value
    }
    if (Array.isArray(value)) return value.map(v => revive(v, firestore))
    if (isPlainObj(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, revive(v, firestore)]))
    return value
}

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

function ImportDialog({
    open, onOpenChange, firestore, dbLabel, defaultCollection, onDone,
}: {
    open: boolean
    onOpenChange: (o: boolean) => void
    firestore: Firestore
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
            for (let i = 0; i < allOps.length; i += 400) {
                const chunk = allOps.slice(i, i + 400)
                const batch = writeBatch(firestore)
                for (const op of chunk) {
                    const ref = op.auto ? doc(collection(firestore, op.path)) : doc(firestore, op.path)
                    const data = restore ? revive(op.data, firestore) : op.data
                    merge ? batch.set(ref, data, { merge: true }) : batch.set(ref, data)
                }
                await batch.commit()
                done += chunk.length
                setProgress(done)
            }
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
            toast.error(
                (e?.code === "permission-denied" ? "Write blocked by Firestore rules." : `Import failed: ${e?.message || "unknown error"}`) +
                (done ? ` (${done.toLocaleString()} already saved)` : "")
            )
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
                        <Button className="rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white" onClick={run} disabled={!allOps.length || importing}>
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

/* ─────────────── Page ─────────────── */
export default function DatabaseFetchingPage() {
    const [userId, setUserId] = React.useState<string | null>(null)
    const [dbKey, setDbKey] = React.useState<DbKey>("main")
    const [mode, setMode] = React.useState<ScopeMode>("group")

    const [discovered, setDiscovered] = React.useState<string[]>([])
    const [source, setSource] = React.useState<DiscoverySource>("none")
    const [manual, setManual] = React.useState<string[]>([])
    const [discovering, setDiscovering] = React.useState(false)
    const [scanDocs, setScanDocs] = React.useState(0)
    const [scanCols, setScanCols] = React.useState(0)
    const [newCollection, setNewCollection] = React.useState("")
    const [colFilter, setColFilter] = React.useState("")
    const [importOpen, setImportOpen] = React.useState(false)

    const [selected, setSelected] = React.useState<string | null>(null)
    const [rows, setRows] = React.useState<Row[]>([])
    const [loading, setLoading] = React.useState(false)
    const [loadedCount, setLoadedCount] = React.useState(0)
    const requestIdRef = React.useRef(0)
    const autoSelectedRef = React.useRef(false)

    const [search, setSearch] = React.useState("")
    // Rows are EXPANDED by default; this tracks the ones the user collapsed
    const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())

    React.useEffect(() => {
        setUserId(localStorage.getItem("userId"))
    }, [])

    /* ── Discovery: full → partial → probe ── */
    const discoverCollections = React.useCallback(async (key: DbKey, isCancelled: () => boolean = () => false) => {
        setDiscovering(true)
        setScanDocs(0)
        setScanCols(0)
        const firestore = DBS[key].instance
        const finish = (list: string[], src: DiscoverySource) => {
            if (isCancelled()) return
            const sorted = [...list].sort((a, b) => a.localeCompare(b))
            setDiscovered(sorted)
            setSource(src)
            if (src === "full") {
                try { localStorage.setItem(cacheKey(key), JSON.stringify(sorted)) } catch {}
            }
        }

        try {
            // 1) COMPLETE: every document path, every depth
            try {
                const all = await fullScan(
                    firestore,
                    (d, c) => { if (!isCancelled()) { setScanDocs(d); setScanCols(c) } },
                    isCancelled
                )
                if (isCancelled()) return
                finish(all, "full")
                if (all.length === 0) toast.info("Database appears empty. Paste names manually if needed.")
                return
            } catch (e) {
                console.warn("Full scan blocked, falling back:", e)
            }

            // 2) PARTIAL: root IDs + sampling
            try {
                const roots = await restListCollectionIds(firestore, "")
                if (isCancelled()) return
                const all = await sampledScan(firestore, roots, n => !isCancelled() && setScanCols(n), isCancelled)
                finish(all, "partial")
                toast.warning("Full scan blocked by your rules. Showing PARTIAL results (sampled).")
                return
            } catch (e) {
                console.warn("REST listing blocked, probing known names:", e)
            }

            // 3) PROBE
            const probed = await probeCollections(firestore, CANDIDATE_COLLECTIONS)
            finish(probed, probed.length ? "probe" : "none")
            toast.warning(probed.length
                ? "REST blocked. Showing readable known collections only. Paste the rest manually."
                : "Nothing could be discovered. Paste collection names manually.")
        } finally {
            if (!isCancelled()) setDiscovering(false)
        }
    }, [])

    /* ── On DB change ── */
    React.useEffect(() => {
        let cancelled = false
        try {
            const raw = localStorage.getItem(manualKey(dbKey))
            setManual(raw ? JSON.parse(raw) : [])
        } catch { setManual([]) }

        let cached: string[] = []
        try {
            const raw = localStorage.getItem(cacheKey(dbKey))
            cached = raw ? JSON.parse(raw) : []
        } catch {}

        setSelected(null)
        setRows([])
        setDiscovered(cached)
        setSource(cached.length ? "full" : "none")
        autoSelectedRef.current = false
        discoverCollections(dbKey, () => cancelled)
        return () => { cancelled = true }
    }, [dbKey, discoverCollections])

    const persistManual = (list: string[]) => {
        setManual(list)
        try { localStorage.setItem(manualKey(dbKey), JSON.stringify(list)) } catch {}
    }

    const allCollections = React.useMemo(
        () => Array.from(new Set([...discovered, ...manual])).sort((a, b) => a.localeCompare(b)),
        [discovered, manual]
    )

    const visibleCollections = React.useMemo(() => {
        const q = colFilter.trim().toLowerCase()
        return q ? allCollections.filter(n => n.toLowerCase().includes(q)) : allCollections
    }, [allCollections, colFilter])

    /* ── Fetch ALL documents (auto-paginates until exhausted) ── */
    const fetchAll = React.useCallback(
        async (name: string) => {
            const reqId = ++requestIdRef.current
            setLoading(true)
            setLoadedCount(0)
            const firestore = DBS[dbKey].instance
            const isPath = name.includes("/")
            let useGroup = mode === "group" && !isPath

            const makeBase = (): Query<DocumentData> =>
                useGroup ? collectionGroup(firestore, name) : collection(firestore, name)

            let last: QueryDocumentSnapshot<DocumentData> | null = null
            let first = true

            try {
                while (true) {
                    if (reqId !== requestIdRef.current) return

                    const buildQ = () =>
                        last
                            ? query(makeBase(), startAfter(last), limit(PAGE_SIZE))
                            : query(makeBase(), limit(PAGE_SIZE))

                    let snap: QuerySnapshot<DocumentData>
                    try {
                        snap = await getDocs(buildQ())
                    } catch (e: any) {
                        if (first && useGroup && e?.code === "permission-denied") {
                            toast.info("Collection group blocked by rules. Showing root collection only.")
                            useGroup = false
                            snap = await getDocs(buildQ())
                        } else throw e
                    }
                    if (reqId !== requestIdRef.current) return
                    first = false

                    const newRows: Row[] = snap.docs.map(d => ({
                        id: d.id,
                        path: d.ref.path,
                        data: serialize(d.data()),
                    }))

                    setRows(prev => [...prev, ...newRows])
                    setLoadedCount(prev => prev + newRows.length)

                    if (snap.docs.length < PAGE_SIZE) break
                    last = snap.docs[snap.docs.length - 1]
                }
            } catch (e: any) {
                if (reqId !== requestIdRef.current) return
                console.error(e)
                toast.error(e?.code === "permission-denied"
                    ? "Permission denied by Firestore security rules."
                    : `Failed to load: ${e?.message || "unknown error"}`)
            } finally {
                if (reqId === requestIdRef.current) setLoading(false)
            }
        },
        [dbKey, mode]
    )

    const selectCollection = (name: string) => {
        setSelected(name)
        setRows([])
        setCollapsed(new Set())
        setSearch("")
        fetchAll(name)
    }

    /* Re-fetch when scope mode changes */
    const firstModeRun = React.useRef(true)
    React.useEffect(() => {
        if (firstModeRun.current) { firstModeRun.current = false; return }
        if (selected) selectCollection(selected)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode])

    /* Auto-open first collection */
    React.useEffect(() => {
        if (autoSelectedRef.current || selected || discovered.length === 0) return
        autoSelectedRef.current = true
        selectCollection(discovered[0])
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [discovered])

    /* Bulk add (comma / space / newline separated) */
    const addCollections = () => {
        const names = newCollection
            .split(/[\s,;]+/)
            .map(s => s.trim().replace(/^\/+|\/+$/g, ""))
            .filter(Boolean)
        if (!names.length) return

        const valid = names.filter(n => n.split("/").length % 2 === 1)
        const invalid = names.length - valid.length
        if (invalid) toast.error(`${invalid} invalid path(s) skipped (subcollection paths look like users/abc/orders)`)
        if (!valid.length) return

        const merged = Array.from(new Set([...manual, ...valid.filter(n => !discovered.includes(n))]))
        persistManual(merged)
        setNewCollection("")
        toast.success(`Added ${valid.length} collection${valid.length > 1 ? "s" : ""}`)
        selectCollection(valid[0])
    }

    const removeManual = (name: string) => {
        persistManual(manual.filter(m => m !== name))
        if (selected === name) { setSelected(null); setRows([]) }
    }

    /* ── Filtering ── */
    const filteredRows = React.useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter(r => r.path.toLowerCase().includes(q) || JSON.stringify(r.data).toLowerCase().includes(q))
    }, [rows, search])

    const toggleExpand = (path: string) =>
        setCollapsed(prev => {
            const next = new Set(prev)
            next.has(path) ? next.delete(path) : next.add(path)
            return next
        })

    const copyJson = async (data: any) => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
            toast.success("Copied to clipboard")
        } catch { toast.error("Copy failed") }
    }

    const downloadJson = () => {
        if (!selected) return
        const payload = Object.fromEntries(filteredRows.map(r => [r.path, r.data]))
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${selected.replace(/\//g, "_")}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const sourceLabel = discovering
        ? `Scanning... ${scanDocs.toLocaleString()} docs · ${scanCols} groups`
        : source === "full" ? "Complete (all groups, all levels)"
        : source === "partial" ? "Partial (sampled)"
        : source === "probe" ? "Partial (known names)"
        : "Manual"

    return (
        <ProtectedPageWrapper>
            <SidebarProvider defaultOpen={false}>
                <AppSidebar userId={userId} />
                <SidebarInset className="bg-[#F8FAFA] min-h-screen m-0 rounded-none border-none shadow-none overflow-auto font-sans">
                    <PageHeader
                        title="Database Viewer"
                        version="v1"
                        showBackButton={true}
                        trigger={<SidebarTrigger className="mr-2" />}
                    />

                    <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-4">
                        {/* DB selector */}
                        <div className="flex flex-wrap items-center gap-2">
                            <Database className="size-4 text-zinc-500" />
                            {(Object.keys(DBS) as DbKey[]).map(k => (
                                <button
                                    key={k}
                                    onClick={() => setDbKey(k)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide border transition-all",
                                        dbKey === k
                                            ? "bg-zinc-900 text-white border-zinc-900"
                                            : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-100"
                                    )}
                                >
                                    {DBS[k].label}
                                </button>
                            ))}
                            <Button
                                onClick={() => setImportOpen(true)}
                                className="ml-auto h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-black uppercase tracking-wide"
                            >
                                <Upload className="size-3.5 mr-1.5" /> Import JSON
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
                            {/* ── Collections sidebar ── */}
                            <aside className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4 space-y-3 h-fit lg:sticky lg:top-20">
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0">
                                        <h2 className="text-[12px] font-black uppercase tracking-widest text-zinc-800">
                                            Collection Groups ({allCollections.length})
                                        </h2>
                                        <p className={cn(
                                            "text-[9px] font-black uppercase tracking-widest mt-0.5",
                                            source === "full" && !discovering ? "text-emerald-600" : "text-zinc-400"
                                        )}>
                                            {sourceLabel}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost" size="sm"
                                        onClick={() => discoverCollections(dbKey)}
                                        disabled={discovering}
                                        className="h-8 px-2"
                                        title="Re-scan all collections"
                                    >
                                        {discovering
                                            ? <RefreshCw className="size-3 animate-spin" />
                                            : <Wand2 className="size-3" />}
                                    </Button>
                                </div>

                                {/* Filter collections */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                                    <input
                                        value={colFilter}
                                        onChange={e => setColFilter(e.target.value)}
                                        placeholder="Filter collections..."
                                        className="w-full h-9 pl-8 pr-8 rounded-xl bg-zinc-50 border border-zinc-200 text-[12px] outline-none focus:bg-white focus:border-zinc-400"
                                    />
                                    {colFilter && (
                                        <button onClick={() => setColFilter("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Add collections (bulk paste supported) */}
                                <div className="flex gap-2">
                                    <textarea
                                        value={newCollection}
                                        onChange={e => setNewCollection(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addCollections() }
                                        }}
                                        rows={2}
                                        placeholder="Paste names (comma/line separated) or path/to/sub"
                                        className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-[12px] font-medium outline-none focus:bg-white focus:border-zinc-400 resize-none"
                                    />
                                    <Button size="sm" onClick={addCollections} disabled={!newCollection.trim()} className="h-auto rounded-xl bg-zinc-900 text-white">
                                        <Plus className="size-4" />
                                    </Button>
                                </div>

                                {/* List */}
                                <div className="space-y-1 max-h-[55vh] overflow-y-auto">
                                    {discovering && allCollections.length === 0 &&
                                        [...Array(6)].map((_, i) => (
                                            <div key={i} className="h-9 rounded-xl bg-zinc-100 animate-pulse" />
                                        ))}
                                    {!discovering && allCollections.length === 0 && (
                                        <p className="text-[11px] text-zinc-400 font-medium py-4 text-center">
                                            No collections found. Paste names above.
                                        </p>
                                    )}
                                    {visibleCollections.map(name => {
                                        const isManual = manual.includes(name)
                                        return (
                                            <div
                                                key={name}
                                                className={cn(
                                                    "group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border transition-all",
                                                    selected === name
                                                        ? "bg-zinc-900 text-white border-zinc-900"
                                                        : "bg-zinc-50/50 border-zinc-100 hover:bg-zinc-100"
                                                )}
                                                onClick={() => selectCollection(name)}
                                            >
                                                <FolderOpen className="size-3.5 shrink-0" />
                                                <span className="text-[12px] font-bold truncate flex-1">{name}</span>
                                                {isManual && !discovered.includes(name) && (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); removeManual(name) }}
                                                        className={cn("opacity-0 group-hover:opacity-100 transition-opacity",
                                                            selected === name ? "text-white/70 hover:text-white" : "text-zinc-400 hover:text-rose-600")}
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </aside>

                            {/* ── Documents panel ── */}
                            <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4 md:p-5 min-w-0">
                                {!selected ? (
                                    <div className="py-20 text-center text-zinc-400">
                                        <FileJson className="size-10 mx-auto mb-3 opacity-50" />
                                        <p className="text-[13px] font-bold">Select a collection to view its documents</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-wrap items-center gap-2 mb-4">
                                            <div className="min-w-0 mr-auto">
                                                <h2 className="text-[16px] font-black text-zinc-900 truncate">{selected}</h2>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                    {filteredRows.length}
                                                    {search ? ` of ${rows.length}` : ""} docs
                                                    {loading ? ` · loading... ${loadedCount.toLocaleString()}` : " · all loaded"}
                                                </p>
                                            </div>

                                            {/* Scope toggle */}
                                            <div className="flex rounded-xl border border-zinc-200 overflow-hidden h-9">
                                                {(["group", "root"] as ScopeMode[]).map(m => (
                                                    <button
                                                        key={m}
                                                        onClick={() => setMode(m)}
                                                        className={cn(
                                                            "px-3 text-[10px] font-black uppercase tracking-wide transition-all",
                                                            mode === m ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"
                                                        )}
                                                    >
                                                        {m === "group" ? "Group" : "Root"}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                                                <input
                                                    value={search}
                                                    onChange={e => setSearch(e.target.value)}
                                                    placeholder="Filter loaded docs..."
                                                    className="h-9 w-52 pl-8 pr-8 rounded-xl bg-zinc-50 border border-zinc-200 text-[12px] outline-none focus:bg-white focus:border-zinc-400"
                                                />
                                                {search && (
                                                    <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                                                        <X className="size-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            <Button variant="outline" size="sm" className="h-9 rounded-xl text-[11px] font-bold"
                                                onClick={() => setCollapsed(new Set())}>
                                                Expand all
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-9 rounded-xl text-[11px] font-bold"
                                                onClick={() => setCollapsed(new Set(filteredRows.map(r => r.path)))}>
                                                Collapse
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-9 rounded-xl text-[11px] font-bold"
                                                onClick={downloadJson} disabled={filteredRows.length === 0}>
                                                <Download className="size-3.5 mr-1" /> JSON
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-9 rounded-xl text-[11px] font-bold"
                                                onClick={() => { setRows([]); fetchAll(selected) }}
                                                disabled={loading}>
                                                <RefreshCw className={cn("size-3.5 mr-1", loading && "animate-spin")} /> Refresh
                                            </Button>
                                        </div>

                                        {/* Rows */}
                                        <div className="space-y-2">
                                            {loading && rows.length === 0 &&
                                                [...Array(5)].map((_, i) => (
                                                    <div key={i} className="h-14 rounded-xl bg-zinc-100 animate-pulse" />
                                                ))}

                                            {filteredRows.map(row => {
                                                const isOpen = !collapsed.has(row.path)
                                                const entries = Object.entries(row.data || {})
                                                return (
                                                    <div key={row.path} className="border border-zinc-200 rounded-xl overflow-hidden">
                                                        <div
                                                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-50"
                                                            onClick={() => toggleExpand(row.path)}
                                                        >
                                                            {isOpen
                                                                ? <ChevronDown className="size-4 text-zinc-400 shrink-0" />
                                                                : <ChevronRight className="size-4 text-zinc-400 shrink-0" />}
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[12px] font-black text-zinc-900 truncate">/{row.path}</p>
                                                                {!isOpen && (
                                                                    <p className="text-[11px] text-zinc-500 truncate">
                                                                        {entries.slice(0, 4).map(([k, v]) => `${k}: ${previewValue(v)}`).join("  ·  ") || "(no fields)"}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 shrink-0">
                                                                {entries.length} fields
                                                            </span>
                                                            <button
                                                                onClick={e => { e.stopPropagation(); copyJson({ path: row.path, ...row.data }) }}
                                                                className="text-zinc-400 hover:text-zinc-800 shrink-0"
                                                                title="Copy JSON"
                                                            >
                                                                <Copy className="size-3.5" />
                                                            </button>
                                                        </div>
                                                        <JsonBlock
                                                            data={row.data}
                                                            open={isOpen}
                                                            onReveal={() => setCollapsed(prev => {
                                                                if (!prev.has(row.path)) return prev
                                                                const next = new Set(prev)
                                                                next.delete(row.path)
                                                                return next
                                                            })}
                                                        />
                                                    </div>
                                                )
                                            })}

                                            {!loading && rows.length > 0 && filteredRows.length === 0 && (
                                                <p className="text-center text-[12px] text-zinc-400 font-medium py-8">No loaded documents match your filter.</p>
                                            )}
                                        </div>

                                        {loading && rows.length > 0 && (
                                            <p className="text-center text-[11px] font-bold text-zinc-400 py-3 flex items-center justify-center gap-2">
                                                <RefreshCw className="size-3 animate-spin" /> Loading remaining documents...
                                            </p>
                                        )}
                                    </>
                                )}
                            </section>
                        </div>

                        <ImportDialog
                            open={importOpen}
                            onOpenChange={setImportOpen}
                            firestore={DBS[dbKey].instance}
                            dbLabel={DBS[dbKey].label}
                            defaultCollection={selected ?? ""}
                            onDone={ids => {
                                const extra = ids.filter(n => !allCollections.includes(n))
                                if (extra.length) persistManual([...manual, ...extra])
                                if (selected) { setRows([]); fetchAll(selected) }
                            }}
                        />
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </ProtectedPageWrapper>
    )
}