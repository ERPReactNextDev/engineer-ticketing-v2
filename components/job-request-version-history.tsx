"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileClock, History, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getJobRequestHistory, type JobRequestHistoryRow } from "@/lib/job-request-supabase";
import { VersionHistoryFillUpViewer } from "@/components/job-request-version-history-fill-up-viewer";

type JobRequestVersionHistoryDialogProps = {
  jobRequestId: string;
  jobRequestNo: string;
  department: string;
};

/* -------------------------------------------------------------------------- */
/*  Field configuration                                                       */
/* -------------------------------------------------------------------------- */

const HISTORY_COLUMNS = new Set([
  "history_id",
  "version_number",
  "version_label",
  "version_created_at",
  "operation",
]);

const NON_VERSION_FIELDS = new Set([
  ...HISTORY_COLUMNS,
  "updated_at",
  "messages",
  "viewed_status_by_user",
  "created_by",
  "created_by_signature",
]);

const PD_DATABASE_FIELDS = new Set([
  "pd_database_images",
  "pd_database_item_codes",
  "pd_database_quantities",
  "pd_database_descriptions",
]);

const HIDDEN_SNAPSHOT_FIELDS = new Set([
  "id",
  "admin_notes",
  "adminNotes",
  "location_coordinates",
  "messages",
  "priority",
  "viewed_status_by_user",
  "working_time",
  "boqs",
  "procurement_say",
  "procurement_summary",
  "approved_by_procurement_name",
  "created_by",
  "created_by_signature",
]);
const SUBMITTED_BY_FIELD = "submitted_by";
const AGENT_REFERENCE_FIELD = "agent_name";
const APPROVER_REFERENCE_FIELDS = new Set([
  "approved_by_engineering_member",
  "approved_by_engineering_leader",
  "approved_by_engineering_manager",
  "approved_by_procurement",
]);
const USER_REFERENCE_FIELDS = new Set([
  SUBMITTED_BY_FIELD,
  AGENT_REFERENCE_FIELD,
  ...APPROVER_REFERENCE_FIELDS,
]);
const RESOLVED_NAME_FIELDS = new Set([AGENT_REFERENCE_FIELD, ...APPROVER_REFERENCE_FIELDS]);

function isHiddenSnapshotField(field: string): boolean {
  return HIDDEN_SNAPSHOT_FIELDS.has(field) || /signature/i.test(field);
}

/**
 * Display order, most important first.
 * Fields that are not listed here fall into "Other details" (sorted A–Z),
 * which is shown right before the attachments.
 * Adjust the field names to match your actual columns.
 */
type FieldSection = {
  title: string;
  fields: string[];
  isRest?: boolean;
  isNotes?: boolean;
};

const FIELD_SECTIONS: FieldSection[] = [
  {
    title: "Request",
    fields: [
      "job_request_no",
      "reference_no",
      "status",
      "request_type",
      "job_type",
      "urgency",
    ],
  },
  {
    title: "Customer & contact",
    fields: [
      "company_name",
      "customer_name",
      "client_name",
      "contact_person",
      "contact_designation",
      "email",
      "email_address",
      "contact_number",
      "contact_no",
      "address",
      "location",
    ],
  },
  {
    title: "Scope of work",
    fields: [
      "project_name",
      "subject",
      "title",
      "description",
      "job_description",
      "scope_of_work",
      "requirements",
      "remarks",
    ],
  },
  {
    title: "Schedule",
    fields: [
      "date_needed",
      "due_date",
      "target_date",
      "deadline",
      "start_date",
      "end_date",
      "date_submitted",
      "date_created",
      "created_at",
      "working_days",
    ],
  },
  { title: "Notes", fields: [], isNotes: true },
  { title: "Other details", fields: [], isRest: true },
  { title: "Photo Gallery", fields: ["attachments"] },
];

type PdDatabaseVersionItem = {
  imageUrl: string;
  itemCode: string;
  quantity: string;
  description: string;
};

/* -------------------------------------------------------------------------- */
/*  Date formatting                                                           */
/*    no time  -> November 11, 2026                                           */
/*    has time -> Nov 11, 2026 10:30 am                                       */
/* -------------------------------------------------------------------------- */

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const ISO_DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

function formatDateParts(date: Date, withTime: boolean): string {
  if (!withTime) {
    return `${MONTHS_LONG[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const meridiem = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 || 12;

  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} ${hour12}:${minutes} ${meridiem}`;
}

/** Returns a formatted string, or null when the value is not a date. */
function formatDateValue(value: string, forceTime = false): string | null {
  const trimmed = value.trim();
  const match = ISO_DATE_RE.exec(trimmed);
  if (!match) return null;

  const hasTimePart = match[4] !== undefined;

  // Date-only values: build a local date to avoid the UTC off-by-one-day issue.
  if (!hasTimePart) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) return null;
    return formatDateParts(date, forceTime);
  }

  let normalized = trimmed.replace(" ", "T");
  if (/[+-]\d{2}$/.test(normalized)) normalized += ":00";

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;

  const isMidnight =
    date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;

  return formatDateParts(date, forceTime || !isMidnight);
}

function formatTimestamp(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "—";

  const formatted = formatDateValue(value, true);
  if (formatted) return formatted;

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? value : formatDateParts(fallback, true);
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function getVersionTitle(version: JobRequestHistoryRow): string {
  return version.version_label || `Version ${version.version_number}`;
}

function getVersionSortValue(version: JobRequestHistoryRow): number {
  const number = Number(version.version_number);
  if (!Number.isNaN(number)) return number;
  const time = new Date(String(version.version_created_at)).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getSnapshotKey(version: JobRequestHistoryRow): string {
  return JSON.stringify(
    Object.entries(version)
      .filter(([field]) => !NON_VERSION_FIELDS.has(field) && !isHiddenSnapshotField(field))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function removeDuplicateSnapshots(rows: JobRequestHistoryRow[]): JobRequestHistoryRow[] {
  // Oldest -> newest so that "duplicate" always means "nothing changed since the last save".
  const ordered = [...rows].sort((a, b) => getVersionSortValue(a) - getVersionSortValue(b));
  const uniqueRows: JobRequestHistoryRow[] = [];
  let previousSnapshotKey: string | null = null;

  for (const row of ordered) {
    const snapshotKey = getSnapshotKey(row);
    if (snapshotKey === previousSnapshotKey) continue;
    uniqueRows.push(row);
    previousSnapshotKey = snapshotKey;
  }

  // Newest first for display.
  return uniqueRows.reverse();
}

function getChangedFields(
  version: JobRequestHistoryRow,
  previous: JobRequestHistoryRow | undefined,
): Set<string> {
  const changed = new Set<string>();
  if (!previous) return changed;

  const fields = new Set([...Object.keys(version), ...Object.keys(previous)]);
  for (const field of fields) {
    if (NON_VERSION_FIELDS.has(field) || isHiddenSnapshotField(field)) continue;
    if (JSON.stringify(version[field]) !== JSON.stringify(previous[field])) {
      changed.add(field);
    }
  }
  return changed;
}

function formatFieldLabel(field: string): string {
  const label = field.replace(/_/g, " ").trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isNotesField(field: string): boolean {
  const normalized = field.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  return /(^|_)notes$/.test(normalized);
}

function formatNotesValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => String(item ?? "")).join("\n");
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}

function formatFieldValue(value: unknown): string {
  if (typeof value === "string") {
    if (!value.trim()) return "—";
    return formatDateValue(value) ?? value;
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function getBulletItems(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return items
    .map((item) => (item == null ? "" : String(item).trim()))
    .filter(Boolean);
}

function isLongValue(value: unknown): boolean {
  const text = formatFieldValue(value);
  return text.length > 80 || text.includes("\n");
}

function getAttachmentUrls(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          const trimmed = value.trim();
          if (trimmed.startsWith("[")) {
            try {
              const parsed: unknown = JSON.parse(trimmed);
              if (Array.isArray(parsed)) return parsed;
            } catch {
              return [trimmed];
            }
          }
          return trimmed.split(/[\r\n,]\s*(?=https?:\/\/)/i);
        })()
      : [];

  return values
    .filter((item): item is string => typeof item === "string")
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\/\S+$/i.test(url));
}

function getSeparatedValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => (item == null ? "" : String(item).trim()));
  }
  if (typeof value !== "string" || !value.trim()) return [];

  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => (item == null ? "" : String(item).trim()));
      }
    } catch {
      // Fall back to the comma-separated format used by the job-request form.
    }
  }

  return trimmed.split(",").map((item) => item.trim());
}

function getPdDatabaseVersionItems(version: JobRequestHistoryRow): PdDatabaseVersionItem[] {
  const images = getSeparatedValues(version.pd_database_images).map((url) =>
    url.replace(/%2C/gi, ","),
  );
  const itemCodes = getSeparatedValues(version.pd_database_item_codes);
  const quantities = getSeparatedValues(version.pd_database_quantities);
  const descriptions = getSeparatedValues(version.pd_database_descriptions);
  const count = Math.max(images.length, itemCodes.length, quantities.length, descriptions.length);

  return Array.from({ length: count }, (_, index) => ({
    imageUrl: images[index] ?? "",
    itemCode: itemCodes[index] ?? "",
    quantity: quantities[index] ?? "",
    description: descriptions[index] ?? "",
  }));
}

function isImageUrl(url: string): boolean {
  try {
    return /\.(avif|gif|jpe?g|png|webp|bmp|svg)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

async function fetchUserDisplayName(referenceId: string): Promise<string> {
  const response = await fetch(`/api/user-by-reference?referenceid=${encodeURIComponent(referenceId)}`);
  if (!response.ok) {
    throw new Error(`Unable to resolve user reference ${referenceId} (${response.status}).`);
  }

  const user: unknown = await response.json();
  if (!user || typeof user !== "object") {
    throw new Error(`Invalid user response for reference ${referenceId}.`);
  }

  const record = user as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";

  return name || referenceId;
}

function formatResolvedFieldValue(
  field: string,
  value: unknown,
  names: Record<string, string>,
): string {
  if (RESOLVED_NAME_FIELDS.has(field) && typeof value === "string") {
    const referenceId = value.trim();
    return (names[referenceId] ?? referenceId) || "—";
  }
  return formatFieldValue(value);
}

function isResolvedNameField(field: string): boolean {
  return RESOLVED_NAME_FIELDS.has(field);
}

function buildSections(
  version: JobRequestHistoryRow,
): { title: string; fields: [string, unknown][] }[] {
  const visible = new Set(
    Object.keys(version).filter(
      (field) =>
        !HISTORY_COLUMNS.has(field)
        && !PD_DATABASE_FIELDS.has(field)
        && !isHiddenSnapshotField(field)
        && field !== SUBMITTED_BY_FIELD,
    ),
  );

  const listed = new Set(FIELD_SECTIONS.flatMap((section) => section.fields));
  const notes = [...visible].filter(isNotesField).sort((a, b) => a.localeCompare(b));
  notes.forEach((field) => listed.add(field));
  const rest = [...visible].filter((field) => !listed.has(field)).sort((a, b) => a.localeCompare(b));

  return FIELD_SECTIONS.map((section) => {
    const names = section.isNotes
      ? notes
      : section.isRest
      ? rest
      : section.fields.filter((field) => visible.has(field));
    return {
      title: section.title,
      fields: names.map((field): [string, unknown] => [field, version[field]]),
    };
  }).filter((section) => section.fields.length > 0);
}

const CONTACT_FIELD_KEYS = {
  name: ["contact_person"],
  designation: ["contact_designation"],
  email: ["email", "email_address"],
  number: ["contact_number", "contact_no"],
} as const;

function getContactRows(fields: [string, unknown][]) {
  const values = Object.fromEntries(
    Object.entries(CONTACT_FIELD_KEYS).map(([key, aliases]) => {
      const field = fields.find(([name, value]) => aliases.includes(name as never) && value !== null && value !== undefined && value !== "");
      return [key, {
        field: field?.[0] ?? aliases[0],
        values: getSeparatedValues(field?.[1]),
      }];
    }),
  ) as Record<keyof typeof CONTACT_FIELD_KEYS, { field: string; values: string[] }>;

  const hasContactFields = fields.some(([field]) =>
    Object.values(CONTACT_FIELD_KEYS).some((aliases) => aliases.includes(field as never)),
  );
  const count = hasContactFields
    ? Math.max(1, ...Object.values(values).map((entry) => entry.values.length))
    : 0;

  return Array.from({ length: count }, (_, index) => ({
    index,
    details: Object.entries(values).map(([key, entry]) => ({
      key,
      field: entry.field,
      label: key === "name" ? "Contact person"
        : key === "designation" ? "Designation"
        : key === "email" ? "Email address"
        : "Contact number",
      value: entry.values[index] ?? "—",
    })),
  }));
}

/* -------------------------------------------------------------------------- */
/*  Small presentational pieces                                               */
/* -------------------------------------------------------------------------- */

function ChangedBadge({ label = "Changed" }: { label?: string }) {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
      {label}
    </span>
  );
}

function SectionHeading({ title, changed }: { title: string; changed?: boolean }) {
  return (
    <h4 className="mb-2 flex items-center border-b border-slate-200 pb-1.5 text-xs font-bold text-slate-900">
      {title}
      {changed ? <ChangedBadge /> : null}
    </h4>
  );
}

function AttachmentGrid({ value }: { value: unknown }) {
  const urls = getAttachmentUrls(value);

  if (urls.length === 0) {
    return <span className="whitespace-pre-wrap">{formatFieldValue(value)}</span>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {urls.map((url, index) => (
        <a
          key={`${url}-${index}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="group min-w-0 overflow-hidden rounded-md border bg-slate-50"
        >
          {isImageUrl(url) ? (
            <Image
              src={url}
              alt={`Attachment ${index + 1}`}
              width={640}
              height={420}
              unoptimized
              className="h-48 w-full object-contain transition-transform group-hover:scale-[1.02]"
            />
          ) : (
            <span className="block truncate p-3 text-blue-700 underline">{url}</span>
          )}
        </a>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function JobRequestVersionHistoryDialog({
  jobRequestId,
  jobRequestNo,
  department,
}: JobRequestVersionHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<JobRequestHistoryRow[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const requestedReferences = useRef<Set<string>>(new Set());

  /* Load history ----------------------------------------------------------- */
  useEffect(() => {
    if (!open || !jobRequestId) return;

    let active = true;

    void getJobRequestHistory(jobRequestNo)
      .then((rows) => {
        if (!active) return;
        const uniqueRows = removeDuplicateSnapshots(rows);
        setVersions(uniqueRows);
        setSelectedVersionId((current) =>
          uniqueRows.some((row) => row.history_id === current)
            ? current
            : uniqueRows[0]?.history_id ?? "",
        );
      })
      .catch((reason: unknown) => {
        console.error("Failed to load job-request version history:", reason);
        if (active) {
          setVersions([]);
          setError("Unable to load version history. Check your Supabase connection and table permissions.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, jobRequestId, jobRequestNo]);

  /* Resolve agent / submitter names --------------------------------------- */
  useEffect(() => {
    if (!open || versions.length === 0) return;

    const referenceIds = Array.from(
      new Set(
        versions
          .flatMap((version) => Array.from(USER_REFERENCE_FIELDS, (field) => version[field]))
          .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
          .map((value) => value.trim()),
      ),
    ).filter((referenceId) => !requestedReferences.current.has(referenceId));

    if (referenceIds.length === 0) return;
    referenceIds.forEach((referenceId) => requestedReferences.current.add(referenceId));

    void Promise.all(
      referenceIds.map(async (referenceId) => {
        try {
          return [referenceId, await fetchUserDisplayName(referenceId)] as const;
        } catch (reason) {
          console.error("Failed to resolve job-request user name:", reason);
          return [referenceId, referenceId] as const;
        }
      }),
    ).then((resolvedNames) => {
      setAgentNames((current) => ({ ...current, ...Object.fromEntries(resolvedNames) }));
    });
  }, [open, versions]);

  /* Derived data ----------------------------------------------------------- */
  const selectedIndex = versions.findIndex((version) => version.history_id === selectedVersionId);
  const selectedVersion = selectedIndex >= 0 ? versions[selectedIndex] : undefined;
  // versions are newest-first, so the previous save is the next item in the list
  const previousVersion = selectedIndex >= 0 ? versions[selectedIndex + 1] : undefined;

  const changedByVersion = useMemo(() => {
    const map = new Map<string, Set<string>>();
    versions.forEach((version, index) => {
      map.set(version.history_id, getChangedFields(version, versions[index + 1]));
    });
    return map;
  }, [versions]);

  const changedFields = selectedVersion
    ? changedByVersion.get(selectedVersion.history_id) ?? new Set<string>()
    : new Set<string>();

  const sections = useMemo(
    () => (selectedVersion ? buildSections(selectedVersion) : []),
    [selectedVersion],
  );
  const photoGallerySection = sections.find((section) => section.title === "Photo Gallery");
  const pdDatabaseItems = selectedVersion ? getPdDatabaseVersionItems(selectedVersion) : [];
  const pdChanged = [...PD_DATABASE_FIELDS].some((field) => changedFields.has(field));

  const selectedSubmittedByReference =
    typeof selectedVersion?.[SUBMITTED_BY_FIELD] === "string"
      ? selectedVersion[SUBMITTED_BY_FIELD].trim()
      : "";

  /* Render ----------------------------------------------------------------- */
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setLoading(true);
          setError("");
          setOpen(true);
        }}
        className="h-8 shrink-0 gap-2 border-slate-700 bg-slate-900 px-3 text-[9px] font-bold uppercase tracking-wide text-white hover:bg-slate-800 hover:text-white"
      >
        <History className="size-3.5" />
        Version history
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100%-2rem)] max-w-7xl flex-col gap-0 overflow-hidden p-0 sm:max-w-7xl">
          <DialogHeader className="border-b bg-slate-950 px-5 py-4 text-left text-white">
            <DialogTitle className="flex items-center gap-2 text-sm font-extrabold tracking-wide">
              <FileClock className="size-4 text-emerald-400" />
              Job request version history
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {jobRequestNo} · {versions.length} {versions.length === 1 ? "version" : "versions"}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="grid min-h-56 place-items-center text-sm text-slate-500">
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" />
                Loading versions…
              </span>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          ) : versions.length === 0 ? (
            <div className="grid min-h-56 place-items-center px-5 text-center text-sm text-slate-500">
              No version history is available for this request yet.
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[260px_minmax(0,1fr)]">
              {/* Version list */}
              <nav
                aria-label="Job request versions"
                className="max-h-48 space-y-2 overflow-y-auto border-b bg-slate-50/60 p-3 md:max-h-none md:border-b-0 md:border-r"
              >
                {versions.map((version, index) => {
                  const isSelected = version.history_id === selectedVersionId;
                  const changeCount = changedByVersion.get(version.history_id)?.size ?? 0;

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
                          {getVersionTitle(version)}
                        </span>
                        {index === 0 ? (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                            Latest
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500">
                        {formatTimestamp(version.version_created_at)}
                      </span>
                      <span className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="capitalize">{String(version.operation ?? "").toLowerCase()}</span>
                        {changeCount > 0 ? (
                          <span className="font-medium text-amber-700">
                            {changeCount} {changeCount === 1 ? "change" : "changes"}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </nav>

              {/* Snapshot */}
              <section
                aria-label="Selected version snapshot"
                className="min-h-0 overflow-y-auto p-4 md:p-5"
              >
                {selectedVersion ? (
                  <>
                    <div className="mb-5">
                      <h3 className="text-base font-extrabold text-slate-900">
                        {getVersionTitle(selectedVersion)}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Saved {formatTimestamp(selectedVersion.version_created_at)}
                        {selectedVersion.operation ? (
                          <span className="capitalize"> · {String(selectedVersion.operation).toLowerCase()}</span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {previousVersion
                          ? `Fields that changed from ${getVersionTitle(previousVersion)} are marked.`
                          : "This is the first saved version."}
                      </p>
                    </div>

                    {photoGallerySection ? (
                      <section aria-label="Photo Gallery" className="mb-4">
                        <SectionHeading
                          title="Photo Gallery"
                          changed={photoGallerySection.fields.some(([field]) => changedFields.has(field))}
                        />
                        <div className="space-y-4">
                          {photoGallerySection.fields.map(([field, value]) => (
                            <div key={field} className="min-w-0">
                              <dd className="break-words text-xs text-slate-700">
                                <AttachmentGrid value={value} />
                              </dd>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {/* People */}
                    <div className="mb-4 text-center">
                      <dl className="grid gap-4">
                        <div>
                          <dt className="flex items-center justify-center text-[11px] font-semibold text-slate-500">
                            Submitted by
                            {changedFields.has(SUBMITTED_BY_FIELD) ? <ChangedBadge /> : null}
                          </dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-900">
                            {selectedSubmittedByReference
                              ? agentNames[selectedSubmittedByReference] ?? selectedSubmittedByReference
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* Prioritized field sections, with PD items after Scope of work */}
                    {sections.filter((section) => section.title !== "Photo Gallery").map((section) => (
                      <div key={section.title}>
                        <section aria-label={section.title} className="mb-4">
                          <SectionHeading
                            title={section.title}
                            changed={
                              section.title !== "Request"
                              && section.fields.some(([field]) => changedFields.has(field))
                            }
                          />

                          {section.title === "Customer & contact" ? (
                            <div className="space-y-3">
                              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                                {section.fields
                                  .filter(([field]) => !Object.values(CONTACT_FIELD_KEYS).some((aliases) => aliases.includes(field as never)))
                                  .map(([field, value]) => (
                                    <div key={field} className="min-w-0">
                                      <dt className={`flex items-center text-[11px] text-slate-500 ${isResolvedNameField(field) ? "font-bold uppercase tracking-wide" : "font-semibold"}`}>
                                        {isResolvedNameField(field) ? formatFieldLabel(field).toUpperCase() : formatFieldLabel(field)}
                                        {changedFields.has(field) ? <ChangedBadge /> : null}
                                      </dt>
                                      <dd className="mt-1 break-words text-xs text-slate-800">{formatFieldValue(value)}</dd>
                                    </div>
                                  ))}
                              </dl>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {getContactRows(section.fields).map((contact) => (
                                  <div key={contact.index} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                      Contact {contact.index + 1}
                                    </p>
                                    <dl className="grid gap-2">
                                      {contact.details.map((detail) => (
                                        <div key={detail.key} className="min-w-0">
                                          <dt className="flex items-center text-[10px] font-semibold text-slate-500">
                                            {detail.label}
                                            {changedFields.has(detail.field) ? <ChangedBadge /> : null}
                                          </dt>
                                          <dd className="mt-0.5 break-words text-xs text-slate-800">{detail.value}</dd>
                                        </div>
                                      ))}
                                    </dl>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : section.title === "Attachments" ? (
                            <dl className="space-y-4">
                              {section.fields.map(([field, value]) => (
                                <div key={field} className="min-w-0">
                                  <dt className={`flex items-center text-[11px] text-slate-500 ${isResolvedNameField(field) ? "font-bold uppercase tracking-wide" : "font-semibold"}`}>
                                    {isResolvedNameField(field) ? formatFieldLabel(field).toUpperCase() : formatFieldLabel(field)}
                                    {changedFields.has(field) ? <ChangedBadge /> : null}
                                  </dt>
                                  <dd className="mt-2 break-words text-xs text-slate-700">
                                    <AttachmentGrid value={value} />
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                              {section.fields.map(([field, value]) => (
                                <div
                                  key={field}
                                  className={`min-w-0 ${!isNotesField(field) && isLongValue(value) ? "sm:col-span-2" : ""}`}
                                >
                                  <dt className={`flex items-center text-[11px] text-slate-500 ${isNotesField(field) ? "font-black uppercase tracking-widest" : isResolvedNameField(field) ? "font-bold uppercase tracking-wide" : "font-semibold"}`}>
                                    {isResolvedNameField(field) ? formatFieldLabel(field).toUpperCase() : formatFieldLabel(field)}
                                    {isNotesField(field) ? (
                                      <span className="ml-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                                        (Read only)
                                      </span>
                                    ) : null}
                                    {changedFields.has(field) ? <ChangedBadge /> : null}
                                  </dt>
                                  <dd className="mt-1 break-words text-xs text-slate-800">
                                    {isNotesField(field) ? (
                                      <Textarea
                                        aria-label={`${formatFieldLabel(field)} (read only)`}
                                        readOnly
                                        rows={2}
                                        value={formatNotesValue(value)}
                                        placeholder="—"
                                        className="min-h-[52px] resize-y rounded-lg border-slate-700 bg-slate-900 px-3 py-2 text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus-visible:ring-0"
                                      />
                                    ) : field === "fill_up_form" ? (
                                      <VersionHistoryFillUpViewer
                                        value={value}
                                        department={department}
                                        preferredDateFinish={{
                                          from: selectedVersion.working_time_from,
                                          to: selectedVersion.working_time_to,
                                        }}
                                        pdDatabaseItems={pdDatabaseItems}
                                      />
                                    ) : (field === "site_installation" || field.toLowerCase() === "permits") && getBulletItems(value).length > 0 ? (
                                      <ul className="list-disc space-y-1 pl-5">
                                        {getBulletItems(value).map((item, index) => (
                                          <li key={`${item}-${index}`}>{item}</li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <span className="whitespace-pre-wrap">
                                        {formatResolvedFieldValue(field, value, agentNames)}
                                      </span>
                                    )}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </section>

                        {section.title === "Scope of work" && pdDatabaseItems.length > 0 ? (
                          <PdDatabaseSection items={pdDatabaseItems} changed={pdChanged} />
                        ) : null}
                      </div>
                    ))}

                    {/* If there is no "Scope of work" section, still show PD items */}
                    {!sections.some((section) => section.title === "Scope of work")
                    && pdDatabaseItems.length > 0 ? (
                      <PdDatabaseSection items={pdDatabaseItems} changed={pdChanged} />
                    ) : null}
                  </>
                ) : null}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PdDatabaseSection({
  items,
  changed,
}: {
  items: PdDatabaseVersionItem[];
  changed: boolean;
}) {
  return (
    <section aria-label="PD Database items" className="mb-6">
      <SectionHeading title="PD database items" changed={changed} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <article
            key={`${item.itemCode}-${index}`}
            className="flex min-w-0 gap-3 rounded-md border bg-slate-50 p-3"
          >
            {item.imageUrl ? (
              <a
                href={item.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="h-24 w-24 shrink-0 overflow-hidden rounded border bg-white"
              >
                {isImageUrl(item.imageUrl) ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.description || item.itemCode || `PD Database item ${index + 1}`}
                    width={192}
                    height={192}
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="block p-2 text-[10px] text-blue-700 underline">Open image</span>
                )}
              </a>
            ) : (
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded border bg-white text-[10px] text-slate-400">
                No image
              </div>
            )}
            <dl className="min-w-0 space-y-2">
              <div>
                <dt className="text-[11px] font-semibold text-slate-500">Item {index + 1}</dt>
                <dd className="break-words text-xs font-semibold text-slate-800">
                  {item.itemCode || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold text-slate-500">Description</dt>
                <dd className="break-words text-xs text-slate-700">{item.description || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold text-slate-500">Quantity</dt>
                <dd className="text-xs text-slate-700">{item.quantity || "—"}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}