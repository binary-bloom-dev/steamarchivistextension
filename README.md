# SteamArchivist Browser Extension

Browser extension that exports your full Steam purchase history and syncs it with [SteamArchivist](https://steamarchivist.com).

## What It Does

Steam doesn't provide a native way to export your purchase history. This extension reads the data directly from your [Steam account history page](https://store.steampowered.com/account/history), paginates through the full list, and:

1. **Downloads a CSV** locally (you always get a copy)
2. **Sends structured data** to SteamArchivist for financial analysis

## How It Works

1. Install the extension
2. Visit [steamarchivist.com](https://steamarchivist.com) while logged in — the extension automatically links to your account (no manual token entry)
3. Navigate to your [Steam purchase history](https://store.steampowered.com/account/history)
4. Click the "Export Full History to SteamArchivist" button
5. Wait for pagination to complete — progress is shown in real time
6. CSV downloads automatically; data is sent to SteamArchivist in the background
7. Uninstall the extension when done (it prompts you)

## Privacy & Data Collection

This extension collects **only** your Steam purchase history (dates, game names, prices, transaction types). It does **not** collect:

- Your Steam password or session tokens
- Your friends list, playtime, or achievements
- Any data from pages other than the Steam purchase history page

Data is sent to `steamarchivist.com` over HTTPS using a single-use, time-limited token tied to your SteamArchivist session. The token expires after 10 minutes and can only be used once.

The extension requests permissions for:

| Permission | Why |
|---|---|
| `store.steampowered.com/account/history*` | Read and paginate your purchase history |
| `steamarchivist.com/*` | Auto-acquire a linking token when you're logged in |
| `storage` | Store the linking token in session storage (cleared on browser close) |
| `management` | Offer self-uninstall after export completes |

## Building From Source

Prerequisites: Node.js 18+ and pnpm.

```bash
pnpm install
pnpm build              # Chrome (MV3)
pnpm build:firefox      # Firefox (MV2)
```

Output goes to `.output/chrome-mv3/` or `.output/firefox-mv2/`.

To load unpacked in Chrome: `chrome://extensions` → Enable Developer Mode → Load Unpacked → select `.output/chrome-mv3/`.

## Development

```bash
pnpm dev                # Chrome dev mode with hot reload
pnpm dev:firefox        # Firefox dev mode
pnpm test               # Run tests
pnpm lint               # Lint
```

## Testing

```bash
pnpm test
```

Tests cover HTML parsing, CSV generation, formula injection prevention, and pagination cursor extraction.

## License

MIT — see [LICENSE](LICENSE).
