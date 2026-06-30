// File: src/utils/timeUtils.js

/**
 * Formats a Date object as a short timestamp like "3:47 PM"
 *
 * @param {Date} date - The date to format
 * @returns {string} formatted time
 */
export function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Returns a relative time string like "2 minutes ago" or "just now"
 *
 * @param {Date} date - A past Date to compare with now
 * @returns {string}
 */
export function relativeTime(date) {
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
