/**
 * Extract the user's SteamID64 from the current page.
 *
 * Steam embeds the ID in inline scripts as `g_steamID = "76561198..."`.
 * If that's not present, fall back to profile links containing /profiles/XXXXX/.
 */
export function extractSteamId(): string | null {
  // Primary: look for g_steamID assignment in inline scripts
  const scripts = document.querySelectorAll('script:not([src])');
  for (const script of scripts) {
    const text = script.textContent ?? '';
    const match = text.match(/g_steamID\s*=\s*"(\d{17})"/);
    if (match) return match[1];
  }

  // Fallback: profile links in the page header/nav
  const profileLinks = document.querySelectorAll('a[href*="/profiles/"]');
  for (const link of profileLinks) {
    const href = link.getAttribute('href') ?? '';
    const match = href.match(/\/profiles\/(\d{17})/);
    if (match) return match[1];
  }

  return null;
}
