/**
 * Meeting Room Booking Reminders
 * 
 * Call this endpoint via a cron job or scheduled task every 15 minutes.
 * It finds bookings starting in the next 30 minutes and sends push notifications
 * to the submitter and tagged attendees.
 * 
 * Example cron: every 15 min → GET /api/meeting-rooms/send-reminders
 */

import { NextResponse } from "next/server"
import { getDb } from "@/lib/firebase-admin"
import { Timestamp } from "firebase-admin/firestore"

export async function GET() {
  try {
    const db = getDb()
    const now = new Date()
    const in30 = new Date(now.getTime() + 30 * 60 * 1000)
    const in45 = new Date(now.getTime() + 45 * 60 * 1000)

    // Find confirmed bookings whose start time is within the next 30–45 min window
    // We use a 15-min window to match the cron frequency
    const snap = await db.collection("room_bookings")
      .where("status", "==", "CONFIRMED")
      .where("reminderSent", "==", false)
      .get()

    const reminders: string[] = []

    for (const docSnap of snap.docs) {
      const b = docSnap.data()
      const bookingDate: Date = b.bookingDate?.toDate ? b.bookingDate.toDate() : new Date(b.bookingDate)
      const [sh, sm] = (b.startTime || "0:0").split(":").map(Number)
      const startDateTime = new Date(bookingDate)
      startDateTime.setHours(sh, sm, 0, 0)

      // Check if start time is within the 30–45 min window
      if (startDateTime >= in30 && startDateTime <= in45) {
        const minutesUntil = Math.round((startDateTime.getTime() - now.getTime()) / 60000)

        // Collect target user IDs: submitter + attendees
        const targetIds: string[] = [b.submittedBy].filter(Boolean)
        if (Array.isArray(b.attendees)) {
          b.attendees.forEach((a: any) => { if (a.id) targetIds.push(a.id) })
        }

        // Get FCM tokens for all targets
        const tokens: string[] = []
        for (const uid of [...new Set(targetIds)]) {
          const devicesSnap = await db.collection("users").doc(uid).collection("devices").get()
          devicesSnap.forEach(d => {
            const data = d.data()
            if (data.fcmToken && data.notificationsEnabled !== false) {
              tokens.push(data.fcmToken)
            }
          })
        }

        if (tokens.length > 0) {
          // Send via FCM using the existing send-push API
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
          await fetch(`${baseUrl}/api/send-push`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: `⏰ Meeting in ${minutesUntil} minutes`,
              body: `${b.title} · ${b.roomName} · ${b.startTime}–${b.endTime}`,
              url: `/appointments/meeting-rooms/${docSnap.id}`,
              tokens,
            }),
          })

          // Mark reminder as sent to avoid duplicates
          await docSnap.ref.update({ reminderSent: true, reminderSentAt: Timestamp.now() })
          reminders.push(docSnap.id)
        }
      }
    }

    return NextResponse.json({
      success: true,
      remindersSet: reminders.length,
      bookingIds: reminders,
    })
  } catch (error: any) {
    console.error("Reminder error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
