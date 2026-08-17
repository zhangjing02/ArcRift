/**
 * Validates session and job IDs.
 * Supports MongoDB ObjectIds (24-char hex), SQLite UUIDs, and custom Unicode project identifiers.
 */
export function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > 256) return false;
  if (trimmed.includes("..") || trimmed.includes("\\")) return false;
  return true;
}
