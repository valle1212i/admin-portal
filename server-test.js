// 🧪 Ladda miljövariabler
require("dotenv").config();
console.log("✅ STARTAR SERVER");

const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// 🌐 CORS-inställningar
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

app.use((req, res, next) => {
  console.log("🔍 Inkommande origin:", req.headers.origin);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// 📦 Routes
try {
  app.use("/api/chat", require("./routes/chat"));
  console.log("✅ Chat route laddad");
} catch (err) {
  console.error("❌ Fel i chat.js:", err);
}

try {
  app.use("/api/customers", require("./routes/customers"));
  console.log("✅ Customers route laddad");
} catch (err) {
  console.error("❌ Fel i customers.js:", err);
}

try {
  app.use("/api/server-status", require("./routes/serverStatus"));
  console.log("✅ Server-status route laddad");
} catch (err) {
  console.error("❌ Fel i serverStatus.js:", err);
}

try {
  app.use("/api/auth", require("./routes/auth"));
  console.log("✅ Auth route laddad");
} catch (err) {
  console.error("❌ Fel i auth.js:", err);
}

// 🧭 HTML-sidor
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-dashboard.html"));
});
app.get("/admin-chat.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-chat.html"));
});

// 🔌 Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("🟢 Admin ansluten via Socket.IO");

  socket.on("sendMessage", (msg) => {
    console.log("✉️ Meddelande mottaget i adminpanelen:", msg);
    io.emit("newMessage", msg);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Admin frånkopplad");
  });
});

// 🌍 MongoDB-anslutning
mongoose
  .connect(process.env.MONGO_URI, { dbName: "adminportal" })
  .then(() => console.log("✅ MongoDB (adminportal) ansluten"))
  .catch((err) => console.error("❌ Fel vid MongoDB-anslutning:", err));

// 🚀 Starta servern
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servern körs på http://localhost:${PORT}`);
});
