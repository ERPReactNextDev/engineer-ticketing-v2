import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported, Messaging } from "firebase/messaging";

// --- MAIN PROJECT CONFIG (For Push & Users) ---
const mainConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- LOGS PROJECT CONFIG (For your other data) ---
const logsConfig = {
  apiKey: process.env.NEXT_PUBLIC_LOGS_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_LOGS_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_LOGS_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_LOGS_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_LOGS_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_LOGS_FIREBASE_APP_ID,
};

// --- COLLAB PROJECT CONFIG (For EngiConnect Chat) ---
const collabConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 1. Initialize Main App (Default)
const mainApp = !getApps().length ? initializeApp(mainConfig) : getApp();

// 2. Initialize Logs App (Named "logsApp")
const logsApp = !getApps().find(app => app.name === "logsApp") 
  ? initializeApp(logsConfig, "logsApp") 
  : getApp("logsApp");

// 3. Initialize Collab App (Named "collabApp") - For EngiConnect Chat
const collabApp = !getApps().find(app => app.name === "collabApp") 
  ? initializeApp(collabConfig, "collabApp") 
  : getApp("collabApp");

// --- EXPORTS ---

// Main Exports
export const db = getFirestore(mainApp);
export const storage = getStorage(mainApp);

// Logs Exports
export const logsDb = getFirestore(logsApp);

// Collab Exports (For EngiConnect Chat)
export const dbCollab = getFirestore(collabApp);

// Messaging Export (Client-Safe)
export const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (typeof window !== "undefined" && await isSupported()) {
    return getMessaging(mainApp);
  }
  return null;
};