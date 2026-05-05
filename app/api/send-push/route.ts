import { NextResponse } from "next/server";
import { getApp } from "@/lib/firebase-admin";
import { getMessaging } from "firebase-admin/messaging";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; 

// Lazy getter for messaging - initializes Firebase Admin only when needed
function getMessagingInstance() {
  const app = getApp();
  return getMessaging(app);
}

export async function POST(request: Request) {
  try {
    const { title, body, tokens, url } = await request.json();

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ success: false, error: "No tokens" }, { status: 400 });
    }

    const message = {
      notification: { title, body },
      data: { url: url || "/" },
      tokens: tokens,
      android: {
        priority: "high" as const,
        notification: {
          sound: "default",
          channelId: "default",
        },
      },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          body: body,
          requireInteraction: true,
          icon: "/logo.png" // Make sure this exists in /public or remove it
        },
        fcm_options: { link: url || "/" },
      },
    };

    // CRITICAL: We MUST await this so Vercel doesn't kill the function early
    const messaging = getMessagingInstance();
    const response = await messaging.sendEachForMulticast(message);
    
    console.log(`Vercel Push: ${response.successCount} sent, ${response.failureCount} failed`);

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (err: any) {
    console.error("Vercel API Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}