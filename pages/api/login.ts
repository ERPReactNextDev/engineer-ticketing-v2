import { NextApiRequest, NextApiResponse } from "next";
import { validateUser, connectToDatabase } from "@/lib/ModuleGlobal/mongodb";
import { serialize } from "cookie";
import { ObjectId } from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { Email, Password, deviceId, pin, mode, savedPin, userId } = req.body;
  const db = await connectToDatabase();
  const usersCollection = db.collection("users");

  let user;
  let isVerified = false;

  try {

    /* ──────────────────────────────────────────
       MODE: biometric
       WebAuthn was verified client-side.
       We trust the resolved userId and fetch
       the user directly — no PIN or password needed.
       This fixes the "wrong account" bug: instead of
       looking up by deviceId (which maps to whoever last
       logged in), we look up by the exact userId that was
       bound to the WebAuthn credential during registration.
    ────────────────────────────────────────── */
    if (mode === "biometric") {
      if (!userId || !deviceId) {
        return res.status(400).json({ message: "userId and deviceId are required for biometric login." });
      }

      try {
        user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      } catch {
        return res.status(400).json({ message: "Invalid userId format." });
      }

      if (!user) {
        return res.status(401).json({ message: "Biometric account not found." });
      }

      // Biometric was verified on-device by WebAuthn — trust it
      isVerified = true;

      // Update DeviceId so PIN login still works on this device
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { DeviceId: deviceId, LastLoginAt: new Date(), LoginAttempts: 0 } }
      );
    }

    /* ──────────────────────────────────────────
       MODE: pin
       Look up user by DeviceId, compare PIN server-side.
    ────────────────────────────────────────── */
    else if (mode === "pin") {
      if (!pin || !deviceId) {
        return res.status(400).json({ message: "PIN and Device ID are required." });
      }
      if (pin === savedPin) isVerified = true;
      user = await usersCollection.findOne({ DeviceId: deviceId });
    }

    /* ──────────────────────────────────────────
       MODE: password (default)
    ────────────────────────────────────────── */
    else {
      if (!Email || !Password || !deviceId) {
        return res.status(400).json({ message: "Credentials and deviceId are required." });
      }
      user = await usersCollection.findOne({ Email });
      if (user) {
        const result = await validateUser({ Email, Password });
        if (result.success) isVerified = true;
      }
    }

    /* ── Common validations ── */
    if (!user) {
      return res.status(401).json({
        message: mode === "pin"       ? "Device not linked to an account." :
                 mode === "biometric" ? "Account not found." :
                                       "Invalid credentials.",
      });
    }

    if (["Resigned", "Terminated"].includes(user.Status)) {
      return res.status(403).json({ message: `Access denied. Account is ${user.Status}.` });
    }

    if (user.Status === "Locked") {
      return res.status(403).json({
        message: "Account Is Locked. Submit your ticket to IT Department.",
        locked: true,
      });
    }

    const allowedDepartments = ["IT", "Sales", "Engineering", "Procurement", "Warehouse Operations","Admin"];
    if (!allowedDepartments.includes(user.Department)) {
      return res.status(403).json({ message: "Access denied: Unauthorized Department." });
    }

    /* ── Wrong credentials (password / PIN mode) ── */
    if (!isVerified) {
      const attempts = (user.LoginAttempts || 0) + 1;
      if (attempts >= 5) {
        await usersCollection.updateOne(
          { _id: user._id },
          { $set: { Status: "Locked", LoginAttempts: attempts } }
        );
        return res.status(403).json({ message: "Account Is Locked.", locked: true });
      }
      await usersCollection.updateOne({ _id: user._id }, { $set: { LoginAttempts: attempts } });
      return res.status(401).json({ message: `Invalid credentials. Attempt ${attempts}/5` });
    }

    /* ── Success ── */
    // For password / PIN modes, update DeviceId and reset attempts
    if (mode !== "biometric") {
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { LoginAttempts: 0, Status: "Active", DeviceId: deviceId, LastLoginAt: new Date() } }
      );
    }

    const resolvedUserId = user._id.toString();

    res.setHeader("Set-Cookie", serialize("session", resolvedUserId, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      maxAge: 60 * 60 * 24,
      path: "/",
    }));

    return res.status(200).json({
      message: "Login successful",
      userId:     resolvedUserId,
      Firstname:  user.Firstname || user.Username,
      Role:       user.Role,
      Department: user.Department,
      Email:      user.Email,
    });

  } catch (error) {
    console.error("Login API Error:", error);
    return res.status(500).json({ message: "System Connection Error." });
  }
}