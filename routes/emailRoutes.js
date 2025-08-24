// routes/emailRoutes.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const { convert } = require("html-to-text");
const Customer = require("../models/Customer");

/* =========================
   Admin-middleware (session)
   ========================= */
function requireAdmin(req, res, next) {
  const role = req.session?.user?.role;
  if (role !== "admin") {
    return res.status(403).json({ success: false, message: "Åtkomst nekad" });
  }
  next();
}

/* =========================
   Nodemailer (Brevo SMTP)
   ========================= */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // STARTTLS på 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 500,
});

/* =========================
   Hjälpare
   ========================= */
const FROM_ADDRESS = process.env.SMTP_FROM || process.env.SMTP_USER;
const REPLY_TO = process.env.SMTP_REPLY_TO || undefined;

// Skicka ett mail (wrap för konsekvent from/replyTo)
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
     limit?: number,          // t.ex. 300 (Brevo free-kvot)
     test?: boolean,          // true => skicka endast till testRecipients
     testRecipients?: string[],// manuella testmottagare
     dryRun?: boolean         // true => skickar inte, returnerar bara urvalet
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

    // 1) Hämta mottagare
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

    // Respektera valfri limit (t.ex. 300/dag)
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

    // 2) Förbered innehåll
    const textFallback = text || convert(html, { wordwrap: 120 });

    // 3) Skicka i BCC-batchar (mindre SMTP-overhead)
    const BATCH_SIZE = 50; // justera vid behov
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_SIZE);

      try {
        await transporter.sendMail({
          from: FROM_ADDRESS,
          // Skicka till en "to" (kan vara egen adress) och lägg kunder i BCC
          to: FROM_ADDRESS,
          bcc: chunk.join(","),
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
