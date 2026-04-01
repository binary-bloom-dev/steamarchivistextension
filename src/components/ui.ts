/**
 * DOM injection for the export button, progress bar, and status messages.
 * All elements use the `sa-ext-` prefix to avoid collisions with Steam's styles.
 */

const PREFIX = 'sa-ext';

function injectStyles(): void {
  if (document.getElementById(`${PREFIX}-styles`)) return;

  const style = document.createElement('style');
  style.id = `${PREFIX}-styles`;
  style.textContent = `
    .${PREFIX}-container {
      margin: 16px 0;
      font-family: "Motiva Sans", Arial, Helvetica, sans-serif;
    }

    .${PREFIX}-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: linear-gradient(to right, #47bfff 0%, #1a44c2 60%);
      color: #fff;
      border: none;
      border-radius: 2px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: filter 0.15s;
    }

    .${PREFIX}-button:hover:not(:disabled) {
      filter: brightness(1.15);
    }

    .${PREFIX}-button:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .${PREFIX}-progress {
      margin-top: 12px;
      display: none;
    }

    .${PREFIX}-progress.active {
      display: block;
    }

    .${PREFIX}-progress-bar {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }

    .${PREFIX}-progress-fill {
      height: 100%;
      background: linear-gradient(to right, #47bfff, #1a44c2);
      transition: width 0.3s ease;
      width: 0%;
    }

    .${PREFIX}-progress-text {
      margin-top: 6px;
      font-size: 12px;
      color: #8f98a0;
    }

    .${PREFIX}-status {
      margin-top: 10px;
      font-size: 13px;
      padding: 8px 12px;
      border-radius: 2px;
      display: none;
    }

    .${PREFIX}-status.success {
      display: block;
      background: rgba(76, 175, 80, 0.15);
      color: #81c784;
    }

    .${PREFIX}-status.error {
      display: block;
      background: rgba(244, 67, 54, 0.15);
      color: #ef9a9a;
    }

    .${PREFIX}-status.warning {
      display: block;
      background: rgba(255, 152, 0, 0.15);
      color: #ffcc02;
    }
  `;

  document.head.appendChild(style);
}

export interface ExportUI {
  container: HTMLElement;
  button: HTMLButtonElement;
  setProgress(page: number, count: number): void;
  setStatus(type: 'success' | 'error' | 'warning', message: string): void;
  setButtonEnabled(enabled: boolean): void;
  setButtonText(text: string): void;
}

/**
 * Inject the export UI into the Steam purchase history page.
 * Placed near the top of the history table for visibility.
 */
export function injectExportUI(onClick: () => void): ExportUI {
  injectStyles();

  const container = document.createElement('div');
  container.className = `${PREFIX}-container`;
  container.id = `${PREFIX}-root`;

  const button = document.createElement('button');
  button.className = `${PREFIX}-button`;
  button.textContent = 'Export Full History to SteamArchivist';
  button.addEventListener('click', onClick);

  const progress = document.createElement('div');
  progress.className = `${PREFIX}-progress`;

  const progressBar = document.createElement('div');
  progressBar.className = `${PREFIX}-progress-bar`;

  const progressFill = document.createElement('div');
  progressFill.className = `${PREFIX}-progress-fill`;

  const progressText = document.createElement('div');
  progressText.className = `${PREFIX}-progress-text`;

  progressBar.appendChild(progressFill);
  progress.appendChild(progressBar);
  progress.appendChild(progressText);

  const status = document.createElement('div');
  status.className = `${PREFIX}-status`;

  container.appendChild(button);
  container.appendChild(progress);
  container.appendChild(status);

  // Insert before the transaction table
  const table = document.querySelector('.wallet_history_table, .account_table');
  if (table?.parentElement) {
    table.parentElement.insertBefore(container, table);
  } else {
    // Fallback: append to main content area
    const content = document.querySelector('#main_content, .account_history');
    content?.prepend(container);
  }

  return {
    container,
    button,

    setProgress(page: number, count: number) {
      progress.classList.add('active');
      progressText.textContent = `Loading page ${page}... (${count} transactions found)`;
      // Indeterminate-style — pulse between 20-80% since we don't know total pages
      const width = Math.min(20 + (page * 5), 90);
      progressFill.style.width = `${width}%`;
    },

    setStatus(type: 'success' | 'error' | 'warning', message: string) {
      progress.classList.remove('active');
      progressFill.style.width = '100%';
      status.className = `${PREFIX}-status ${type}`;
      status.textContent = message;
    },

    setButtonEnabled(enabled: boolean) {
      button.disabled = !enabled;
    },

    setButtonText(text: string) {
      button.textContent = text;
    },
  };
}
