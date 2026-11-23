import { NextRequest, NextResponse } from "next/server";
import { parse } from "cookie";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import {
  DocumentReference,
  type DocumentData,
  GeoPoint,
  getFirestore,
  type Query,
  Timestamp,
} from "firebase-admin/firestore";
import { fetchUserById } from "@/lib/ModuleGlobal/supabase";

export const runtime = "nodejs";

const PAGE_SIZE = 500;
const MAX_IMPORT_BATCH = 400;

async function authorize(request: NextRequest) {
  const sessionId = parse(request.headers.get("cookie") || "").session;
  if (!sessionId) return false;

  const user = await fetchUserById(sessionId);
  if (!user || ["Resigned", "Terminated"].includes(user.Status)) return false;

  const roles = [
    user.engiconnect_role,
    user.Role,
    user.role,
    user.RoleCode,
    user.Position,
  ]
    .filter((role): role is string => typeof role === "string")
    .map((role) => role.toUpperCase().trim());

  const department = String(user.Department || user.department || "").toUpperCase().trim();
  return department === "IT" ||
    roles.some((role) => role === "SUPER ADMIN" || role.endsWith("_SUPER ADMIN"));
}

function getDatabase(key: string) {
  const projectId = key === "logs"
    ? process.env.NEXT_PUBLIC_LOGS_FIREBASE_PROJECT_ID
    : process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(`Firebase Admin credentials are not configured for the ${key} database.`);
  }

  const appName = `database-fetching-${key}`;
  const app = getApps().find((candidate) => candidate.name === appName) || initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  }, appName);
  return getFirestore(app);
}

function validPath(path: unknown, documentPath: boolean) {
  if (typeof path !== "string" || !path.trim() || path.startsWith("/") || path.endsWith("/")) return false;
  const segments = path.split("/");
  return segments.every(Boolean) && segments.length % 2 === (documentPath ? 0 : 1);
}

function serialize(value: any): any {
  if (value === null || value === undefined) return value;
  if (value instanceof Timestamp || value instanceof Date) return value instanceof Date ? value.toISOString() : value.toDate().toISOString();
  if (value instanceof GeoPoint) return { latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return `ref:${value.path}`;
  if (Buffer.isBuffer(value)) return `bytes:${value.toString("base64")}`;
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
}

function revive(value: any, database: ReturnType<typeof getFirestore>): any {
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return Timestamp.fromDate(date);
    }
    if (value.startsWith("ref:")) {
      const path = value.slice(4).replace(/^\/+|\/+$/g, "");
      if (validPath(path, true)) return database.doc(path);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => revive(item, database));
  if (value && typeof value === "object") {
    if (typeof value.latitude === "number" && typeof value.longitude === "number" && Object.keys(value).length === 2) {
      return new GeoPoint(value.latitude, value.longitude);
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revive(item, database)]));
  }
  return value;
}

async function discoverCollections(database: ReturnType<typeof getFirestore>) {
  const found = new Set<string>();
  const queue: Array<{ ref: FirebaseFirestore.CollectionReference; depth: number }> =
    (await database.listCollections()).map((ref) => ({ ref, depth: 1 }));
  const visited = new Set<string>();

  while (queue.length && visited.size < 2000) {
    const current = queue.shift()!;
    if (visited.has(current.ref.path)) continue;
    visited.add(current.ref.path);
    found.add(current.ref.id);
    if (current.depth >= 4) continue;

    const sample = await current.ref.limit(25).get();
    for (const snapshot of sample.docs) {
      const subcollections = await snapshot.ref.listCollections();
      subcollections.forEach((ref) => {
        found.add(ref.id);
        queue.push({ ref, depth: current.depth + 1 });
      });
    }
  }

  return Array.from(found).sort((a, b) => a.localeCompare(b));
}

export async function GET(request: NextRequest) {
  try {
    if (!(await authorize(request))) {
      return NextResponse.json({ error: "Only an authenticated Super Admin can access this tool." }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const database = getDatabase(params.get("db") || "main");
    const action = params.get("action");

    if (action === "collections") {
      return NextResponse.json({ collections: await discoverCollections(database) });
    }

    if (action !== "rows") {
      return NextResponse.json({ error: "Unknown database operation." }, { status: 400 });
    }

    const name = params.get("name") || "";
    const mode = params.get("mode") || "group";
    const cursor = params.get("cursor");
    const isPath = name.includes("/");
    if (!validPath(name, false) || (mode === "group" && isPath)) {
      return NextResponse.json({ error: "Invalid collection name or path." }, { status: 400 });
    }

    let query: Query<DocumentData> = mode === "group" && !isPath
      ? database.collectionGroup(name)
      : database.collection(name);
    if (cursor) {
      if (!validPath(cursor, true)) return NextResponse.json({ error: "Invalid page cursor." }, { status: 400 });
      const cursorSnapshot = await database.doc(cursor).get();
      if (cursorSnapshot.exists) query = query.startAfter(cursorSnapshot);
    }

    const snapshot = await query.limit(PAGE_SIZE).get();
    const rows = snapshot.docs.map((document) => ({
      id: document.id,
      path: document.ref.path,
      data: serialize(document.data()),
    }));

    return NextResponse.json({
      rows,
      nextCursor: snapshot.docs.length === PAGE_SIZE ? snapshot.docs[snapshot.docs.length - 1].ref.path : null,
    });
  } catch (error) {
    console.error("Admin database read failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Database read failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await authorize(request))) {
      return NextResponse.json({ error: "Only an authenticated Super Admin can access this tool." }, { status: 403 });
    }

    const body = await request.json();
    const database = getDatabase(body.db || "main");

    if (body.action === "update") {
      if (!validPath(body.path, true) || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
        return NextResponse.json({ error: "Invalid document update." }, { status: 400 });
      }
      await database.doc(body.path).update(revive(body.data, database));
      return NextResponse.json({ success: true });
    }

    if (body.action === "import") {
      if (!Array.isArray(body.operations)) {
        return NextResponse.json({ error: "Import operations are required." }, { status: 400 });
      }

      for (let index = 0; index < body.operations.length; index += MAX_IMPORT_BATCH) {
        const batch = database.batch();
        const operations = body.operations.slice(index, index + MAX_IMPORT_BATCH);
        for (const operation of operations) {
          if (!validPath(operation.path, !operation.auto)) {
            return NextResponse.json({ error: `Invalid import path: ${operation.path}` }, { status: 400 });
          }
          const reference = operation.auto
            ? database.collection(operation.path).doc()
            : database.doc(operation.path);
          const data = body.restore ? revive(operation.data, database) : operation.data;
          if (body.merge) batch.set(reference, data, { merge: true });
          else batch.set(reference, data);
        }
        await batch.commit();
      }
      return NextResponse.json({ success: true, imported: body.operations.length });
    }

    return NextResponse.json({ error: "Unknown database operation." }, { status: 400 });
  } catch (error) {
    console.error("Admin database write failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Database write failed." },
      { status: 500 },
    );
  }
}
