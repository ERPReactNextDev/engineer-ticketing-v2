import { NextApiRequest, NextApiResponse } from "next";
import {
  fetchRolePermission,
  fetchAllRolePermissions,
  saveRolePermission,
  fetchUserById,
} from "@/lib/ModuleGlobal/supabase";

// Helper to check if user is SUPER ADMIN
async function isSuperAdmin(userId?: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const user = await fetchUserById(userId);
    if (!user) return false;
    const role = user.role || user.engiconnect_role || "";
    return role.toUpperCase() === "SUPER ADMIN";
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { docId } = req.query;
  const userId = req.headers["x-user-id"] as string;

  if (method === "GET") {
    try {
      if (docId && typeof docId === "string") {
        // Fetch single role permission
        const permission = await fetchRolePermission(docId);
        if (!permission) {
          return res.status(404).json({ error: "Permission not found" });
        }
        return res.status(200).json(permission);
      } else {
        // Fetch all role permissions
        const permissions = await fetchAllRolePermissions();
        return res.status(200).json(permissions);
      }
    } catch (error) {
      console.error("GET role permissions error:", error);
      return res.status(500).json({ error: "Failed to fetch permissions" });
    }
  }

  if (method === "POST") {
    try {
      // Verify user is SUPER ADMIN before allowing save
      const isAdmin = await isSuperAdmin(userId);
      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden: Only SUPER ADMIN can modify permissions" });
      }

      const data = req.body;
      const doc_id = data.doc_id || `${data.department}_${data.role}`;

      const success = await saveRolePermission(doc_id, data);
      if (!success) {
        return res.status(500).json({ error: "Failed to save permission" });
      }

      return res.status(200).json({ message: "Permission saved successfully" });
    } catch (error) {
      console.error("POST role permission error:", error);
      return res.status(500).json({ error: "Failed to save permission" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
