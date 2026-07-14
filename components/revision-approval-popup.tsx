"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RevisionApprovalPopupProps {
  latestRevision: any;
  onApprove: () => void;
  onReject: () => void;
}

export function RevisionApprovalPopup({ latestRevision, onApprove, onReject }: RevisionApprovalPopupProps) {
  if (!latestRevision) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 w-80 bg-white border border-amber-200 rounded-2xl shadow-2xl shadow-amber-200/50 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="size-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-[11px] font-black text-amber-700 mb-1">
            Revision Request: {latestRevision.revision_result}
          </p>
          <p className="text-[9px] font-bold text-amber-600 mb-2">
            Revision #{latestRevision.revision_number} · {new Date(latestRevision.revision_date).toLocaleDateString()}
          </p>
          {latestRevision.remarks && (
            <p className="text-[9px] text-amber-800 italic mb-1">
              Remarks: {latestRevision.remarks}
            </p>
          )}
          {latestRevision.spf_revision_remarks_engineering && (
            <p className="text-[9px] text-amber-800 italic mb-3">
              Engineering Remarks: {latestRevision.spf_revision_remarks_engineering}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <Button
              onClick={onReject}
              className="h-8 px-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex-1"
            >
              Reject
            </Button>
            <Button
              onClick={onApprove}
              className="h-8 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex-1"
            >
              Approve
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
