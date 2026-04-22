import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { Tab, Tabs } from '@mui/material';
import { AccordionPrimitive } from '../Primitive/Accordion/AccordionPrimitive';
import './Terminal.css';

type LogLevel = 'log' | 'warn' | 'error';

interface LogEntry {
  time:   string;
  values: unknown[];
  level:  LogLevel;
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

// ── Value preview helpers ──────────────────────────────────────────────────

function previewPrimitive(value: unknown): string {
  if (value === null)      return 'null';
  if (value === undefined) return 'undefined';
  return String(value);
}

function previewValue(value: unknown): string {
  if (value === null || value === undefined || typeof value !== 'object') {
    return previewPrimitive(value);
  }
  if (Array.isArray(value)) {
    const preview = value.slice(0, 3).map(previewPrimitive).join(', ');
    return `Array(${value.length}) [ ${preview}${value.length > 3 ? ', …' : ''} ]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 3);
  const preview = entries.map(([key, val]) => `${key}: ${previewPrimitive(val)}`).join(', ');
  const full    = `{ ${preview}${Object.keys(value as object).length > 3 ? ', …' : ''} }`;
  return full.length > 60 ? full.slice(0, 57) + '…' : full;
}

// ── Recursive value renderer ───────────────────────────────────────────────

function LogValue({ value }: { value: unknown }): React.ReactElement {
  if (value === null || value === undefined || typeof value !== 'object') {
    return <span className="log-value-primitive">{previewPrimitive(value)}</span>;
  }

  if (Array.isArray(value)) {
    return (
      <AccordionPrimitive title={previewValue(value)}>
        <div className="log-value-children">
          {value.map((item, index) => (
            <div key={index} className="log-value-row">
              <span className="log-value-key">{index}:</span>
              <LogValue value={item} />
            </div>
          ))}
        </div>
      </AccordionPrimitive>
    );
  }

  const objectEntries = Object.entries(value as Record<string, unknown>);
  return (
    <AccordionPrimitive title={previewValue(value)}>
      <div className="log-value-children">
        {objectEntries.map(([key, val]) => (
          <div key={key} className="log-value-row">
            <span className="log-value-key">{key}:</span>
            <LogValue value={val} />
          </div>
        ))}
        {objectEntries.length === 0 && <span className="log-value-primitive">empty</span>}
      </div>
    </AccordionPrimitive>
  );
}

// ── Exported handle type (named Terminal so SceneManager import type works) ──
export interface Terminal {
  print(value: unknown, level?: LogLevel, tabId?: string): void;
  clear(tabId?: string): void;
  addTab(tabId: string, label: string): void;
  activateTab(tabId: string): void;
  restoreConsole(): void;
}

export const TerminalComponent = forwardRef<Terminal>(function TerminalComponent(_, ref) {
  const [state, dispatch] = useReducer(terminalReducer, INITIAL_STATE);

  const stateRef = useRef(state);
  useLayoutEffect(() => { stateRef.current = state; });

  const outputRef = useRef<HTMLDivElement>(null);

  const originalLogRef   = useRef(console.log.bind(console));
  const originalWarnRef  = useRef(console.warn.bind(console));
  const originalErrorRef = useRef(console.error.bind(console));
  const interceptedRef   = useRef(false);

  function _now(): string {
    return new Date().toTimeString().slice(0, 8);
  }

  const print = useCallback((value: unknown, level: LogLevel = 'log', tabId?: string): void => {
    const targetTabId = tabId ?? stateRef.current.activeTabId;
    dispatch({ type: 'APPEND_ENTRY', tabId: targetTabId, entry: { time: _now(), values: [value], level } });
  }, []);

  const clear = useCallback((tabId?: string): void => {
    const targetTabId = tabId ?? stateRef.current.activeTabId;
    dispatch({ type: 'CLEAR_TAB', tabId: targetTabId });
  }, []);

  const addTab = useCallback((tabId: string, label: string): void => {
    dispatch({ type: 'ADD_TAB', tabId, label });
  }, []);

  const activateTab = useCallback((tabId: string): void => {
    dispatch({ type: 'ACTIVATE_TAB', tabId });
  }, []);

  const interceptConsole = useCallback((): void => {
    if (interceptedRef.current) return;
    interceptedRef.current = true;
    originalLogRef.current   = console.log.bind(console);
    originalWarnRef.current  = console.warn.bind(console);
    originalErrorRef.current = console.error.bind(console);
    console.log = (...args: unknown[]) => {
      originalLogRef.current(...args);
      dispatch({ type: 'APPEND_ENTRY', tabId: 'console', entry: { time: _now(), values: args, level: 'log' } });
    };
    console.warn = (...args: unknown[]) => {
      originalWarnRef.current(...args);
      dispatch({ type: 'APPEND_ENTRY', tabId: 'console', entry: { time: _now(), values: args, level: 'warn' } });
    };
    console.error = (...args: unknown[]) => {
      originalErrorRef.current(...args);
      dispatch({ type: 'APPEND_ENTRY', tabId: 'console', entry: { time: _now(), values: args, level: 'error' } });
    };
  }, []);

  const restoreConsole = useCallback((): void => {
    console.log   = originalLogRef.current;
    console.warn  = originalWarnRef.current;
    console.error = originalErrorRef.current;
    interceptedRef.current = false;
  }, []);

  useEffect(() => {
    interceptConsole();
    return restoreConsole;
  }, [interceptConsole, restoreConsole]);

  const activeEntries = useMemo(
    () => state.entries.get(state.activeTabId) ?? [],
    [state.entries, state.activeTabId],
  );

  useEffect(() => {
    const element = outputRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [activeEntries]);

  useImperativeHandle(ref, () => ({ print, clear, addTab, activateTab, restoreConsole }), [print, clear, addTab, activateTab, restoreConsole]);

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
      <div id="terminal-output" ref={outputRef}>
        <div className="terminal-tab-body active">
          {activeEntries.map((entry, index) => (
            <div
              key={index}
              className="log-entry"
              style={LOG_COLOR[entry.level] ? { color: LOG_COLOR[entry.level] } : undefined}
            >
              <span className="log-time">{entry.time}</span>
              <span className="log-body">
                {entry.values.map((value, valueIndex) => (
                  <LogValue key={valueIndex} value={value} />
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
