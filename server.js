require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const serverStatusRoute = require("./routes/serverStatus");
const path = require("path");

const app = express();

// 🔧 Tillåt frontend-domäner (inkl. localhost)
const allowedOrigins = [
  "http://localhost:3000",
  "https://customerportal-frontend.onrender.com",
  "https://admin-portal-rn5z.onrender.com",
  "https://admin-portal.onrender.com"
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
}));

// 👉 Hantera preflight-förfrågningar
app.options("*", cors());

// 📦 Middleware
app.use(express.json());

// 📂 Servera statiska filer från public/
app.use(express.static(path.join(__dirname, "public")));

// 📡 HTTP-server + Socket.IO setup
const http = require("http").createServer(app);

const io = require("socket.io")(http, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 🧠 Socket.IO logik
io.on("connection", (socket) => {
  console.log("🟢 En användare anslöt");

  socket.on("sendMessage", (msg) => {
    console.log("✉️ Meddelande mottaget:", msg);
    io.emit("newMessage", msg); // Broadcast till alla klienter
  });

  socket.on("disconnect", () => {
    console.log("🔴 Användare frånkopplad");
  });
});

// 🔌 MongoDB-anslutning
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🟢 MongoDB anslutning lyckades"))
  .catch(err => console.error("🔴 MongoDB anslutning misslyckades:", err));

// 🌐 API-routes
const chatRoutes = require("./routes/chat");
app.use("/api/chat", chatRoutes);

const customerRoutes = require("./routes/customers");
app.use("/api/customers", customerRoutes);

app.use("/api/server-status", serverStatusRoute);

// 📄 HTML-vyer
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-dashboard.html"));
});

app.get("/admin-chat.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-chat.html"));
});

// 🚀 Starta servern
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Servern körs på http://localhost:${PORT}`));
