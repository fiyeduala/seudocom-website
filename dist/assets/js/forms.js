/*
 * Validation and submission for every form marked data-form="<name>".
 * The endpoint comes from site-config.js. With no endpoint, nothing leaves the browser.
 * Form values are never written to localStorage, sessionStorage or cookies.
 */
(function () {
  'use strict';

  var COPY = {
    application: {
      preview: '<strong>Your details look complete, but nothing has been submitted.</strong> Applications are not open yet: this form is a preview and is not connected to Seudocom. Your application and resume have not been sent or saved.',
      success: '<strong>Thank you. Your application has been submitted.</strong> Submitting an application does not guarantee employment.',
      failure: '<strong>Your application could not be submitted.</strong> Nothing has been received. Please try again later.'
    },
    assessment: {
      preview: '<strong>Your links look complete, but nothing has been submitted.</strong> Assessments are not open yet: this form is a preview and is not connected to Seudocom.',
      success: '<strong>Thank you. Your assessment has been submitted.</strong> Follow its progress on your <a href="dashboard.html">applicant dashboard</a>. A notarized affidavit is required before any interview. Completing the assessment does not guarantee an interview or employment.',
      failure: '<strong>Your assessment could not be submitted.</strong> Nothing has been received. Please try again later.'
    },
    contact: {
      preview: '<strong>Your details look complete, but nothing has been sent.</strong> This form is a preview and is not connected to Seudocom yet. Please email us using the address on this page.',
      success: '<strong>Thank you. Your inquiry has been sent.</strong> Seudocom will review it and be in touch.',
      failure: '<strong>Your inquiry could not be sent.</strong> Please try again later.'
    }
  };
  var MIME_EXTENSIONS = ['pdf', 'docx'];

  function labelText(input) {
    var label = input.form.querySelector('label[for="' + input.id + '"]');
    if (!label) return input.name;
    var clone = label.cloneNode(true);
    clone.querySelectorAll('span').forEach(function (s) { s.remove(); });
    return clone.textContent.trim();
  }

  function validate(input) {
    var v = input.type === 'file' || input.type === 'checkbox' ? '' : input.value.trim();
    var name = labelText(input);
    var missing = input.getAttribute('data-missing');
    if (input.type === 'checkbox') return input.required && !input.checked ? (missing || 'Please confirm your consent to continue.') : '';
    if (input.type === 'file') {
      var file = input.files[0];
      if (!file) return input.required ? 'Please choose your resume file.' : '';
      var ext = file.name.split('.').pop().toLowerCase();
      if (MIME_EXTENSIONS.indexOf(ext) === -1 || file.name.indexOf('.') === -1) return 'Please choose a PDF or DOCX file.';
      if (file.size === 0) return 'That file appears to be empty. Please choose another.';
      var max = Number(input.getAttribute('data-max-mb')) || 5;
      if (file.size > max * 1024 * 1024) return 'That file is larger than ' + max + ' MB. Please choose a smaller file.';
      return '';
    }
    if (input.required && !v) {
      if (missing) return missing;
      return input.tagName === 'SELECT' ? 'Please choose an option for ' + name.toLowerCase() + '.' : 'Please enter your ' + name.toLowerCase() + '.';
    }
    if (v && input.type === 'url' && !/^https:\/\/(drive|docs)\.google\.com\/\S+$/.test(v)) return 'Please paste a full Google Drive link, starting with https://drive.google.com/.';
    if (v && input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Please enter a valid email address, such as name@company.com.';
    if (v && input.type === 'tel' && v.replace(/\D/g, '').length < 7) return 'Please enter a valid phone number, including the area code.';
    return '';
  }

  function showError(input, message) {
    var field = input.closest('.field');
    var id = input.id + '-error';
    var err = document.getElementById(id);
    var described = (input.getAttribute('aria-describedby') || '').split(' ').filter(function (d) { return d && d !== id; });
    if (message) {
      if (!err) {
        err = document.createElement('p');
        err.className = 'field__error';
        err.id = id;
        field.appendChild(err);
      }
      err.textContent = message;
      input.setAttribute('aria-invalid', 'true');
      described.push(id);
    } else {
      if (err) err.remove();
      input.removeAttribute('aria-invalid');
    }
    if (described.length) input.setAttribute('aria-describedby', described.join(' '));
    else input.removeAttribute('aria-describedby');
    field.classList.toggle('field--invalid', !!message);
  }

  // The server shows this code once. It is displayed here and never stored in the browser.
  function showCode(result, code) {
    var wrap = document.createElement('div');
    wrap.className = 'code-actions';
    var intro = document.createElement('p');
    intro.innerHTML = '<strong>This is your access code. Write it down now and keep it safe.</strong> You need it to view your status on the applicant dashboard, and it will not be shown again or sent by email.';
    var box = document.createElement('p');
    box.className = 'code-box';
    box.id = 'access-code';
    box.textContent = code;
    var row = document.createElement('div');
    row.className = 'btn-row';
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn btn--white btn--sm';
    copy.textContent = 'Copy Code';
    copy.addEventListener('click', function () {
      if (!navigator.clipboard) { copy.textContent = 'Please copy it by hand'; return; }
      navigator.clipboard.writeText(code).then(function () { copy.textContent = 'Copied'; }, function () { copy.textContent = 'Please copy it by hand'; });
    });
    var dash = document.createElement('a');
    dash.className = 'btn btn--lime btn--sm';
    dash.href = 'dashboard.html';
    dash.target = '_blank';
    dash.rel = 'noopener';
    dash.textContent = 'Open My Dashboard';
    row.appendChild(copy);
    row.appendChild(dash);
    wrap.appendChild(intro);
    wrap.appendChild(box);
    wrap.appendChild(row);
    result.appendChild(wrap);
  }

  function setup(form) {
    var name = form.getAttribute('data-form');
    var conf = (window.SEUDOCOM_CONFIG.forms || {})[name] || {};
    var endpoint = conf.endpoint;
    var copy = COPY[name];
    var summary = form.querySelector('[data-error-summary]');
    var result = form.querySelector('[data-form-result]');
    var submit = form.querySelector('button[type="submit"]');
    var inputs = Array.prototype.slice.call(form.querySelectorAll('input:not([type="hidden"]), select, textarea'));

    if (endpoint) {
      var note = document.querySelector('[data-form-preview-notice="' + name + '"]');
      if (note) note.remove();
    }

    inputs.forEach(function (input) {
      input.addEventListener(input.type === 'file' || input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'blur', function () {
        if (input.type === 'file') {
          var shown = form.querySelector('[data-file-name]');
          if (shown) shown.textContent = input.files[0] ? input.files[0].name : 'No file selected';
        }
        showError(input, validate(input));
      });
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true') showError(input, validate(input));
        result.hidden = true;
      });
    });

    function report(type, html) {
      result.className = 'form__result form__result--' + type;
      result.innerHTML = html;
      result.hidden = false;
      result.focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      result.hidden = true;
      var bad = [];
      inputs.forEach(function (input) {
        var msg = validate(input);
        showError(input, msg);
        if (msg) bad.push({ input: input, msg: msg });
      });
      if (bad.length) {
        summary.innerHTML = '<strong>Please fix ' + (bad.length === 1 ? 'this problem' : 'these ' + bad.length + ' problems') + ':</strong><ul></ul>';
        bad.forEach(function (b) {
          var li = document.createElement('li');
          var a = document.createElement('a');
          a.href = '#' + b.input.id;
          a.textContent = b.msg;
          a.addEventListener('click', function (ev) { ev.preventDefault(); b.input.focus(); });
          li.appendChild(a);
          summary.querySelector('ul').appendChild(li);
        });
        summary.hidden = false;
        summary.focus();
        return;
      }
      summary.hidden = true;

      if (!endpoint) {
        report('preview', copy.preview);
        return;
      }

      var original = submit.textContent;
      submit.disabled = true;
      submit.textContent = 'Sending…';
      fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (!res.ok) throw new Error(data.error || '');
            return data;
          });
        })
        .then(function (data) {
          form.reset();
          var shown = form.querySelector('[data-file-name]');
          if (shown) shown.textContent = 'No file selected';
          form.dispatchEvent(new CustomEvent('seudocom:submitted'));
          report('success', copy.success);
          if (data.code) showCode(result, data.code);
        })
        .catch(function (err) {
          report('error', copy.failure);
          if (err.message && err instanceof TypeError === false) {
            var why = document.createElement('p');
            why.textContent = err.message;
            result.appendChild(why);
          }
        })
        .finally(function () {
          submit.disabled = false;
          submit.textContent = original;
        });
    });
  }

  document.querySelectorAll('form[data-form]').forEach(setup);
})();
