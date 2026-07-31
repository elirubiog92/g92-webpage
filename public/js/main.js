// Shared helpers
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function showNotice(el, message, type) {
  el.textContent = message;
  el.className = `notice show ${type}`;
}
