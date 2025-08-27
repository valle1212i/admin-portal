// routes/security.js
const express = require("express");
const router = express.Router();

const LoginEvent = require("../models/LoginEvent");
const AdminUser  = require("../models/AdminUser"); // ✅ kolla i adminusers-kollektionen

/** =========================
 *  Auth: kräver inloggning
 *  ========================= */
function requireAuth(req, res, next) {
  if (req.session?.user?._id) return next();
  return res.status(401).json({ success: false, message: "Inte inloggad" });
}

/** =========================
 *  Admin: uppgradera sessionen
 *  om user.email finns i adminusers
 *  ========================= */
async function requireAdmin(req, res, next) {
  // redan admin?
  if (req.session?.user?.role === "admin") return next();

  const email = req.session?.user?.email;
  if (!email) {
    return res.status(403).json({ success: false, message: "Åtkomst nekad" });
  }

  try {
    const adminDoc = await AdminUser.findOne({ email }).lean();
    if (adminDoc) {
      // uppgradera rollen i sessionen så resten av appen ser det
      req.session.user.role = "admin";
      return next();
    }
    return res.status(403).json({ success: false, message: "Åtkomst nekad" });
  } catch (err) {
    console.error("requireAdmin fel:", err);
    return res.status(500).json({ success: false, message: "Serverfel i security" });
  }
}

/** =========================
 *  Debug: se vad sessionen innehåller
 *  ========================= */
router.get("/whoami", (req, res) => {
  res.json({ user: req.session?.user || null });
});

/** =========================
 *  Senaste inloggningar (per användare)
 *  ========================= */
router.get("/logins", requireAuth, async (req, res) => {
  try {
    const logins = await LoginEvent.find({ userId: req.session.user._id })
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      success: true,
      logins: logins.map((e) => ({
        timestamp: new Date(e.timestamp).toLocaleString("sv-SE"),
        ip: e.ip,
        device: e.device,
      })),
    });
  } catch (err) {
    console.error("Fel vid hämtning av inloggningar:", err);
    res.status(500).json({ success: false, message: "Kunde inte hämta historik" });
  }
});

/** =========================
 *  Alla inloggningar (endast admin)
 *  ========================= */
router.get("/all-logins", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const events = await LoginEvent.find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .populate("userId", "name email");

    const formatted = events.map((e) => ({
      timestamp: new Date(e.timestamp).toLocaleString("sv-SE"),
      ip: e.ip,
      device: e.device,
      name: e.userId?.name || "Okänd",
      email: e.userId?.email || "okänd@domän.se",
    }));

    res.json({ success: true, logins: formatted });
  } catch (err) {
    console.error("Fel vid hämtning av all loggdata:", err);
    res.status(500).json({ success: false, message: "Misslyckades att hämta loggar" });
  }
});

module.exports = { router, requireAuth, requireAdmin };
