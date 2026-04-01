import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'SteamArchivist Purchase History Export',
    description: 'Export your full Steam purchase history and sync with SteamArchivist.',
    permissions: ['storage', 'management'],
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
  },
});
