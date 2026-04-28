import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, IconButton, List, ListItem, ListItemText, TextField } from '@mui/material';
import {
  SANDBOX_EVENTS,
  type PubSubManager,
  type HierarchyRowAddedPayload,
  type HierarchyRowRemovedPayload,
  type HierarchyRowSelectedPayload,
  type HierarchyRowRenamedPayload,
} from '../../../game/events';

const SINGLETON_KEYS = new Set(['Skybox', 'InfiniteGround']);
import './SceneHierarchy.css';

const NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9]*$/;

interface RowData {
  name: string;
  key: string;
}

interface SceneHierarchyProps {
  pubSub: PubSubManager;
}

export function SceneHierarchyComponent({ pubSub }: SceneHierarchyProps) {
  const [rows, setRows]                   = useState<RowData[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue]     = useState('');
  const [renameInvalid, setRenameInvalid] = useState(false);
  const [clipboardIndex, setClipboardIndex] = useState<number | null>(null);

  const pubSubRef = useRef(pubSub);
  useLayoutEffect(() => { pubSubRef.current = pubSub; });

  useEffect(() => {
    const onRowAdded = (raw: unknown) => {
      const { name, key } = raw as HierarchyRowAddedPayload;
      setRows((previous) => [...previous, { name, key }]);
    };

    const onRowRemoved = (raw: unknown) => {
      const { index } = raw as HierarchyRowRemovedPayload;
      setRows((previous) => previous.filter((_, rowIndex) => rowIndex !== index));
      setSelectedIndex((previous) => {
        if (previous === index)  return -1;
        if (previous > index)    return previous - 1;
        return previous;
      });
      setClipboardIndex((previous) => {
        if (previous === null)    return null;
        if (previous === index)   return null;
        if (previous > index)     return previous - 1;
        return previous;
      });
    };

    const onRowSelected = (raw: unknown) => {
      const { index } = raw as HierarchyRowSelectedPayload;
      setSelectedIndex(index);
    };

    const onRowRenamed = (raw: unknown) => {
      const { index, name } = raw as HierarchyRowRenamedPayload;
      setRows((previous) =>
        previous.map((row, rowIndex) => rowIndex === index ? { ...row, name } : row),
      );
    };

    pubSub.subscribe(SANDBOX_EVENTS.HIERARCHY_ROW_ADDED,   onRowAdded);
    pubSub.subscribe(SANDBOX_EVENTS.HIERARCHY_ROW_REMOVED, onRowRemoved);
    pubSub.subscribe(SANDBOX_EVENTS.HIERARCHY_ROW_SELECTED, onRowSelected);
    pubSub.subscribe(SANDBOX_EVENTS.HIERARCHY_ROW_RENAMED, onRowRenamed);

    return () => {
      pubSub.unsubscribe(SANDBOX_EVENTS.HIERARCHY_ROW_ADDED,   onRowAdded);
      pubSub.unsubscribe(SANDBOX_EVENTS.HIERARCHY_ROW_REMOVED, onRowRemoved);
      pubSub.unsubscribe(SANDBOX_EVENTS.HIERARCHY_ROW_SELECTED, onRowSelected);
      pubSub.unsubscribe(SANDBOX_EVENTS.HIERARCHY_ROW_RENAMED, onRowRenamed);
    };
  }, [pubSub]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;

      if (event.key === 'c' || event.key === 'C') {
        if (selectedIndex === -1) return;
        const row = rows[selectedIndex];
        if (!row || SINGLETON_KEYS.has(row.key)) return;
        setClipboardIndex(selectedIndex);
        event.preventDefault();
        return;
      }
      if (event.key === 'v' || event.key === 'V') {
        if (clipboardIndex === null) return;
        const row = rows[clipboardIndex];
        if (!row || SINGLETON_KEYS.has(row.key)) return;
        pubSubRef.current.publish(SANDBOX_EVENTS.HIERARCHY_OBJECT_DUPLICATE, { index: clipboardIndex });
        event.preventDefault();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [selectedIndex, clipboardIndex, rows]);

  function handleRowClick(index: number): void {
    setSelectedIndex(index);
    pubSubRef.current.publish(SANDBOX_EVENTS.HIERARCHY_OBJECT_SELECTED, { index });
  }

  function handleRowDoubleClick(): void {
    setSelectedIndex(-1);
    pubSubRef.current.publish(SANDBOX_EVENTS.HIERARCHY_OBJECT_DESELECTED);
  }

  function beginRename(index: number, currentName: string): void {
    setRenamingIndex(index);
    setRenameValue(currentName);
    setRenameInvalid(false);
  }

  function commitRename(): void {
    if (renamingIndex === null) return;
    const trimmed = renameValue.trim();
    if (!NAME_REGEX.test(trimmed)) {
      setRenameInvalid(true);
      setTimeout(() => setRenameInvalid(false), 600);
      return;
    }
    setRows((previous) =>
      previous.map((row, index) => index === renamingIndex ? { ...row, name: trimmed } : row),
    );
    pubSubRef.current.publish(SANDBOX_EVENTS.HIERARCHY_OBJECT_RENAMED, { index: renamingIndex, name: trimmed });
    setRenamingIndex(null);
  }

  function cancelRename(): void {
    setRenamingIndex(null);
  }

  return (
    <aside id="scene-hierarchy">
      <List id="scene-list" dense disablePadding>
        {rows.map((row, index) => (
          <ListItem
            key={index}
            data-index={index}
            className={`hier-row${selectedIndex === index ? ' selected' : ''}`}
            disablePadding
            secondaryAction={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {!SINGLETON_KEYS.has(row.key) && (
                  <IconButton
                    sx={{ width: '32px', height: '32px' }}
                    size="small"
                    className="hier-duplicate"
                    title="Duplicate"
                    onClick={(event) => { event.stopPropagation(); pubSubRef.current.publish(SANDBOX_EVENTS.HIERARCHY_OBJECT_DUPLICATE, { index }); }}
                  >
                    ⧉
                  </IconButton>
                )}
                <IconButton
                  sx={{ width: '32px', height: '32px' }}
                  size="small"
                  className="hier-remove"
                  title="Remove"
                  onClick={(event) => { event.stopPropagation(); pubSubRef.current.publish(SANDBOX_EVENTS.HIERARCHY_OBJECT_REMOVED, { index }); }}
                >
                  ×
                </IconButton>
              </Box>
            }
            onClick={() => handleRowClick(index)}
            onDoubleClick={handleRowDoubleClick}
          >
            {renamingIndex === index ? (
              <TextField
                autoFocus
                size="small"
                value={renameValue}
                error={renameInvalid}
                className={`hier-rename-input${renameInvalid ? ' sb-input--invalid' : ''}`}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter')  { event.preventDefault(); commitRename(); }
                  if (event.key === 'Escape') { event.preventDefault(); cancelRename(); }
                }}
                onBlur={cancelRename}
                onClick={(event) => event.stopPropagation()}
                slotProps={{ htmlInput: { spellCheck: false } }}
              />
            ) : (
              <ListItemText
                primary={row.name}
                className="hier-name"
                onDoubleClick={(event) => { event.stopPropagation(); beginRename(index, row.name); }}
              />
            )}
          </ListItem>
        ))}
      </List>
    </aside>
  );
}
