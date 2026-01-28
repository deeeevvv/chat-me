// public/login.js
document.getElementById("googleLogin").addEventListener("click", () => {
  window.location.href = "/auth/google";
});

document.getElementById("guestForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("guestName").value.trim();
  if (!name) return alert("Please enter a name.");
  const res = await fetch("/auth/guest", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (data.ok) window.location.href = "/chat.html";
});
