const express = require("express");
const router = express.Router();
const AdminSession = require("../models/AdminSession");

// Starta ny session
router.post("/start-session", async (req, res) => {
  if (!req.session.admin) return res.sendStatus(401);

  const session = await AdminSession.create({
    adminId: req.session.admin._id,
    startTime: new Date()
  });

  req.session.activeSessionId = session._id;
  res.json({ success: true });
});

// Avsluta session
router.post("/end-session", async (req, res) => {
  const sessionId = req.session.activeSessionId;
  if (!sessionId) return res.json({ success: false });

  const session = await AdminSession.findById(sessionId);
  if (!session || session.endTime) return res.json({ success: false });

  const end = new Date();
  const duration = Math.floor((end - session.startTime) / 1000);

  session.endTime = end;
  session.durationSeconds = duration;
  await session.save();

  req.session.activeSessionId = null;
  res.json({ success: true });
});

module.exports = router;
