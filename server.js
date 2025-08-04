// server.js (adminportalen) - komplett version med Socket.IO, chatt-sessioner och meddelandehantering

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
const Message = require("./models/Message");
const Customer = require("./models/Customer");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://source-database.onrender.com",
  "https://admin-portal-rn5z.onrender.com"
];

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "admin_secret_key",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    dbName: "adminportal"
  }),
  cookie: {
    secure: false,
    sameSite: "Lax",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 2
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
  .then(() => console.log("✅ MongoDB (adminportal) ansluten"))
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
