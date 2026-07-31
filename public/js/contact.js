(function () {
  const form = document.getElementById('contact-form');
  const notice = document.getElementById('notice');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      email: document.getElementById('email').value.trim(),
      message: document.getElementById('message').value.trim()
    };
    if (!payload.name || !payload.phone || !payload.email || !payload.message) {
      showNotice(notice, 'Please fill in your name, phone, email, and a message.', 'err');
      return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true; btn.textContent = 'Sending…';

    try {
      const res = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      showNotice(notice, "Thanks! We've got your message and will get back to you soon.", 'ok');
      form.reset();
    } catch (err) {
      showNotice(notice, err.message, 'err');
    } finally {
      btn.disabled = false; btn.textContent = 'Send Message';
    }
  });
})();
