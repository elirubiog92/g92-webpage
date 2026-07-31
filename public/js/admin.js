(function () {
  const loginView = document.getElementById('login-view');
  const dashView = document.getElementById('dashboard-view');
  const logoutLink = document.getElementById('logout-link');

  async function checkSession() {
    const res = await fetch('/api/admin/session');
    const data = await res.json();
    if (data.isAdmin) {
      loginView.style.display = 'none';
      dashView.style.display = 'block';
      logoutLink.style.display = 'inline';
      loadApplications();
      loadReviews();
      loadFirstDay();
      loadMessages();
    } else {
      loginView.style.display = 'block';
      dashView.style.display = 'none';
      logoutLink.style.display = 'none';
    }
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const notice = document.getElementById('login-notice');
    const password = document.getElementById('password').value;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');
      checkSession();
    } catch (err) {
      showNotice(notice, err.message, 'err');
    }
  });

  logoutLink.addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/admin/logout', { method: 'POST' });
    checkSession();
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`panel-${btn.dataset.panel}`).classList.add('active');
    });
  });

  // ---------------- Applications ----------------
  async function loadApplications() {
    const list = document.getElementById('applications-list');
    const apps = await fetch('/api/admin/applications').then(r => r.json());
    if (!apps.length) { list.innerHTML = '<p style="color:var(--muted);">No applications yet.</p>'; return; }

    list.innerHTML = apps.map(a => {
      const score = a.aiScore;
      const hasScore = score && !score.error;
      const flagLabel = { strong: 'Strong', worth_a_look: 'Worth a look', needs_more_info: 'Needs more info' };
      const recLabel = { move_to_interview: 'Move to interview', maybe: 'Maybe', do_not_move_forward: 'Do not move forward' };
      const avail = a.availability || {};
      const el = a.eligibility || {};

      const concerns = [];
      if (el.validLicense === 'No') concerns.push('No valid license');
      if (el.eligibleUS === 'No') concerns.push('Not eligible to work in the U.S.');
      if (el.age21 === 'No') concerns.push('Under 21');
      if (el.canLift50 === 'No') concerns.push("Can't lift/push/pull 50 lbs");
      if (el.bgCheckConsent === 'No') concerns.push("Didn't consent to background check");
      if (el.felony7yr === 'Yes') concerns.push('Felony in last 7 years, review explanation');
      if ((el.drivingRecord || []).some(v => v !== 'None of the above')) concerns.push('Driving record flag, review explanation');

      return `
      <div class="app-row" data-id="${a.id}">
        <div class="app-row-top">
          <div>
            <h4 style="margin:0 0 4px; font-family:'Sora'; font-size:1.05rem;">${escapeHtml(a.name)}</h4>
            <p class="mono" style="margin:0; font-size:0.78rem; color:var(--muted);">${escapeHtml(a.email)} · ${escapeHtml(a.phone)}</p>
            <p class="mono" style="margin:4px 0 0; font-size:0.72rem; color:var(--muted);">Submitted ${new Date(a.submittedAt).toLocaleString()}</p>
          </div>
          <div style="text-align:right;">
            ${concerns.length ? `<span class="flag ineligible" title="${escapeHtml(concerns.join(' · '))}">${concerns.length} eligibility flag${concerns.length > 1 ? 's' : ''}</span><br style="line-height:2;">` : ''}
            ${hasScore ? `<span class="flag ${score.overall_flag}">${flagLabel[score.overall_flag] || score.overall_flag}</span>` : `<span class="flag needs_more_info">${score ? 'Scoring failed' : 'Scoring…'}</span>`}
            <div style="margin-top:10px; display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
              <select class="status-select" data-id="${a.id}">
                ${['new','reviewed','contacted','hired','archived'].map(s => `<option value="${s}" ${a.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <select class="status-select recommendation-select" data-id="${a.id}">
                <option value="">No recommendation yet</option>
                ${['move_to_interview','maybe','do_not_move_forward'].map(r => `<option value="${r}" ${a.recommendation === r ? 'selected' : ''}>${recLabel[r]}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        ${hasScore ? `
        <div class="score-bars">
          <span class="score-bar">RELIABILITY ${score.reliability}/5</span>
          <span class="score-bar">ACCOUNTABILITY ${score.accountability}/5</span>
          <span class="score-bar">SAFETY ${score.safety_mindset}/5</span>
          <span class="score-bar">COACHABILITY ${score.coachability}/5</span>
          <span class="score-bar">CUSTOMER EXP. ${score.customer_experience}/5</span>
          <span class="score-bar">COMMUNICATION ${score.communication}/5</span>
        </div>
        <p style="font-size:0.88rem; margin:6px 0;">${escapeHtml(score.summary || '')}</p>
        ${score.notable_quote ? `<p style="font-size:0.85rem; font-style:italic; color:var(--muted); margin:4px 0;">"${escapeHtml(score.notable_quote)}"</p>` : ''}
        ` : score?.error ? `<p style="font-size:0.85rem; color:var(--bad);">${escapeHtml(score.error)}</p>` : ''}

        <div style="margin-top:10px; display:flex; gap:10px;">
          <button class="btn btn-ghost btn-small toggle-qa" data-id="${a.id}">View full answers</button>
          ${score?.error ? `<button class="btn btn-ghost btn-small rescore" data-id="${a.id}">Retry AI scoring</button>` : ''}
        </div>

        <div class="qa-list" id="qa-${a.id}">
          <div class="qa-item"><b>Employment desired</b><p>${escapeHtml(a.employmentDesired || 'N/A')}</p></div>
          <div class="qa-item"><b>Valid driver's license</b><p>${escapeHtml(el.validLicense || 'N/A')}</p></div>
          <div class="qa-item"><b>Eligible to work in U.S. / 21+ / can lift 50 lbs</b><p>${escapeHtml(el.eligibleUS || 'N/A')} / ${escapeHtml(el.age21 || 'N/A')} / ${escapeHtml(el.canLift50 || 'N/A')}</p></div>
          <div class="qa-item"><b>DSP history</b><p>${escapeHtml(el.dspHistory || 'N/A')}</p></div>
          ${(el.dspHistory || '').startsWith('Yes') ? `
          <div class="qa-item"><b>Previous/current DSP</b><p>${escapeHtml(el.dspName || 'N/A')}</p></div>
          <div class="qa-item"><b>DSP phone number</b><p>${escapeHtml(el.dspPhone || 'N/A')}</p></div>
          <div class="qa-item"><b>Reason for departure</b><p>${escapeHtml(el.dspReason || 'N/A')}</p></div>
          ` : ''}
          <div class="qa-item"><b>Delivery experience</b><p>${escapeHtml(el.deliveryExperience || 'N/A')}${el.deliveryExperienceExplain ? ': ' + escapeHtml(el.deliveryExperienceExplain) : ''}</p></div>
          <div class="qa-item"><b>Felony in last 7 years</b><p>${escapeHtml(el.felony7yr || 'N/A')}${el.felonyExplain ? ': ' + escapeHtml(el.felonyExplain) : ''}</p></div>
          <div class="qa-item"><b>Driving record (last 3 years)</b><p>${escapeHtml((el.drivingRecord || []).join(', ') || 'N/A')}${el.drivingRecordExplain ? ': ' + escapeHtml(el.drivingRecordExplain) : ''}</p></div>
          <div class="qa-item"><b>Background check consent</b><p>${escapeHtml(el.bgCheckConsent || 'N/A')}</p></div>
          <div class="qa-item"><b>Days available</b><p>${escapeHtml((avail.daysAvailable || []).join(', ') || 'N/A')}</p></div>
          <div class="qa-item"><b>Days per week wanted</b><p>${escapeHtml(avail.daysPerWeek || 'N/A')}</p></div>
          <div class="qa-item"><b>Days NOT available</b><p>${escapeHtml(avail.daysNotAvailable || 'N/A')}</p></div>
          <div class="qa-item"><b>Full shift commitment</b><p>${escapeHtml(avail.fullShiftCommit || 'N/A')}</p></div>
          ${Object.entries(a.answers).map(([q, ans]) => `<div class="qa-item"><b>${escapeHtml(q)}</b><p>${escapeHtml(ans)}</p></div>`).join('')}
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.toggle-qa').forEach(btn => {
      btn.addEventListener('click', () => {
        const el = document.getElementById(`qa-${btn.dataset.id}`);
        el.classList.toggle('open');
        btn.textContent = el.classList.contains('open') ? 'Hide full answers' : 'View full answers';
      });
    });

    list.querySelectorAll('.status-select:not(.recommendation-select)').forEach(sel => {
      sel.addEventListener('change', async () => {
        await fetch(`/api/admin/applications/${sel.dataset.id}/status`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: sel.value })
        });
      });
    });

    list.querySelectorAll('.recommendation-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        await fetch(`/api/admin/applications/${sel.dataset.id}/recommendation`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recommendation: sel.value })
        });
      });
    });

    list.querySelectorAll('.rescore').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = 'Scoring…';
        await fetch(`/api/admin/applications/${btn.dataset.id}/rescore`, { method: 'POST' });
        loadApplications();
      });
    });
  }

  // ---------------- Reviews moderation ----------------
  async function loadReviews() {
    const list = document.getElementById('reviews-list');
    const reviews = await fetch('/api/admin/reviews').then(r => r.json());
    if (!reviews.length) { list.innerHTML = '<p style="color:var(--muted);">No reviews submitted yet.</p>'; return; }

    list.innerHTML = reviews.map(r => `
      <div class="app-row" data-id="${r.id}">
        <div class="app-row-top">
          <div>
            <div class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
            <p class="mono" style="font-size:0.78rem; color:var(--muted); margin:4px 0 0;">${escapeHtml(r.name)} · ${escapeHtml(r.role)} · ${new Date(r.submittedAt).toLocaleDateString()}</p>
          </div>
          <span class="flag ${r.status === 'approved' ? 'strong' : r.status === 'rejected' ? '' : 'worth_a_look'}" style="${r.status === 'rejected' ? 'background:rgba(225,88,74,0.15); color:var(--bad);' : ''}">${r.status}</span>
        </div>
        <p style="margin:10px 0;">${escapeHtml(r.body)}</p>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-primary btn-small approve" data-id="${r.id}" ${r.status === 'approved' ? 'disabled' : ''}>Approve</button>
          <button class="btn btn-danger btn-small reject" data-id="${r.id}" ${r.status === 'rejected' ? 'disabled' : ''}>Reject</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.approve').forEach(btn => btn.addEventListener('click', () => setReviewStatus(btn.dataset.id, 'approved')));
    list.querySelectorAll('.reject').forEach(btn => btn.addEventListener('click', () => setReviewStatus(btn.dataset.id, 'rejected')));
  }

  async function setReviewStatus(id, status) {
    await fetch(`/api/admin/reviews/${id}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
    });
    loadReviews();
  }

  // ---------------- First-day feedback ----------------
  async function loadFirstDay() {
    const list = document.getElementById('firstday-list');
    const entries = await fetch('/api/admin/first-day').then(r => r.json());
    if (!entries.length) { list.innerHTML = '<p style="color:var(--muted);">No first-day feedback yet.</p>'; return; }

    list.innerHTML = entries.map(f => `
      <div class="app-row">
        <div class="app-row-top">
          <div>
            <h4 style="margin:0 0 4px; font-family:'Oswald'; font-size:1rem;">${escapeHtml(f.submittedBy)}, ${escapeHtml(f.role)}</h4>
            ${f.trainerName ? `<p class="mono" style="font-size:0.78rem; color:var(--muted); margin:0;">Trainer: ${escapeHtml(f.trainerName)}</p>` : ''}
            <p class="mono" style="font-size:0.72rem; color:var(--muted); margin:4px 0 0;">${new Date(f.submittedAt).toLocaleString()}</p>
          </div>
          ${f.rating ? `<div class="stars">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</div>` : ''}
        </div>
        ${f.whatWentWell ? `<div class="qa-item" style="margin-top:10px;"><b>What went well</b><p>${escapeHtml(f.whatWentWell)}</p></div>` : ''}
        ${f.whatNeedsWork ? `<div class="qa-item"><b>What needs work</b><p>${escapeHtml(f.whatNeedsWork)}</p></div>` : ''}
        <p class="mono" style="font-size:0.78rem; color:${f.wouldRecommend ? 'var(--good)' : 'var(--muted)'};">${f.wouldRecommend ? '✓ Would recommend G92' : 'Did not say they\'d recommend'}</p>
      </div>
    `).join('');
  }

  // ---------------- Contact messages ----------------
  async function loadMessages() {
    const list = document.getElementById('messages-list');
    const messages = await fetch('/api/admin/messages').then(r => r.json());
    if (!messages.length) { list.innerHTML = '<p style="color:var(--muted);">No messages yet.</p>'; return; }

    const statusLabel = { new: 'New', read: 'Read', replied: 'Replied' };

    list.innerHTML = messages.map(m => `
      <div class="app-row" data-id="${m.id}">
        <div class="app-row-top">
          <div>
            <h4 style="margin:0 0 4px; font-family:'Sora'; font-size:1rem;">${escapeHtml(m.name)}</h4>
            <p class="mono" style="margin:0; font-size:0.78rem; color:var(--muted);">${escapeHtml(m.phone || '')}${m.phone && m.email ? ' · ' : ''}${escapeHtml(m.email || '')}</p>
            <p class="mono" style="margin:4px 0 0; font-size:0.72rem; color:var(--muted);">${new Date(m.submittedAt).toLocaleString()}</p>
          </div>
          <select class="status-select message-status-select" data-id="${m.id}">
            ${['new','read','replied'].map(s => `<option value="${s}" ${m.status === s ? 'selected' : ''}>${statusLabel[s]}</option>`).join('')}
          </select>
        </div>
        <p style="margin-top:10px;">${escapeHtml(m.message)}</p>
      </div>
    `).join('');

    list.querySelectorAll('.message-status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        await fetch(`/api/admin/messages/${sel.dataset.id}/status`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: sel.value })
        });
      });
    });
  }

  checkSession();
})();
