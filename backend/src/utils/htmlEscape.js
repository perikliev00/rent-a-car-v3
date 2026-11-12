/**
 * Encode a value for an HTML text context. This does not make a string safe
 * inside a URL, attribute script, or CSS context.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Remove CR/LF so a dynamic subject cannot inject extra mail headers.
 * @param {unknown} value
 * @returns {string}
 */
function escapeMailHeader(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

module.exports = {
  escapeHtml,
  escapeMailHeader,
};
