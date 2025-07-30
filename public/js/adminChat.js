const socket = io(window.location.origin, { withCredentials: true });

// 🔽 Plocka session och kund-ID från URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get("sessionId");
const customerId = urlParams.get("customerId");

if (!sessionId || !customerId) {
  alert("❌ Saknar sessionId eller customerId i URL");
  throw new Error("sessionId eller customerId saknas");
}

// 🔽 Lyssna på inkommande meddelanden
socket.on("newMessage", (msg) => {
  if (msg.sessionId !== sessionId) return;
  renderMessage(msg);
});

// 🚀 Ladda historik
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(`/api/chat/session/${sessionId}`);
    if (!res.ok) throw new Error("Svar ej OK");
    const data = await res.json();

    if (!Array.isArray(data)) return;

    data.forEach(renderMessage);
  } catch (err) {
    console.error("❌ Kunde inte hämta historik:", err);
    const box = document.getElementById("chatMessages");
    if (box) {
      box.innerHTML = "<p style='color:red;'>❌ Fel vid hämtning av meddelanden.</p>";
    }
  }
});

// 📤 Skicka meddelande
document.getElementById("sendBtn")?.addEventListener("click", () => {
  const input = document.getElementById("adminMessageInput");
  if (!input) return;

  const message = input.value.trim();
  if (!message) return;

  const msg = {
    customerId,
    sessionId,
    message,
    sender: "admin",
    timestamp: new Date()
  };

  // Skicka via Socket.IO
  socket.emit("sendMessage", msg);

  // Spara till backend
  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(msg)
  }).catch(err => console.error("❌ Kunde inte spara meddelande:", err));

  input.value = "";
  renderMessage(msg);
});

// 🧱 Visa meddelande i chatten
function renderMessage(msg) {
  const container = document.getElementById("chatMessages");
  if (!container) return;

  const div = document.createElement("div");
  div.className = "message";

  const sender =
    msg.sender === "admin" ? "Du" :
    msg.sender === "system" ? "System" :
    "Kund";

  div.innerHTML = `
    <strong>${sender}:</strong>
    <span>${msg.message}</span><br/>
    <small>${new Date(msg.timestamp).toLocaleString("sv-SE")}</small>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
