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
    document.getElementById('dash-affidavit').hidden = !(me.canUploadAffidavit || me.affidavitAt);
    document.getElementById('dash-affidavit-steps').hidden = !me.canUploadAffidavit;
    document.getElementById('dash-affidavit-state').textContent = me.affidavitAt ? 'Uploaded ' + day(me.affidavitAt) + '. Seudocom will review it.' + (me.canUploadAffidavit ? ' You can replace it below if needed.' : '') : 'Seudocom needs your notarized affidavit before your interview.';
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
  }

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

  document.getElementById('dash-affidavit-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var problem = document.getElementById('dash-affidavit-error');
    var input = document.getElementById('dash-affidavit-file');
    problem.hidden = true;
    if (!input.files.length) {
      problem.textContent = 'Please choose your signed, notarized affidavit.';
      problem.hidden = false;
      input.focus();
      return;
    }
    var body = new FormData();
    body.append('affidavit', input.files[0]);
    fetch(API + 'affidavit', { method: 'POST', credentials: 'same-origin', headers: { 'X-Seudocom': '1' }, body: body })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); }); })
      .then(function () { input.value = ''; return load(); })
      .catch(function (err) {
        problem.textContent = err.message || 'The upload failed. Please try again.';
        problem.hidden = false;
        problem.focus();
      });
  });

  document.getElementById('dash-logout').addEventListener('click', function () {
    post('logout').then(load);
  });

  load();
})();
