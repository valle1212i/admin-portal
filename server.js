// 🌍 Miljövariabler
require("dotenv").config();
console.log("📦 MONGO_URI:", process.env.MONGO_URI);
console.log("📦 CUSTOMER_DB_URI:", process.env.CUSTOMER_DB_URI);

const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ✅ Tillåtna domäner (för både Express och Socket.io)
const allowedOrigins = [
  "http://localhost:3000", // lokal adminportal
  "http://localhost:5173", // lokal kundportal
  "https://customerportal-frontend.onrender.com",
  "https://admin-portal.onrender.com",
  "https://admin-portal-rn5z.onrender.com",
  "https://source-database.up.railway.app" // din Railway backend
];

// 🌐 Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// 🔌 Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("🔌 En klient ansluten:", socket.id);

  socket.on("sendMessage", (msg) => {
    console.log("📥 Meddelande mottaget:", msg);
    io.emit("newMessage", msg);
  });

  socket.on("disconnect", () => {
    console.log("🔌 En klient kopplade från:", socket.id);
  });
});

// 🌍 MongoDB-anslutning (Adminportalen)
mongoose
  .connect(process.env.MONGO_URI, {
    dbName: "adminportal"
  })
  .then(() => console.log("✅ MongoDB (adminportal) ansluten"))
  .catch((err) => console.error("❌ Fel vid MongoDB-anslutning:", err));

// 🧭 API-routes
console.log("🧪 Laddar ./routes/chat...");
app.use("/api/chat", require("./routes/chat"));
console.log("🧪 Laddar ./routes/customers...");
app.use("/api/customers", require("./routes/customers"));
console.log("🧪 Laddar ./routes/server-status...");
app.use("/api/server-status", require("./routes/serverStatus"));

// 📄 HTML-sidor
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-dashboard.html"));
});

app.get("/admin-chat.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-chat.html"));
});

// 🚀 Starta server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servern körs på http://localhost:${PORT}`);
});
