// public/chat.js
// client-side chat logic (TTS + Copy + Clean Readout + Proper Table Handling + Modal Logic)

// === Fetch user and show welcome + logo ===
async function getUser() {
  try {
    const res = await fetch("/api/user", { credentials: "same-origin" });
    const data = await res.json();

    if (!data.loggedIn) {
      window.location.href = "/index.html";
      return;
    }

    window.currentUser = data.user;

    const name = data.user.name || "Guest";
    const userType = data.user.type || "guest";

    const userDisplay = document.getElementById("welcome");
    const logo = document.createElement("img");
    logo.alt = "User logo";
    logo.style.cssText = "width:28px;height:28px;border-radius:50%;margin-right:8px;object-fit:cover;";

    logo.src = userType === "google" ? (data.user.photo || "/google.svg") : "/guest.svg";

    userDisplay.textContent = `Hi, ${name}`;
    userDisplay.prepend(logo);

    await loadHistory();
  } catch (err) {
    console.error("Failed to fetch user:", err);
    window.location.href = "/index.html";
  }
}

window.addEventListener("DOMContentLoaded", getUser);

// === Elements ===
const content = document.getElementById("content");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");
const clearChatBtn = document.getElementById("clearChat");
const toggleHistoryBtn = document.getElementById("toggleHistory");
const historySection = document.getElementById("history");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistory");
const logoutBtn = document.getElementById("logoutBtn");

// === Modal Elements (Added for Warning Popup) ===
const warningModal = document.getElementById('warningModal');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const confirmBtn = document.getElementById('confirmBtn');
const cancelBtn = document.getElementById('cancelBtn');

let isAnswerLoading = false;
let answerSectionId = 0;
let pendingAction = null; // To track if we are deleting chat or history

// === Event Listeners ===
sendButton?.addEventListener("click", handleSendMessage);
chatInput?.addEventListener("keypress", (e) => e.key === "Enter" && handleSendMessage());

// History Toggle
toggleHistoryBtn?.addEventListener("click", () => (historySection.hidden = !historySection.hidden));

// Logout
logoutBtn?.addEventListener("click", () => (window.location = "/logout"));


// === WARNING POPUP LOGIC ===

// 1. Open Modal Helper
function openWarning(action) {
  pendingAction = action;
  warningModal.classList.add('active');

  if (action === 'chat') {
    modalTitle.innerText = "Clear Chat?";
    modalDesc.innerText = "This will remove all current messages.";
  } else if (action === 'history') {
    modalTitle.innerText = "Clear History?";
    modalDesc.innerText = "This will permanently delete your saved history.";
  }
}

// 2. Close Modal Helper
function closeWarning() {
  warningModal.classList.remove('active');
  pendingAction = null;
}

// 3. Button Listeners (Trigger Modal instead of Action)
clearChatBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  openWarning('chat');
});

clearHistoryBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  openWarning('history');
});

// 4. Modal Action Listeners
confirmBtn?.addEventListener("click", () => {
  if (pendingAction === 'chat') {
    executeClearChat();
  } else if (pendingAction === 'history') {
    executeClearHistory();
  }
  closeWarning();
});

cancelBtn?.addEventListener("click", closeWarning);

// Close modal if clicking outside box
warningModal?.addEventListener("click", (e) => {
    if(e.target === warningModal) closeWarning();
});


// === Voice Recognition ===
const recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (recognition) {
  const speech = new recognition();
  speech.continuous = false;
  speech.interimResults = false;

  const mic = document.createElement("button");
  mic.textContent = "🎤";
  mic.style.cssText = `
    position: absolute;
    right: 75px;
    bottom: 22px;
    background: white;
    color: #4F6BFE;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    font-size: 1rem;
    cursor: pointer;
  `;
  document.querySelector(".chat-form")?.appendChild(mic);

  mic.addEventListener("click", () => {
    speech.start();
    mic.textContent = "🎙️";
  });

  speech.onresult = (e) => {
    chatInput.value = e.results[0][0].transcript;
    mic.textContent = "🎤";
    handleSendMessage();
  };

  speech.onend = () => (mic.textContent = "🎤");
}

// === TTS + Copy buttons SVG ===
let currentSpeech = null;
let isSpeaking = false;

const speakerSVG = `
<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
<path d="M3 9v6h4l5 5V4L7 9H3z" stroke="#4F6BFE" stroke-width="2" fill="none"/>
<path class="sound-wave" d="M14 10a2 2 0 010 4" stroke="#4F6BFE" stroke-width="2" fill="none"/>
<path class="sound-wave" d="M16 8a4 4 0 010 8" stroke="#4F6BFE" stroke-width="2" fill="none"/>
</svg>
`;

const speakerSVGActive = `
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="pulse">
<path d="M3 9v6h4l5 5V4L7 9H3z" stroke="#ffffff" stroke-width="2" fill="#4F6BFE"/>
<path class="sound-wave" d="M14 10a2 2 0 010 4" stroke="#ffffff" stroke-width="2" fill="none"/>
<path class="sound-wave" d="M16 8a4 4 0 010 8" stroke="#ffffff" stroke-width="2" fill="none"/>
</svg>
`;

const copySVG = `
<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
<rect x="9" y="9" width="12" height="12" rx="2" stroke="#4F6BFE" stroke-width="2"/>
<rect x="3" y="3" width="12" height="12" rx="2" stroke="#4F6BFE" stroke-width="2"/>
</svg>
`;

const copySVGSuccess = `
<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
<path d="M20 6L9 17l-5-5" stroke="#10B981" stroke-width="3" fill="none"/>
</svg>
`;

// --- Clean text for TTS (exclude tables) ---
function cleanTextForSpeech(raw) {
  return raw
    .replace(/<table[\s\S]*?<\/table>/gi, "") // remove tables
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u{1F600}-\u{1F6FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[`*_#>\[\]{}]/g, "")
    .replace(/[.;!?:"“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Utility buttons (TTS + Copy) ---
function addUtilityButtons(answerElement, originalText) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;gap:12px;margin-top:10px;align-items:center;";

  const speakBtn = document.createElement("button");
  speakBtn.innerHTML = speakerSVG;
  speakBtn.style.cssText = "background: rgba(79,107,254,0.12); border:none; padding:6px 10px; border-radius:10px; cursor:pointer; transition:0.2s;";

  const copyBtn = document.createElement("button");
  copyBtn.innerHTML = copySVG;
  copyBtn.style.cssText = "background: rgba(79,107,254,0.12); border:none; padding:6px 10px; border-radius:10px; cursor:pointer; transition:0.2s;";

  wrapper.appendChild(speakBtn);
  wrapper.appendChild(copyBtn);
  answerElement.appendChild(wrapper);

  // --- SPEAK ---
  speakBtn.addEventListener("click", () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      isSpeaking = false;
      speakBtn.innerHTML = speakerSVG;
      return;
    }
    const cleaned = cleanTextForSpeech(originalText);
    if (!cleaned) return;
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.rate = 0.85;
    currentSpeech = utter;
    isSpeaking = true;
    speakBtn.innerHTML = speakerSVGActive;

    utter.onend = () => {
      isSpeaking = false;
      speakBtn.innerHTML = speakerSVG;
    };

    window.speechSynthesis.speak(utter);
  });

  // --- COPY ---
  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(originalText);
    copyBtn.innerHTML = copySVGSuccess;
    copyBtn.style.background = "rgba(16,185,129,0.15)";
    setTimeout(() => {
      copyBtn.innerHTML = copySVG;
      copyBtn.style.background = "rgba(79,107,254,0.12)";
    }, 1200);
  });
}

// --- Chat flow ---
async function handleSendMessage() {
  const question = chatInput.value.trim();
  if (!question || isAnswerLoading) return;

  addQuestionSection(question);
  chatInput.value = "";

  try {
    isAnswerLoading = true;
    sendButton.classList.add("send-button-nonactive");

    const res = await fetch("/api/chat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    if (!res.ok) throw new Error("Server error");

    const data = await res.json();
    const result = data.result || "No response.";

    isAnswerLoading = false;
    const formatted = formatResponse(result);
    const element = addAnswerSection(formatted);

    addUtilityButtons(element, result);
    updateHistory(question);
  } catch (err) {
    console.error("Error:", err);
    isAnswerLoading = false;
    const element = addAnswerSection("Something went wrong. Check your connection.");
    addUtilityButtons(element, "Something went wrong");
  } finally {
    sendButton.classList.remove("send-button-nonactive");
    scrollToBottom();
  }
}

// --- Add Question/Answer Sections ---
function addQuestionSection(message) {
  isAnswerLoading = true;
  const section = document.createElement("section");
  section.className = "question-section";
  section.textContent = message;
  content.appendChild(section);

  addAnswerSection(message);
  scrollToBottom();
}

function addAnswerSection(message) {
  if (isAnswerLoading) {
    answerSectionId++;
    const section = document.createElement("section");
    section.className = "answer-section";
    section.innerHTML = getLoadingSvg();
    section.id = answerSectionId;
    content.appendChild(section);
    return section;
  } else {
    const section = document.getElementById(String(answerSectionId));
    if (section) {
      section.innerHTML = message;
      section.classList.add("fade-in");
    }
    return section;
  }
}

// --- Formatter (Markdown, tables, math, colors) ---
function formatResponse(text) {
  if (!text) return "";

  text = text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[-*_]{3,}$/gm, "")
    .replace(/\n{2,}/g, "\n");

  // Remove markdown text before table
  text = text.replace(/markdown''/gi, "");

  // Math
  text = text
    .replace(/\$\$([\s\S]+?)\$\$/g, '<div class="math-block">\\($1\\)</div>')
    .replace(/\$([^$]+)\$/g, '<span class="math-inline">\\($1\\)</span>')
    .replace(/\\\((.*?)\\\)/g, '<span class="math-inline">\\($1\\)</span>')
    .replace(/\\\[(.*?)\\\]/gs, '<div class="math-block">\\($1\\)</div>');

  // Bold, italics, inline code
  text = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  // Tables
  if (/\|.*\|/.test(text)) {
    text = text.replace(/((?:\|.*\|\n?)+)/g, (match) => {
      const rows = match.trim().split("\n");
      const filteredRows = rows.filter(row => !/^(\s*\|?\s*:?-+:?\s*\|)+\s*$/.test(row));
      const tableRows = filteredRows
        .map(row => {
          const cells = row.split("|").filter(c => c.trim() !== "");
          return `<tr>${cells.map(c => `<td>${c.trim()}</td>`).join("")}</tr>`;
        })
        .join("");
      return `<div class="table-wrapper"><table class="markdown-table">${tableRows}</table></div>`;
    });
  }

  // Line breaks
  text = text.replace(/(?<!<\/tr>)\n/g, "<br>");

  return `<div class="ai-reply fade-in">${text}</div>`;
}

// --- Styles ---
const style = document.createElement("style");
style.textContent = `
.pulse { animation: pulsing 0.8s infinite ease-in-out; }
@keyframes pulsing { 0%{transform:scale(1);opacity:1;}50%{transform:scale(1.2);opacity:0.7;}100%{transform:scale(1);opacity:1;} }

.fade-in { animation: fadeIn 0.5s ease-in-out; }
@keyframes fadeIn { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }

.ai-reply code { background: rgba(255,255,255,0.15); padding: 2px 5px; border-radius:4px; font-family: monospace; }
.ai-reply strong { color: #4F6BFE; font-weight:600; }
.ai-reply em { color: #4fc3d0ff; }
.math-inline { font-family: "Cambria Math","DejaVu Math TeX Gyre",serif; color: #d21010ff; }
.math-block { display:block; text-align:center; margin:8px 0; font-family: "Cambria Math","DejaVu Math TeX Gyre",serif; }

/* --- Table Wrappers --- */
.table-wrapper {
  width: 100%;
  max-height: 300px;
  margin: 10px 0;
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 6px;
  background: rgba(255,255,255,0.03);
  overflow-x: auto;
  overflow-y: auto;
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
  word-break: break-word;  /* force long words to wrap */
  white-space: normal;      /* allow wrapping inside cells */
}
.table-wrapper::-webkit-scrollbar { display: none; } /* Chrome, Safari, Opera */

.markdown-table {
  border-collapse: collapse;
  width: max-content;
  min-width: 100%;
  table-layout: auto;   /* let cells grow naturally but allow wrapping */
  word-wrap: break-word; /* older fallback */
}
.markdown-table td {
  border:1px solid rgba(255, 255, 255, 0.68);
  padding:6px 8px;
  max-width: 250px;       /* prevent single cells from stretching too far */
  word-break: break-word; /* wrap long strings */
  white-space: normal;    /* allow multiline content */
}
.markdown-table tr:nth-child(even) { background: rgba(255,255,255,0.05); }
`;
document.head.appendChild(style);
// --- Loading SVG & Scroll ---
function getLoadingSvg() {
  return `<svg style="height:25px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <circle fill="#4F6BFE" stroke="#4F6BFE" stroke-width="15" r="15" cx="40" cy="100">
      <animate attributeName="cy" values="100;80;100" dur="0.6s" repeatCount="indefinite" begin="0s"/>
    </circle>
    <circle fill="#4F6BFE" stroke="#4F6BFE" stroke-width="15" r="15" cx="100" cy="100">
      <animate attributeName="cy" values="100;80;100" dur="0.6s" repeatCount="indefinite" begin="0.2s"/>
    </circle>
    <circle fill="#4F6BFE" stroke="#4F6BFE" stroke-width="15" r="15" cx="160" cy="100">
      <animate attributeName="cy" values="100;80;100" dur="0.6s" repeatCount="indefinite" begin="0.4s"/>
    </circle>
  </svg>`;
}

function scrollToBottom() {
  content.scrollTo({ top: content.scrollHeight, behavior: "smooth" });
}

// === EXECUTING FUNCTIONS (Called ONLY by Modal) ===

function executeClearChat() {
  content.innerHTML = `<section class="answer-section"> Hi there! 🙋‍♂️ I’m Chat Me — your friendly AI assistant. Let’s get started with your thoughts! 😊 </section>`;
  isAnswerLoading = false;
  answerSectionId = 0;
}

// === History Management ===
async function loadHistory() {
  const user = window.currentUser;
  if (user && user.type === "google") {
    try {
      const res = await fetch("/api/history", { credentials: "same-origin" });
      if (!res.ok) throw new Error("No history");
      const data = await res.json();
      historyList.innerHTML = "";
      (data.history || []).forEach(item => createHistoryItem(item.question));
      return;
    } catch (err) { console.warn("Failed to load server history:", err); }
  }
  const saved = JSON.parse(localStorage.getItem("chatHistory") || "[]");
  historyList.innerHTML = "";
  saved.forEach(q => createHistoryItem(q));
}

function updateHistory(question) {
  if (window.currentUser && window.currentUser.type === "google") {
    loadHistory().catch(() => {});
    return;
  }
  const history = JSON.parse(localStorage.getItem("chatHistory") || "[]");
  if (!history.includes(question)) {
    history.push(question);
    localStorage.setItem("chatHistory", JSON.stringify(history));
    createHistoryItem(question);
  }
}

function createHistoryItem(question) {
  const li = document.createElement("li");
  li.textContent = question;
  li.addEventListener("click", () => {
    chatInput.value = question;
    chatInput.focus();
  });
  historyList.prepend(li);
}

// Renamed to 'execute' to show it's triggered by the modal
async function executeClearHistory() {
  const user = window.currentUser;
  if (user && user.type === "google") {
    try {
      const res = await fetch("/api/clear-history", { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) throw new Error("Server delete failed");
      historyList.innerHTML = "";
    } catch (err) { console.error("Failed to clear server history:", err); }
  } else {
    localStorage.removeItem("chatHistory");
    historyList.innerHTML = "";
  }
}