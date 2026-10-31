/*
 * Form connections. While an endpoint is null, its form stays in honest preview mode:
 * it validates input, sends nothing and says so. Application and assessment forms use
 * the PHP backend in api/. The contact form has no backend yet.
 */
window.SEUDOCOM_CONFIG = {
  forms: {
    application: { endpoint: 'api/application.php' },
    contact: { endpoint: null },
    assessment: { endpoint: 'api/assessment.php' }
  }
};
