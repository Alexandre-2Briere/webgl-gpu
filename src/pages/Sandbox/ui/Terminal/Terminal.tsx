import { forwardRef, useImperativeHandle, useReducer, useRef } from 'react';
import { Tab, Tabs } from '@mui/material';
import './Terminal.css';

type LogLevel = 'log' | 'warn' | 'error';

interface LogEntry {
  time:  string;
  text:  string;
  level: LogLevel;
}

interface TabEntry {
  id:    string;
  label: string;
}

interface TerminalState {
  tabs:        TabEntry[];
  entries:     Map<string, LogEntry[]>;
  activeTabId: string;
}

type TerminalAction =
  | { type: 'ADD_TAB';      tabId: string; label: string }
  | { type: 'ACTIVATE_TAB'; tabId: string }
  | { type: 'APPEND_ENTRY'; tabId: string; entry: LogEntry }
  | { type: 'CLEAR_TAB';    tabId: string };

function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case 'ADD_TAB': {
      const newEntries = new Map(state.entries);
      newEntries.set(action.tabId, []);
      return {
        ...state,
        tabs:    [...state.tabs, { id: action.tabId, label: action.label }],
        entries: newEntries,
      };
    }
    case 'ACTIVATE_TAB':
      return { ...state, activeTabId: action.tabId };
    case 'APPEND_ENTRY': {
      const current = state.entries.get(action.tabId) ?? [];
      const capped  = current.length >= 500 ? current.slice(1) : current;
      const newEntries = new Map(state.entries);
      newEntries.set(action.tabId, [...capped, action.entry]);
      return { ...state, entries: newEntries };
    }
    case 'CLEAR_TAB': {
      const newEntries = new Map(state.entries);
      newEntries.set(action.tabId, []);
      return { ...state, entries: newEntries };
    }
    default:
      return state;
  }
}

const INITIAL_STATE: TerminalState = {
  tabs:        [{ id: 'console', label: 'Console' }],
  entries:     new Map([['console', []]]),
  activeTabId: 'console',
};

// ── Exported handle type (named Terminal so SceneManager import type works) ──
export interface Terminal {
  print(text: string, level?: LogLevel, tabId?: string): void;
  clear(tabId?: string): void;
  addTab(tabId: string, label: string): void;
  activateTab(tabId: string): void;
  restoreConsole(): void;
}

export const TerminalComponent = forwardRef<Terminal>(function TerminalComponent(_, ref) {
  const [state, dispatch] = useReducer(terminalReducer, INITIAL_STATE);

  // Keep stale-closure-safe refs for the imperative API
  const stateRef      = useRef(state);
  stateRef.current    = state;

  const originalLogRef   = useRef(console.log.bind(console));
  const originalWarnRef  = useRef(console.warn.bind(console));
  const originalErrorRef = useRef(console.error.bind(console));
  const interceptedRef   = useRef(false);

  function _now(): string {
    return new Date().toTimeString().slice(0, 8);
  }

  function print(text: string, level: LogLevel = 'log', tabId?: string): void {
    const targetTabId = tabId ?? stateRef.current.activeTabId;
    dispatch({ type: 'APPEND_ENTRY', tabId: targetTabId, entry: { time: _now(), text, level } });
  }

  function clear(tabId?: string): void {
    const targetTabId = tabId ?? stateRef.current.activeTabId;
    dispatch({ type: 'CLEAR_TAB', tabId: targetTabId });
  }

  function addTab(tabId: string, label: string): void {
    dispatch({ type: 'ADD_TAB', tabId, label });
  }

  function activateTab(tabId: string): void {
    dispatch({ type: 'ACTIVATE_TAB', tabId });
  }

  function interceptConsole(): void {
    if (interceptedRef.current) return;
    interceptedRef.current = true;
    originalLogRef.current   = console.log.bind(console);
    originalWarnRef.current  = console.warn.bind(console);
    originalErrorRef.current = console.error.bind(console);
    console.log = (...args: unknown[]) => {
      originalLogRef.current(...args);
      print(args.map(String).join(' '), 'log', 'console');
    };
    console.warn = (...args: unknown[]) => {
      originalWarnRef.current(...args);
      print(args.map(String).join(' '), 'warn', 'console');
    };
    console.error = (...args: unknown[]) => {
      originalErrorRef.current(...args);
      print(args.map(String).join(' '), 'error', 'console');
    };
  }

  function restoreConsole(): void {
    console.log   = originalLogRef.current;
    console.warn  = originalWarnRef.current;
    console.error = originalErrorRef.current;
    interceptedRef.current = false;
  }

  interceptConsole();

  useImperativeHandle(ref, () => ({ print, clear, addTab, activateTab, restoreConsole }), []);

  const activeEntries = state.entries.get(state.activeTabId) ?? [];

  const LOG_COLOR: Record<LogLevel, string> = { log: '', warn: '#e8c547', error: '#e84747' };

  return (
    <div id="terminal-panel">
      <h2 className="sr-only">Console</h2>
      <Tabs
        id="terminal-tabs"
        value={state.activeTabId}
        onChange={(_, newTabId: string) => activateTab(newTabId)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {state.tabs.map((tab) => (
          <Tab key={tab.id} value={tab.id} label={tab.label} className="sb-btn-tab" />
        ))}
      </Tabs>
      <div id="terminal-output">
        <div className="terminal-tab-body active">
          {activeEntries.map((entry, index) => (
            <div
              key={index}
              className="log-entry"
              style={LOG_COLOR[entry.level] ? { color: LOG_COLOR[entry.level] } : undefined}
            >
              <span className="log-time">{entry.time}</span>
              {entry.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
