import { createClient } from "@supabase/supabase-js";

const STARTING_NUMBER = 36;
const MAX_RETRIES = 5;

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE ||
    "";

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function isSiteVisitNumberExists(siteVisitNo: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { data } = await client
    .from("appointments")
    .select("id")
    .eq("site_visit_no", siteVisitNo)
    .limit(1)
    .maybeSingle();

  return !!data;
}

export async function getNextSiteVisitNumber(isTest: boolean = false): Promise<string> {
  const client = getSupabaseClient();
  const currentYear = new Date().getFullYear();
  const prefix = isTest ? `TEST-PS-${currentYear}-` : `PS-${currentYear}-`;

  let start = isTest ? 1 : STARTING_NUMBER;

  if (client) {
    const { data, error } = await client
      .from("appointments")
      .select("site_visit_no")
      .like("site_visit_no", `${prefix}%`)
      .order("site_visit_no", { ascending: false })
      .limit(1000);

    if (!error && data) {
      const numbers = data
        .map((row: any) => Number.parseInt(String(row.site_visit_no).slice(prefix.length), 10))
        .filter((number: number) => Number.isFinite(number));
      if (numbers.length > 0) start = Math.max(...numbers) + 1;
    }
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const number = start + attempt;
    const formatted = `${prefix}${String(number).padStart(3, "0")}`;
    if (!(await isSiteVisitNumberExists(formatted))) return formatted;
  }

  throw new Error("Failed to generate a unique site visit number");
}

export async function getCounterStatus(): Promise<{
  production: { currentNumber: number; lastUsed: string | null; startingNumber: number; year: number };
  test: { currentNumber: number; lastUsed: string | null; year: number };
}> {
  const client = getSupabaseClient();
  const currentYear = new Date().getFullYear();
  const prodPrefix = `PS-${currentYear}-`;
  const testPrefix = `TEST-PS-${currentYear}-`;

  let prodNumber = STARTING_NUMBER;
  let testNumber = 0;

  if (client) {
    const { data } = await client
      .from("appointments")
      .select("site_visit_no")
      .or(`site_visit_no.like.${prodPrefix}%,site_visit_no.like.${testPrefix}%`)
      .limit(1000);

    data?.forEach((row: any) => {
      const value = String(row.site_visit_no || "");
      if (value.startsWith(prodPrefix)) {
        prodNumber = Math.max(prodNumber, Number.parseInt(value.slice(prodPrefix.length), 10) || prodNumber);
      }
      if (value.startsWith(testPrefix)) {
        testNumber = Math.max(testNumber, Number.parseInt(value.slice(testPrefix.length), 10) || 0);
      }
    });
  }

  return {
    production: {
      currentNumber: prodNumber,
      lastUsed: prodNumber >= STARTING_NUMBER ? `${prodPrefix}${String(prodNumber).padStart(3, "0")}` : null,
      startingNumber: STARTING_NUMBER,
      year: currentYear,
    },
    test: {
      currentNumber: testNumber,
      lastUsed: testNumber > 0 ? `${testPrefix}${String(testNumber).padStart(3, "0")}` : null,
      year: currentYear,
    },
  };
}

export async function adjustCounter(
  newNumber: number,
  isTest: boolean = false
): Promise<{ success: boolean; message: string }> {
  return {
    success: false,
    message: isTest
      ? "Test counter adjustment is not supported while counters are derived from Supabase appointments."
      : "Counter adjustment is not supported while the counter is derived from Supabase appointments.",
  };
}

export async function initializeCounter(
  startingNumber: number = STARTING_NUMBER
): Promise<{ success: boolean; message: string }> {
  return {
    success: false,
    message: `Supabase counters are derived from appointments. The production starting number is ${startingNumber}.`,
  };
}
