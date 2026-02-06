// File: src/utils/sanitizeFilename.js
/**
 * Sanitizes a filename to prevent security issues and ensure cross-platform compatibility.
 *
 * @param {string} raw - The raw filename input
 * @param {string} fallback - Fallback filename if sanitization fails (default: 'document.txt')
 * @returns {string} A safe filename
 */
export function sanitizeFilename(raw, fallback = 'document.txt') {
  if (!raw || typeof raw !== 'string') return fallback;

  const cleaned = String(raw)
    // Remove Unicode control chars including RTL override (U+202E)
    .replace(/[\u0000-\u001F\u007F-\u009F\u200E-\u202E]/g, '')
    // Remove path separators and shell metacharacters
    .replace(/[\/\\<>:"|?*`$&;(){}[\]]/g, '_')
    // Handle Windows reserved names
    .replace(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i, 'safe_$1$2')
    // Normalize whitespace and trim
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);

  if (!cleaned || cleaned === '.' || cleaned === '..') return fallback;
  if (!/\.[a-z0-9]{1,5}$/i.test(cleaned)) return cleaned + '.txt';
  return cleaned;
}

/**
 * Gets a document filename with the specified extension.
 * Uses the document title input if available.
 *
 * @param {string} extension - The file extension (without dot)
 * @returns {string} A sanitized filename with extension
 */
export function getDocumentFilename(extension) {
  const titleInput = document.getElementById('document-title');
  const base = sanitizeFilename(titleInput?.value);
  const ext = String(extension || '').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'txt';

  // Remove any existing extension from base before adding new one
  const baseWithoutExt = base.replace(/\.[a-z0-9]{1,8}$/i, '');
  return `${baseWithoutExt}.${ext}`;
}
