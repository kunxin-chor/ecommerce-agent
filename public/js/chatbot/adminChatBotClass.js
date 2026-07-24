(function () {
  'use strict';

  const container = document.getElementById('admin-chat');
  if (!container) return;

  try {
    window.adminChatbot = new AdminChatbotUI('#admin-chat');
  } catch (err) {
    console.error('Could not start AdminChatbotUI', err);
  }
})();
