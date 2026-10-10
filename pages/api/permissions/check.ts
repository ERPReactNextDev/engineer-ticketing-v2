import { NextApiRequest, NextApiResponse } from "next";
import { fetchUserById } from "@/lib/ModuleGlobal/supabase";
import { fetchRolePermission } from "@/lib/ModuleGlobal/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { userId } = req.query;

  if (method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // Fetch user from Supabase
    const user = await fetchUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user is Resigned or Terminated - deny access
    if (["Resigned", "Terminated"].includes(user.Status)) {
      return res.status(403).json({ 
        error: `Access denied. Account is ${user.Status}.`,
        status: user.Status,
        forceLogout: true
      });
    }

    const userDept = user.Department?.toUpperCase() || "";
    const userRole = user.engiconnect_role?.toUpperCase() || user.Role?.toUpperCase() || "GUEST";

    // IT and PROCUREMENT departments bypass role checking
    if (userDept === "IT" || userDept === "PROCUREMENT") {
      return res.status(200).json({
        hasAccess: true,
        isDashboardAllowed: true,
        permissions: null,
        bypass: true,
      });
    }

    // Check role_permissions
    const docId = `${userDept}_${userRole}`;
    const rolePermission = await fetchRolePermission(docId);

    if (rolePermission) {
      // Parse services if it's a string
      let services = rolePermission.services;
      if (typeof services === 'string') {
        try {
          services = JSON.parse(services);
        } catch {
          services = {};
        }
      }
      
      return res.status(200).json({
        hasAccess: true,
        isDashboardAllowed: rolePermission.is_dashboard_allowed !== false,
        permissions: rolePermission,
        services: services || {},
        bypass: false,
      });
    }

    // If no role permission found, check if role is GUEST
    if (userRole === "GUEST") {
      return res.status(200).json({
        hasAccess: true,
        isDashboardAllowed: false,
        permissions: null,
        services: {},
        bypass: false,
      });
    }

    // Default: allow access if no explicit permission found
    return res.status(200).json({
      hasAccess: true,
      isDashboardAllowed: true,
      permissions: null,
      services: {},
      bypass: false,
    });
  } catch (error) {
    console.error("Check permissions error:", error);
    return res.status(500).json({ error: "Failed to check permissions" });
  }
}
