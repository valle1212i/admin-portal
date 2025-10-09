// server.js (adminportalen) - komplett version med Socket.IO, chatt-sessioner och meddelandehantering
const OutboundMessage = require('./models/OutboundMessage'); // importera modellen

require("dotenv").config();
console.log("✅ STARTAR SERVER");

const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const rateLimit = require('express-rate-limit');

const Admin = require("./models/Admin");
const Case = require("./models/Case");
const Message = require("./models/Message");
const Customer = require("./models/Customer");

const app = express();
const server = http.createServer(app);

console.log('ENV:', { NODE_ENV: process.env.NODE_ENV, PORT: process.env.PORT, MONGO_URI: !!process.env.MONGO_URI });

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://source-database.onrender.com",
  "https://admin-portal-rn5z.onrender.com"
];

// === Outbox Worker ===
async function processOutboxBatch(limit = 50) {
  // Hämta äldst & minst försökt först
  const items = await OutboundMessage
    .find({})
    .sort({ attempts: 1, createdAt: 1 })
    .limit(limit)
    .lean();

  for (const m of items) {
    try {
      const res = await fetch(m.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(m.headers || {}) },
        body: JSON.stringify(m.body)
      });

      if (res.ok) {
        await OutboundMessage.deleteOne({ _id: m._id });
      } else {
        await OutboundMessage.updateOne(
          { _id: m._id },
          { $inc: { attempts: 1 }, $set: { lastError: `HTTP ${res.status}` } }
        );
      }
    } catch (e) {
      await OutboundMessage.updateOne(
        { _id: m._id },
        { $inc: { attempts: 1 }, $set: { lastError: e?.message || String(e) } }
      );
    }
  }
}

let OUTBOX_TIMER = null;
function startOutboxWorker() {
  if (OUTBOX_TIMER) return; // idempotent
  const intervalMs = Number(process.env.OUTBOX_INTERVAL_MS || 30_000);
  console.log('🛫 Outbox-worker startar, intervall:', intervalMs, 'ms');

  OUTBOX_TIMER = setInterval(() => {
    processOutboxBatch().catch(err => console.error('Outbox fel:', err));
  }, intervalMs);

  // soft shutdown
  const stop = () => { if (OUTBOX_TIMER) clearInterval(OUTBOX_TIMER); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("⛔ Blockerad origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","X-Requested-With","X-Tenant","CSRF-Token","X-Signature","X-Idempotency-Key"],
  exposedHeaders: ["X-CSRF-Token"]
}));
app.options("*", cors());

// --- HMAC-ingest: läs rå JSON body för exakt denna path (måste ligga före express.json()) ---
const adminIngestAdsRouter = require('./routes/adminIngestAds');

// Rate limit för ingest (skydd mot brus)
const ingestLimiter = rateLimit({ windowMs: 60_000, max: 60 }); // 60 requests/min/IP

app.use(
  '/admin/api/ingest/ads',
  ingestLimiter, // <- viktig: limiter före raw parsern
  express.raw({ type: 'application/json', limit: '200kb' }), // ger req.body = Buffer
  adminIngestAdsRouter
);



app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Render/Proxy kräver trust proxy för att secure cookies ska fungera korrekt
app.set("trust proxy", 1);

app.use(session({
  secret: process.env.SESSION_SECRET || "admin_secret_key",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    dbName: "adminportal"
  }),
  cookie: {
    // 'none' + secure i prod (korsdomän), annars 'lax' lokalt
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure:    process.env.NODE_ENV === "production",
    httpOnly:  true,
    maxAge:    1000 * 60 * 60 * 2
  }
}));


// 🔄 Uppdatera lastSeen varje gång en admin gör en request
app.use(async (req, res, next) => {
  if (req.session?.admin) {
    try {
      await Admin.findByIdAndUpdate(req.session.admin._id, {
        lastSeen: new Date()
      });
    } catch (err) {
      console.error("⚠️ Kunde inte uppdatera lastSeen:", err);
    }
  }
  next();
});


app.use(express.static(path.join(__dirname, "public")));

const requireAdminLogin = require("./middleware/requireAdminLogin");

app.use("/api/chat", require("./routes/chat"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/server-status", require("./routes/serverStatus"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/cases", require("./routes/cases"));
app.use("/api/admin-status", require("./routes/adminStatus"));
app.use("/api/admins", require("./routes/admins"));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/admin', require('./routes/adminImpersonate'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/stripe', require('./routes/stripe'));
const { router: securityRouter, requireAdmin } = require('./routes/security');
app.use('/api/security', securityRouter);

// … efter session & static …
app.use('/api/email', require('./routes/emailRoutes'));

// ✅ MONTERA ADMIN-ROUTERNA + LOGGA
try {
  const adminAds = require('./routes/adminAds');
  app.use('/api/admin/ads', adminAds);
  console.log('✅ Mounted: /api/admin/ads');
} catch (e) { console.error('❌ Kunde inte montera /api/admin/ads:', e); }

try {
  const adminSupport = require('./routes/adminSupport');
  app.use('/api/admin/support', adminSupport);
  console.log('✅ Mounted: /api/admin/support');
} catch (e) { console.error('❌ Kunde inte montera /api/admin/support:', e); }

try {
  const adminStudioRadgivning = require('./routes/adminStudioRadgivning');
  app.use('/api/admin/studio-radgivning', adminStudioRadgivning);
  console.log('✅ Mounted: /api/admin/studio-radgivning');
} catch (e) { console.error('❌ Kunde inte montera /api/admin/studio-radgivning:', e); }

try {
  const adminIngest = require('./routes/adminIngest');
  app.use('/admin/api/ingest', adminIngest);
  console.log('✅ Mounted: /admin/api/ingest');
} catch (e) { console.error('❌ Kunde inte montera /admin/api/ingest:', e); }

// ✅ HEALTH måste ligga före 404-fallback
app.get("/_health/db", (_req, res) => {
  const conn = mongoose.connection;
  const map = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  res.json({
    ok: conn.readyState === 1,
    state: map[conn.readyState] || String(conn.readyState),
    name: conn.name,
    host: conn.host
  });
});





app.get("/api/admin/me", (req, res) => {
  if (!req.session?.admin) {
    return res.status(401).json({ success: false, message: "Inte inloggad" });
  }
  res.json({ success: true, admin: req.session.admin });
});

app.get("/", (req, res) => res.redirect("/login.html"));
app.get("/dashboard", requireAdminLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin-dashboard.html"))
);
app.get("/admin-chat.html", requireAdminLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "views", "admin-chat.html"))
);
app.get("/login.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.post("/admin-login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).send("❌ Fel e-post");
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).send("❌ Fel lösenord");

    req.session.admin = {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role || "admin"
    };

    res.redirect("/dashboard");
  } catch (err) {
    console.error("❌ Fel vid admin-login:", err);
    res.status(500).send("❌ Internt serverfel");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send("❌ Fel vid utloggning");
    res.redirect("/login.html");
  });
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("🟢 Admin ansluten via Socket.IO");

  socket.on("newSession", async (data) => {
    try {
      const { sessionId, customerId, topic, description } = data;

      if (!sessionId || !customerId || !topic || !description) {
        console.warn("⚠️ Ogiltig sessionsdata:", data);
        return;
      }

      let caseExists = await Case.findOne({ sessionId });
      if (!caseExists) {
        const newCase = new Case({
          caseId: `CASE-${Date.now().toString(36).toUpperCase()}`, // 🆕 Lägg till detta!
          sessionId,
          customerId,
          topic,
          description,
          messages: [],
          createdAt: new Date()
        });
        

        await newCase.save();
        console.log("🆕 Ny chatsession sparad:", sessionId);
      } else {
        console.log("ℹ️ Session redan finns:", sessionId);
      }

      io.emit("activeSession", {
        sessionId,
        customerId,
        topic,
        description,
        timestamp: new Date()
      });

    } catch (err) {
      console.error("❌ Fel vid mottagning av newSession:", err);
    }
  });

  socket.on("sendMessage", async (msg) => {
    console.log("✉️ Meddelande mottaget:", msg);

    try {
      const { sessionId, customerId, sender, message } = msg;
      if (!sessionId || !customerId || !sender || !message) {
        console.warn("⚠️ Ogiltigt meddelandeformat");
        return;
      }

      let caseDoc = await Case.findOne({ sessionId });

      if (!caseDoc) {
        caseDoc = new Case({
          customerId,
          sessionId,
          messages: []
        });
      }

      caseDoc.messages.push({
        sender,
        message,
        timestamp: new Date()
      });

      await caseDoc.save();

      io.emit("newMessage", msg);
    } catch (err) {
      console.error("❌ Fel vid sparning av meddelande:", err);
    }
  });
});

mongoose
  .connect(process.env.MONGO_URI, { dbName: "adminportal" })
  .then(() => {
    console.log("✅ MongoDB (adminportal) ansluten");
    if (process.env.PROCESS_OUTBOX === 'true') startOutboxWorker();
  })
  .catch((err) => console.error("❌ MongoDB-anslutning misslyckades:", err));


app.use((req, res) => {
  const fallbackPath = path.join(__dirname, "public", "404.html");
  res.status(404).sendFile(fallbackPath, (err) => {
    if (err) res.status(404).send("❌ Sidan kunde inte hittas.");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server körs på http://localhost:${PORT}`);
});
