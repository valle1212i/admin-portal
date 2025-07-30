const socket = io(window.location.origin, { withCredentials: true });

// 🔄 Hämta session och kund-ID från URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get("sessionId");
const customerId = urlParams.get("customerId");

if (!sessionId || !customerId) {
  alert("❌ Saknar sessionId eller customerId");
  throw new Error("Saknas nödvändiga parametrar");
}

const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

// ⏪ Ladda historik vid start
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(`/api/chat/session/${sessionId}`);
    const data = await res.json();
    data.forEach(msg => {
      if (msg.sender === "admin") renderOutgoingMessage(msg);
      else renderIncomingMessage(msg);
    });

    // 👇 Skicka systemmeddelande (endast första gången)
    notifyAdminOfNewSession();

  } catch (err) {
    console.error("❌ Kunde inte hämta historik:", err);
  }
});

// 🔔 Ny session (om kunden skickade från sin portal)
socket.on("activeSession", (session) => {
  if (session.sessionId === sessionId && session.customerId === customerId) {
    renderSystemMessage("🔔 Ny chatt startad");
  }
});

// 📨 Nya meddelanden i realtid
socket.on("newMessage", (msg) => {
  if (msg.sessionId !== sessionId) return;

  if (msg.sender === "admin") renderOutgoingMessage(msg);
  else renderIncomingMessage(msg);
});

// 🧾 Skicka meddelande från admin
sendBtn?.addEventListener("click", () => {
  const text = input.value.trim();
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
  renderOutgoingMessage(msg);
});

// 🔔 Systemmeddelande till logg + databas
function notifyAdminOfNewSession() {
  const msg = {
    customerId,
    sessionId,
    message: "🔔 Ny chatt startad",
    sender: "system",
    timestamp: new Date()
  };

  socket.emit("sendMessage", msg);

  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg)
  }).catch(console.error);
}

// 💬 Visa inkommande
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

// 💬 Visa admins meddelande
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

// 💬 Systemmeddelande (manuellt renderad)
function renderSystemMessage(text) {
  renderIncomingMessage({
    message: text,
    sender: "system",
    timestamp: new Date()
  });
}
