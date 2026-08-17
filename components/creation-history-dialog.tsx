"use client";

import React from "react";
import { History, GitBranch, Eye, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface VersionHistoryItem {
  id: number;
  version_number: number;
  version_label: string;
  created_at: string;
  edited_by: string;
  status: string;
  changes_summary?: string;
}

interface CreationHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionHistory: VersionHistoryItem[];
  selectedVersion: number | null;
  onLoadVersion: (versionId: number) => void;
  onBackToLatest: () => void;
  staffNames?: Record<string, string>;
}

const getStatusMeta = (status: string) => {
  const s = (status || "").toUpperCase().trim();
  if (s.includes("APPROVED BY PROCUREMENT") || s.includes("APPROVED"))
    return { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", glow: "shadow-emerald-200" };
  if (s.includes("COSTING DONE"))
    return { color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", dot: "bg-violet-500", glow: "shadow-violet-200" };
  if (s.includes("REJECTED"))
    return { color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500", glow: "shadow-rose-200" };
  if (s.includes("PROCESSING BY PD"))
    return { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500", glow: "shadow-blue-200" };
  if (s.includes("PROCUREMENT"))
    return { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500", glow: "shadow-blue-200" };
  return { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400", glow: "shadow-amber-200" };
};

export function CreationHistoryDialog({
  open,
  onOpenChange,
  versionHistory,
  selectedVersion,
  onLoadVersion,
  onBackToLatest,
  staffNames = {},
}: CreationHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[24px] max-w-2xl mx-4 p-6 max-h-[80vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-2xl bg-violet-600 flex items-center justify-center">
              <GitBranch size={16} className="text-white" />
            </div>
            <DialogTitle className="text-[13px] font-black uppercase tracking-widest">Creation History</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-zinc-500 leading-relaxed">
            View previous versions of this request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {versionHistory.length === 0 ? (
            <div className="text-center py-8">
              <History size={32} className="mx-auto text-zinc-300 mb-2" />
              <p className="text-sm text-zinc-400">No creation history yet</p>
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
                      onLoadVersion(version.id);
                      onOpenChange(false);
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
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </p>
                      
                      {version.edited_by && (
                        <p className="text-[10px] text-zinc-500">
                          <span className="font-bold">By:</span> {staffNames[version.edited_by] || version.edited_by}
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
                          onLoadVersion(version.id);
                          onOpenChange(false);
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
              onClick={onBackToLatest}
              className="mt-2 rounded-xl font-black text-[8px] uppercase tracking-widest"
            >
              <RefreshCw size={10} className="mr-1" />
              Back to Latest
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}