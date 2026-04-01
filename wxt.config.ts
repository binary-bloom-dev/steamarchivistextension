import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  // manifest as a function gives access to the target browser so we can
  // apply the least-privilege permission set per platform (DEP-3).
  manifest: ({ browser }) => ({
    name: 'SteamArchivist Purchase History Export',
    description: 'Export your full Steam purchase history and sync with SteamArchivist.',
    // management is used solely for browser.management.uninstallSelf().
    // Firefox does not implement uninstallSelf(), so the permission is both
    // non-functional and broader than needed on that browser. (DEP-3)
    permissions: browser === 'firefox' ? ['storage'] : ['storage', 'management'],
    host_permissions: [
      'https://store.steampowered.com/account/history*',
      'https://steamarchivist.com/*',
    ],
    // Explicitly declare the CSP so a WXT version bump cannot silently
    // relax it. MV3 default is equivalent, but making it explicit is
    // intentional policy. (ATTACK-4)
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  }),
});
