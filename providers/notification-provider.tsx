"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { db, getMessagingInstance } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, getDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { toast } from "sonner";
import { X, BellRing, BellOff, CheckCircle2, RefreshCw, Wifi, Settings, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeUserToPush } from "@/lib/push-subscription";
import { v4 as uuidv4 } from "uuid";
import { playNotificationSound, preloadSounds, getSoundConfig } from "@/lib/notification-sounds";
import { NotificationPopup, NotificationData, useNotificationQueue } from "@/components/notification-popup";
import { NotificationSettings } from "@/components/notification-settings";

/* ─────────────────────────────────────────────────────────
   DEVICE ID — unified with login-form.tsx
   Both use the same localStorage key "deviceId" with uuidv4.
   This was the bug: notification-provider used btoa(ua+screen)
   but login used uuidv4 — they never matched so the server
   could never link a push subscription to a login session.
───────────────────────────────────────────────────────── */
function getDeviceId(): string {
  if (typeof window === "undefined") return "unknown";
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = uuidv4();
    localStorage.setItem("deviceId", id);
  }
  return id;
}

/* Pages where the sync badge and prompt are shown */
const BADGE_PAGES = ["/dashboard"];

/* Pages that are public — never show notification prompt */
const PUBLIC_PAGES = ["/login", "/", "/forgot-password"];

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname();
  const { current, addNotification, closeCurrent } = useNotificationQueue();

  const [isMounted, setIsMounted]     = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSyncing, setIsSyncing]     = useState(false);
  const [showPrompt, setShowPrompt]   = useState(false);
  const [userId, setUserId]           = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  // FIX: Cache the subscription check result so we don't re-read Firestore on every route change.
  const subscriptionChecked = useRef(false);

  /* ── Check current subscription status ── */
  const checkSubscription = useCallback(async () => {
    if (typeof window === "undefined") return;

    const uid = localStorage.getItem("userId");
    setUserId(uid);

    // Don't check on public/auth pages or if not logged in
    if (!uid || PUBLIC_PAGES.includes(pathname ?? "")) return;

    // FIX: Only check Firestore once per session mount, not on every route change.
    // Subsequent navigations reuse the cached result. The check resets when the
    // component unmounts (e.g., on logout/page refresh).
    if (subscriptionChecked.current) return;
    subscriptionChecked.current = true;

    const safeUid  = uid as string;
    const deviceId = getDeviceId();

    try {
      // 1. Is there an active browser push subscription?
      const reg      = await navigator.serviceWorker?.getRegistration?.();
      const sub      = await reg?.pushManager?.getSubscription?.();
      const hasBrowserSub = !!sub;

      // 2. Is this device registered in Firestore for this user?
      const deviceRef  = doc(db, "users", safeUid, "devices", deviceId);
      const deviceSnap = await getDoc(deviceRef);
      const hasDbSub   = deviceSnap.exists() && deviceSnap.data()?.notificationsEnabled !== false;

      // Both must be true to be considered "synced"
      const active = hasBrowserSub && hasDbSub;
      setIsSubscribed(active);

      // Show prompt on dashboard if not synced and user is logged in
      if (!active && BADGE_PAGES.includes(pathname ?? "")) {
        setTimeout(() => setShowPrompt(true), 1500);
      }
    } catch (err) {
      console.error("Check subscription error:", err);
    }
  }, [pathname]);

  /* ── Mount + Firebase messaging listener ── */
  useEffect(() => {
    setIsMounted(true);
    checkSubscription();

    // Preload notification sounds
    preloadSounds();

    // One-time cleanup of duplicate device registrations
    const cleanupDuplicateDevices = async () => {
      const uid = localStorage.getItem("userId");
      if (!uid) return;
      
      try {
        const devicesCol = collection(db, "users", uid, "devices");
        const devicesSnap = await getDocs(devicesCol);
        
        // Group by deviceId and keep only the most recent
        const deviceMap = new Map();
        devicesSnap.forEach((d) => {
          const data = d.data();
          const existing = deviceMap.get(data.deviceId);
          if (!existing || (data.lastPushSync?.seconds > existing.data.lastPushSync?.seconds)) {
            deviceMap.set(data.deviceId, { id: d.id, data, ref: d.ref });
          }
        });
        
        // Delete duplicates
        const batch = writeBatch(db);
        let deleted = 0;
        devicesSnap.forEach((d) => {
          const data = d.data();
          const keeper = deviceMap.get(data.deviceId);
          if (keeper && keeper.id !== d.id) {
            batch.delete(d.ref);
            deleted++;
          }
        });
        
        if (deleted > 0) {
          await batch.commit();
          console.log(`[Push] Cleaned up ${deleted} duplicate device registration(s)`);
        }
      } catch (err) {
        console.error("[Push] Cleanup error:", err);
      }
    };
    
    cleanupDuplicateDevices();

    // Listen for foreground messages
    getMessagingInstance().then(messaging => {
      if (!messaging) return;
      onMessage(messaging, payload => {
        // Use FCM messageId for deduplication if available
        const messageId = payload.messageId || `fcm-${Date.now()}`;
        
        // Show rich popup notification instead of toast
        const notification: NotificationData = {
          id: messageId,
          title: payload.notification?.title || "New Update",
          body: payload.notification?.body || "",
          type: "info",
          url: payload.data?.url || "/dashboard",
          timestamp: new Date(),
        };
        addNotification(notification);
        
        // Play notification sound using configurable settings
        playNotificationSound();
      });
    });
  }, [pathname, addNotification]);

  /* ── Sync this device to push notifications ── */
  const handleSyncPush = async () => {
    const uid = localStorage.getItem("userId");
    if (!uid) return toast.error("Please log in before syncing notifications.");

    setIsSyncing(true);

    try {
      const messaging = await getMessagingInstance();
      if (!messaging) throw new Error("Push notifications not supported on this browser.");

      // First, unregister any existing push subscription to prevent duplicates
      try {
        const existingReg = await navigator.serviceWorker.getRegistration();
        if (existingReg?.pushManager) {
          const existingSub = await existingReg.pushManager.getSubscription();
          if (existingSub) {
            await existingSub.unsubscribe();
            console.log("[Push] Unsubscribed from previous push subscription");
          }
        }
      } catch (unsubErr) {
        console.error("[Push] Unsubscribe error (non-fatal):", unsubErr);
      }

      // Register service worker fresh
      await navigator.serviceWorker.register("/firebase-messaging-sw.js");

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was denied.");

      // Get FCM token
      const fcmToken = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY?.trim(),
      });

      // Get Web Push subscription
      const fullSubscription = await subscribeUserToPush();
      const deviceId = getDeviceId(); // same key as login form

      // Clean up old duplicate devices with same FCM token or same deviceId
      try {
        const devicesCol = collection(db, "users", uid, "devices");
        const devicesSnap = await getDocs(devicesCol);
        const batch = writeBatch(db);
        let deletedCount = 0;
        
        devicesSnap.forEach((d) => {
          const data = d.data();
          // Delete if: same FCM token (different device) OR same deviceId (old entry)
          if ((data.fcmToken === fcmToken && d.id !== deviceId) || 
              (data.deviceId === deviceId && d.id !== deviceId)) {
            batch.delete(d.ref);
            deletedCount++;
          }
        });
        
        if (deletedCount > 0) {
          await batch.commit();
          console.log(`[Push] Cleaned up ${deletedCount} duplicate device(s)`);
        }
      } catch (cleanupErr) {
        console.error("[Push] Cleanup error (non-fatal):", cleanupErr);
      }

      // Save to Firestore under users/{uid}/devices/{deviceId}
      const deviceRef = doc(db, "users", uid, "devices", deviceId);
      await setDoc(deviceRef, {
        fcmToken,
        pushSubscription: fullSubscription
          ? JSON.parse(JSON.stringify(fullSubscription))
          : null,
        platform:           navigator.platform,
        userAgent:          navigator.userAgent,
        deviceId,           // store it explicitly for server-side lookups
        lastPushSync:       serverTimestamp(),
        notificationsEnabled: true,
      }, { merge: true });

      setIsSubscribed(true);
      setShowPrompt(false);
      toast.success("Device synced! You'll now receive real-time notifications.");
    } catch (err: any) {
      console.error("Push sync error:", err);
      toast.error(err.message || "Sync failed. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  /* ── Don't render on server or public pages ── */
  if (!isMounted) return <>{children}</>;
  const safePath      = pathname ?? "";
  const isPublicPage  = PUBLIC_PAGES.includes(safePath);
  const isOnBadgePage = BADGE_PAGES.includes(safePath);

  return (
    <>
      {/* ══════════════════════════════════════
          SYNC PROMPT MODAL
          Only shown on dashboard, only when logged in
      ══════════════════════════════════════ */}
      {showPrompt && !isSubscribed && !isPublicPage && userId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-[360px] rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="relative p-7 flex flex-col items-center text-center">
              <button
                onClick={() => setShowPrompt(false)}
                className="absolute top-5 right-5 p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X size={18} className="text-zinc-400" />
              </button>

              {/* Icon */}
              <div className="relative mb-5">
                <div className="absolute -inset-4 bg-[#E33636]/10 rounded-full blur-xl" />
                <div className="size-20 rounded-[22px] bg-white border border-zinc-100 shadow-xl flex items-center justify-center relative">
                  <BellRing size={30} className="text-[#121212]" />
                  <div className="absolute -top-1.5 -right-1.5 size-4 bg-[#E33636] rounded-full border-4 border-white animate-pulse" />
                </div>
              </div>

              <h3 className="text-lg font-black text-[#121212] uppercase tracking-tight leading-tight mb-2">
                Sync This Device
              </h3>
              <p className="text-[11px] font-medium text-zinc-400 leading-relaxed mb-6 max-w-[260px]">
                Stay up to date with real-time alerts for requests, approvals, and updates — even when the app is in the background.
              </p>

              <div className="w-full space-y-2.5">
                <button
                  onClick={handleSyncPush}
                  disabled={isSyncing}
                  className="w-full bg-[#121212] hover:bg-zinc-800 active:scale-[0.98] text-white font-black py-3.5 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-lg text-[11px] uppercase tracking-widest disabled:opacity-50"
                >
                  {isSyncing
                    ? <><RefreshCw size={16} className="animate-spin" /> Syncing...</>
                    : <><Wifi size={16} /> Enable Notifications</>}
                </button>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="w-full text-zinc-400 text-[9px] font-black uppercase tracking-widest py-2 hover:text-zinc-700 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          BOTTOM-LEFT SYNC BADGE
          Only on dashboard. Positioned to avoid
          the bottom-right FAB button.
      ══════════════════════════════════════ */}
      {isOnBadgePage && userId && (
        <div className="fixed bottom-6 left-4 z-30">
          <button
            onClick={() => !isSubscribed && setShowPrompt(true)}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border shadow-lg bg-white transition-all active:scale-95",
              isSubscribed
                ? "border-emerald-100 cursor-default"
                : "border-red-100 hover:border-red-200 hover:shadow-xl cursor-pointer"
            )}
          >
            <div className={cn(
              "size-7 rounded-xl flex items-center justify-center flex-shrink-0",
              isSubscribed ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
            )}>
              {isSubscribed
                ? <CheckCircle2 size={15} />
                : <BellOff size={15} />}
            </div>
            <div className="text-left">
              <p className="text-[9px] font-black uppercase tracking-wide text-zinc-900 leading-none">
                {isSubscribed ? "Device Synced" : "Not Synced"}
              </p>
              <p className="text-[8px] font-bold text-zinc-400 uppercase mt-0.5">
                Push Notifications
              </p>
            </div>
            {!isSubscribed && (
              <div className="size-1.5 bg-[#E33636] rounded-full animate-pulse flex-shrink-0" />
            )}
          </button>

          {/* Settings button - only show when subscribed */}
          {isSubscribed && (
            <button
              onClick={() => setShowSettings(true)}
              className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-zinc-200 shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <Settings size={14} className="text-zinc-500" />
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wide">
                Sound Settings
              </span>
            </button>
          )}
        </div>
      )}

      {/* Rich Notification Popup */}
      <NotificationPopup
        notification={current}
        onClose={closeCurrent}
        autoClose={true}
        autoCloseDelay={8000}
      />

      {/* Notification Settings Modal */}
      <NotificationSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {children}
    </>
  );
}