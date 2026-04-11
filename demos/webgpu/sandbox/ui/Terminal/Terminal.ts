import './terminal.css';
import { createTabButton } from '../primitives/index';

type LogLevel = 'log' | 'warn' | 'error'

function _clone<T extends Element>(templateId: string, selector: string): T {
  const template = document.querySelector<HTMLTemplateElement>(templateId)!;
  return (template.content.cloneNode(true) as DocumentFragment).querySelector<T>(selector)!;
}

interface TerminalTab {
  button: HTMLButtonElement
  body:   HTMLDivElement
}

export class Terminal {
  private readonly _tabsContainer:   HTMLElement;
  private readonly _outputContainer: HTMLElement;

  private readonly _tabs = new Map<string, TerminalTab>();
  private _activeTabId = '';

  private _originalLog:   typeof console.log   = console.log.bind(console);
  private _originalWarn:  typeof console.warn  = console.warn.bind(console);
  private _originalError: typeof console.error = console.error.bind(console);

  constructor(tabsContainer: HTMLElement, outputContainer: HTMLElement) {
    this._tabsContainer   = tabsContainer;
    this._outputContainer = outputContainer;

    this.addTab('console', 'Console');
    this.activateTab('console');
    this.interceptConsole();
  }

  // ── Tab management ───────────────────────────────────────────────────────────

  addTab(tabId: string, label: string): HTMLElement {
    const button = createTabButton(label, () => this.activateTab(tabId));
    const body   = _clone<HTMLDivElement>('#terminal-tab-body-tpl', '.terminal-tab-body');

    this._tabsContainer.appendChild(button);
    this._outputContainer.appendChild(body);

    this._tabs.set(tabId, { button, body });
    return body;
  }

  activateTab(tabId: string): void {
    if (!this._tabs.has(tabId)) return;

    for (const [id, tab] of this._tabs) {
      const isActive = id === tabId;
      tab.button.classList.toggle('active', isActive);
      tab.body.classList.toggle('active', isActive);
    }
    this._activeTabId = tabId;
  }

  // ── Output ───────────────────────────────────────────────────────────────────

  print(text: string, level: LogLevel = 'log', tabId?: string): void {
    const targetTabId = tabId ?? this._activeTabId;
    const tab = this._tabs.get(targetTabId);
    if (!tab) return;

    const time = new Date().toTimeString().slice(0, 8);

    const entry = _clone<HTMLDivElement>('#log-entry-tpl', '.log-entry');
    entry.classList.add(`log-${level}`);
    entry.querySelector<HTMLElement>('.log-time')!.textContent = time;
    entry.appendChild(document.createTextNode(text));
    tab.body.appendChild(entry);

    // Cap at 500 entries
    if (tab.body.childElementCount > 500) {
      tab.body.firstElementChild?.remove();
    }

    // Auto-scroll only if this tab is active
    if (targetTabId === this._activeTabId) {
      this._outputContainer.scrollTop = this._outputContainer.scrollHeight;
    }
  }

  clear(tabId?: string): void {
    const targetTabId = tabId ?? this._activeTabId;
    const tab = this._tabs.get(targetTabId);
    if (tab) tab.body.innerHTML = '';
  }

  // ── Console intercept ────────────────────────────────────────────────────────

  interceptConsole(): void {
    this._originalLog   = console.log.bind(console);
    this._originalWarn  = console.warn.bind(console);
    this._originalError = console.error.bind(console);

    console.log = (...args: unknown[]) => {
      this._originalLog(...args);
      this.print(args.map(String).join(' '), 'log', 'console');
    };

    console.warn = (...args: unknown[]) => {
      this._originalWarn(...args);
      this.print(args.map(String).join(' '), 'warn', 'console');
    };

    console.error = (...args: unknown[]) => {
      this._originalError(...args);
      this.print(args.map(String).join(' '), 'error', 'console');
    };
  }

  restoreConsole(): void {
    console.log   = this._originalLog;
    console.warn  = this._originalWarn;
    console.error = this._originalError;
  }
}
