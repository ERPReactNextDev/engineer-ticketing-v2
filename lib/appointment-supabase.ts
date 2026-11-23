import { supabase } from "@/utils/supabase";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

const FIELD_MAP: Record<string, string> = {
  site_visit_no: "siteVisitNo",
  contact_person: "contactPerson",
  requestor_phone: "requestorPhone",
  appointment_date: "appointmentDate",
  file_url: "fileUrl",
  submitted_by: "submittedBy",
  submitted_by_name: "submittedByName",
  tsm_name: "tsmName",
  sales_head: "salesHead",
  confirmation_notes: "confirmationNotes",
  cancel_reason: "cancelReason",
  pending_at: "pendingAt",
  pending_by: "pendingBy",
  confirmed_at: "confirmedAt",
  confirmed_by: "confirmedBy",
  completed_at: "completedAt",
  completed_by: "completedBy",
  cancelled_at: "cancelledAt",
  cancelled_by: "cancelledBy",
  cancelled_by_id: "cancelledById",
  last_modified_by: "lastModifiedBy",
  assigned_at: "assignedAt",
  assigned_by: "assignedBy",
  assigned_by_id: "assignedById",
  created_at: "createdAt",
  updated_at: "updatedAt",
};

export function toSupabaseTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function normalizeAppointment(row: Record<string, any>) {
  if (!row) return row;

  const normalized: Record<string, any> = { ...row };
  Object.entries(FIELD_MAP).forEach(([snake, camel]) => {
    if (normalized[snake] !== undefined) normalized[camel] = normalized[snake];
  });

  ["pendingAt", "confirmedAt", "completedAt", "cancelledAt", "assignedAt", "createdAt", "updatedAt", "appointmentDate"].forEach((field) => {
    const value = normalized[field];
    if (typeof value === "string") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        normalized[field] = {
          seconds: Math.floor(date.getTime() / 1000),
          toDate: () => date,
        };
      }
    }
  });

  return normalized;
}

export function getAppointmentSupabaseClient() {
  return supabase;
}

export interface SiteVisitProtocol {
  id: string;
  label: string;
  desc: string;
  missionObjectives?: string;
  pic: string[];
  isActive: boolean;
}

export interface SiteVisitUser {
  ReferenceID?: string | null;
  Firstname?: string | null;
  Lastname?: string | null;
  Department?: string | null;
  Status?: string | null;
}

export interface SiteVisitPicOption {
  referenceId: string;
  name: string;
}

export function splitSiteVisitPicValues(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value.flatMap((item) => typeof item === "string" ? item.split(",") : [])
    : typeof value === "string"
      ? value.split(",")
      : [];

  return values.map((item) => item.trim()).filter(Boolean);
}

function normalizePicName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getSiteVisitPicOptions(
  protocolPics: string[],
  users: SiteVisitUser[]
): SiteVisitPicOption[] {
  const usersByReferenceId = new Map<string, SiteVisitUser>();
  const usersByName = new Map<string, SiteVisitUser[]>();

  users.forEach((user) => {
    const referenceId = user.ReferenceID?.trim();
    if (!referenceId || ["RESIGNED", "TERMINATED"].includes(user.Status?.trim().toUpperCase() || "")) return;

    usersByReferenceId.set(referenceId, user);
    const name = `${user.Firstname || ""} ${user.Lastname || ""}`.trim();
    if (!name) return;

    const key = normalizePicName(name);
    usersByName.set(key, [...(usersByName.get(key) || []), user]);
  });

  const optionsByReferenceId = new Map<string, SiteVisitPicOption>();
  protocolPics.forEach((protocolPic) => {
    const pic = protocolPic.trim();
    const exactReferenceMatch = usersByReferenceId.get(pic);
    const nameMatches = usersByName.get(normalizePicName(pic)) || [];
    const user = exactReferenceMatch || (nameMatches.length === 1 ? nameMatches[0] : undefined);
    const referenceId = user?.ReferenceID?.trim();
    if (!referenceId) return;

    const name = `${user?.Firstname || ""} ${user?.Lastname || ""}`.trim();
    if (name) optionsByReferenceId.set(referenceId, { referenceId, name });
  });

  return Array.from(optionsByReferenceId.values());
}

export function resolveSiteVisitPicNames(value: unknown, users: SiteVisitUser[]): string {
  const usersByReferenceId = new Map<string, SiteVisitUser>();
  users.forEach((user) => {
    const referenceId = user.ReferenceID?.trim();
    if (referenceId) usersByReferenceId.set(referenceId, user);
  });

  const names = splitSiteVisitPicValues(value).map((pic) => {
    const user = usersByReferenceId.get(pic);
    return user
      ? `${user.Firstname || ""} ${user.Lastname || ""}`.trim() || pic
      : pic;
  });

  return names.join(", ") || "UNASSIGNED";
}

export function siteVisitPicMatches(value: unknown, option: SiteVisitPicOption): boolean {
  const normalizedName = normalizePicName(option.name);
  return splitSiteVisitPicValues(value).some((pic) =>
    pic === option.referenceId || normalizePicName(pic) === normalizedName
  );
}

export const SITE_VISIT_PROTOCOL_LABELS: Record<string, string> = {
  "4q2YrRupVTGi2obgvAgE": "Product concern",
  "9BJoDnGyNJFGXwjZJDCc": "Formal Meeting",
  "I1Yxbf3jv1xVWZesA0v0": "Installation services",
  "JqjOoU72mQsMuy1ghhNp": "Product Presentation",
  "LF5vPmaO5IGwK1QwKArE": "Bidding",
  "MQmHCE0K0zryWXsKk2tL": "AREA ASSESMENT",
  "MvvMZcLjVk4z6zR3fAML": "RETROFITTING",
};

export const FALLBACK_PROTOCOLS: SiteVisitProtocol[] = [
  { id: "concern", label: "Concern", desc: "Client concern assessment", pic: ["ENGINEERING_STAFF"], isActive: true },
  { id: "meeting", label: "Meeting", desc: "Client meeting", pic: ["ENGINEERING_STAFF"], isActive: true },
  { id: "installation", label: "Installation Services", desc: "Equipment installation", pic: ["ENGINEERING_STAFF"], isActive: true },
  { id: "presentation", label: "Presentation", desc: "Technical presentation", pic: ["ENGINEERING_STAFF"], isActive: true },
  { id: "bidding", label: "Bidding", desc: "Bidding support", pic: ["ENGINEERING_STAFF"], isActive: true },
  { id: "assessment", label: "Assessment", desc: "Technical assessment", pic: ["ENGINEERING_STAFF"], isActive: true },
  { id: "retrofitting", label: "Retrofitting", desc: "Retrofitting services", pic: ["ENGINEERING_STAFF"], isActive: true },
  { id: "others", label: "Others", desc: "Other requirements", pic: ["ENGINEERING_STAFF"], isActive: true },
];

export async function getSiteVisitProtocols(includeLegacyConfig = false): Promise<SiteVisitProtocol[]> {
  if (includeLegacyConfig) {
    try {
      const snapshot = await getDocs(
        query(collection(db, "protocols"), where("isActive", "==", true))
      );
      if (!snapshot.empty) {
        return snapshot.docs.map((protocolDoc) => {
          const row = protocolDoc.data();
          return {
            id: protocolDoc.id,
            label: row.label || row.name || row.protocolName || protocolDoc.id,
            desc: row.desc || "",
            missionObjectives: row.description || row.missionObjectives,
            pic: Array.isArray(row.pic) ? row.pic : typeof row.pic === "string" ? [row.pic] : [],
            isActive: true,
          };
        });
      }
    } catch (error) {
      console.warn("Could not read legacy protocol configuration; checking Supabase.", error);
    }
  }

  try {
    const { data, error } = await supabase
      .from("protocols")
      .select("*")
      .eq("is_active", true);

    if (!error && data?.length) {
      return data.map((row: Record<string, any>) => ({
        id: row.id,
        label: row.label || row.name || row.id,
        desc: row.desc || row.description || "",
        missionObjectives: row.description || row.mission_objectives || row.missionObjectives,
        pic: Array.isArray(row.pic) ? row.pic : typeof row.pic === "string" ? [row.pic] : [],
        isActive: row.is_active ?? true,
      }));
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("protocols")
      .select("*");

    if (!fallbackError && fallbackData?.length) {
      return fallbackData.map((row: Record<string, any>) => ({
        id: row.id,
        label: row.label || row.name || row.id,
        desc: row.desc || row.description || "",
        missionObjectives: row.description || row.mission_objectives || row.missionObjectives,
        pic: Array.isArray(row.pic) ? row.pic : typeof row.pic === "string" ? [row.pic] : [],
        isActive: row.is_active ?? row.isActive ?? true,
      }));
    }
  } catch (error) {
    console.warn("Supabase protocols unavailable; using local fallback.", error);
  }

  return FALLBACK_PROTOCOLS;
}
