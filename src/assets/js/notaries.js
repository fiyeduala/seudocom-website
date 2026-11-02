/* Lists partners of one kind from the backend. Partner content is inserted as text, never as HTML. */
(function () {
  'use strict';

  var list = document.getElementById('partner-list');
  var fallback = list.getAttribute('data-fallback');

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

  fetch('api/partners.php?kind=' + encodeURIComponent(list.getAttribute('data-kind')))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var partners = d.partners || [];
      if (!partners.length) return message('No partners are listed yet. ' + fallback);
      list.textContent = '';
      partners.forEach(function (p) {
        var box = el('article', 'task');
        box.appendChild(el('h2', 'form__subject', p.name));
        var place = [p.location, p.country].filter(Boolean).join(', ');
        if (place) box.appendChild(el('p', 'admin-small', place));
        if (p.details) box.appendChild(el('p', 'admin-pre', p.details));
        if (p.cost) box.appendChild(el('p', 'admin-small', 'Cost: ' + p.cost));
        if (p.disclosure) box.appendChild(el('p', 'admin-small', 'Relationship to Seudocom or its recruiters: ' + p.disclosure));
        var link = el('a', 'btn btn--black btn--sm', 'Select This Partner');
        link.href = p.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', 'Select ' + p.name + ' (opens their website)');
        box.appendChild(link);
        list.appendChild(box);
      });
    })
    .catch(function () { message('The partner list could not be loaded. ' + fallback); });
})();
