import { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseClient } from "@/lib/ModuleGlobal/supabase";

type UserRow = {
  id: string | number;
  UserId?: string | null;
  ReferenceID?: string | null;
  Firstname?: string | null;
  Lastname?: string | null;
  userName?: string | null;
  profilePicture?: string | null;
  Department?: string | null;
};

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
    const userMap: Record<string, { firstName: string; lastName: string; userName: string; profilePicture?: string; department?: string }> = {};

    const identifiers = Array.from(new Set(
      userIds
        .filter((id: unknown) => typeof id === "string" || typeof id === "number")
        .map((id: string | number) => String(id).trim())
        .filter(Boolean)
    ));
    if (identifiers.length === 0) return res.status(200).json({ users: userMap });

    const numericIds = identifiers.filter((id) => /^\d+$/.test(id));
    const stringIds = identifiers.filter((id) => !/^\d+$/.test(id));
    const selectedUsers = new Map<string, UserRow>();

    const addUsers = (rows: UserRow[] | null) => {
      rows?.forEach((user) => {
        const userData = {
          firstName: user.Firstname || "",
          lastName: user.Lastname || "",
          userName: user.userName || "",
          profilePicture: user.profilePicture || "",
          department: user.Department || "",
        };
        [user.id, user.UserId, user.ReferenceID].forEach((identifier) => {
          const key = identifier === null || identifier === undefined ? "" : String(identifier).trim();
          if (key) userMap[key] = userData;
        });
      });
    };

    if (numericIds.length > 0) {
      const { data, error } = await supabase
        .from("users")
        .select("id, UserId, ReferenceID, Firstname, Lastname, userName, profilePicture, Department")
        .in("id", numericIds);
      if (error) {
        console.error("Supabase numeric user ID lookup error:", error);
        return res.status(500).json({ message: "Database error" });
      }
      data?.forEach((user) => selectedUsers.set(String(user.id), user));
    }

    if (stringIds.length > 0) {
      const [legacyIdResult, referenceIdResult] = await Promise.all([
        supabase
          .from("users")
          .select("id, UserId, ReferenceID, Firstname, Lastname, userName, profilePicture, Department")
          .in("UserId", stringIds),
        supabase
          .from("users")
          .select("id, UserId, ReferenceID, Firstname, Lastname, userName, profilePicture, Department")
          .in("ReferenceID", stringIds),
      ]);

      const lookupError = legacyIdResult.error || referenceIdResult.error;
      if (lookupError) {
        console.error("Supabase string user ID lookup error:", lookupError);
        return res.status(500).json({ message: "Database error" });
      }

      legacyIdResult.data?.forEach((user) => selectedUsers.set(String(user.id), user));
      referenceIdResult.data?.forEach((user) => selectedUsers.set(String(user.id), user));
    }

    addUsers(Array.from(selectedUsers.values()));

    return res.status(200).json({ users: userMap });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
