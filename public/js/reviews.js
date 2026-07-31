(function () {
  const list = document.getElementById('reviews-list');

  fetch('/api/reviews').then(r => r.json()).then(reviews => {
    if (!reviews.length) {
      list.innerHTML = '<p style="color:var(--muted);">No reviews yet. Be the first to share yours below.</p>';
      return;
    }
    list.innerHTML = reviews.map(r => `
      <div class="review-card">
        <div class="review-top">
          <div class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        </div>
        <p class="review-body">"${escapeHtml(r.body)}"</p>
        <p class="review-meta" style="margin-top:12px;">${escapeHtml(r.name)} · ${escapeHtml(r.role)}</p>
      </div>
    `).join('');
  }).catch(() => {
    list.innerHTML = '<p style="color:var(--muted);">Reviews are temporarily unavailable.</p>';
  });

  const form = document.getElementById('review-form');
  const notice = document.getElementById('notice');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('name').value.trim(),
      role: document.getElementById('role').value,
      rating: document.getElementById('rating').value,
      body: document.getElementById('body').value.trim()
    };
    if (!payload.body) { showNotice(notice, 'Please write a review before submitting.', 'err'); return; }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true; btn.textContent = 'Submitting…';

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      showNotice(notice, 'Thanks! Your review is in queue for a quick moderation check, then it\'ll go live.', 'ok');
      form.reset();
    } catch (err) {
      showNotice(notice, err.message, 'err');
    } finally {
      btn.disabled = false; btn.textContent = 'Submit Review';
    }
  });
})();
