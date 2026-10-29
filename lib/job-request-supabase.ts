import { createClient } from "@supabase/supabase-js";

const CACHE_KEY = "job_request_supabase_client_v2";
const isBrowser = typeof window !== "undefined";

type JsonRecord = Record<string, unknown>;

export type JobRequestRow = JsonRecord & {
  id?: string;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  jobRequestNo?: string | null;
  job_request_no?: string | null;
  projectTitle?: string | null;
  clientName?: string | null;
  location?: string | null;
  agentName?: string | null;
  submittedByName?: string | null;
  workingTimeFrom?: string | null;
  workingTimeTo?: string | null;
  totalWorkingDays?: number | null;
  scopeOfWork?: string | null;
  scopeQty?: number | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  memberNotes?: string | null;
  adminNotes?: string | null;
  leaderNotes?: string | null;
  managerNotes?: string | null;
  procurementNotes?: string | null;
  attachments?: string[] | null;
  viewedStatusByUser?: Record<string, string> | null;
  status?: string | null;
  createdBy?: string | null;
  submittedBy?: string | null;
  fillUpForm?: Record<string, unknown> | null;
  procurementSummary?: Record<string, unknown> | null;
  procurementSay?: number | null;
};

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL_TICKET || "";
}

function getSupabaseKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";
}

export function getJobRequestSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();

  if ((!url || !key) && !isBrowser) {
    return null;
  }

  if (isBrowser) {
    const cached = (window as unknown as Record<string, unknown>)[CACHE_KEY];
    if (cached && typeof cached === "object") {
      return cached as ReturnType<typeof createClient>;
    }
  }

  if (!url || !key) return null;

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  if (isBrowser) {
    (window as unknown as Record<string, unknown>)[CACHE_KEY] = client;
  }

  return client;
}

function toCamelCase(input: string): string {
  if (!input) return input;
  const parts = input.split("_").filter(Boolean);
  if (!parts.length) return input;
  return parts
    .map((part, index) => {
      if (index === 0) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

function toSnakeCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function nestedSnakeCase(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => nestedSnakeCase(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<JsonRecord>((acc, [key, item]) => {
      acc[toSnakeCase(key)] = nestedSnakeCase(item);
      return acc;
    }, {});
  }

  return value;
}

function nestedCamelCase(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => nestedCamelCase(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<JsonRecord>((acc, [key, item]) => {
      acc[toCamelCase(key)] = nestedCamelCase(item);
      return acc;
    }, {});
  }

  return value;
}

export function normalizeJobRequestRow(row: JobRequestRow | null | undefined): JobRequestRow | null | undefined {
  if (!row) return row;
  const normalized = nestedCamelCase(row) as JobRequestRow;
  if (normalized.createdAt && typeof normalized.createdAt === "string") {
    normalized.createdAt = new Date(normalized.createdAt);
  }
  if (normalized.updatedAt && typeof normalized.updatedAt === "string") {
    normalized.updatedAt = new Date(normalized.updatedAt);
  }
  return normalized;
}

export function serializeJobRequestForDb(record: JsonRecord = {}): JsonRecord {
  return nestedSnakeCase(record) as JsonRecord;
}

export async function listJobRequests(): Promise<JobRequestRow[]> {
  const supabase = getJobRequestSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase job request client is not configured. Check the job request Supabase URL and publishable key.");
  }

  const { data, error } = await supabase
    .from("job_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    const err = new Error(error.message || "Unknown database error");
    Object.assign(err, { code: error.code, details: error.details, hint: error.hint });
    throw err;
  }
  return (data || []).map((row: JobRequestRow) => normalizeJobRequestRow(row) as JobRequestRow);
}

export async function getJobRequestById(id: string): Promise<JobRequestRow | null> {
  const supabase = getJobRequestSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("job_requests").select("*").eq("id", id).maybeSingle();
  if (error) {
    const err = new Error(error.message || "Unknown database error");
    Object.assign(err, { code: error.code, details: error.details, hint: error.hint });
    throw err;
  }
  return data ? (normalizeJobRequestRow(data as JobRequestRow) as JobRequestRow) : null;
}

export async function createJobRequest(payload: JsonRecord): Promise<JobRequestRow> {
  const supabase = getJobRequestSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase job request client is not configured.");
  }

  const row = serializeJobRequestForDb(payload);
  const { data, error } = await supabase.from("job_requests").insert([row]).select().single();
  if (error) {
    const err = new Error(error.message || "Failed to create job request");
    Object.assign(err, { code: error.code, details: error.details, hint: error.hint });
    throw err;
  }
  return normalizeJobRequestRow(data as JobRequestRow) as JobRequestRow;
}

export async function updateJobRequest(id: string, updates: JsonRecord): Promise<JobRequestRow> {
  const supabase = getJobRequestSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase job request client is not configured.");
  }

  const serialized = serializeJobRequestForDb(updates);
  const { data, error } = await supabase.from("job_requests").update(serialized).eq("id", id).select().single();
  if (error) {
    const err = new Error(error.message || "Failed to update job request");
    Object.assign(err, { code: error.code, details: error.details, hint: error.hint });
    throw err;
  }
  return normalizeJobRequestRow(data as JobRequestRow) as JobRequestRow;
}

export async function saveJobFillUpDraft(requestId: string, payload: JsonRecord): Promise<unknown> {
  const supabase = getJobRequestSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase job request client is not configured.");
  }

  const row: JsonRecord = {
    request_id: requestId,
    requestId,
    ...serializeJobRequestForDb(payload),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("job_fill_ups").upsert(row, { onConflict: "request_id" }).select().single();
  if (error) {
    const err = new Error(error.message || "Failed to save job fill-up draft");
    Object.assign(err, { code: error.code, details: error.details, hint: error.hint });
    throw err;
  }
  return data;
}

export async function markRequestViewed(id: string, userId: string, status: string): Promise<JobRequestRow | null> {
  const supabase = getJobRequestSupabaseClient();
  if (!supabase) return null;

  const { data: existing, error: fetchError } = await supabase.from("job_requests").select("viewed_status_by_user").eq("id", id).maybeSingle();
  if (fetchError) {
    const err = new Error(fetchError.message || "Failed to fetch job request");
    Object.assign(err, { code: fetchError.code, details: fetchError.details, hint: fetchError.hint });
    throw err;
  }

  const viewedStatusByUser = (existing?.viewed_status_by_user as Record<string, string>) || {};
  const next = {
    ...viewedStatusByUser,
    [userId]: status,
  };

  const { data, error } = await supabase.from("job_requests").update({ viewed_status_by_user: next }).eq("id", id).select().single();
  if (error) {
    const err = new Error(error.message || "Failed to mark request as viewed");
    Object.assign(err, { code: error.code, details: error.details, hint: error.hint });
    throw err;
  }
  return normalizeJobRequestRow(data as JobRequestRow) as JobRequestRow;
}

export function parseJobRequestChatMessages(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Job request messages contain invalid JSON.");
  }

  return Array.isArray(parsed) ? parsed : [];
}

export async function getJobRequestChatMessages(id: string): Promise<unknown[]> {
  const supabase = getJobRequestSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase job request client is not configured.");
  }

  const { data, error } = await supabase
    .from("job_requests")
    .select("messages")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message || "Failed to fetch job request messages");
    Object.assign(err, { code: error.code, details: error.details, hint: error.hint });
    throw err;
  }

  return parseJobRequestChatMessages(data?.messages);
}

export async function saveJobRequestChatMessages(id: string, messages: unknown[]): Promise<void> {
  const supabase = getJobRequestSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase job request client is not configured.");
  }

  const { error } = await supabase
    .from("job_requests")
    .update({ messages, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    const err = new Error(error.message || "Failed to save job request messages");
    Object.assign(err, { code: error.code, details: error.details, hint: error.hint });
    throw err;
  }
}

export function mapLegacyJobRequest(document: JsonRecord = {}): JobRequestRow {
  const normalized = normalizeJobRequestRow(document as JobRequestRow) as JobRequestRow;
  if (normalized.jobRequestNo === undefined && normalized.job_request_no !== undefined) {
    normalized.jobRequestNo = normalized.job_request_no as string;
  }
  if (normalized.createdAt === undefined && normalized.created_at !== undefined) {
    normalized.createdAt = normalized.created_at as string | Date;
  }
  if (normalized.updatedAt === undefined && normalized.updated_at !== undefined) {
    normalized.updatedAt = normalized.updated_at as string | Date;
  }
  return normalized;
}
