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
  },
});
