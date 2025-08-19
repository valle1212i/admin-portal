// routes/emailRoutes.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const { convert } = require("html-to-text");
const Customer = require("../models/Customer");

// enkel admin-middleware: använder sessionsrollen
function requireAdmin(req, res, next) {
  const role = req.session?.user?.role;
  if (role !== "admin") {
    return res.status(403).json({ success: false, message: "Åtkomst nekad" });
  }
  next();
}

// Nodemailer-transport (Brevo SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,                // TLS via STARTTLS på port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,                   // återanvänd anslutningar
  maxConnections: 5,
  maxMessages: 100
});

// Hälsa/verify
router.get("/verify", requireAdmin, async (req, res) => {
  try {
    await transporter.verify();
    res.json({ success: true, message: "SMTP OK" });
  } catch (err) {
    console.error("SMTP verify fail:", err);
    res.status(500).json({ success: false, message: "SMTP misslyckades", error: err?.message });
  }
});

/**
 * POST /api/email/masssend
 * body: {
 *   subject: string,
 *   html: string,          // HTML-innehållet (valfritt: text genereras automatiskt)
 *   text?: string,         // om du vill skicka egen text fallback
 *   segment?: { plan?: string, industry?: string }, // enkel filtrering
 *   limit?: number,        // t.ex. 300 för att matcha gratiskvoten
 *   test?: boolean,        // om true → skickar bara till arrayen testRecipients
 *   testRecipients?: string[] // manuella testmottagare
 * }
 */
router.post("/masssend", requireAdmin, async (req, res) => {
  try {
    const {
      subject,
      html,
      text,
      segment = {},
      limit,
      test = false,
      testRecipients = []
    } = req.body || {};

    if (!subject || !html) {
      return res.status(400).json({ success: false, message: "subject och html krävs" });
    }

    // 1) Hämta mottagare
    let recipients = [];
    if (test) {
      // endast testutskick
      recipients = (testRecipients || []).filter(Boolean);
    } else {
      const query = {};
      if (segment.plan) query.plan = segment.plan;
      if (segment.industry) query.industry = segment.industry;

      // hämta bara e-postfältet (och name för ev. personalisering)
      const users = await Customer.find(query, { email: 1, name: 1 }).lean();
      recipients = users.map(u => u.email).filter(Boolean);
    }

    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: "Inga mottagare hittades" });
    }

    // respekt för valfri limit (t.ex. 300/dag på Brevo free)
    if (limit && recipients.length > limit) {
      recipients = recipients.slice(0, limit);
    }

    // 2) Förbered meddelande-data
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const replyTo = process.env.SMTP_REPLY_TO || undefined;
    const textFallback = text || convert(html, { wordwrap: 120 });

    // 3) Skicka i batchar (t.ex. 50 per batch)
    const BATCH_SIZE = 50;
    let sent = 0, failed = 0, errors = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_SIZE);

      // Skicka en och en i chunk (enkelt & robust); vill du ha snabbare: använd transporter.sendMail med 'bcc' = chunk.join(',')
      for (const to of chunk) {
        try {
          await transporter.sendMail({
            from,
            to,                   // vill du skicka med BCC i batch: använd bcc: chunk.join(',')
            subject,
            html,
            text: textFallback,
            replyTo
          });
          sent++;
        } catch (err) {
          failed++;
          errors.push({ to, error: err?.message || String(err) });
        }
      }
    }

    return res.json({
      success: true,
      message: `Utskick klart: ${sent} skickat, ${failed} misslyckades`,
      sent,
      failed,
      errors
    });
  } catch (err) {
    console.error("masssend error:", err);
    res.status(500).json({ success: false, message: "Serverfel vid massutskick", error: err?.message });
  }
});

module.exports = router;
