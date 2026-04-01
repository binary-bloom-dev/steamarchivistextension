// Smallest valid SteamID64 (first individual account in Universe 1, Type Individual).
// SteamID64 values exceed Number.MAX_SAFE_INTEGER so BigInt is required.
const STEAMID64_MIN = BigInt('76561197960265728');

/**
 * Return true if the given string is a structurally valid SteamID64:
 * exactly 17 digits and within the known valid range (AUTH-4).
 */
export function isValidSteamId(id: string): boolean {
  if (!/^\d{17}$/.test(id)) return false;
  try {
    return BigInt(id) >= STEAMID64_MIN;
  } catch {
    return false;
  }
}

/**
 * Extract the user's SteamID64 from the current page.
 *
 * Steam embeds the ID in inline scripts as `g_steamID = "76561198..."`.
 * If that's not present, fall back to profile links containing /profiles/XXXXX/.
 * Returns null if no ID is found or if the extracted value is out of valid range.
 */
export function extractSteamId(): string | null {
  // Primary: look for g_steamID assignment in inline scripts
  const scripts = document.querySelectorAll('script:not([src])');
  for (const script of scripts) {
    const text = script.textContent ?? '';
    const match = text.match(/g_steamID\s*=\s*"(\d{17})"/);
    if (match && isValidSteamId(match[1])) return match[1];
  }

  // Fallback: profile links in the page header/nav
  const profileLinks = document.querySelectorAll('a[href*="/profiles/"]');
  for (const link of profileLinks) {
    const href = link.getAttribute('href') ?? '';
    const match = href.match(/\/profiles\/(\d{17})/);
    if (match && isValidSteamId(match[1])) return match[1];
  }

  return null;
}
