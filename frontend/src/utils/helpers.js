export async function hashChunk(arrayBuffer) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(2)} ${units[exponent]}`;
}

export function formatSpeed(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}