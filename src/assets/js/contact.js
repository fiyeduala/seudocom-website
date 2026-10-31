/* Preselects the inquiry type from links such as contact.html?type=workforce */
(function () {
  'use strict';
  var type = new URLSearchParams(location.search).get('type');
  var select = document.getElementById('c-type');
  if (type && select && select.querySelector('option[value="' + CSS.escape(type) + '"]')) select.value = type;
})();
