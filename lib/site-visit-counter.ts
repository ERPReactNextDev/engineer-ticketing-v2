import { db } from "@/lib/firebase";
import {
  doc,
  runTransaction,
  serverTimestamp,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";

const COUNTER_DOC_ID = "site_visits";
const STARTING_NUMBER = 36;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 100;

/**
 * Generate the next sequential site visit number with high-concurrency protection
 * Format: PS-YYYY-### (e.g., PS-2026-036)
 * Resets to 001 when new year starts
 *
 * @param isTest - If true, generates a test number (prefixes with TEST- and uses separate counter)
 * @returns The formatted site visit number
 */
export async function getNextSiteVisitNumber(
  isTest: boolean = false
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = isTest ? `TEST-PS-${currentYear}-` : `PS-${currentYear}-`;
  
  let lastError: Error | null = null;

  // Retry loop for collision handling
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const counterRef = doc(db, "counters", isTest ? "site_visits_test" : COUNTER_DOC_ID);

      // Use transaction for atomic counter increment
      const nextNum = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        
        const counterYear = counterSnap.exists() ? counterSnap.data().year : null;
        
        let current: number;
        let next: number;
        
        // Check if year has changed - reset counter if new year
        if (counterSnap.exists() && counterYear === currentYear) {
          // Same year, continue from current
          if (isTest) {
            current = counterSnap.data().currentNumber || 0;
          } else {
            current = counterSnap.data().currentNumber || STARTING_NUMBER - 1;
          }
          next = current + 1;
        } else {
          // New year or first time - start from beginning
          next = isTest ? 1 : STARTING_NUMBER;
        }

        // Double-check this number isn't already used in appointments
        const checkRef = collection(db, "appointments");
        const checkQuery = query(
          checkRef, 
          where("siteVisitNo", "==", `${prefix}${String(next).padStart(3, "0")}`),
          limit(1)
        );
        const checkSnap = await getDocs(checkQuery);
        
        if (!checkSnap.empty) {
          // Number already exists, skip ahead
          console.warn(`Site visit counter collision detected at ${next} for year ${currentYear}, skipping...`);
          const skipTo = next + 1;
          
          transaction.set(counterRef, {
            currentNumber: skipTo,
            year: currentYear,
            lastUpdated: serverTimestamp(),
            startingNumber: isTest ? 0 : STARTING_NUMBER,
            type: isTest ? "test" : "production",
            lastCollision: serverTimestamp(),
          });
          return skipTo;
        }

        // Update counter with current year
        transaction.set(counterRef, {
          currentNumber: next,
          year: currentYear,
          lastUpdated: serverTimestamp(),
          startingNumber: isTest ? 0 : STARTING_NUMBER,
          type: isTest ? "test" : "production",
        });

        return next;
      });

      const formattedNumber = `${prefix}${String(nextNum).padStart(3, "0")}`;

      // Counter transactions serialize number generation; this check handles
      // numbers that may predate the counter.
      const exists = await isSiteVisitNumberExists(formattedNumber);
      if (exists) {
        console.warn(`Number ${formattedNumber} already exists in database, retrying...`);
        lastError = new Error("Number already exists");
        
        // Small delay before retry to reduce contention
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }
        continue;
      }

      return formattedNumber;

    } catch (error: any) {
      console.error(`Attempt ${attempt} failed:`, error);
      lastError = error;
      
      // Exponential backoff before retry
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `Failed to generate unique site visit number after ${MAX_RETRIES} attempts. ` +
    `Last error: ${lastError?.message || "Unknown error"}`
  );
}

/**
 * Check if a site visit number already exists in the database
 */
export async function isSiteVisitNumberExists(
  siteVisitNo: string
): Promise<boolean> {
  const q = query(
    collection(db, "appointments"),
    where("siteVisitNo", "==", siteVisitNo),
    limit(1)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * Get current counter status (for IT/Engineering admin view)
 */
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
  const [prodSnap, testSnap] = await Promise.all([
    getDoc(doc(db, "counters", COUNTER_DOC_ID)),
    getDoc(doc(db, "counters", "site_visits_test")),
  ]);

  const currentYear = new Date().getFullYear();
  const prodYear = prodSnap.exists() ? (prodSnap.data().year || currentYear) : currentYear;
  const testYear = testSnap.exists() ? (testSnap.data().year || currentYear) : currentYear;

  return {
    production: {
      currentNumber: prodSnap.exists()
        ? prodSnap.data().currentNumber || STARTING_NUMBER
        : STARTING_NUMBER,
      lastUsed: prodSnap.exists()
        ? `PS-${prodYear}-${String(prodSnap.data().currentNumber || STARTING_NUMBER).padStart(3, "0")}`
        : null,
      startingNumber: prodSnap.exists()
        ? prodSnap.data().startingNumber || STARTING_NUMBER
        : STARTING_NUMBER,
      year: prodYear,
    },
    test: {
      currentNumber: testSnap.exists()
        ? testSnap.data().currentNumber || 0
        : 0,
      lastUsed: testSnap.exists()
        ? `TEST-PS-${testYear}-${String(testSnap.data().currentNumber || 0).padStart(3, "0")}`
        : null,
      year: testYear,
    },
  };
}

/**
 * Admin function to adjust the counter (IT/Engineering only)
 * @param newNumber - The new current number to set
 * @param isTest - Whether to adjust test or production counter
 */
export async function adjustCounter(
  newNumber: number,
  isTest: boolean = false
): Promise<{ success: boolean; message: string }> {
  try {
    if (newNumber < 1) {
      return { success: false, message: "Number must be at least 1" };
    }

    const counterRef = doc(
      db,
      "counters",
      isTest ? "site_visits_test" : COUNTER_DOC_ID
    );

    await updateDoc(counterRef, {
      currentNumber: newNumber,
      manuallyAdjusted: true,
      adjustedAt: serverTimestamp(),
    });

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

/**
 * Admin function to initialize/reset the counter with a specific starting number
 * @param startingNumber - The number to start from (next will be startingNumber + 1)
 */
export async function initializeCounter(
  startingNumber: number = STARTING_NUMBER
): Promise<{ success: boolean; message: string }> {
  try {
    if (startingNumber < 1) {
      return { success: false, message: "Starting number must be at least 1" };
    }

    const counterRef = doc(db, "counters", COUNTER_DOC_ID);
    const year = new Date().getFullYear();

    await setDoc(
      counterRef,
      {
        currentNumber: startingNumber,
        startingNumber: startingNumber,
        initialized: true,
        initializedAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        type: "production",
      },
      { merge: true }
    );

    return {
      success: true,
      message: `Counter initialized. Next site visit will be PS-${year}-${String(startingNumber + 1).padStart(3, "0")}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to initialize counter",
    };
  }
}
