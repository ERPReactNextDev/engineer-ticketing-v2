import { NextApiRequest, NextApiResponse } from "next";
import {
  fetchAllDepartmentConfigs,
  fetchDepartmentConfig,
  saveDepartmentConfig,
  deleteDepartmentConfig,
} from "@/lib/ModuleGlobal/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { name } = req.query;

  if (method === "GET") {
    try {
      if (name && typeof name === "string") {
        // Fetch single department config
        const config = await fetchDepartmentConfig(name);
        if (!config) {
          return res.status(404).json({ error: "Department config not found" });
        }
        return res.status(200).json(config);
      } else {
        // Fetch all department configs
        const configs = await fetchAllDepartmentConfigs();
        return res.status(200).json(configs);
      }
    } catch (error) {
      console.error("GET department configs error:", error);
      return res.status(500).json({ error: "Failed to fetch department configs" });
    }
  }

  if (method === "POST") {
    try {
      const data = req.body;
      const departmentName = data.name;

      const success = await saveDepartmentConfig(departmentName, data);
      if (!success) {
        return res.status(500).json({ error: "Failed to save department config" });
      }

      return res.status(200).json({ message: "Department config saved successfully" });
    } catch (error) {
      console.error("POST department config error:", error);
      return res.status(500).json({ error: "Failed to save department config" });
    }
  }

  if (method === "DELETE") {
    try {
      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Department name is required" });
      }

      const success = await deleteDepartmentConfig(name);
      if (!success) {
        return res.status(500).json({ error: "Failed to delete department config" });
      }

      return res.status(200).json({ message: "Department config deleted successfully" });
    } catch (error) {
      console.error("DELETE department config error:", error);
      return res.status(500).json({ error: "Failed to delete department config" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
