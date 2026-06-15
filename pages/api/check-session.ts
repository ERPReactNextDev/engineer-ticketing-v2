import { NextApiRequest, NextApiResponse } from "next";
import { fetchUserById } from "@/lib/ModuleGlobal/supabase";
import { parse } from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  
  // ✅ Check for delegated ID if cookie is missing (iframe scenario)
  const sessionUserId = cookies.session || req.headers["x-delegated-user-id"];
  const deviceId = req.headers["x-device-id"];

  if (!sessionUserId) {
    return res.status(401).json({ error: "Unauthorized: No Session Found" });
  }

  try {
    const user = await fetchUserById(sessionUserId as string);
    
    if (!user) return res.status(401).json({ error: "User not found" });

    // ✅ If it's a delegated session from Taskflow, we allow the device mismatch
    const isDelegated = !!req.headers["x-delegated-user-id"];
    
    if (!isDelegated && user.DeviceId !== deviceId) {
      return res.status(401).json({ error: "Device mismatch." });
    }

    return res.status(200).json({ message: "Session valid", user });
  } catch (err) {
    console.error("Session validation error:", err);
    return res.status(500).json({ error: "Session validation failed" });
  }
}