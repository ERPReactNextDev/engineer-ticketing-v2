import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { parse } from "cookie";
import { dbCollab } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { spf_number } = req.body;

  if (!spf_number) {
    return res.status(400).json({ message: "spf_number is required" });
  }

  // Get current user from session
  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  const sessionUserId = cookies.session;
  const userDeptFromCookie = cookies.department?.toUpperCase() || "";

  // Fetch user's Department based on logged-in user
  // IT and PROCUREMENT departments bypass strict role checking
  let userDepartment = userDeptFromCookie;

  if (userDeptFromCookie !== "IT" && userDeptFromCookie !== "PROCUREMENT") {
    const { data: userData } = await supabase
      .from("users")
      .select("Department")
      .eq("id", sessionUserId)
      .single();

    userDepartment = userData?.Department || userDeptFromCookie;
  }

  try {
    // Fetch current spf_creation data to get previous_status
    const { data: creationData, error: fetchError } = await supabase
      .from("spf_creation")
      .select("status, previous_status")
      .eq("spf_number", spf_number)
      .single();

    if (fetchError) throw fetchError;

    // Fetch the latest revision history record for this spf_number
    const { data: latestRevision, error: revisionError } = await supabase
      .from("spf_request_revision_history")
      .select("*")
      .eq("spf_number", spf_number)
      .order("revision_number", { ascending: false })
      .limit(1)
      .single();

    if (revisionError || !latestRevision) {
      return res.status(404).json({
        message: "Revision history not found"
      });
    }

    // Get the next revision number
    const nextRevisionNumber = (parseInt(latestRevision.revision_number) || 0) + 1;

    // Prepare data for new revision history record
    // Exclude id to avoid unique constraint violation
    const { id, date_created, date_updated, spf_revision_approval_sales_status, spf_revision_approval_sales_date, revision_number, revision_result, revision_date, ...revisionDataWithoutId } = latestRevision;

    // Insert new record into spf_request_revision_history
    const { error: historyError } = await supabase
      .from("spf_request_revision_history")
      .insert({
        ...revisionDataWithoutId,
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
        spf_revision_approval_sales_status: "Rejected",
        spf_revision_approval_sales_date: new Date().toISOString(),
        revision_number: nextRevisionNumber,
        revision_result: `Request Rejected By ${userDepartment}`,
        revision_date: new Date().toISOString(),
      });

    if (historyError) throw historyError;

    // Revert spf_creation to previous status
    if (creationData?.previous_status) {
      const { error: creationError } = await supabase
        .from("spf_creation")
        .update({
          status: creationData.previous_status,
          previous_status: null,
          date_updated: new Date().toISOString()
        })
        .eq("spf_number", spf_number);

      if (creationError) throw creationError;
    }

    // Broadcast to collaboration hub
    try {
      const docRef = doc(dbCollab, "spf_creations", spf_number);
      await updateDoc(docRef, {
        messages: arrayUnion({
          id: `sys-${Date.now()}`,
          text: `REVISION REJECTED BY ${userDepartment.toUpperCase()}`,
          senderId: "system",
          senderName: "System",
          role: "system",
          time: new Date().toISOString(),
          isSystem: true,
          seenBy: [sessionUserId]
        })
      });
    } catch (firebaseError) {
      console.error("Failed to broadcast to collaboration hub:", firebaseError);
      // Don't fail the request if Firebase fails
    }

    return res.status(200).json({
      success: true,
      message: "Revision rejected by Engineering"
    });

  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: err.message || "Server error"
    });
  }
}