"use client";

import { useMemo, useRef, useState } from "react";
import { Activity, CheckCircle2, Clock, History, LoaderCircle, Radio, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getSiteVisitHistory,
  type AppointmentHistoryRow,
} from "@/lib/appointment-supabase";

type SiteVisitVersionHistoryDialogProps = {
  appointmentId: string;
  siteVisitNo: string;
};

const VERSION_SECTIONS = [
  {
    title: "Appointment overview",
    fields: [
      "site_visit_no",
      "protocols",
      "client",
      "submitted_by_name",
      "pic",
      "pending_at",
      "confirmed_at",
      "completed_at",
      "cancelled_at",
    ],
  },
  {
    title: "Visit details",
    fields: [
      "appointment_date",
      "address",
      "agenda",
      "notes",
      "personnel",
      "ppe",
      "permits",
      "file_url",
      "confirmation_notes",
      "cancel_reason",
    ],
  },
] as const;

const DISPLAY_FIELDS: Set<string> = new Set(VERSION_SECTIONS.flatMap((section) => section.fields));
DISPLAY_FIELDS.add("status");
DISPLAY_FIELDS.add("contact_person");
DISPLAY_FIELDS.add("designation");
DISPLAY_FIELDS.add("email");
DISPLAY_FIELDS.add("contact_number");

const CONTACT_FIELDS = ["contact_person", "designation", "email", "contact_number"] as const;
const PILL_COLORS: Record<string, string> = {
  protocols: "border-blue-100 bg-blue-50 text-blue-700",
  pic: "border-slate-200 bg-slate-50 text-slate-700",
  personnel: "border-blue-100 bg-blue-50 text-blue-700",
  ppe: "border-amber-100 bg-amber-50 text-amber-700",
  permits: "border-emerald-100 bg-emerald-50 text-emerald-700",
};

function formatFieldLabel(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: unknown): string {
  if (typeof value !== "string" || !value) return "Unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function splitValues(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return values
    .map((item) => (typeof item === "string" || typeof item === "number" ? String(item).trim() : ""))
    .filter(Boolean);
}

function splitContactValues(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return values.map((item) => (typeof item === "string" ? item.trim() : ""));
}

function getContacts(version: AppointmentHistoryRow) {
  const [names, designations, emails, numbers] = CONTACT_FIELDS.map((field) =>
    splitContactValues(version[field])
  );
  const count = Math.max(names.length, designations.length, emails.length, numbers.length);
  return Array.from({ length: count }, (_, index) => ({
    name: names[index] || "",
    designation: designations[index] || "",
    email: emails[index] || "",
    number: numbers[index] || "",
  })).filter((contact) => contact.name || contact.designation || contact.email || contact.number);
}

function formatValue(value: unknown, field: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "string" && field === "appointment_date") {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  if (typeof value === "string" && /_at$/i.test(field)) {
    return formatTimestamp(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (value.every((item) => typeof item === "string" || typeof item === "number")) {
      return value.join(", ");
    }
    return JSON.stringify(value, null, 2);
  }

  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function VersionStatusStep({
  active,
  completed,
  label,
}: {
  active: boolean;
  completed: boolean;
  label: string;
}) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-1">
      <div className={`flex size-6 items-center justify-center rounded-full border-2 transition-all ${
        completed
          ? "border-blue-500 bg-blue-500 text-white"
          : active
            ? "border-blue-500 bg-white text-blue-600 ring-2 ring-blue-50"
            : "border-slate-200 bg-white text-slate-300"
      }`}>
        {completed ? <CheckCircle2 size={10} /> : <div className="size-1.5 rounded-full bg-current" />}
      </div>
      <span className={`text-[8px] font-black uppercase tracking-tight ${
        active ? "text-slate-900" : "text-slate-400"
      }`}>
        {label}
      </span>
    </div>
  );
}

function VersionStatusTracker({
  status,
  changed,
}: {
  status: string;
  changed: boolean;
}) {
  const normalizedStatus = status.toUpperCase();
  const isPending = normalizedStatus === "PENDING";
  const isConfirmed = normalizedStatus === "CONFIRMED";
  const isCompleted = normalizedStatus === "COMPLETED";
  const isCancelled = normalizedStatus === "CANCELLED";
  const StatusIcon = isCancelled ? XCircle : isCompleted ? CheckCircle2 : isConfirmed ? Clock : Activity;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm md:flex-row md:items-center">
      <div className="flex shrink-0 items-center gap-2.5 border-slate-100 pr-3 md:border-r">
        <div className={`flex size-8 items-center justify-center rounded-lg text-white shadow-sm ${
          isCancelled ? "bg-red-500" : isCompleted ? "bg-emerald-500" : isConfirmed ? "bg-blue-500" : "bg-amber-500"
        }`}>
          <StatusIcon size={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-tight text-slate-900">
            {normalizedStatus}
          </span>
          {changed && <span className="text-[8px] font-semibold uppercase text-amber-700">Status changed</span>}
        </div>
      </div>

      <div className="relative flex flex-1 items-center px-2">
        <div className="absolute left-0 top-1/2 z-0 h-0.5 w-full -translate-y-1/2 bg-slate-100" />
        <div
          className="absolute left-0 top-1/2 z-0 h-0.5 -translate-y-1/2 bg-blue-500 transition-all"
          style={{ width: isCompleted ? "100%" : isConfirmed ? "50%" : "0%" }}
        />
        <div className="relative z-10 flex w-full items-center justify-between">
          <VersionStatusStep active={true} completed={!isPending} label="Pending" />
          <VersionStatusStep active={isConfirmed || isCompleted} completed={isCompleted} label="Completed" />
          <VersionStatusStep active={isCompleted} completed={isCompleted} label="Acknowledged" />
        </div>
      </div>
    </div>
  );
}

function getChangedFields(
  current: AppointmentHistoryRow,
  previous?: AppointmentHistoryRow,
): Set<string> {
  if (!previous) return new Set();

  const fields = DISPLAY_FIELDS;
  return new Set(
    [...fields].filter((field) =>
      JSON.stringify(current[field]) !== JSON.stringify(previous[field])
    ),
  );
}

export function SiteVisitVersionHistoryDialog({
  appointmentId,
  siteVisitNo,
}: SiteVisitVersionHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<AppointmentHistoryRow[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSequence = useRef(0);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      loadSequence.current += 1;
      return;
    }

    const requestSequence = ++loadSequence.current;
    setLoading(true);
    setError(null);
    getSiteVisitHistory(appointmentId)
      .then((history) => {
        if (requestSequence !== loadSequence.current) return;
        setVersions(history);
        setSelectedVersionId(history[0]?.history_id ?? null);
      })
      .catch((reason: unknown) => {
        if (requestSequence !== loadSequence.current) return;
        console.error("Failed to load Site Visit version history:", reason);
        setError(reason instanceof Error ? reason.message : "Unable to load version history.");
      })
      .finally(() => {
        if (requestSequence === loadSequence.current) setLoading(false);
      });
  };

  const selectedIndex = versions.findIndex((version) => version.history_id === selectedVersionId);
  const selectedVersion = selectedIndex >= 0 ? versions[selectedIndex] : null;
  const previousVersion = selectedIndex >= 0 ? versions[selectedIndex + 1] : undefined;
  const changedFields = useMemo(
    () => selectedVersion ? getChangedFields(selectedVersion, previousVersion) : new Set<string>(),
    [selectedVersion, previousVersion],
  );
  const selectedContacts = selectedVersion ? getContacts(selectedVersion) : [];
  const contactsChanged = CONTACT_FIELDS.some((field) => changedFields.has(field));
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-7 px-3 inline-flex items-center gap-1.5 rounded-lg border-slate-800 bg-slate-900 text-[7px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-slate-800 hover:text-white"
        >
          <History size={10} />
          Version History
        </Button>
      </DialogTrigger>
      <DialogContent className="z-[110] flex h-[88vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden rounded-xl border-0 p-0 sm:max-w-[96vw] xl:max-w-[1400px]">
        <DialogHeader className="shrink-0 bg-slate-950 p-5 pr-12 text-white">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white">
            <History className="size-4 text-emerald-400" />
            Site Visit version history
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            {siteVisitNo} · {versions.length} {versions.length === 1 ? "version" : "versions"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid min-h-56 flex-1 place-items-center text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" />
              Loading versions…
            </span>
          </div>
        ) : error ? (
          <div role="alert" className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : versions.length === 0 ? (
          <div className="grid min-h-56 flex-1 place-items-center px-5 text-center text-sm text-slate-500">
            No version history is available for this appointment yet.
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[260px_minmax(0,1fr)]">
            <nav
              aria-label="Site Visit versions"
              className="max-h-48 space-y-2 overflow-y-auto border-b bg-slate-50/60 p-3 md:max-h-none md:border-b-0 md:border-r"
            >
              {versions.map((version, index) => {
                const isSelected = version.history_id === selectedVersionId;
                const changeCount = getChangedFields(version, versions[index + 1]).size;

                return (
                  <button
                    key={version.history_id}
                    type="button"
                    onClick={() => setSelectedVersionId(version.history_id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
                      isSelected
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-slate-900">
                        {version.version_label || `Version ${version.version_number}`}
                      </span>
                      {index === 0 && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Latest
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      {formatTimestamp(version.version_created_at)}
                    </span>
                    <span className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="capitalize">{String(version.operation || "").toLowerCase()}</span>
                      {changeCount > 0 && (
                        <span className="font-medium text-amber-700">
                          {changeCount} {changeCount === 1 ? "change" : "changes"}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </nav>

            <section aria-label="Selected Site Visit snapshot" className="min-h-0 overflow-y-auto p-4 md:p-5">
              {selectedVersion && (
                <>
                  <div className="mb-5">
                    <h3 className="text-base font-extrabold text-slate-900">
                      {selectedVersion.version_label}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Saved {formatTimestamp(selectedVersion.version_created_at)}
                      {selectedVersion.operation && (
                        <span className="capitalize"> · {String(selectedVersion.operation).toLowerCase()}</span>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {previousVersion
                        ? `Fields changed from ${previousVersion.version_label} are marked.`
                        : "This is the first saved version."}
                    </p>
                  </div>

                  <VersionStatusTracker
                    status={String(selectedVersion.status || "PENDING")}
                    changed={changedFields.has("status")}
                  />

                  {VERSION_SECTIONS.map((section) => {
                    const sectionFields = section.fields.filter((field) =>
                      selectedVersion[field] !== undefined ||
                      previousVersion?.[field] !== undefined
                    );
                    const hasContacts = section.title === "Visit details" &&
                      CONTACT_FIELDS.some((field) =>
                        selectedVersion[field] !== undefined ||
                        previousVersion?.[field] !== undefined
                      );
                    if (sectionFields.length === 0 && !hasContacts) return null;

                    return (
                      <section key={section.title} className="mb-6">
                        <h4 className="mb-3 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          {section.title}
                        </h4>
                        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {sectionFields.map((field) => {
                            const value = selectedVersion[field];
                            const isChanged = changedFields.has(field);
                            const isUrl = typeof value === "string" && /^https?:\/\//i.test(value);
                            const listValues = ["protocols", "pic", "personnel", "ppe", "permits"].includes(field)
                              ? splitValues(value)
                              : [];

                            return (
                              <div
                                key={field}
                                className={`min-w-0 rounded-lg border p-3 ${
                                  isChanged ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-white"
                                }`}
                              >
                                <dt className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500">
                                  {formatFieldLabel(field)}
                                  {isChanged && (
                                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                                      Changed
                                    </span>
                                  )}
                                </dt>
                                <dd className="mt-1 break-words text-xs text-slate-800">
                                  {isUrl ? (
                                    <a
                                      href={value}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-blue-700 underline"
                                    >
                                      Open attachment
                                    </a>
                                  ) : listValues.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {listValues.map((item, index) => (
                                        <span
                                          key={`${field}-${item}-${index}`}
                                          className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${PILL_COLORS[field] || "border-slate-200 bg-slate-50 text-slate-700"}`}
                                        >
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <pre className="whitespace-pre-wrap break-words font-sans">
                                      {formatValue(value, field)}
                                    </pre>
                                  )}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                        {section.title === "Visit details" && (
                          <div className="mt-4 rounded-lg border border-slate-100 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">
                                Account Contacts
                              </span>
                              {contactsChanged && (
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                                  Changed
                                </span>
                              )}
                            </div>
                            {selectedContacts.length > 0 ? (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {selectedContacts.map((contact, index) => (
                                  <div
                                    key={`${contact.name}-${contact.email}-${index}`}
                                    className="rounded-lg border border-slate-100 bg-slate-50/50 p-2"
                                  >
                                    <div className="flex flex-wrap items-baseline gap-x-1.5">
                                      <span className="text-[11px] font-bold text-slate-700">
                                        {contact.name || "Unnamed contact"}
                                      </span>
                                      {contact.designation && (
                                        <span className="text-[9px] text-slate-500">{contact.designation}</span>
                                      )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      {contact.email && (
                                        <span className="break-all text-[9px] text-slate-600">{contact.email}</span>
                                      )}
                                      {contact.number && (
                                        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[8px] font-semibold text-blue-700">
                                          <Radio size={9} /> {contact.number}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-slate-600">N/A</span>
                            )}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
