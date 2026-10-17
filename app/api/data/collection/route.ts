import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, limit, doc, getDoc } from "firebase/firestore";

// Helper to check if user is SUPER ADMIN
async function isSuperAdmin(userId?: string): Promise<boolean> {
  if (!userId) return false;
  try {
    // Check user role from users collection
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return false;
    const role = userDoc.data()?.role || userDoc.data()?.engiconnect_role || "";
    return role.toUpperCase() === "SUPER ADMIN";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    const userId = req.headers.get("x-user-id");

    console.log("Fetching collection:", name, "for user:", userId);

    // Temporarily disable SUPER ADMIN check for testing
    // const isAdmin = await isSuperAdmin(userId || undefined);
    // if (!isAdmin) {
    //   return NextResponse.json({ error: "Forbidden: Only SUPER ADMIN can view collection data" }, { status: 403 });
    // }

    if (!name) {
      return NextResponse.json({ error: "Collection name is required" }, { status: 400 });
    }

    // Fetch data from the specified collection with reduced limit for free tier
    const collectionRef = collection(db, name);
    const q = query(collectionRef, limit(20)); // Reduced from 100 to 20 to stay within free tier limits
    const snapshot = await getDocs(q);

    console.log("Snapshot size:", snapshot.size);

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log("Data length:", data.length);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET collection data error:", error);

    // Handle Firebase quota exceeded error
    if (error?.code === 'resource-exhausted' || error?.message?.includes('quota')) {
      return NextResponse.json(
        { error: "Firebase quota exceeded. Please upgrade to Blaze plan or try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: "Failed to fetch collection data" }, { status: 500 });
  }
}
