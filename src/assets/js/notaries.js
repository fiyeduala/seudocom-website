/* Lists notarization partners from the backend. Partner content is inserted as text, never as HTML. */
(function () {
  'use strict';

  var list = document.getElementById('partner-list');

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function message(text) {
    list.textContent = '';
    list.appendChild(el('p', '', text));
  }

  fetch('api/partners.php')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var partners = d.partners || [];
      if (!partners.length) return message('No partners are listed yet. You can use any licensed notary public.');
      list.textContent = '';
      partners.forEach(function (p) {
        var box = el('article', 'task');
        box.appendChild(el('h2', 'form__subject', p.name));
        if (p.location) box.appendChild(el('p', 'admin-small', p.location));
        if (p.details) box.appendChild(el('p', 'admin-pre', p.details));
        var link = el('a', 'btn btn--black btn--sm', 'Select This Partner');
        link.href = p.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', 'Select ' + p.name + ' (opens their website)');
        box.appendChild(link);
        list.appendChild(box);
      });
    })
    .catch(function () { message('The partner list could not be loaded. You can use any licensed notary public.'); });
})();
