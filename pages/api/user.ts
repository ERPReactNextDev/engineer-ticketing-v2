import { NextApiRequest, NextApiResponse } from "next";
import { fetchUserById, getSupabaseClient } from "@/lib/ModuleGlobal/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
  //test

  try {
    const userId = req.query.id as string;
    const role = req.query.role as string;

    // CASE 1: Single User
    if (userId) {
      const user = await fetchUserById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { Password, ...userData } = user;
      return res.status(200).json(userData);
    }

    // CASE 2: All Users (Dropdown)
    const supabase = getSupabaseClient();
    let query = supabase.from("users").select("*");
    
    if (role) {
      query = query.eq("Role", role);
    }

    const { data: users, error } = await query;

    if (error) {
      console.error("Supabase Error:", error);
      return res.status(500).json({ error: error.message });
    }

    // Remove password field from all users
    const safeUsers = users?.map(({ Password, ...userData }) => userData) || [];
    return res.status(200).json(safeUsers);

  } catch (error) {
    console.error("Database Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}