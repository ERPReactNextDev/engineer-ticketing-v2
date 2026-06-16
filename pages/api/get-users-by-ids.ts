import { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseClient } from "@/lib/ModuleGlobal/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { userIds } = req.body;

  if (!userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ message: "Invalid userIds array" });
  }

  try {
    const supabase = getSupabaseClient();

    // Fetch users from Supabase
    const { data: users, error } = await supabase
      .from("users")
      .select("id, Firstname, Lastname, userName, profilePicture, Department")
      .in("id", userIds);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ message: "Database error" });
    }

    // Create a map of userId -> user data
    const userMap: Record<string, { firstName: string; lastName: string; userName: string; profilePicture?: string; department?: string }> = {};
    
    users?.forEach(user => {
      // Use the id field as string to match Firebase seenBy IDs
      const userId = user.id?.toString();
      if (userId) {
        userMap[userId] = {
          firstName: user.Firstname || "",
          lastName: user.Lastname || "",
          userName: user.userName || "",
          profilePicture: user.profilePicture || "",
          department: user.Department || ""
        };
      }
    });

    return res.status(200).json({ users: userMap });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
