// 🌍 Ladda miljövariabler tidigt
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

const Admin = require("./models/Admin");
const Case = require("./models/Case");

const app = express();
const server = http.createServer(app);

// ✅ Tillåtna domäner
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://source-database.onrender.com",
  "https://admin-portal-rn5z.onrender.com"
];

// 🌐 Middleware: CORS
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("⛔ Blockerad origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));
app.options("*", cors());

// 🧱 Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 💾 Sessions med MongoDB-lagring
app.use(session({
  secret: process.env.SESSION_SECRET || "admin_secret_key",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    dbName: "adminportal"
  }),
  cookie: {
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 2
  }
}));

// 📁 Statisk frontend
app.use(express.static(path.join(__dirname, "public")));

// 🔐 Middleware för att skydda adminsidor
const requireAdminLogin = require("./middleware/requireAdminLogin");

// 🧪 Ladda routes
try {
  app.use("/api/chat", require("./routes/chat"));
  app.use("/api/customers", require("./routes/customers"));
  app.use("/api/server-status", require("./routes/serverStatus"));
  app.use("/api/auth", require("./routes/auth"));
  console.log("✅ API-routes laddade");
} catch (err) {
  console.error("❌ Fel vid laddning av routes:", err);
}

// API: Vem är inloggad admin?
app.get("/api/admin/me", (req, res) => {
  if (!req.session?.admin) {
    return res.status(401).json({ success: false, message: "Inte inloggad" });
  }
  res.json({ success: true, admin: req.session.admin });
});

// 🌐 HTML-sidor (skyddade & publika)
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

// 🔐 Inloggning (POST)
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
    res.status(500).send("❌ Internt serverfel vid inloggning");
  }
});

// 🚪 Utloggning
app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send("❌ Fel vid utloggning");
    res.redirect("/login.html");
  });
});

// 🔌 Socket.IO + Chat Case-sparning
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("🟢 Admin ansluten via Socket.IO");

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
      console.error("❌ Fel vid sparning av chattmeddelande:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Admin frånkopplad");
  });
});

// 🛢️ MongoDB
mongoose
  .connect(process.env.MONGO_URI, { dbName: "adminportal" })
  .then(() => console.log("✅ MongoDB (adminportal) ansluten"))
  .catch((err) => console.error("❌ Fel vid MongoDB-anslutning:", err));

  app.use((req, res, next) => {
    const fallbackPath = path.join(__dirname, "public", "404.html");
    res.status(404).sendFile(fallbackPath, (err) => {
      if (err) {
        // Om 404.html saknas – visa enkel text
        res.status(404).send("❌ Sidan kunde inte hittas.");
      }
    });
  });
// 🚀 Starta server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servern körs på http://localhost:${PORT}`);
});
