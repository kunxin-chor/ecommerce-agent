(function () {
  'use strict';

  const container = document.getElementById('admin-chat');
  if (!container) return;

  // Prefer the streaming UI; fall back to the base class if its
  // script was not loaded (e.g. an older branch's chat.ejs)
  const ChatbotClass = window.StreamingChatbotUI || window.AdminChatbotUI;

  try {
    window.adminChatbot = new ChatbotClass('#admin-chat');
  } catch (err) {
    console.error('Could not start admin chatbot', err);
  }
})();
