import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractInitialCursor } from '../src/lib/paginator';

describe('extractInitialCursor', () => {
  let addedScripts: HTMLScriptElement[] = [];

  /**
   * Insert a script element without jsdom executing it.
   * We set type="text/plain" first, set the content, append to DOM,
   * then remove the type — extractInitialCursor queries script:not([src])
   * which still matches. The key is jsdom only executes type="text/javascript"
   * or no-type scripts, so text/plain is inert.
   *
   * Since our parser reads textContent (not evaluates), this works fine.
   */
  function addInertScript(content: string): HTMLScriptElement {
    const script = document.createElement('script');
    script.type = 'text/plain';
    script.textContent = content;
    document.head.appendChild(script);
    addedScripts.push(script);
    return script;
  }

  afterEach(() => {
    for (const s of addedScripts) {
      s.parentNode?.removeChild(s);
    }
    addedScripts = [];
  });

  it('extracts cursor from inline script', () => {
    // Our selector is script:not([src]) — type=text/plain still matches
    addInertScript(`
      var g_historyCursor = {"wallet_txnid":"1234567890","timestamp_newest":1700000000,"balance":"0","currency":1};
    `);

    const cursor = extractInitialCursor();
    expect(cursor).not.toBeNull();

    const parsed = JSON.parse(cursor!);
    expect(parsed.wallet_txnid).toBe('1234567890');
    expect(parsed.timestamp_newest).toBe(1700000000);
  });

  it('returns null when no cursor script exists', () => {
    expect(extractInitialCursor()).toBeNull();
  });

  it('handles malformed JSON gracefully', () => {
    addInertScript('var g_historyCursor = {broken json');
    expect(extractInitialCursor()).toBeNull();
  });
});
