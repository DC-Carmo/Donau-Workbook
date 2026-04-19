(function () {
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function addMsg(role, text) {
    const msgs = document.getElementById("chatMsgs");
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    const safe = escapeHtml(text).replace(/\n/g, "<br>");

    div.innerHTML = `<div class="msg-label">${role === "user" ? "You" : "AI Coach"}</div><div class="msg-bubble">${safe}</div>`;

    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function showTyping() {
    const msgs = document.getElementById("chatMsgs");
    const div = document.createElement("div");
    div.className = "msg ai";
    div.id = "typing";
    div.innerHTML = '<div class="msg-label">AI Coach</div><div class="typing-indicator"><span></span><span></span><span></span></div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function removeTyping() {
    const typing = document.getElementById("typing");
    if (typing) {
      typing.remove();
    }
  }

  window.DonauShared = {
    addMsg,
    escapeHtml,
    removeTyping,
    showTyping,
  };
})();
