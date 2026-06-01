/**
 * Notification Service
 * Reusable push notification system for all services
 * 
 * SECURITY PROTOCOL:
 * - Notifications are targeted to specific users based on role hierarchy
 * - IT/SUPER ADMIN/LEADER/MANAGER: Receive all relevant notifications
 * - TSM: Receive notifications for own items + subordinate items
 * - TSA/MEMBER: Only receive notifications for their own items
 */

import { collectionGroup, getDocs, query, getFirestore, collection, where, doc, getDoc } from "firebase/firestore";

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
}

interface NotificationOptions {
  /** Target specific users by their user IDs. If not provided, sends to all admins/IT. */
  targetUserIds?: string[];
  /** The user who triggered the notification (excluded from recipients to avoid self-notification) */
  triggeredBy?: string;
  /** Whether to include all admin users (IT, SUPER ADMIN, LEADER, MANAGER) regardless of relationship */
  includeAdmins?: boolean;
  /** The department this notification relates to (for department-specific filtering) */
  department?: string;
}

/**
 * Get admin users who should receive all notifications.
 * FIX: Query only users with admin roles instead of downloading the entire users collection.
 * Uses the Firestore `users` collection where Role is one of the admin values.
 */
async function getAdminUserIds(db: any): Promise<string[]> {
  const adminIds: string[] = [];
  
  try {
    // FIX: Use targeted queries instead of fetching all users.
    // Query IT department users and admin-role users separately, then merge.
    const { query: fsQuery, collection: fsCollection, where: fsWhere, getDocs: fsGetDocs } = await import("firebase/firestore");

    const [itSnap, adminRoleSnap] = await Promise.all([
      fsGetDocs(fsQuery(fsCollection(db, "users"), fsWhere("Department", "==", "IT"))),
      fsGetDocs(fsQuery(fsCollection(db, "users"), fsWhere("Role", "in", ["SUPER ADMIN", "LEADER", "MANAGER"]))),
    ]);

    const seen = new Set<string>();
    const addUnique = (id: string) => { if (!seen.has(id)) { seen.add(id); adminIds.push(id); } };

    itSnap.forEach((d: any) => addUnique(d.id));
    adminRoleSnap.forEach((d: any) => addUnique(d.id));
  } catch (error) {
    console.error("Error fetching admin users:", error);
  }
  
  return adminIds;
}

/**
 * Get TSM's subordinate user IDs.
 * FIX: Query only users whose TSM field matches this TSM's name/refId,
 * instead of downloading the entire users collection.
 */
async function getSubordinateIds(db: any, tsmUserId: string): Promise<string[]> {
  const subordinateIds: string[] = [];
  
  try {
    const tsmDoc = await getDoc(doc(db, "users", tsmUserId));
    if (!tsmDoc.exists()) return [];
    
    const tsmData = tsmDoc.data();
    const tsmName = `${tsmData.Firstname || ""} ${tsmData.Lastname || ""}`.trim();
    const tsmRefId = (tsmData.ReferenceID || "").toUpperCase();
    const clean = (n: string) => (n || "").replace(/,/g, "").replace(/\s+/g, " ").trim().toUpperCase();
    const myCleanName = clean(tsmName);

    // FIX: Query by TSM name field instead of fetching all users
    const { query: fsQuery, collection: fsCollection, where: fsWhere, getDocs: fsGetDocs } = await import("firebase/firestore");

    const [byTSMName, byTSMRef] = await Promise.all([
      fsGetDocs(fsQuery(fsCollection(db, "users"), fsWhere("TSM", "==", myCleanName))),
      tsmRefId ? fsGetDocs(fsQuery(fsCollection(db, "users"), fsWhere("TSM", "==", tsmRefId))) : Promise.resolve({ docs: [] as any[] }),
    ]);

    const seen = new Set<string>();
    const addUnique = (id: string) => { if (!seen.has(id) && id !== tsmUserId) { seen.add(id); subordinateIds.push(id); } };

    (byTSMName as any).docs.forEach((d: any) => addUnique(d.id));
    (byTSMRef as any).docs.forEach((d: any) => addUnique(d.id));
  } catch (error) {
    console.error("Error fetching subordinates:", error);
  }
  
  return subordinateIds;
}

/**
 * Send push notification to targeted users' devices
 * 
 * SECURITY: Only sends to devices belonging to the specified target users.
 * If no targets specified, defaults to admin users only.
 */
export async function sendPushNotification(
  payload: NotificationPayload,
  options: NotificationOptions = {}
): Promise<{
  success: boolean;
  successCount?: number;
  failureCount?: number;
  message: string;
}> {
  try {
    const db = getFirestore();
    
    // Build list of target user IDs
    let targetUserIds: string[] = options.targetUserIds || [];
    
    // If includeAdmins is true (or not specified), add admin users
    if (options.includeAdmins !== false) {
      const adminIds = await getAdminUserIds(db);
      // Add admins that aren't already in the target list
      adminIds.forEach(id => {
        if (!targetUserIds.includes(id)) {
          targetUserIds.push(id);
        }
      });
    }
    
    // Remove the triggering user to avoid self-notification
    if (options.triggeredBy) {
      targetUserIds = targetUserIds.filter(id => id !== options.triggeredBy);
    }
    
    if (targetUserIds.length === 0) {
      return { success: true, successCount: 0, failureCount: 0, message: "No target users" };
    }
    
    // Get devices only for target users
    const deviceTokens = new Map<string, { token: string; lastSync: any }>();
    
    for (const userId of targetUserIds) {
      const devicesCol = collection(db, "users", userId, "devices");
      const devicesSnap = await getDocs(devicesCol);
      
      devicesSnap.forEach((d) => {
        const deviceData = d.data();
        const deviceId = deviceData.deviceId || d.id;
        
        if (deviceData.fcmToken && deviceData.notificationsEnabled !== false) {
          const existing = deviceTokens.get(deviceId);
          const currentSync = deviceData.lastPushSync?.toDate?.() || new Date(0);
          
          if (!existing || currentSync > existing.lastSync) {
            deviceTokens.set(deviceId, { 
              token: deviceData.fcmToken, 
              lastSync: currentSync 
            });
          }
        }
      });
    }

    const uniqueTokens = Array.from(deviceTokens.values()).map(v => v.token);

    if (uniqueTokens.length === 0) {
      return { success: true, successCount: 0, failureCount: 0, message: "No tokens found for target users" };
    }

    // Send push notification
    const pushRes = await fetch("/api/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        tokens: uniqueTokens,
        url: payload.url || "/dashboard",
      }),
    });

    const pushData = await pushRes.json();

    return {
      success: pushData.success,
      successCount: pushData.successCount || 0,
      failureCount: pushData.failureCount || 0,
      message: pushData.success 
        ? `Sent to ${pushData.successCount} devices (${targetUserIds.length} users)` 
        : pushData.error || "Failed to send",
    };
  } catch (error: any) {
    console.error("Push notification error:", error);
    return { 
      success: false, 
      successCount: 0, 
      failureCount: 0, 
      message: error.message || "Unknown error" 
    };
  }
}

/**
 * Send notification to a user's manager/TSM hierarchy
 */
export async function sendNotificationToHierarchy(
  payload: NotificationPayload,
  submittedByUserId: string,
  options: { triggeredBy?: string; includeSubmitter?: boolean } = {}
): Promise<{ success: boolean; message: string }> {
  try {
    const db = getFirestore();
    
    // Get the submitter's info
    const submitterDoc = await getDoc(doc(db, "users", submittedByUserId));
    if (!submitterDoc.exists()) {
      return { success: false, message: "Submitter not found" };
    }
    
    const submitterData = submitterDoc.data();
    const submitterRole = (submitterData.Role || submitterData.role || "MEMBER").toUpperCase();
    
    // Build target list
    const targetUserIds: string[] = [];
    
    // Always include admins
    const adminIds = await getAdminUserIds(db);
    targetUserIds.push(...adminIds);
    
    // For TSA/MEMBER, also notify their TSM and Manager
    if (submitterRole === "MEMBER" || submitterRole === "TSA") {
      const clean = (n: string) => (n || "").replace(/,/g, "").replace(/\s+/g, " ").trim().toUpperCase();

      // FIX: Use the submitter's own TSM/Manager fields to look up their hierarchy
      // instead of scanning the entire users collection.
      const submitterTSMName = clean(submitterData.TSMName || submitterData.TSM || "");
      const submitterManagerName = clean(submitterData.ManagerName || submitterData.Manager || "");

      const { query: fsQuery, collection: fsCollection, where: fsWhere, getDocs: fsGetDocs } = await import("firebase/firestore");

      const lookups: Promise<any>[] = [];
      if (submitterTSMName) {
        lookups.push(fsGetDocs(fsQuery(fsCollection(db, "users"), fsWhere("Role", "==", "TSM"))));
      }
      if (submitterManagerName) {
        lookups.push(fsGetDocs(fsQuery(fsCollection(db, "users"), fsWhere("Role", "in", ["MANAGER", "SALES HEAD"]))));
      }

      const results = await Promise.all(lookups);
      results.forEach((snap: any) => {
        snap.docs.forEach((userDoc: any) => {
          const userData = userDoc.data();
          const fullName = clean(`${userData.Firstname || ""} ${userData.Lastname || ""}`);
          const refId = clean(userData.ReferenceID || "");
          const isTSMMatch = submitterTSMName && (fullName === submitterTSMName || refId === submitterTSMName);
          const isManagerMatch = submitterManagerName && (fullName === submitterManagerName || refId === submitterManagerName);
          if ((isTSMMatch || isManagerMatch) && !targetUserIds.includes(userDoc.id)) {
            targetUserIds.push(userDoc.id);
          }
        });
      });
    }
    
    // Include submitter if requested (for updates about their own items)
    if (options.includeSubmitter && !targetUserIds.includes(submittedByUserId)) {
      targetUserIds.push(submittedByUserId);
    }
    
    // Send to targets (excluding the triggering user)
    const result = await sendPushNotification(payload, {
      targetUserIds,
      triggeredBy: options.triggeredBy,
      includeAdmins: false, // Already included above
    });
    
    return { success: result.success, message: result.message };
  } catch (error: any) {
    console.error("Hierarchy notification error:", error);
    return { success: false, message: error.message };
  }
}

/**
 * Service-specific notification helpers
 */
export const NotificationTemplates = {
  // Site Visit Appointments
  siteVisit: {
    created: (clientName: string, date: string) => ({
      title: "New Site Visit Scheduled",
      body: `${clientName} scheduled a site visit for ${date}`,
      url: "/appointments/site-visit",
    }),
    updated: (clientName: string) => ({
      title: "Site Visit Updated",
      body: `${clientName} updated their site visit details`,
      url: "/appointments/site-visit",
    }),
  },

  // Job Requests
  jobRequest: {
    created: (companyName: string, projectTitle: string) => ({
      title: "New Job Request",
      body: `${companyName} submitted "${projectTitle}"`,
      url: "/request/job",
    }),
    statusChanged: (projectTitle: string, newStatus: string) => ({
      title: "Job Request Status Update",
      body: `"${projectTitle}" is now ${newStatus}`,
      url: "/request/job",
    }),
  },

  // DIAlux Requests
  dialux: {
    created: (clientName: string, projectName: string) => ({
      title: "New DIAlux Simulation",
      body: `${clientName} requested simulation for "${projectName}"`,
      url: "/request/dialux",
    }),
    completed: (projectName: string) => ({
      title: "DIAlux Simulation Complete",
      body: `"${projectName}" simulation has been completed`,
      url: "/request/dialux",
    }),
  },

  // Shop Drawing Requests
  shopDrawing: {
    created: (projectName: string) => ({
      title: "New Shop Drawing Request",
      body: `New request for "${projectName}" requires review`,
      url: "/request/shop-drawing",
    }),
    statusChanged: (projectName: string, newStatus: string) => ({
      title: "Shop Drawing Update",
      body: `"${projectName}" is now ${newStatus}`,
      url: "/request/shop-drawing",
    }),
  },

  // Testing/Monitoring
  testing: {
    created: (productName: string, targetDate: string) => ({
      title: "New Testing Item",
      body: `"${productName}" scheduled for ${targetDate}`,
      url: "/request/testing",
    }),
    overdue: (productName: string, daysOverdue: number) => ({
      title: "⚠️ Testing Item Overdue",
      body: `"${productName}" is ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue`,
      url: "/request/testing",
    }),
    completed: (productName: string) => ({
      title: "Testing Complete",
      body: `"${productName}" has passed testing`,
      url: "/request/testing",
    }),
  },

  // Other Requests
  otherRequest: {
    created: (title: string, userName: string) => ({
      title: `New Request: ${title}`,
      body: `${userName} just submitted a new entry`,
      url: "/request/other",
    }),
  },

  // SPF Product Requests
  productRequest: {
    created: (productName: string, quantity: number) => ({
      title: "New SPF Product Request",
      body: `Request for ${quantity} unit${quantity > 1 ? "s" : ""} of ${productName}`,
      url: "/request/product",
    }),
    approved: (productName: string) => ({
      title: "SPF Request Approved",
      body: `"${productName}" has been approved`,
      url: "/request/product",
    }),
  },

  // Product Recommendations
  recommendation: {
    created: (productName: string, clientName: string) => ({
      title: "New Product Recommendation",
      body: `${clientName} recommended "${productName}"`,
      url: "/requests/recommendation",
    }),
  },

  // Meeting Room Bookings
  meetingRoom: {
    created: (roomName: string, date: string, time: string) => ({
      title: "New Meeting Room Booking",
      body: `${roomName} booked for ${date} at ${time}`,
      url: "/appointments/meeting-rooms",
    }),
    confirmed: (roomName: string, date: string) => ({
      title: "Meeting Room Confirmed",
      body: `Your booking for ${roomName} on ${date} is confirmed`,
      url: "/appointments/meeting-rooms",
    }),
    cancelled: (roomName: string) => ({
      title: "Meeting Room Booking Cancelled",
      body: `Booking for ${roomName} has been cancelled`,
      url: "/appointments/meeting-rooms",
    }),
    rejected: (roomName: string) => ({
      title: "Meeting Room Booking Rejected",
      body: `Your booking request for ${roomName} was not approved`,
      url: "/appointments/meeting-rooms",
    }),
  },

  // System/Messages
  message: {
    newMessage: (senderName: string) => ({
      title: "New Message",
      body: `${senderName} sent you a message`,
      url: "/messages",
    }),
  },
};

/**
 * Send notification with template
 */
export async function sendNotification(
  template: { title: string; body: string; url?: string }
): Promise<{ success: boolean; message: string }> {
  const result = await sendPushNotification(template);
  return { success: result.success, message: result.message };
}
