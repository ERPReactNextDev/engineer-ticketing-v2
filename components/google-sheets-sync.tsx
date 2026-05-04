"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { FileSpreadsheet, Download, Upload, RefreshCw, CheckCircle, AlertCircle, Sheet, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"

interface SyncStatus {
    type: "idle" | "importing" | "exporting" | "syncing" | "success" | "error";
    message: string;
    details?: any;
}

interface GoogleSheetsSyncProps {
    selectedIds?: string[];
    onSyncComplete?: () => void;
}

export function GoogleSheetsSync({ selectedIds = [], onSyncComplete }: GoogleSheetsSyncProps) {
    const [open, setOpen] = React.useState(false)
    const [status, setStatus] = React.useState<SyncStatus>({ type: "idle", message: "" })
    const [lastSync, setLastSync] = React.useState<string>("Never")

    // Load last sync time from localStorage
    React.useEffect(() => {
        const saved = localStorage.getItem("testing_sheet_last_sync")
        if (saved) setLastSync(saved)
    }, [])

    const handleImport = async () => {
        setStatus({ type: "importing", message: "Importing data from Google Sheet..." })
        
        try {
            const response = await fetch("/api/testing/google-sheet-sync", {
                method: "GET",
            })
            const result = await response.json()
            
            if (result.success) {
                setStatus({ 
                    type: "success", 
                    message: `Successfully imported ${result.details.imported} items from Google Sheet!`,
                    details: result.details 
                })
                const now = new Date().toLocaleString()
                localStorage.setItem("testing_sheet_last_sync", now)
                setLastSync(now)
                onSyncComplete?.()
            } else {
                setStatus({ type: "error", message: result.message || "Import failed" })
            }
        } catch (error) {
            setStatus({ type: "error", message: (error as Error).message })
        }
    }

    const [forceOverwrite, setForceOverwrite] = React.useState(false)
    const [showForceConfirm, setShowForceConfirm] = React.useState(false)

    const handleExport = async (force = false) => {
        setStatus({ type: "exporting", message: force ? "Force exporting (overwriting existing data)..." : "Exporting data to Google Sheet..." })
        
        try {
            const response = await fetch("/api/testing/google-sheet-sync", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    ...(force && { "x-force-overwrite": "true" })
                },
                body: JSON.stringify({ entryIds: selectedIds.length > 0 ? selectedIds : undefined }),
            })
            const result = await response.json()
            
            if (response.status === 409 && result.requiresForce) {
                // Sheet has existing data - show force option
                setStatus({ 
                    type: "error", 
                    message: `Sheet has ${result.existingRows} existing rows. Use "Force Export" to overwrite, or data will append.` 
                })
                setShowForceConfirm(true)
                return
            }
            
            if (result.success) {
                setStatus({ 
                    type: "success", 
                    message: force 
                        ? `Force exported ${result.count} items (overwrote existing data)` 
                        : `Successfully exported ${result.count} items to Google Sheet!` 
                })
                const now = new Date().toLocaleString()
                localStorage.setItem("testing_sheet_last_sync", now)
                setLastSync(now)
                setShowForceConfirm(false)
            } else {
                setStatus({ type: "error", message: result.message || "Export failed" })
            }
        } catch (error) {
            setStatus({ type: "error", message: (error as Error).message })
        }
    }

    return (
        <>
            <Button
                variant="outline"
                onClick={() => setOpen(true)}
                className="h-11 px-4 rounded-xl bg-white border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 font-bold text-[10px] tracking-widest"
            >
                <FileSpreadsheet className="size-4 mr-2" />
                Google Sheets
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                            <Sheet className="size-4" />
                            Google Sheets Sync
                        </DialogTitle>
                        <DialogDescription className="text-[11px] text-zinc-400">
                            Sync Testing Tracker data with Google Sheets for PQ team collaboration
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* Status Display */}
                        {status.type !== "idle" && (
                            <div className={cn(
                                "p-4 rounded-xl text-center",
                                status.type === "success" && "bg-emerald-50 border border-emerald-200",
                                status.type === "error" && "bg-rose-50 border border-rose-200",
                                (status.type === "importing" || status.type === "exporting" || status.type === "syncing") && "bg-blue-50 border border-blue-200"
                            )}>
                                {status.type === "success" && <CheckCircle className="size-5 text-emerald-500 mx-auto mb-2" />}
                                {status.type === "error" && <AlertCircle className="size-5 text-rose-500 mx-auto mb-2" />}
                                {(status.type === "importing" || status.type === "exporting" || status.type === "syncing") && (
                                    <RefreshCw className="size-5 text-blue-500 mx-auto mb-2 animate-spin" />
                                )}
                                <p className={cn(
                                    "text-[12px] font-bold",
                                    status.type === "success" && "text-emerald-700",
                                    status.type === "error" && "text-rose-700",
                                    (status.type === "importing" || status.type === "exporting" || status.type === "syncing") && "text-blue-700"
                                )}>
                                    {status.message}
                                </p>
                                {status.details && (
                                    <p className="text-[10px] text-zinc-500 mt-1">
                                        Imported: {status.details.imported} | Skipped: {status.details.skipped}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Sync Options */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={handleImport}
                                disabled={status.type === "importing" || status.type === "exporting"}
                                className="p-4 rounded-2xl border border-zinc-200 hover:border-blue-400 hover:bg-blue-50 transition-all group disabled:opacity-50"
                            >
                                <Download className="size-6 text-zinc-400 group-hover:text-blue-500 mx-auto mb-2" />
                                <p className="text-[11px] font-black text-zinc-700 group-hover:text-blue-700">Import from Sheet</p>
                                <p className="text-[9px] text-zinc-400 mt-1">Pull Google Sheet data</p>
                            </button>

                            <button
                                onClick={() => handleExport(false)}
                                disabled={status.type === "importing" || status.type === "exporting"}
                                className="p-4 rounded-2xl border border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group disabled:opacity-50"
                            >
                                <Upload className="size-6 text-zinc-400 group-hover:text-emerald-500 mx-auto mb-2" />
                                <p className="text-[11px] font-black text-zinc-700 group-hover:text-emerald-700">
                                    {selectedIds.length > 0 ? `Export Selected (${selectedIds.length})` : "Export All"}
                                </p>
                                <p className="text-[9px] text-zinc-400 mt-1">Safe append to sheet</p>
                            </button>
                        </div>

                        {/* Force Export Warning */}
                        {showForceConfirm && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <ShieldAlert className="size-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[11px] font-bold text-amber-800">⚠️ DANGER: Force Export Will Overwrite Data</p>
                                        <p className="text-[10px] text-amber-700 mt-1">
                                            This will DELETE all existing data in the Google Sheet and replace it with app data. 
                                            Only use if the client specifically requested a full reset.
                                        </p>
                                        <button
                                            onClick={() => handleExport(true)}
                                            disabled={status.type === "importing" || status.type === "exporting"}
                                            className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-[10px] font-bold hover:bg-amber-700 transition-colors disabled:opacity-50"
                                        >
                                            ⚠️ Yes, Force Export & Overwrite
                                        </button>
                                        <button
                                            onClick={() => setShowForceConfirm(false)}
                                            className="mt-3 ml-2 px-4 py-2 bg-zinc-200 text-zinc-700 rounded-lg text-[10px] font-bold hover:bg-zinc-300 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Info */}
                        <div className="bg-zinc-50 rounded-xl p-3">
                            <p className="text-[10px] text-zinc-500">
                                <span className="font-bold">Last Sync:</span> {lastSync}
                            </p>
                            <p className="text-[9px] text-zinc-400 mt-1">
                                Sheet ID: 1bR_3xvyc_S5QrZX941wu-Avy5KTxDWlq83ze28voWpw
                            </p>
                        </div>

                        {/* Safety Notice */}
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-emerald-700 flex items-center gap-2">
                                <ShieldAlert className="size-4" />
                                🔒 Safe Mode: Export will APPEND data, never delete
                            </p>
                            <p className="text-[9px] text-emerald-600 mt-1">
                                The client&apos;s live Google Sheet data is protected. New data appends at the bottom.
                                Force Export (overwrite) requires explicit confirmation.
                            </p>
                        </div>

                        {/* Instructions */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">For Product Quality (PQ) Team:</p>
                            <ul className="text-[10px] text-zinc-500 space-y-1">
                                <li>• Add items directly in Google Sheet with columns: Ref ID, Product, Shipment Code, Qty, Dates</li>
                                <li>• Click &quot;Import from Sheet&quot; to sync into the app</li>
                                <li>• App updates automatically sync back to the sheet</li>
                                <li>• PQ team has full access to manage testing items and quality tracking</li>
                            </ul>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
