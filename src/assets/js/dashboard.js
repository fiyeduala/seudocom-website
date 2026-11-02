/* Applicant dashboard. Sign-in uses a server session; the access code is never stored in the browser. */
(function () {
  'use strict';

  var API = 'api/applicant.php?action=';
  var jobs = (window.SEUDOCOM_CAREERS || {}).jobs || [];
  var login = document.getElementById('dash-login');
  var panel = document.getElementById('dash-panel');
  var error = document.getElementById('dash-error');

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function day(iso) { return iso ? new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium' }) : ''; }

  function post(action, body) {
    return fetch(API + action, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Seudocom': '1' }, body: JSON.stringify(body || {}) });
  }

  function show(me) {
    login.hidden = true;
    panel.hidden = false;
    var job = jobs.filter(function (j) { return j.id === me.position; })[0];
    document.getElementById('dash-status-title').textContent = me.statusLabel;
    document.getElementById('dash-status-message').textContent = me.statusMessage;
    var steps = document.getElementById('dash-steps');
    steps.textContent = '';
    ['Assessment', 'Certificate', 'Interview', 'Affidavit', 'Decision'].forEach(function (name, i) {
      var passed = i + 1 < me.step && me.status !== 'unsuccessful';
      var item = el('li', passed ? 'is-done' : i + 1 === me.step ? 'is-current' : '', (i + 1) + '. ' + name);
      if (i + 1 === me.step) item.setAttribute('aria-current', 'step');
      steps.appendChild(item);
    });
    var facts = document.getElementById('dash-facts');
    facts.textContent = '';
    [['Name', me.name], ['Position', job ? job.title : 'General application'], ['Applied', day(me.appliedAt)], ['Assessment', me.assessmentAt ? 'Submitted ' + day(me.assessmentAt) : 'Not submitted']].forEach(function (f) {
      facts.appendChild(el('dt', '', f[0]));
      facts.appendChild(el('dd', '', f[1]));
    });
    var link = document.getElementById('dash-assessment');
    link.hidden = !(job && job.questions && me.canSubmitAssessment);
    if (job) {
      link.href = 'assessment.html?role=' + encodeURIComponent(job.id);
      link.textContent = me.assessmentAt ? 'Update My Assessment' : 'Open My Assessment';
    }
    showStages(me, job);
    document.getElementById('dash-affidavit').hidden = !(me.canUploadAffidavit || me.affidavitAt);
    document.getElementById('dash-affidavit-steps').hidden = !me.canUploadAffidavit;
    document.getElementById('dash-affidavit-state').textContent = me.affidavitAt ? 'Uploaded ' + day(me.affidavitAt) + '. Seudocom will review it.' + (me.canUploadAffidavit ? ' You can replace it below if needed.' : '') : 'Seudocom needs your notarized affidavit.';
    var list = document.getElementById('dash-updates');
    list.textContent = '';
    if (!me.updates.length) list.appendChild(el('p', '', 'No updates yet.'));
    me.updates.forEach(function (u) {
      var box = el('article', 'task');
      box.appendChild(el('h3', 'form__subject', u.subject));
      box.appendChild(el('p', 'admin-small', day(u.createdAt)));
      box.appendChild(el('p', 'admin-pre', u.body));
      list.appendChild(box);
    });
    showPush(me);
  }

  function showStages(me, job) {
    document.getElementById('dash-certificate').hidden = !me.canUploadCertificate;
    document.getElementById('dash-certificate-state').textContent = me.certificateAt ? 'Uploaded ' + day(me.certificateAt) + '. You can replace it below until Seudocom has reviewed it.' : 'Upload a customer support or customer relations certificate from any recognized provider.';
    if (me.canUploadCertificate) loadProviders(me.nationality);
    document.getElementById('dash-identity').hidden = !me.canUploadIdentity;
    document.getElementById('dash-identity-state').textContent = me.identityAt ? 'Uploaded ' + day(me.identityAt) + '. You can replace it below until Seudocom has reviewed it.' : 'Your recorded interview opens after Seudocom confirms your identity.';
    var questions = job && job.interviewQuestions;
    document.getElementById('dash-interview').hidden = !me.canSubmitInterview;
    document.getElementById('dash-interview-form').hidden = !questions;
    document.getElementById('dash-interview-state').textContent = !questions ? 'Seudocom will contact you about your interview.' : me.interviewAt ? 'Submitted ' + day(me.interviewAt) + '. You can resubmit below until Seudocom has reviewed it.' : 'Your identity has been confirmed. Answer each question below.';
    var box = document.getElementById('dash-interview-questions');
    if (me.canSubmitInterview && questions && !box.children.length) {
      questions.forEach(function (q, i) {
        var card = el('div', 'task');
        card.appendChild(el('p', '', (i + 1) + '. ' + q));
        var field = el('div', 'field');
        var label = el('label', '', 'Google Drive link');
        label.setAttribute('for', 'interview-' + (i + 1));
        var input = el('input');
        input.id = 'interview-' + (i + 1);
        input.name = 'interview' + (i + 1);
        input.type = 'url';
        input.required = true;
        input.placeholder = 'https://drive.google.com/...';
        field.appendChild(label);
        field.appendChild(input);
        card.appendChild(field);
        box.appendChild(card);
      });
    }
  }

  // Providers for the applicant's country come first; providers with no country apply to everyone.
  function loadProviders(nationality) {
    var box = document.getElementById('dash-certificate-partners');
    fetch('api/partners.php?kind=certificate').then(function (r) { return r.json(); }).then(function (d) {
      var mine = (nationality || '').toLowerCase();
      var fits = function (p) { return !!p.country && mine.indexOf(p.country.toLowerCase()) !== -1; };
      box.textContent = '';
      (d.partners || []).filter(function (p) { return !p.country || fits(p); }).sort(function (a, b) { return fits(b) - fits(a); }).forEach(function (p) {
        var card = el('article', 'task');
        card.appendChild(el('h4', '', p.name));
        if (p.details) card.appendChild(el('p', 'admin-pre', p.details));
        if (p.cost) card.appendChild(el('p', 'admin-small', 'Cost: ' + p.cost));
        if (p.disclosure) card.appendChild(el('p', 'admin-small', 'Relationship to Seudocom or its recruiters: ' + p.disclosure));
        var link = el('a', 'btn btn--black btn--sm', 'Visit ' + p.name);
        link.href = p.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        card.appendChild(link);
        box.appendChild(card);
      });
    }).catch(function () {});
  }

  /* Push notifications. Nothing is requested until the applicant presses the button. */
  var pushKey = null;
  var pushOn = false;
  var pushBox = document.getElementById('dash-push');
  var pushState = document.getElementById('dash-push-state');
  var pushToggle = document.getElementById('dash-push-toggle');
  var pushError = document.getElementById('dash-push-error');

  function currentSubscription() {
    return navigator.serviceWorker.getRegistration().then(function (reg) { return reg ? reg.pushManager.getSubscription() : null; });
  }

  function saveSubscription(sub) {
    var data = sub.toJSON();
    return post('push-subscribe', { endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); }); });
  }

  function keyBytes(text) {
    var raw = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  function paintPush() {
    pushToggle.hidden = false;
    pushToggle.textContent = pushOn ? 'Turn Off Notifications' : 'Turn On Notifications';
    pushState.textContent = pushOn
      ? 'Notifications are on for this device. Tap a notification to come back to this dashboard, then sign in with your access code.'
      : 'Please turn on notifications on this device. This is how Seudocom tells you when your application moves forward or a decision is made.';
  }

  function showPush(me) {
    pushKey = me.pushKey;
    if (me.status === 'successful' || me.status === 'unsuccessful') {
      pushBox.hidden = true;
      return;
    }
    var supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) {
      var appleDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
      pushBox.hidden = !appleDevice;
      pushState.textContent = 'On iPhone and iPad, add this page to your Home Screen, open it from there, and sign in to turn on notifications.';
      return;
    }
    if (!pushKey) { pushBox.hidden = true; return; }
    pushBox.hidden = false;
    currentSubscription().then(function (sub) {
      pushOn = !!sub && Notification.permission === 'granted';
      paintPush();
      if (pushOn) return saveSubscription(sub);
    }).catch(function () {});
  }

  function pushProblem(message) {
    pushError.textContent = message;
    pushError.hidden = false;
    pushError.focus();
  }

  function turnOnPush() {
    return Notification.requestPermission().then(function (permission) {
      if (permission !== 'granted') {
        pushProblem('Notifications are blocked. Allow them for this site in your browser settings, then try again.');
        return;
      }
      return navigator.serviceWorker.register('sw.js')
        .then(function () { return navigator.serviceWorker.ready; })
        .then(function (reg) { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(pushKey) }); })
        .then(saveSubscription)
        .then(function () { pushOn = true; paintPush(); });
    });
  }

  function turnOffPush() {
    return currentSubscription().then(function (sub) {
      if (!sub) return;
      var endpoint = sub.endpoint;
      return sub.unsubscribe().then(function () { return post('push-unsubscribe', { endpoint: endpoint }); });
    }).then(function () { pushOn = false; paintPush(); });
  }

  pushToggle.addEventListener('click', function () {
    pushError.hidden = true;
    pushToggle.disabled = true;
    (pushOn ? turnOffPush() : turnOnPush())
      .catch(function (err) { pushProblem(err.message || 'Notifications could not be changed on this device. Please try again.'); })
      .then(function () { pushToggle.disabled = false; });
  });

  function load() {
    return fetch(API + 'me', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (me) {
        if (me.authenticated) show(me);
        else { panel.hidden = true; login.hidden = false; }
      })
      .catch(function () {
        login.hidden = false;
        error.textContent = 'The dashboard could not reach the server. Please try again later.';
        error.hidden = false;
      });
  }

  document.getElementById('dash-form').addEventListener('submit', function (e) {
    e.preventDefault();
    error.hidden = true;
    var input = document.getElementById('dash-code');
    if (!input.value.trim()) {
      error.textContent = 'Please enter your access code.';
      error.hidden = false;
      input.focus();
      return;
    }
    post('login', { code: input.value })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); }); })
      .then(function () { input.value = ''; return load(); })
      .catch(function (err) {
        error.textContent = err.message || 'Something went wrong. Please try again.';
        error.hidden = false;
        error.focus();
      });
  });

  function bindUpload(stage, missing, check) {
    document.getElementById('dash-' + stage + '-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var form = e.target;
      var problem = document.getElementById('dash-' + stage + '-error');
      var input = document.getElementById('dash-' + stage + '-file');
      var complain = function (text) {
        problem.textContent = text;
        problem.hidden = false;
        problem.focus();
      };
      problem.hidden = true;
      var issue = check ? check() : '';
      if (issue) return complain(issue);
      if (!input.files.length) return complain(missing);
      fetch(API + stage, { method: 'POST', credentials: 'same-origin', headers: { 'X-Seudocom': '1' }, body: new FormData(form) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); }); })
        .then(function () { form.reset(); return load(); })
        .catch(function (err) { complain(err.message || 'The upload failed. Please try again.'); });
    });
  }

  bindUpload('certificate', 'Please choose your certificate.', function () {
    return document.getElementById('dash-certificate-issuer').value.trim() ? '' : 'Please enter who issued your certificate.';
  });
  bindUpload('identity', 'Please choose your identity document.', function () {
    return document.getElementById('dash-identity-consent').checked ? '' : 'Please confirm your consent to continue.';
  });
  bindUpload('affidavit', 'Please choose your signed, notarized affidavit.');

  document.getElementById('dash-interview-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var problem = document.getElementById('dash-interview-error');
    var body = { consent: document.getElementById('dash-interview-consent').checked ? 'yes' : '', linksShared: document.getElementById('dash-interview-shared').checked ? 'yes' : '' };
    var empty = false;
    Array.prototype.forEach.call(document.querySelectorAll('#dash-interview-questions input'), function (input) {
      if (!input.value.trim()) empty = true;
      body[input.name] = input.value;
    });
    problem.hidden = true;
    var complain = function (text) {
      problem.textContent = text;
      problem.hidden = false;
      problem.focus();
    };
    if (empty) return complain('Please paste a Google Drive link for every question.');
    if (!body.consent || !body.linksShared) return complain('Please complete both confirmations.');
    post('interview', body)
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); }); })
      .then(function () { document.getElementById('dash-interview-questions').textContent = ''; e.target.reset(); return load(); })
      .catch(function (err) { complain(err.message || 'Your interview could not be submitted. Please try again.'); });
  });

  document.getElementById('dash-logout').addEventListener('click', function () {
    // A shared device must stop receiving this applicant's notifications after sign-out.
    var stopPush = pushOn ? turnOffPush().catch(function () {}) : Promise.resolve();
    stopPush.then(function () { return post('logout'); }).then(load);
  });

  load();
})();
