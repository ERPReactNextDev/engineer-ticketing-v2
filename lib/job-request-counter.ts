import { createClient } from "@supabase/supabase-js";

const STARTING_NUMBER = 42;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 100;
const RESERVATION_EXPIRY_MINUTES = 5;

const memoryCounters = new Map<string, number>();
const memoryReservations = new Map<string, number>();

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL_TICKET || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getCounterRow(isTest: boolean) {
  const currentYear = new Date().getFullYear();
  const counterId = isTest ? "job_requests_test" : "job_requests";
  const client = getSupabaseClient();

  if (!client) {
    const key = `${counterId}:${currentYear}`;
    return {
      current_number: memoryCounters.get(key) ?? (isTest ? 0 : STARTING_NUMBER - 1),
      year: currentYear,
      type: isTest ? "test" : "production",
    };
  }

  try {
    const { data, error } = await client.from("job_request_counters").select("*").eq("id", counterId).maybeSingle();
    if (error && (error as any).code !== "42P01") throw error;
    return data || { current_number: isTest ? 0 : STARTING_NUMBER - 1, year: currentYear, type: isTest ? "test" : "production" };
  } catch (error) {
    const key = `${counterId}:${currentYear}`;
    return {
      current_number: memoryCounters.get(key) ?? (isTest ? 0 : STARTING_NUMBER - 1),
      year: currentYear,
      type: isTest ? "test" : "production",
    };
  }
}

async function persistCounterRow(isTest: boolean, next: number, currentYear: number) {
  const client = getSupabaseClient();
  const counterId = isTest ? "job_requests_test" : "job_requests";

  if (!client) {
    memoryCounters.set(`${counterId}:${currentYear}`, next);
    return;
  }

  try {
    const { error } = await client.from("job_request_counters").upsert(
      { id: counterId, current_number: next, year: currentYear, type: isTest ? "test" : "production", last_updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

    if (error && (error as any).code === "42P01") {
      memoryCounters.set(`${counterId}:${currentYear}`, next);
      return;
    }

    if (error) throw error;
  } catch (error) {
    memoryCounters.set(`${counterId}:${currentYear}`, next);
  }
}

async function reserveNumber(number: string, isTest: boolean): Promise<boolean> {
  const client = getSupabaseClient();
  const reservationKey = `${isTest ? "test-" : "prod-"}${number}`;
  const expiresAt = Date.now() + RESERVATION_EXPIRY_MINUTES * 60 * 1000;

  if (!client) {
    memoryReservations.set(reservationKey, expiresAt);
    return true;
  }

  try {
    const { error } = await client.from("job_request_number_reservations").upsert(
      {
        number,
        is_test: isTest,
        reserved_at: new Date().toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
      },
      { onConflict: "number" }
    );

    if (error && (error as any).code === "42P01") {
      memoryReservations.set(reservationKey, expiresAt);
      return true;
    }

    if (error) throw error;
    return true;
  } catch (error) {
    console.warn("Fallback reservation used for job request counter:", error);
    memoryReservations.set(reservationKey, expiresAt);
    return true;
  }
}

export async function releaseReservedNumber(number: string): Promise<void> {
  const client = getSupabaseClient();
  const reservationKey = `prod-${number}`;

  if (!client) {
    memoryReservations.delete(reservationKey);
    memoryReservations.delete(`test-${number}`);
    return;
  }

  try {
    const { error } = await client.from("job_request_number_reservations").delete().eq("number", number);
    if (error && (error as any).code !== "42P01") {
      throw error;
    }
  } catch (error) {
    memoryReservations.delete(reservationKey);
    memoryReservations.delete(`test-${number}`);
  }
}

async function isNumberReserved(number: string): Promise<boolean> {
  const client = getSupabaseClient();
  const reservationKey = `prod-${number}`;

  if (!client) {
    const value = memoryReservations.get(reservationKey) ?? memoryReservations.get(`test-${number}`);
    if (!value) return false;
    if (value < Date.now()) {
      memoryReservations.delete(reservationKey);
      memoryReservations.delete(`test-${number}`);
      return false;
    }
    return true;
  }

  try {
    const { data, error } = await client.from("job_request_number_reservations").select("*").eq("number", number).maybeSingle();
    if (error && (error as any).code === "42P01") return false;
    if (!data) return false;
    const expiry = data.expires_at ? new Date(data.expires_at).getTime() : 0;
    if (expiry < Date.now()) {
      await client.from("job_request_number_reservations").delete().eq("number", number);
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

export async function isJobRequestNumberExists(jobRequestNo: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data, error } = await client.from("job_requests").select("id").eq("job_request_no", jobRequestNo).limit(1).maybeSingle();
    if (error && (error as any).code === "42P01") return false;
    return !!data;
  } catch (error) {
    return false;
  }
}

export async function getNextJobRequestNumber(isTest: boolean = false): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = isTest ? `TEST-JR-${currentYear}-` : `JR-${currentYear}-`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const counter = await getCounterRow(isTest);
      let next = (counter.current_number ?? 0) + 1;
      if (counter.year !== currentYear) {
        next = isTest ? 1 : STARTING_NUMBER;
      }

      const formattedNumber = `${prefix}${String(next).padStart(4, "0")}`;
      const reserved = await reserveNumber(formattedNumber, isTest);
      if (!reserved) {
        lastError = new Error("Reservation failed");
        continue;
      }

      const exists = await isJobRequestNumberExists(formattedNumber);
      if (exists) {
        await releaseReservedNumber(formattedNumber);
        lastError = new Error("Number already exists");
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }
        continue;
      }

      const isReserved = await isNumberReserved(formattedNumber);
      if (isReserved) {
        await releaseReservedNumber(formattedNumber);
        lastError = new Error("Number currently reserved");
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }
        continue;
      }

      await persistCounterRow(isTest, next, currentYear);
      return formattedNumber;
    } catch (error: any) {
      console.error(`Attempt ${attempt} failed:`, error);
      lastError = error;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to generate unique job request number after ${MAX_RETRIES} attempts. Last error: ${lastError?.message || "Unknown error"}`);
}

export async function getCounterStatus(): Promise<{
  production: {
    currentNumber: number;
    lastUsed: string | null;
    startingNumber: number;
    year: number;
  };
  test: {
    currentNumber: number;
    lastUsed: string | null;
    year: number;
  };
}> {
  const currentYear = new Date().getFullYear();
  const client = getSupabaseClient();

  if (!client) {
    return {
      production: {
        currentNumber: memoryCounters.get(`job_requests:${currentYear}`) ?? STARTING_NUMBER,
        lastUsed: null,
        startingNumber: STARTING_NUMBER,
        year: currentYear,
      },
      test: {
        currentNumber: memoryCounters.get(`job_requests_test:${currentYear}`) ?? 1,
        lastUsed: null,
        year: currentYear,
      },
    };
  }

  try {
    const [{ data: productionData, error: productionError }, { data: testData, error: testError }] = await Promise.all([
      client.from("job_request_counters").select("*").eq("id", "job_requests").maybeSingle(),
      client.from("job_request_counters").select("*").eq("id", "job_requests_test").maybeSingle(),
    ]);

    if (productionError && (productionError as any).code !== "42P01") throw productionError;
    if (testError && (testError as any).code !== "42P01") throw testError;

    return {
      production: {
        currentNumber: productionData?.current_number ?? STARTING_NUMBER,
        lastUsed: productionData?.last_updated_at ?? null,
        startingNumber: productionData?.starting_number ?? STARTING_NUMBER,
        year: productionData?.year ?? currentYear,
      },
      test: {
        currentNumber: testData?.current_number ?? 1,
        lastUsed: testData?.last_updated_at ?? null,
        year: testData?.year ?? currentYear,
      },
    };
  } catch (error) {
    return {
      production: {
        currentNumber: memoryCounters.get(`job_requests:${currentYear}`) ?? STARTING_NUMBER,
        lastUsed: null,
        startingNumber: STARTING_NUMBER,
        year: currentYear,
      },
      test: {
        currentNumber: memoryCounters.get(`job_requests_test:${currentYear}`) ?? 1,
        lastUsed: null,
        year: currentYear,
      },
    };
  }
}

export async function adjustCounter(
  newNumber: number,
  isTest: boolean = false
): Promise<{ success: boolean; message: string }> {
  try {
    if (newNumber < 1) {
      return { success: false, message: "Number must be at least 1" };
    }

    const client = getSupabaseClient();
    if (client) {
      const { error } = await client.from("job_request_counters").upsert(
        { id: isTest ? "job_requests_test" : "job_requests", current_number: newNumber, type: isTest ? "test" : "production", last_updated_at: new Date().toISOString(), year: new Date().getFullYear() },
        { onConflict: "id" }
      );

      if (error && (error as any).code !== "42P01") {
        throw error;
      }
    } else {
      memoryCounters.set(`${isTest ? "job_requests_test" : "job_requests"}:${new Date().getFullYear()}`, newNumber);
    }

    return {
      success: true,
      message: `Counter ${isTest ? "test" : "production"} adjusted to ${newNumber}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to adjust counter",
    };
  }
}

export async function initializeCounter(
  startingNumber: number = STARTING_NUMBER
): Promise<{ success: boolean; message: string }> {
  try {
    if (startingNumber < 1) {
      return { success: false, message: "Starting number must be at least 1" };
    }

    const client = getSupabaseClient();
    if (client) {
      const { error } = await client.from("job_request_counters").upsert(
        {
          id: "job_requests",
          current_number: startingNumber,
          starting_number: startingNumber,
          initialized: true,
          initialized_at: new Date().toISOString(),
          last_updated_at: new Date().toISOString(),
          type: "production",
          year: new Date().getFullYear(),
        },
        { onConflict: "id" }
      );

      if (error && (error as any).code !== "42P01") throw error;
    } else {
      memoryCounters.set(`job_requests:${new Date().getFullYear()}`, startingNumber);
    }

    return {
      success: true,
      message: `Counter initialized. Next job request will be JR${new Date().getFullYear().toString().slice(-2)}-${String(startingNumber + 1).padStart(4, "0")}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to initialize counter",
    };
  }
}
