/**
 * Client ID utility for collaborative editing.
 *
 * Provides a persistent unique identifier for this browser/client that is used
 * to distinguish local user from remote collaborators in awareness features
 * (cursors, typing indicators, user lists, etc.).
 *
 * The ID is stored in localStorage so it persists across page reloads and
 * browser sessions, ensuring consistent identity for the same user/device.
 */

const STORAGE_KEY = 'automerge-client-id';

/**
 * Get or create a unique client identifier.
 *
 * Returns the existing client ID from localStorage if available,
 * otherwise generates a new UUID and stores it for future use.
 *
 * @returns {string} A UUID string identifying this client
 */
export function getClientID() {
  let clientID = localStorage.getItem(STORAGE_KEY);
  if (!clientID) {
    clientID = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, clientID);
  }
  return clientID;
}
