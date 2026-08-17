/**
 * Validates session and job IDs.
 * Supports MongoDB ObjectIds (24-char hex), SQLite UUIDs, and custom project identifiers.
 */
export function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > 128) return false;
  // Allow alphanumeric, dash, underscore, dot, colon for SQLite / MCP custom project IDs
  return /^[a-zA-Z0-9_\-\.\:\/]+$/.test(trimmed);
}
