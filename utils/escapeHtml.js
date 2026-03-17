/**
 * Escape a string for safe insertion into HTML (text or attribute values).
 * Prevents XSS when rendering user or API data with innerHTML.
 * @param {string} str - Raw string (e.g. from API or user input)
 * @returns {string} HTML-safe string
 */
function escapeHtml(str) {
  if (str == null || typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
