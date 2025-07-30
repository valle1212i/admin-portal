const socket = io(window.location.origin, { withCredentials: true });

// 🔄 Ta ut sessionId och customerId från URL-parametrar
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get("sessionId");
const customerId = urlParams.get("customerId");

if (!sessionId || !customerId) {
  alert("❌ Kunde inte hitta sessionId eller customerId i URL");
  throw new Error("Saknar sessionId eller customerId");
}

// 🔽 Lyssna på nya meddelanden från kund eller system
socket.on("newMessage", (msg) => {
  if (msg.sessionId !== sessionId) return; // Visa bara relevanta meddelanden

  console.log("📥 Nytt meddelande:", msg);

  if (msg.sender === "customer" || msg.sender === "system") {
    renderIncomingMessage(msg);
  }

  if (msg.sender === "admin") {
    renderOutgoingMessage(msg);
  }
});

// 🚀 Ladda tidigare meddelanden
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(`/api/chat/session/${sessionId}`);
    const data = await res.json();

    if (!Array.isArray(data)) return;

    data.forEach(msg => {
      if (msg.sender === "admin") {
        renderOutgoingMessage(msg);
      } else {
        renderIncomingMessage(msg);
      }
    });
  } catch (err) {
    console.error("❌ Fel vid hämtning av historik:", err);
  }
});

// 📨 Skicka meddelande från admin
document.getElementById("sendBtn")?.addEventListener("click", () => {
  const input = document.getElementById("messageInput");
  const text = input?.value.trim();
  if (!text) return;

  const msg = {
    customerId,
    sessionId,
    message: text,
    sender: "admin",
    timestamp: new Date()
  };

  socket.emit("sendMessage", msg);

  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg)
  }).catch(console.error);

  input.value = "";
});

// 📤 Systemmeddelande vid ny session
function notifyAdminOfNewSession() {
  const systemMsg = {
    customerId,
    sessionId,
    message: "🔔 Ny chatt startad",
    sender: "system",
    timestamp: new Date()
  };

  socket.emit("sendMessage", systemMsg);

  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(systemMsg)
  }).catch(console.error);
}

// 🧱 Render: inkommande meddelande
function renderIncomingMessage(msg) {
  const container = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = "message incoming";

  div.innerHTML = `
    <strong>${msg.sender === "system" ? "System" : "Kund"}:</strong>
    <span>${msg.message}</span><br/>
    <small>${new Date(msg.timestamp).toLocaleString("sv-SE")}</small>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// 🧱 Render: admins meddelande
function renderOutgoingMessage(msg) {
  const container = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = "message outgoing";

  div.innerHTML = `
    <strong>Du:</strong>
    <span>${msg.message}</span><br/>
    <small>${new Date(msg.timestamp).toLocaleString("sv-SE")}</small>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
