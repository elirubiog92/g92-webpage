(function () {
  // Shuffle the answer order for Driver Assessment multiple-choice questions (q1, q3-q8, q10, q15)
  // every time the page loads, so the "best" answer isn't always in the same position and
  // can't be gamed by always picking the first option. Eligibility Yes/No questions and the
  // day-of-week checkboxes are untouched (their names don't match /^q\d+$/).
  function shuffleAssessmentOptions() {
    const groups = {};
    document.querySelectorAll('input[type="radio"]').forEach(input => {
      if (!/^q\d+$/.test(input.name)) return;
      const option = input.closest('.choice-option');
      if (!option) return;
      if (!groups[input.name]) groups[input.name] = { parent: option.parentElement, items: [] };
      groups[input.name].items.push(option);
    });
    Object.values(groups).forEach(({ parent, items }) => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      items.forEach(item => parent.appendChild(item));
    });
  }
  shuffleAssessmentOptions();
})();

(function () {
  const form = document.getElementById('apply-form');
  const steps = [...document.querySelectorAll('.form-step')];
  const dots = [...document.querySelectorAll('.progress-steps span')];
  const notice = document.getElementById('notice');
  let current = 1;

  const ASSESSMENT_QUESTIONS = {
    q1: "You're scheduled to work tomorrow, but a friend invites you out tonight and you know it may affect your ability to work. What do you do?",
    q2: 'Tell us about a time you were late, missed work, or missed an important responsibility. What happened and what did you learn?',
    q3: "You make a mistake at work. What's your first reaction?",
    q4: "You accidentally deliver a package to the wrong location because you rushed and didn't double-check. What do you do?",
    q5: 'You have a difficult route. You still have many stops left, traffic is bad, and you feel behind. What do you do?',
    q6: 'You receive feedback about a driving habit that could become unsafe. How do you respond?',
    q8: 'Your trainer teaches you a different way to organize packages, but you already have your own method. What do you do?',
    q10: 'A customer leaves delivery instructions asking for something specific. What do you do?',
    q17: 'A customer is upset because their package arrived later than expected, and says something rude when you show up. What do you do?',
    q12: "Tell us about a day that didn't go as planned, a heavy route, bad weather, running behind, whatever it might be. What happened, and what helped you stay focused and get through it?",
    q15: 'Which statement describes you best?',
    q16: "What motivates you to do the right thing when nobody's watching, why is this position a good fit for you, and what are you hoping it leads to?"
  };

  // Show/hide "explain" boxes when the related Yes/No answer is Yes
  function wireConditional(radioName, wrapId) {
    const wrap = document.getElementById(wrapId);
    document.querySelectorAll(`input[name="${radioName}"]`).forEach(r => {
      r.addEventListener('change', () => {
        wrap.style.display = r.value === 'Yes' && r.checked ? 'block' : (r.checked ? 'none' : wrap.style.display);
      });
    });
  }
  wireConditional('deliveryExperience', 'deliveryExperienceExplainWrap');
  document.querySelectorAll('input[name="dspHistory"]').forEach(r => {
    r.addEventListener('change', () => {
      document.getElementById('dspHistoryWrap').style.display = r.value.startsWith('Yes') ? 'block' : 'none';
    });
  });
  wireConditional('felony7yr', 'felonyExplainWrap');

  // Driving record checklist: "None of the above" is mutually exclusive with the rest,
  // and any specific item checked reveals the explain box.
  const drivingRecordBoxes = [...document.querySelectorAll('input[name="drivingRecord"]')];
  const noneBox = document.getElementById('drivingRecordNone');
  const drivingRecordExplainWrap = document.getElementById('drivingRecordExplainWrap');
  drivingRecordBoxes.forEach(box => {
    box.addEventListener('change', () => {
      if (box === noneBox && box.checked) {
        drivingRecordBoxes.forEach(b => { if (b !== noneBox) b.checked = false; });
      } else if (box !== noneBox && box.checked) {
        noneBox.checked = false;
      }
      const anySpecificChecked = drivingRecordBoxes.some(b => b !== noneBox && b.checked);
      drivingRecordExplainWrap.style.display = anySpecificChecked ? 'block' : 'none';
    });
  });

  function goTo(step) {
    steps.forEach(s => s.classList.toggle('active', Number(s.dataset.step) === step));
    dots.forEach(d => d.classList.toggle('active', Number(d.dataset.step) <= step));
    current = step;
    if (step === 5) fillReview();
    window.scrollTo({ top: document.querySelector('.form-panel').offsetTop - 90, behavior: 'smooth' });
  }

  function validateStep(step) {
    const container = steps.find(s => Number(s.dataset.step) === step);

    const fields = container.querySelectorAll('input[required], textarea[required], select[required]');
    for (const f of fields) {
      if (f.type === 'radio') continue;
      if (f.id === 'ssnLast4' && !/^\d{4}$/.test(f.value.trim())) { f.focus(); return false; }
      if (!f.value.trim()) { f.focus(); return false; }
    }

    const radioGroups = new Set(
      [...container.querySelectorAll('input[type="radio"][required]')].map(r => r.name)
    );
    for (const name of radioGroups) {
      if (!container.querySelector(`input[name="${name}"]:checked`)) return false;
    }

    return true;
  }

  document.querySelectorAll('[data-next]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!validateStep(current)) {
        showNotice(notice, 'Please answer every question before continuing.', 'err');
        return;
      }
      notice.classList.remove('show');
      goTo(current + 1);
    });
  });

  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => goTo(current - 1));
  });

  function radioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  }

  function checkedValues(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(c => c.value);
  }

  function fillReview() {
    const val = id => document.getElementById(id).value.trim();
    document.getElementById('review-summary').textContent =
`NAME:  ${val('firstName')} ${val('middleName')} ${val('lastName')}
EMAIL: ${val('email')}   PHONE: ${val('phone')}
EMPLOYMENT DESIRED: ${radioValue('employmentDesired')}
VALID DRIVER'S LICENSE: ${radioValue('validLicense')}
ELIGIBLE TO WORK IN US: ${radioValue('eligibleUS')}   21+: ${radioValue('age21')}
CAN LIFT/PUSH/PULL 50 LBS: ${radioValue('canLift50')}
CURRENTLY/EVER WORKED FOR A DSP: ${radioValue('dspHistory')}
FELONY (LAST 7 YRS): ${radioValue('felony7yr')}
DRIVING RECORD (LAST 3 YRS): ${checkedValues('drivingRecord').join(', ') || 'None selected'}
BACKGROUND CHECK CONSENT: ${radioValue('bgCheckConsent')}
DAYS AVAILABLE: ${checkedValues('daysAvailable').join(', ') || 'None selected'}
DAYS PER WEEK: ${radioValue('daysPerWeek')}
FULL SHIFT COMMITMENT: ${radioValue('fullShiftCommit')}`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep(4)) { goTo(4); showNotice(notice, 'Please answer every Driver Assessment question before submitting.', 'err'); return; }

    const val = id => document.getElementById(id).value.trim();

    const answers = {};
    for (const [id, question] of Object.entries(ASSESSMENT_QUESTIONS)) {
      const radio = document.querySelector(`input[name="${id}"]`);
      answers[question] = radio ? radioValue(id) : val(id);
    }
    answers['Safety habits already practiced while driving'] = checkedValues('safetyHabits').join(', ') || 'None selected';

    const payload = {
      name: `${val('firstName')} ${val('middleName')} ${val('lastName')}`.replace(/\s+/g, ' ').trim(),
      email: val('email'),
      phone: val('phone'),
      employmentDesired: radioValue('employmentDesired'),
      hasLicense: radioValue('validLicense'),
      eligibility: {
        validLicense: radioValue('validLicense'),
        eligibleUS: radioValue('eligibleUS'),
        age21: radioValue('age21'),
        canLift50: radioValue('canLift50'),
        dspHistory: radioValue('dspHistory'),
        dspName: val('dspName'),
        dspPhone: val('dspPhone'),
        dspReason: val('dspReason'),
        deliveryExperience: radioValue('deliveryExperience'),
        deliveryExperienceExplain: val('deliveryExperienceExplain'),
        felony7yr: radioValue('felony7yr'),
        felonyExplain: val('felonyExplain'),
        drivingRecord: checkedValues('drivingRecord'),
        drivingRecordExplain: val('drivingRecordExplain'),
        bgCheckConsent: radioValue('bgCheckConsent')
      },
      availability: {
        daysAvailable: checkedValues('daysAvailable'),
        daysPerWeek: radioValue('daysPerWeek'),
        daysNotAvailable: val('daysNotAvailable'),
        fullShiftCommit: radioValue('fullShiftCommit')
      },
      answers
    };

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');

      document.querySelector('.form-panel').innerHTML = `
        <h3 style="color:var(--good);">Application received</h3>
        <p>Thanks, ${escapeHtml(val('firstName'))}. Our team reads every application. We'll reach out by phone or email if it looks like a fit.</p>
        <a href="index.html" class="btn btn-ghost" style="margin-top:12px;">Back to home</a>
      `;
    } catch (err) {
      showNotice(notice, err.message, 'err');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Application';
    }
  });
})();
