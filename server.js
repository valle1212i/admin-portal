// 🌍 Ladda miljövariabler tidigt
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

//✅ Tillåtna domäner (anpassa om du byter Render-URL)
const allowedOrigins = [
 "http://localhost:3000",
"http://localhost:5173",
 "https://source-database.onrender.com",     // Kundportal
  "https://admin-portal-rn5z.onrender.com"    // Adminportal
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

// Hantera preflight
app.options("*", cors());

// 🔍 Logga inkommande requests
app.use((req, res, next) => {
  console.log("🔍 Origin:", req.headers.origin || "ingen");
  next();
});

// 🧱 JSON/body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📁 Statiska filer (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// 🧭 API-routes
console.log("🧪 Laddar routes...");
try {
  app.use("/api/chat", require("./routes/chat"));
  console.log("✅ chat route OK");
} catch (err) {
  console.error("❌ chat.js error:", err);
}
console.log("Laddar chat.js");
app.use("/api/chat", require("./routes/chat"));

try {
  app.use("/api/customers", require("./routes/customers"));
  console.log("✅ customers route OK");
} catch (err) {
  console.error("❌ customers.js error:", err);
}
console.log("Laddar routes.js");
app.use("/api/chat", require("./routes/chat"));

try {
  app.use("/api/server-status", require("./routes/serverStatus"));
  console.log("✅ serverStatus route OK");
} catch (err) {
  console.error("❌ serverStatus.js error:", err);
}
console.log("Laddar serverStatus.js");
app.use("/api/chat", require("./routes/chat"));

try {
  app.use("/api/auth", require("./routes/auth"));
  console.log("✅ auth route OK");
} catch (err) {
  console.error("❌ auth.js error:", err);
}
console.log("Laddar auth.js");
app.use("/api/chat", require("./routes/chat"));


// 📄 SSR-routes (HTML)
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
    console.log("✉️ Meddelande mottaget:", msg);
    io.emit("newMessage", msg);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Admin frånkopplad");
  });
});

// 🛢 MongoDB-anslutning
mongoose
  .connect(process.env.MONGO_URI, { dbName: "adminportal" })
  .then(() => console.log("✅ MongoDB (adminportal) ansluten"))
  .catch((err) => console.error("❌ Fel vid MongoDB-anslutning:", err));

// 🚀 Starta server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servern körs på http://localhost:${PORT}`);
});
