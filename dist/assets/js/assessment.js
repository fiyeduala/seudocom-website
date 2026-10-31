/* Builds the assessment for assessment.html?role=<job id> from careers-data.js. Runs before forms.js. */
(function () {
  'use strict';

  var jobs = (window.SEUDOCOM_CAREERS || {}).jobs || [];
  var id = new URLSearchParams(location.search).get('role');
  var job = jobs.filter(function (j) { return j.id === id && j.questions; })[0];

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function task(prefix, number, heading, text, tag, itemName) {
    var box = el('div', 'task');
    var head = el('div', 'task__head');
    head.appendChild(el('span', 'index', String(number).padStart(2, '0')));
    if (tag) head.appendChild(el('span', 'tag', tag));
    box.appendChild(head);
    if (heading) box.appendChild(el('h4', '', heading));
    box.appendChild(el('p', '', text));
    var field = el('div', 'field');
    var inputId = prefix + '-' + number;
    var label = el('label', '', 'Google Drive link ');
    label.setAttribute('for', inputId);
    label.appendChild(el('span', 'req', 'Required'));
    var input = el('input');
    input.id = inputId;
    input.name = prefix + number;
    input.type = 'url';
    input.required = true;
    input.placeholder = 'https://drive.google.com/...';
    input.setAttribute('data-missing', 'Please paste the Google Drive link for ' + itemName + '.');
    field.appendChild(label);
    field.appendChild(input);
    box.appendChild(field);
    return box;
  }

  if (!job) {
    document.getElementById('assessment-chooser').hidden = false;
    var choices = document.getElementById('assessment-choices');
    jobs.forEach(function (j) {
      if (!j.questions) return;
      var a = el('a', 'btn btn--black', j.title);
      a.href = 'assessment.html?role=' + encodeURIComponent(j.id);
      choices.appendChild(a);
    });
    return;
  }

  document.title = 'Assessment: ' + job.title + ' | Seudocom';
  document.getElementById('assessment-role').textContent = 'Position: ' + job.title;
  document.getElementById('assessment-position').value = job.id;
  var assignments = document.getElementById('assessment-assignments');
  (job.assignments || []).forEach(function (a, i) {
    assignments.appendChild(task('assignment', i + 1, a.title, a.text, a.type, a.type.toLowerCase() + ' ' + (i + 1)));
  });
  var questions = document.getElementById('assessment-questions');
  job.questions.forEach(function (q, i) {
    questions.appendChild(task('question', i + 1, '', q, 'Record on video', 'question ' + (i + 1)));
  });
  document.getElementById('assessment-main').hidden = false;
})();
