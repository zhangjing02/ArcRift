/**
 * Validates MongoDB ObjectIds (24-char hex).
 */
export function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Validates session and workspace identifiers (supports UUIDs, names, and ObjectIds).
 */
export function isValidSessionId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > 256) return false;
  if (trimmed.includes("..") || trimmed.includes("\\")) return false;
  return true;
}
