/* Renders job cards, the job detail dialog and the process steps from careers-data.js. */
(function () {
  'use strict';

  var data = window.SEUDOCOM_CAREERS || {};
  var jobs = (data.jobs || []).filter(function (j) { return !j.sample || data.showSampleJobs; });

  var list = document.getElementById('job-list');
  var empty = document.getElementById('jobs-empty');
  var sampleNotice = document.getElementById('jobs-sample-notice');
  var dialog = document.getElementById('job-dialog');
  var dialogBody = document.getElementById('job-dialog-body');
  var dialogTags = document.getElementById('job-dialog-tags');
  var select = document.getElementById('app-position');
  var roleField = document.getElementById('app-role-field');
  var banner = document.getElementById('applying-for');
  var form = document.getElementById('application-form');
  var lastTrigger = null;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function tags(job) {
    var wrap = document.createDocumentFragment();
    if (job.sample) wrap.appendChild(el('span', 'tag tag--sample', 'Sample, not a real opening'));
    [job.category, job.location, job.employmentType, job.pay].forEach(function (t) {
      if (t) wrap.appendChild(el('span', 'tag', t));
    });
    return wrap;
  }

  function section(title, content) {
    var box = el('section', 'job-dialog__section');
    box.appendChild(el('h3', '', title));
    if (Array.isArray(content)) {
      var ul = el('ul');
      content.forEach(function (c) { ul.appendChild(el('li', '', c)); });
      box.appendChild(ul);
    } else {
      box.appendChild(el('p', '', content));
    }
    return box;
  }

  function applyFor(job) {
    select.value = job ? job.id : 'general';
    syncPosition();
    if (dialog.open) dialog.close();
    document.getElementById('apply').scrollIntoView();
    document.getElementById('app-name').focus({ preventScroll: true });
  }

  function openJob(job, trigger) {
    lastTrigger = trigger || null;
    dialogTags.textContent = '';
    dialogTags.appendChild(tags(job));
    dialogBody.textContent = '';
    var h2 = el('h2', 'display display--md', job.title);
    h2.id = 'job-dialog-title';
    dialogBody.appendChild(h2);
    if (job.overview) dialogBody.appendChild(section('Position overview', job.overview));
    if (job.responsibilities && job.responsibilities.length) dialogBody.appendChild(section('Responsibilities', job.responsibilities));
    if (job.requirements && job.requirements.length) dialogBody.appendChild(section('Requirements', job.requirements));
    var cta = el('button', 'btn btn--black btn--full', 'Apply for This Position');
    cta.type = 'button';
    cta.addEventListener('click', function () { applyFor(job); });
    dialogBody.appendChild(cta);
    if (job.questions) {
      var preview = el('a', 'link-arrow', 'See the assessment for this position');
      preview.href = 'assessment.html?role=' + encodeURIComponent(job.id);
      dialogBody.appendChild(preview);
    }
    history.replaceState(null, '', '#job-' + job.id);
    dialog.showModal();
  }

  function renderJobs() {
    list.textContent = '';
    empty.hidden = jobs.length > 0;
    sampleNotice.hidden = !jobs.some(function (j) { return j.sample; });
    jobs.forEach(function (job) {
      var card = el('article', 'job-card');
      var head = el('div', 'tags');
      head.appendChild(tags(job));
      card.appendChild(head);
      card.appendChild(el('h3', '', job.title));
      card.appendChild(el('p', '', job.summary));
      var actions = el('div', 'job-card__actions');
      var details = el('button', 'btn btn--white btn--sm', 'View Details');
      details.type = 'button';
      details.setAttribute('aria-label', 'View details: ' + job.title);
      details.addEventListener('click', function () { openJob(job, details); });
      var apply = el('button', 'btn btn--black btn--sm', 'Apply');
      apply.type = 'button';
      apply.setAttribute('aria-label', 'Apply: ' + job.title);
      apply.addEventListener('click', function () { applyFor(job); });
      actions.appendChild(details);
      actions.appendChild(apply);
      card.appendChild(actions);
      list.appendChild(card);

      var opt = el('option', '', (job.sample ? 'Sample: ' : '') + job.title);
      opt.value = job.id;
      select.appendChild(opt);
    });
  }

  function renderProcess() {
    var ol = document.getElementById('process-list');
    (data.process || []).forEach(function (step, i) {
      var li = el('li');
      li.appendChild(el('span', 'index', String(i + 1).padStart(2, '0')));
      li.appendChild(el('h3', '', step.title));
      li.appendChild(el('p', '', step.text));
      ol.appendChild(li);
    });
    var links = document.getElementById('assessment-links');
    jobs.forEach(function (j) {
      if (!j.questions) return;
      var a = el('a', 'btn btn--white', 'Assessment: ' + j.title);
      a.href = 'assessment.html?role=' + encodeURIComponent(j.id);
      links.appendChild(a);
    });
  }

  // Associates the application with the selected position and keeps the banner in step.
  function syncPosition() {
    var job = jobs.filter(function (j) { return j.id === select.value; })[0];
    roleField.hidden = !!job;
    banner.hidden = !job;
    banner.textContent = job ? 'Applying for: ' + job.title + (job.sample ? ' (sample, not a real opening)' : '') : '';
  }

  document.getElementById('job-dialog-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', function () {
    if (location.hash.indexOf('#job-') === 0) history.replaceState(null, '', location.pathname + location.search);
    if (lastTrigger && document.contains(lastTrigger) && document.activeElement === document.body) lastTrigger.focus();
  });
  select.addEventListener('change', syncPosition);
  form.addEventListener('seudocom:submitted', syncPosition);

  renderJobs();
  renderProcess();
  syncPosition();

  // Direct links: careers.html#job-<id> opens that position.
  function openFromHash() {
    var match = location.hash.match(/^#job-(.+)$/);
    if (!match || dialog.open) return;
    var linked = jobs.filter(function (j) { return j.id === match[1]; })[0];
    if (linked) openJob(linked);
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
})();
