import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let app: App | undefined;
let _dbInstance: Firestore | undefined;

// Lazy initialization - only initialize when actually needed
function getApp() {
    if (app) return app;
    
    const apps = getApps();
    if (apps.length > 0) {
        app = apps[0];
        return app;
    }
    
    // Check if env vars are available
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error("Firebase Admin credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.");
    }
    
    try {
        app = initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            }),
        });
        return app;
    } catch (error) {
        console.error("Firebase Admin initialization error:", error);
        throw error;
    }
}

// Lazy getter for db
function getDb(): Firestore {
    if (_dbInstance) return _dbInstance;
    _dbInstance = getFirestore(getApp());
    return _dbInstance;
}

export { getApp, getDb };

// Backward compatible lazy-export for db
// Usage: db.collection(), db.batch(), etc.
export const db = {
    collection: (...args: Parameters<Firestore['collection']>) => getDb().collection(...args),
    doc: (...args: Parameters<Firestore['doc']>) => getDb().doc(...args),
    batch: () => getDb().batch(),
    runTransaction: (updateFunction: any) => getDb().runTransaction(updateFunction),
    settings: (settings: any) => getDb().settings(settings),
} as unknown as Firestore;
