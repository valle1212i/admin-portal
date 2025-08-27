// routes/emailRoutes.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const { convert } = require("html-to-text");
const Customer = require("../models/Customer");
const Broadcast = require("../models/Broadcast");

// (valfritt) om du har en separat admin-kollektion
let AdminUser;
try {
  AdminUser = require("../models/AdminUser"); // finns i samlingen "adminusers"
} catch (_) {
  AdminUser = null;
}

/* =========================
   Admin-middleware (session)
   ========================= */
async function requireAdmin(req, res, next) {
  // Redan admin i sessionen?
  if (req.session?.user?.role === "admin") return next();

  // Försök uppgradera: om användaren är inloggad med e-post som finns i adminusers
  const email = req.session?.user?.email;
  if (email && AdminUser) {
    const admin = await AdminUser.findOne({ email }).lean();
    if (admin) {
      req.session.user.role = "admin";
      return next();
    }
  }
  return res.status(403).json({ success: false, message: "Åtkomst nekad" });
}

/* =========================
   Nodemailer (Brevo SMTP)
   ========================= */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,                         // t.ex. smtp-relay.brevo.com
  port: Number(process.env.SMTP_PORT || 587),          // 587 för STARTTLS
  secure: false,
  auth: {
    user: process.env.SMTP_USER,                       // din Brevo-inlogg
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 500,
});

/* =========================
   Hjälpare
   ========================= */
const FROM_ADDRESS = process.env.SMTP_FROM || process.env.SMTP_USER; // t.ex. "Source AB <info@yoursource.se>"
const REPLY_TO = process.env.SMTP_REPLY_TO || undefined;

async function sendOne({ to, subject, html, text }) {
  const textFallback = text || convert(html || "", { wordwrap: 120 });
  return transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
    text: textFallback,
    replyTo: REPLY_TO,
  });
}

/* =========================
   DEBUG: Se sessionen
   ========================= */
router.get("/debug-session", (req, res) => {
  res.json({ sessionUser: req.session?.user || null });
});

/* =========================
   1) SMTP verify
   ========================= */
router.get("/verify", requireAdmin, async (_req, res) => {
  try {
    await transporter.verify();
    res.json({ success: true, message: "SMTP OK" });
  } catch (err) {
    console.error("SMTP verify fail:", err);
    res
      .status(500)
      .json({ success: false, message: "SMTP misslyckades", error: err?.message });
  }
});

/* =========================
   2) Enskilt utskick
   POST /api/email/send
   body: { to, subject, html, text? }
   ========================= */
router.post("/send", requireAdmin, async (req, res) => {
  try {
    const { to, subject, html, text } = req.body || {};
    if (!to || !subject || !html) {
      return res
        .status(400)
        .json({ success: false, message: "to, subject och html krävs" });
    }
    await sendOne({ to, subject, html, text });
    res.json({ success: true, message: "Mejlet skickat" });
  } catch (err) {
    console.error("send error:", err);
    res
      .status(500)
      .json({ success: false, message: "Kunde inte skicka mejl", error: err?.message });
  }
});

/* =========================
   3) Massutskick
   POST /api/email/masssend
   body: {
     subject: string,
     html: string,
     text?: string,
     segment?: { plan?: string, industry?: string },
     limit?: number,
     test?: boolean,
     testRecipients?: string[],
     dryRun?: boolean
   }
   ========================= */
router.post("/masssend", requireAdmin, async (req, res) => {
  try {
    const {
      subject,
      html,
      text,
      segment = {},
      limit,
      test = false,
      testRecipients = [],
      dryRun = false,
    } = req.body || {};

    if (!subject || !html) {
      return res
        .status(400)
        .json({ success: false, message: "subject och html krävs" });
    }

    // 1) Mottagare
    let recipients = [];
    let users = [];

    if (test) {
      recipients = (testRecipients || []).filter(Boolean);
    } else {
      const query = {};
      if (segment.plan) query.plan = segment.plan;
      if (segment.industry) query.industry = segment.industry;

      users = await Customer.find(query, { email: 1, name: 1 }).lean();
      recipients = users.map((u) => u.email).filter(Boolean);
    }

    if (recipients.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Inga mottagare hittades" });
    }

    if (limit && recipients.length > limit) {
      recipients = recipients.slice(0, limit);
    }

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        count: recipients.length,
        sample: recipients.slice(0, 10),
      });
    }

    // 2) Innehåll
    const textFallback = text || convert(html, { wordwrap: 120 });

    // 3) Skicka i BCC-batchar
    const BATCH_SIZE = 50;
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_SIZE);
      try {
        await transporter.sendMail({
          from: FROM_ADDRESS,
          to: FROM_ADDRESS,               // primary to (kan vara din egen)
          bcc: chunk.join(","),           // kunder i BCC
          subject,
          html,
          text: textFallback,
          replyTo: REPLY_TO,
        });
        sent += chunk.length;
      } catch (err) {
        failed += chunk.length;
        errors.push({ bccCount: chunk.length, error: err?.message || String(err) });
      }
    }

    res.json({
      success: true,
      message: `Utskick klart: ${sent} skickat, ${failed} misslyckades`,
      sent,
      failed,
      errors,
    });
  } catch (err) {
    console.error("masssend error:", err);
    res.status(500).json({
      success: false,
      message: "Serverfel vid massutskick",
      error: err?.message,
    });
  }
});

module.exports = router;
