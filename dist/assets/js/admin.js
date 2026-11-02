/* Admin console. All applicant content is inserted as text, never as HTML. */
(function () {
  'use strict';

  var API = 'api/admin.php?action=';
  var jobs = (window.SEUDOCOM_CAREERS || {}).jobs || [];
  var statuses = {};
  var nextStatus = {};
  var selected = {};
  var partnerId = 0;
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function day(iso) { return iso ? new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium' }) : ''; }
  function jobOf(id) { return jobs.filter(function (j) { return j.id === id; })[0]; }
  function title(id) { var j = jobOf(id); return j ? j.title : 'General application'; }

  function showError(message) {
    $('admin-error').textContent = message;
    $('admin-error').hidden = !message;
    if (message) $('admin-error').focus();
  }

  function handle(r) {
    return r.json().then(function (d) {
      if (r.status === 401) { boot(); throw new Error('Please sign in again.'); }
      if (!r.ok) throw new Error(d.error || 'Something went wrong.');
      return d;
    });
  }

  function get(action, params) {
    return fetch(API + action + (params ? '&' + new URLSearchParams(params) : ''), { credentials: 'same-origin' }).then(handle);
  }

  function post(action, body) {
    return fetch(API + action, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Seudocom': '1' }, body: JSON.stringify(body || {}) }).then(handle);
  }

  function failure(err) { showError(err.message); }

  function option(value, label) {
    var o = el('option', '', label);
    o.value = value;
    return o;
  }

  function filters() {
    return { q: $('f-q').value.trim(), status: $('f-status').value, position: $('f-position').value };
  }

  function refresh() {
    return get('list', filters()).then(function (d) {
      var rows = $('admin-rows');
      rows.textContent = '';
      var visible = {};
      d.applicants.forEach(function (a) {
        var tr = el('tr');
        visible[a.id] = true;
        var pick = el('td');
        var box = el('input');
        box.type = 'checkbox';
        box.className = 'bulk-pick';
        box.checked = !!selected[a.id];
        box.setAttribute('aria-label', 'Select ' + a.name);
        box.addEventListener('change', function () {
          if (box.checked) selected[a.id] = true; else delete selected[a.id];
          paintBulk();
        });
        pick.appendChild(box);
        tr.appendChild(pick);
        [a.name, a.email, title(a.position), statuses[a.status] || a.status, day(a.createdAt), a.assessmentAt ? 'Submitted' : 'None', a.certificateAt ? 'Uploaded' : 'None', a.interviewAt ? 'Submitted' : 'None', a.affidavitAt ? 'Uploaded' : 'None'].forEach(function (t) { tr.appendChild(el('td', '', t)); });
        var td = el('td');
        var open = el('button', 'btn btn--white btn--sm', 'Open');
        open.type = 'button';
        open.setAttribute('aria-label', 'Open ' + a.name);
        open.addEventListener('click', function () { detail(a.id); });
        td.appendChild(open);
        tr.appendChild(td);
        rows.appendChild(tr);
      });
      Object.keys(selected).forEach(function (id) { if (!visible[id]) delete selected[id]; });
      paintBulk();
      $('admin-count').textContent = d.applicants.length + (d.applicants.length === 1 ? ' applicant' : ' applicants');
      return get('list', { status: filters().status, position: filters().position });
    }).then(function (d) {
      $('broadcast-count').textContent = 'Current recipients: ' + d.applicants.length + '.';
    }).catch(failure);
  }

  function paintBulk() {
    var count = Object.keys(selected).length;
    $('bulk-count').textContent = count + (count === 1 ? ' applicant selected.' : ' applicants selected.');
    $('bulk-approve').disabled = !count;
    $('bulk-decline').disabled = !count;
  }

  function decide(decision, ids, note) {
    return post('bulk', { decision: decision, ids: ids, note: note }).then(function (d) {
      var where = d.delivery === 'log' ? 'written to the local test log' : 'accepted by the mail server';
      return (decision === 'approve' ? 'Approved: ' : 'Declined: ') + d.moved + '. Skipped because not awaiting this decision: ' + d.skipped + '. Notifications accepted by push services: ' + d.pushed + '.' + (d.emailed ? ' Hired emails ' + where + ': ' + d.emailed + '.' : '') + (d.emailFailed ? ' Hired emails that failed: ' + d.emailFailed + '.' : '');
    });
  }

  function fact(list, label, value) {
    list.appendChild(el('dt', '', label));
    list.appendChild(el('dd', 'admin-pre', value || 'Not provided'));
  }

  function itemLabel(job, key) {
    var m = key.match(/^(assignment|question|interview)(\d+)$/);
    if (!m || !job) return key;
    var i = Number(m[2]) - 1;
    if (m[1] === 'interview') return 'Interview question ' + m[2] + ': ' + ((job.interviewQuestions || [])[i] || '');
    if (m[1] === 'question') return 'Question ' + m[2] + ': ' + (job.questions[i] || '');
    var a = (job.assignments || [])[i];
    return a ? a.type + ' ' + m[2] + ': ' + a.title : key;
  }

  function linkList(job, links) {
    var ul = el('ul', 'admin-links');
    Object.keys(links).forEach(function (key) {
      var li = el('li');
      li.appendChild(el('p', '', itemLabel(job, key)));
      var link = el('a', '', links[key]);
      link.href = links[key];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      li.appendChild(link);
      ul.appendChild(li);
    });
    return ul;
  }

  function downloadLink(text, action, id) {
    var link = el('a', 'btn btn--white btn--sm', text);
    link.id = 'download-' + action;
    link.href = API + action + '&id=' + id;
    link.setAttribute('download', '');
    return link;
  }

  function detail(id) {
    showError('');
    return get('detail', { id: id }).then(function (a) {
      var box = $('admin-detail');
      box.textContent = '';
      box.hidden = false;
      box.appendChild(el('h2', 'display display--md', a.full_name));
      var facts = el('dl', 'admin-facts');
      fact(facts, 'Position', title(a.position));
      fact(facts, 'Email', a.email);
      fact(facts, 'Phone', a.phone);
      fact(facts, 'Mailing address', a.address);
      fact(facts, 'City and state', a.location);
      fact(facts, 'Nationality', a.nationality);
      fact(facts, 'Role sought', a.preferred_role);
      fact(facts, 'Experience', a.experience);
      fact(facts, 'Cover letter', a.cover_letter);
      fact(facts, 'Applied', day(a.created_at));
      box.appendChild(facts);

      var resume = el('a', 'btn btn--white btn--sm', 'Download Resume');
      resume.href = API + 'resume&id=' + a.id;
      resume.setAttribute('download', '');
      box.appendChild(resume);

      box.appendChild(el('h3', 'form__heading', 'Certificate'));
      if (a.certificate_at) {
        box.appendChild(el('p', '', 'Uploaded ' + day(a.certificate_at) + '. Issued by: ' + (a.certificate_issuer || 'Not stated')));
        box.appendChild(downloadLink('Download Certificate', 'certificate', a.id));
      } else {
        box.appendChild(el('p', '', 'Not uploaded.'));
      }

      box.appendChild(el('h3', 'form__heading', 'Identity check'));
      box.appendChild(el('p', '', a.identity_verified_at ? 'Confirmed ' + day(a.identity_verified_at) + '. The document has been deleted.' : a.hasIdentityFile ? 'Document uploaded ' + day(a.identity_at) + '. It is deleted automatically when you approve or decline.' : 'No document on file.'));
      if (a.hasIdentityFile) box.appendChild(downloadLink('Download Identity Document', 'identity', a.id));

      box.appendChild(el('h3', 'form__heading', 'Recorded interview'));
      if (a.interview_answers) box.appendChild(linkList(jobOf(a.position), a.interview_answers));
      else box.appendChild(el('p', '', 'Not submitted.'));

      box.appendChild(el('h3', 'form__heading', 'Notarized affidavit'));
      if (a.affidavit_at) {
        box.appendChild(el('p', '', 'Uploaded ' + day(a.affidavit_at)));
        var affidavit = el('a', 'btn btn--white btn--sm', 'Download Affidavit');
        affidavit.id = 'download-affidavit';
        affidavit.href = API + 'affidavit&id=' + a.id;
        affidavit.setAttribute('download', '');
        box.appendChild(affidavit);
      } else {
        box.appendChild(el('p', '', 'Not uploaded.'));
      }

      box.appendChild(el('h3', 'form__heading', 'Assessment'));
      if (a.assessment) {
        box.appendChild(linkList(jobOf(a.position), a.assessment));
      } else {
        box.appendChild(el('p', '', 'Not submitted.'));
      }

      box.appendChild(el('h3', 'form__heading', 'Decision'));
      var decisionNote = el('textarea');
      decisionNote.id = 'd-decision-note';
      decisionNote.rows = 2;
      var decisionLabel = el('label', '', 'Reason or message shown on the dashboard (optional)');
      decisionLabel.setAttribute('for', 'd-decision-note');
      var decisionField = el('div', 'field');
      decisionField.appendChild(decisionLabel);
      decisionField.appendChild(decisionNote);
      box.appendChild(decisionField);
      var decisions = el('div', 'btn-row');
      var after = function () { return refresh().then(function () { return detail(a.id); }); };
      if (nextStatus[a.status]) {
        var approve = el('button', 'btn btn--black btn--sm', 'Approve: ' + statuses[nextStatus[a.status]]);
        approve.type = 'button';
        approve.id = 'd-approve';
        approve.addEventListener('click', function () {
          if (nextStatus[a.status] === 'successful' && !confirm('Mark ' + a.full_name + ' as hired and send the hired email?')) return;
          decide('approve', [a.id], decisionNote.value).then(after).catch(failure);
        });
        decisions.appendChild(approve);
      }
      if (a.status !== 'successful' && a.status !== 'unsuccessful') {
        var decline = el('button', 'btn btn--white btn--sm', 'Decline');
        decline.type = 'button';
        decline.id = 'd-decline';
        decline.addEventListener('click', function () {
          if (!confirm('Decline ' + a.full_name + '? They will see this on their dashboard.')) return;
          decide('decline', [a.id], decisionNote.value).then(after).catch(failure);
        });
        decisions.appendChild(decline);
      }
      box.appendChild(decisions);

      box.appendChild(el('h3', 'form__heading', 'Change status manually'));
      var form = el('form', 'form');
      var sf = el('div', 'field');
      var sl = el('label', '', 'Status');
      sl.setAttribute('for', 'd-status');
      var select = el('select');
      select.id = 'd-status';
      Object.keys(statuses).forEach(function (k) { select.appendChild(option(k, statuses[k])); });
      select.value = a.status;
      sf.appendChild(sl);
      sf.appendChild(select);
      form.appendChild(sf);
      var nf = el('div', 'field');
      var nl = el('label', '', 'Note shown on the applicant\'s dashboard (optional)');
      nl.setAttribute('for', 'd-note');
      var note = el('textarea');
      note.id = 'd-note';
      note.rows = 3;
      nf.appendChild(nl);
      nf.appendChild(note);
      form.appendChild(nf);
      var save = el('button', 'btn btn--black', 'Save Status');
      save.type = 'submit';
      form.appendChild(el('p', 'admin-small', a.pushDevices ? 'Push notifications are on for ' + a.pushDevices + (a.pushDevices === 1 ? ' device.' : ' devices.') : 'This applicant has not turned on push notifications.'));
      form.appendChild(save);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        post('status', { id: a.id, status: select.value, note: note.value }).then(refresh).then(function () { return detail(a.id); }).catch(failure);
      });
      box.appendChild(form);

      if (a.updates.length) {
        box.appendChild(el('h3', 'form__heading', 'Updates sent'));
        a.updates.forEach(function (u) { box.appendChild(el('p', 'admin-pre', day(u.createdAt) + ' | ' + u.subject + '\n' + u.body)); });
      }

      box.appendChild(el('h3', 'form__heading', 'Access and removal'));
      var codeOut = el('p', 'code-box');
      codeOut.id = 'new-code';
      codeOut.hidden = true;
      var actions = el('div', 'btn-row');
      var issue = el('button', 'btn btn--white btn--sm', 'Issue New Code');
      issue.type = 'button';
      issue.id = 'issue-code';
      issue.addEventListener('click', function () {
        if (!confirm('Replace this applicant\'s code? Their old code stops working. Confirm their identity first.')) return;
        post('new-code', { id: a.id }).then(function (d) { codeOut.textContent = d.code; codeOut.hidden = false; }).catch(failure);
      });
      var del = el('button', 'btn btn--white btn--sm', 'Delete Applicant');
      del.type = 'button';
      del.id = 'delete-applicant';
      del.addEventListener('click', function () {
        if (!confirm('Permanently delete ' + a.full_name + ' and their resume? This cannot be undone.')) return;
        post('delete', { id: a.id }).then(function () { box.hidden = true; return refresh(); }).catch(failure);
      });
      actions.appendChild(issue);
      actions.appendChild(del);
      box.appendChild(actions);
      box.appendChild(codeOut);
      box.focus();
    }).catch(failure);
  }

  function resetPartnerForm() {
    partnerId = 0;
    ['p-name', 'p-url', 'p-location', 'p-details', 'p-cost', 'p-disclosure', 'p-country'].forEach(function (id) { $(id).value = ''; });
    $('partner-form-title').textContent = 'Add a partner';
    $('partner-cancel').hidden = true;
  }

  function loadPartners() {
    return fetch('api/partners.php', { credentials: 'same-origin' }).then(handle).then(function (d) {
      var rows = $('partner-rows');
      rows.textContent = '';
      if (!d.partners.length) rows.appendChild(el('p', '', 'No partners yet.'));
      d.partners.forEach(function (p) {
        var box = el('article', 'task');
        box.appendChild(el('h4', 'form__subject', p.name));
        box.appendChild(el('p', 'admin-small', p.kind === 'certificate' ? 'Certificate provider' : 'Notary'));
        box.appendChild(el('p', 'admin-pre', [p.url, p.location, p.country && 'Shown to applicants from: ' + p.country, p.details, p.cost && 'Cost: ' + p.cost, p.disclosure && 'Relationship: ' + p.disclosure].filter(Boolean).join('\n')));
        var actions = el('div', 'btn-row');
        var edit = el('button', 'btn btn--white btn--sm', 'Edit');
        edit.type = 'button';
        edit.setAttribute('aria-label', 'Edit ' + p.name);
        edit.addEventListener('click', function () {
          partnerId = p.id;
          $('p-name').value = p.name;
          $('p-url').value = p.url;
          $('p-location').value = p.location || '';
          $('p-details').value = p.details || '';
          $('p-kind').value = p.kind || 'notary';
          $('p-cost').value = p.cost || '';
          $('p-disclosure').value = p.disclosure || '';
          $('p-country').value = p.country || '';
          $('partner-form-title').textContent = 'Edit ' + p.name;
          $('partner-cancel').hidden = false;
          $('p-name').focus();
        });
        var remove = el('button', 'btn btn--white btn--sm', 'Remove');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Remove ' + p.name);
        remove.addEventListener('click', function () {
          if (!confirm('Remove ' + p.name + ' from the partners page?')) return;
          post('partner-delete', { id: p.id }).then(function () { if (partnerId === p.id) resetPartnerForm(); return loadPartners(); }).catch(failure);
        });
        actions.appendChild(edit);
        actions.appendChild(remove);
        box.appendChild(actions);
        rows.appendChild(box);
      });
    }).catch(failure);
  }

  function boot() {
    return get('session').then(function (s) {
      statuses = s.statuses;
      nextStatus = s.next || {};
      $('setup-form').hidden = !s.setupRequired;
      $('login-form').hidden = s.setupRequired || s.authenticated;
      $('console').hidden = !s.authenticated;
      if (!s.authenticated) return;
      $('admin-email').textContent = s.email;
      var fs = $('f-status');
      if (!fs.options.length) {
        fs.appendChild(option('', 'All statuses'));
        Object.keys(statuses).forEach(function (k) { fs.appendChild(option(k, statuses[k])); });
        var fp = $('f-position');
        fp.appendChild(option('', 'All positions'));
        jobs.forEach(function (j) { fp.appendChild(option(j.id, j.title)); });
        fp.appendChild(option('general', 'General application'));
      }
      loadPartners();
      return refresh();
    }).catch(failure);
  }

  $('setup-form').addEventListener('submit', function (e) {
    e.preventDefault();
    showError('');
    post('setup', { key: $('setup-key').value, email: $('setup-email').value, password: $('setup-password').value }).then(function () { $('setup-password').value = ''; return boot(); }).catch(failure);
  });
  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    showError('');
    post('login', { email: $('login-email').value, password: $('login-password').value }).then(function () { $('login-password').value = ''; return boot(); }).catch(failure);
  });
  $('admin-logout').addEventListener('click', function () {
    post('logout').then(function () { $('admin-detail').hidden = true; return boot(); }).catch(failure);
  });
  ['f-status', 'f-position'].forEach(function (id) { $(id).addEventListener('change', refresh); });
  var timer;
  $('f-q').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(refresh, 250); });

  $('partner-cancel').addEventListener('click', resetPartnerForm);
  $('partner-form').addEventListener('submit', function (e) {
    e.preventDefault();
    showError('');
    post('partner-save', { id: partnerId, name: $('p-name').value, url: $('p-url').value, location: $('p-location').value, details: $('p-details').value, kind: $('p-kind').value, cost: $('p-cost').value, disclosure: $('p-disclosure').value, country: $('p-country').value }).then(function () { resetPartnerForm(); return loadPartners(); }).catch(failure);
  });

  $('bulk-all').addEventListener('change', function () {
    var on = $('bulk-all').checked;
    Array.prototype.forEach.call(document.querySelectorAll('.bulk-pick'), function (box) {
      if (box.checked !== on) { box.checked = on; box.dispatchEvent(new Event('change')); }
    });
  });

  ['approve', 'decline'].forEach(function (decision) {
    $('bulk-' + decision).addEventListener('click', function () {
      var ids = Object.keys(selected).map(Number);
      var out = $('bulk-result');
      var warning = decision === 'approve'
        ? 'Approve ' + ids.length + ' selected applicants and move each to their next stage? Anyone at the affidavit review will be marked as hired and emailed.'
        : 'Decline ' + ids.length + ' selected applicants? They will see this on their dashboards.';
      if (!confirm(warning)) return;
      out.hidden = true;
      decide(decision, ids, $('bulk-note').value).then(function (text) {
        selected = {};
        $('bulk-all').checked = false;
        $('bulk-note').value = '';
        out.textContent = text;
        out.hidden = false;
        out.focus();
        return refresh();
      }).catch(failure);
    });
  });

  $('broadcast-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var out = $('broadcast-result');
    var f = filters();
    var subject = $('b-subject').value.trim();
    var message = $('b-message').value.trim();
    out.hidden = true;
    if (!subject || !message) {
      out.className = 'form__result form__result--error';
      out.textContent = 'Please enter a subject and a message.';
      out.hidden = false;
      return;
    }
    if (!confirm('Send this update? ' + $('broadcast-count').textContent)) return;
    post('broadcast', { subject: subject, message: message, status: f.status, position: f.position }).then(function (d) {
      var where = d.delivery === 'log' ? 'written to the local test log. No real email was sent' : 'accepted by the mail server. Delivery is not confirmed';
      out.className = 'form__result form__result--' + (d.failed.length ? 'error' : 'preview');
      out.textContent = d.recipients + ' dashboards updated. ' + d.accepted + ' emails ' + where + '.' + (d.failed.length ? ' Failed: ' + d.failed.join(', ') : '');
      out.hidden = false;
      out.focus();
      $('b-subject').value = '';
      $('b-message').value = '';
    }).catch(failure);
  });

  boot();
})();
