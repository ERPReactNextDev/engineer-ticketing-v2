"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Check, Eye, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  decideJobRequestRevision,
  getJobRequestComparison,
} from "@/lib/job-request-supabase";

type JobRequestRevisionReviewDialogProps = {
  jobRequestNo: string;
  referenceId: string;
  onResolved: () => void;
};

type Revision = Record<string, unknown>;

const REVISION_STATUS = "REVISED JR FORM FORWARD TO ENGINEERING";

function asText(value: unknown, fallback = "—"): string {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item ?? "").trim()).filter(Boolean);
    return items.join(", ") || fallback;
  }
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim());
  if (typeof value !== "string" || !value.trim()) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item ?? "").trim());
    } catch {
      // Use the comma-separated format used by job requests.
    }
  }
  return trimmed.split(",").map((item) => item.trim());
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) return "—";
  if (typeof value === "string" && !value.trim()) return "—";
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-black">{label}</p>
      <p className="whitespace-pre-wrap break-words text-xs font-medium leading-relaxed text-slate-500">{value || "—"}</p>
    </div>
  );
}

function ContactCards({ revision }: { revision: Revision }) {
  const fields = [
    { key: "person", label: "Contact person", values: stringList(revision.contact_person) },
    { key: "designation", label: "Designation", values: stringList(revision.contact_designation) },
    { key: "email", label: "Email address", values: stringList(revision.email) },
    { key: "number", label: "Contact number", values: stringList(revision.contact_number) },
  ];
  const count = Math.max(...fields.map((field) => field.values.length), 0);

  if (!count) return null;

  return (
    <div className="grid gap-3 md:col-span-2 sm:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Contact {index + 1}</p>
          <dl className="grid gap-2">
            {fields.map((field) => (
              <div key={field.key} className="min-w-0">
                <dt className="text-[10px] font-semibold text-slate-500">{field.label}</dt>
                <dd className="mt-0.5 break-words text-xs text-slate-800">{field.values[index] || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="truncate text-right font-semibold text-slate-700">{value}</span>
    </div>
  );
}

export function JobRequestRevisionReviewDialog({
  jobRequestNo,
  referenceId,
  onResolved,
}: JobRequestRevisionReviewDialogProps) {
  const [revision, setRevision] = useState<Revision | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<"approve" | "reject" | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refreshRevision = useCallback(async () => {
    setError("");
    try {
      const nextRevision = await getJobRequestComparison(jobRequestNo);
      setRevision(nextRevision?.status === REVISION_STATUS ? nextRevision : null);
    } catch (reason) {
      console.error("Failed to load job-request revision:", reason);
      setError(reason instanceof Error ? reason.message : "Unable to load the job-request revision.");
    } finally {
      setLoading(false);
    }
  }, [jobRequestNo]);

  useEffect(() => {
    void refreshRevision();
  }, [refreshRevision]);

  const attachments = stringList(revision?.attachments ?? revision?.site_photos)
    .filter(Boolean);
  const displayImage = selectedImage && attachments.includes(selectedImage)
    ? selectedImage
    : attachments[0] ?? null;
  const pdImages = stringList(revision?.pd_database_images)
    .map((url) => url.replace(/%2C/gi, ","));
  const pdCodes = stringList(revision?.pd_database_item_codes);
  const pdQuantities = stringList(revision?.pd_database_quantities);
  const pdDescriptions = stringList(revision?.pd_database_descriptions);
  const pdItemCount = Math.max(pdImages.length, pdCodes.length, pdQuantities.length, pdDescriptions.length);
  const coordinates = revision?.location_coordinates && typeof revision.location_coordinates === "object"
    ? revision.location_coordinates as { lat?: unknown; lng?: unknown }
    : null;

  const decideRevision = async () => {
    if (!pendingDecision || !revision || !referenceId) return;
    setSaving(true);
    setError("");
    try {
      await decideJobRequestRevision(jobRequestNo, pendingDecision, referenceId);
      setRevision(null);
      setPendingDecision(null);
      setOpen(false);
      onResolved();
      toast.success(
        pendingDecision === "approve"
          ? "Revision approved and applied to the job request."
          : "Revision rejected. The original job request was kept unchanged.",
        { position: "top-right" },
      );
    } catch (reason) {
      console.error(`Failed to ${pendingDecision} job-request revision:`, reason);
      const message = reason instanceof Error ? reason.message : "Unable to record the Engineering decision.";
      setError(message);
      toast.error(message, { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || (!revision && !error)) return null;

  return (
    <>
      {revision ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className="animate-pulse gap-2 border-amber-300 bg-amber-50 text-[10px] font-black uppercase tracking-wide text-amber-800 hover:bg-amber-100"
        >
          <Eye className="size-3.5" />
          View Revision
          <span className="rounded-full bg-white/80 px-2 py-1 text-[8px]">{REVISION_STATUS}</span>
        </Button>
      ) : (
        error && <p role="alert" className="text-right text-[10px] text-red-600">Revision status unavailable: {error}</p>
      )}

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setPendingDecision(null);
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-6xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-sm font-extrabold uppercase tracking-wide">Job Request Details</DialogTitle>
            <DialogDescription>{jobRequestNo} · {REVISION_STATUS}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}

            {revision && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
                <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                  <header className="bg-slate-950 px-4 py-3 text-white">
                    <span className="block text-xs font-extrabold uppercase tracking-wide">Project information</span>
                    <span className="block text-[8px] font-semibold uppercase tracking-widest text-slate-400">Job request details</span>
                  </header>
                  <div className="grid gap-x-8 gap-y-6 p-5 md:grid-cols-2 md:p-7">
                    <Detail label="Project name" value={asText(revision.project_name)} />
                    <Detail label="Agent name" value={asText(revision.agent_name)} />
                    <Detail label="Project title" value={asText(revision.project_title)} />
                    <Detail label="Company" value={asText(revision.company)} />
                    <Detail label="Client name" value={asText(revision.client_name, "General client")} />
                    <div className="md:col-span-2">
                      <Detail label="Location" value={asText(revision.location)} />
                      {coordinates && Number.isFinite(Number(coordinates.lat)) && Number.isFinite(Number(coordinates.lng)) && (
                        <a
                          href={`https://maps.google.com/?q=${coordinates.lat},${coordinates.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600"
                        >
                          Open in Google Maps
                        </a>
                      )}
                    </div>
                    <ContactCards revision={revision} />
                    <Detail label="Priority" value={asText(revision.priority)} />
                    <Detail label="Working days" value={asText(revision.working_days)} />
                    <Detail
                      label="Preferred Date Finish"
                      value={`${formatDate(revision.working_time_from)} – ${formatDate(revision.working_time_to)}`}
                    />
                    <Detail label="Other assistance" value={asText(revision.other_assistance)} />
                    <Detail label="Site installation" value={asText(revision.site_installation)} />
                    <Detail label="Item modification" value={asText(revision.in_house)} />
                    <Detail label="Documents needed for work permit" value={asText(revision.permits)} />
                    <Detail label="Mounting height" value={asText(revision.mounting_height)} />
                    <Detail label="Temporary facility" value={asText(revision.temp_facility, "No")} />
                    <Detail label="Safety induction" value={asText(revision.safety_induction, "No")} />
                    <Detail label="Scope quantity" value={asText(revision.scope_qty)} />

                    {pdItemCount > 0 && (
                      <section className="flex max-h-[45vh] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 md:col-span-2">
                        <header className="flex items-center justify-between border-b bg-white p-3">
                          <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">PD Database items</h3>
                          <span className="text-[10px] text-slate-400">{pdItemCount} items</span>
                        </header>
                        <div className="min-h-0 flex-1 overflow-y-auto p-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {Array.from({ length: pdItemCount }, (_, index) => (
                              <div key={`${pdCodes[index] ?? ""}-${index}`} className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 p-2.5">
                                {pdImages[index] ? (
                                  <Image
                                    src={pdImages[index]}
                                    alt={pdCodes[index] || "Product"}
                                    width={48}
                                    height={48}
                                    unoptimized
                                    className="size-12 shrink-0 rounded border object-cover"
                                  />
                                ) : (
                                  <div className="grid size-12 shrink-0 place-items-center rounded border bg-slate-50 text-xs text-slate-400">No image</div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-slate-800">{pdCodes[index] || pdDescriptions[index] || "Item"}</p>
                                  <p className="text-[10px] text-slate-500">Item code: {pdCodes[index] || "—"}</p>
                                  {pdDescriptions[index] && <p className="mt-1 text-[10px] text-slate-600">{pdDescriptions[index]}</p>}
                                </div>
                                <p className="shrink-0 text-xs font-bold text-slate-700">Qty: {pdQuantities[index] || "1"}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    )}

                    <div className="md:col-span-2">
                      <Detail label="Detailed scope of work" value={asText(revision.scope_of_work)} />
                    </div>
                    <Detail label="Other documents" value={asText(revision.other_documents)} />
                    <Detail label="Safety notes" value={asText(revision.safety_notes)} />
                    <div className="md:col-span-2">
                      <Detail label="Sales remarks" value={asText(revision.sales_remarks)} />
                    </div>
                  </div>
                </section>

                <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                  <section className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Photo gallery</h2>
                      <span className="text-[9px] text-slate-400">{attachments.length} photos</span>
                    </div>
                    {displayImage
                      ? <a href={displayImage} target="_blank" rel="noreferrer"><Image src={displayImage} alt="Job request attachment" width={800} height={400} unoptimized className="h-44 w-full rounded-xl bg-slate-100 object-cover" /></a>
                      : <div className="grid h-44 place-items-center rounded-xl bg-slate-50 text-xs text-slate-400">No photos attached</div>}
                    {attachments.length > 1 && (
                      <div className="mt-2 flex gap-2 overflow-x-auto">
                        {attachments.map((url, index) => (
                          <button
                            key={`${url}-${index}`}
                            type="button"
                            onClick={() => setSelectedImage(url)}
                            aria-label={`View attachment ${index + 1}`}
                            className={`size-14 shrink-0 overflow-hidden rounded-lg border-2 ${displayImage === url ? "border-blue-500" : "border-transparent"}`}
                          >
                            <Image src={url} alt={`Attachment ${index + 1}`} width={56} height={56} unoptimized className="size-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                  <section className="rounded-2xl border bg-white p-4 shadow-sm">
                    <h2 className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Request info</h2>
                    <div className="space-y-3 text-xs">
                      <InfoRow label="Created" value={formatDate(revision.created_at)} />
                      <InfoRow label="Submitted by" value={asText(revision.submitted_by_name || revision.agent_name)} />
                      <InfoRow label="Reference" value={jobRequestNo} />
                    </div>
                  </section>
                </aside>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Close</Button>
            <Button
              type="button"
              onClick={() => setPendingDecision("reject")}
              disabled={!revision || !referenceId || saving}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              <X className="mr-1 size-4" /> Reject
            </Button>
            <Button
              type="button"
              onClick={() => setPendingDecision("approve")}
              disabled={!revision || !referenceId || saving}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Check className="mr-1 size-4" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDecision !== null} onOpenChange={(nextOpen) => {
        if (!nextOpen && !saving) setPendingDecision(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDecision === "approve" ? "Approve this revision?" : "Reject this revision?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDecision === "approve"
                ? "The revision changes will be applied to the active job request."
                : "The revision will be rejected and the original job request will remain unchanged."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>No, Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving || !referenceId}
              className={pendingDecision === "reject" ? "bg-red-600 text-white hover:bg-red-700" : ""}
              onClick={(event) => {
                event.preventDefault();
                void decideRevision();
              }}
            >
              {saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
              Yes, {pendingDecision === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
