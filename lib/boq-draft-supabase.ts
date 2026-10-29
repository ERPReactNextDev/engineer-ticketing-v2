import { getJobRequestSupabaseClient } from "@/lib/job-request-supabase";
import type {
  BoqSection,
  BoqSummary,
  JobFillUpFormValues,
  ProcurementData,
} from "@/components/job-fill-up-form-dialog";

const EMPTY_SUMMARY: BoqSummary = {
  materialCost: 0,
  laborCost: 0,
  consumables: 0,
  directCost: 0,
  contingencyPct: 0,
  contingency: 0,
  totalProjectCost: 0,
  unitCount: 0,
  costPerItem: 0,
};

export type BoqDraft = {
  requestId: string;
  values: JobFillUpFormValues;
  boqSections: BoqSection[];
  summary: BoqSummary;
  procurement?: ProcurementData;
  status?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  updatedBy?: string;
  completedAt?: string | null;
  completedBy?: string;
};

type BoqDraftRow = {
  request_id: string;
  form_values: JobFillUpFormValues;
  boq_sections: BoqSection[];
  summary: BoqSummary;
  procurement: ProcurementData | null;
  status: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
};

function getClient() {
  const client = getJobRequestSupabaseClient();
  if (!client) {
    throw new Error("Supabase job request client is not configured.");
  }
  return client;
}

function toBoqDraft(row: BoqDraftRow): BoqDraft {
  return {
    requestId: row.request_id,
    values: row.form_values,
    boqSections: row.boq_sections,
    summary: row.summary,
    procurement: row.procurement ?? undefined,
    status: row.status,
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? undefined,
    completedAt: row.completed_at,
    completedBy: row.completed_by ?? undefined,
  };
}

export async function getBoqDraft(requestId: string): Promise<BoqDraft | null> {
  const { data, error } = await getClient()
    .from("boq_draft")
    .select("*")
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load BOQ draft: ${error.message}`);
  }

  return data ? toBoqDraft(data as BoqDraftRow) : null;
}

export async function saveBoqDraft(
  requestId: string,
  changes: Partial<Omit<BoqDraft, "requestId">>
): Promise<BoqDraft> {
  const client = getClient();
  const { data: existingRow, error: loadError } = await client
    .from("boq_draft")
    .select("*")
    .eq("request_id", requestId)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Failed to load existing BOQ draft: ${loadError.message}`);
  }

  const existing = existingRow ? toBoqDraft(existingRow as BoqDraftRow) : null;
  const now = new Date().toISOString();
  const draft: BoqDraft = {
    requestId,
    values: changes.values ?? existing?.values ?? {},
    boqSections: changes.boqSections ?? existing?.boqSections ?? [],
    summary: changes.summary ?? existing?.summary ?? EMPTY_SUMMARY,
    procurement: changes.procurement ?? existing?.procurement,
    status: changes.status ?? existing?.status ?? "draft",
    createdBy: changes.createdBy ?? existing?.createdBy,
    createdByName: changes.createdByName ?? existing?.createdByName,
    createdAt: existing?.createdAt ?? changes.createdAt ?? now,
    updatedAt: now,
    updatedBy: changes.updatedBy ?? existing?.updatedBy,
    completedAt: changes.completedAt ?? existing?.completedAt,
    completedBy: changes.completedBy ?? existing?.completedBy,
  };

  const row = {
    request_id: draft.requestId,
    form_values: draft.values,
    boq_sections: draft.boqSections,
    summary: draft.summary,
    procurement: draft.procurement ?? null,
    status: draft.status,
    created_by: draft.createdBy ?? null,
    created_by_name: draft.createdByName ?? null,
    created_at: draft.createdAt,
    updated_at: draft.updatedAt,
    updated_by: draft.updatedBy ?? null,
    completed_at: draft.completedAt ?? null,
    completed_by: draft.completedBy ?? null,
  };

  const { data, error } = await client
    .from("boq_draft")
    .upsert(row, { onConflict: "request_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save BOQ draft: ${error.message}`);
  }

  return toBoqDraft(data as BoqDraftRow);
}
