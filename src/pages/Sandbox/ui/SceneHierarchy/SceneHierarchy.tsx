import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { IconButton, List, ListItem, ListItemText, TextField } from '@mui/material';
import './SceneHierarchy.css';

const NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9]*$/;

interface RowData {
  name: string;
}

export interface SceneHierarchy {
  addObject(name: string): void;
  removeRow(index: number): void;
  setSelected(index: number): void;
  renameRow(index: number, name: string): void;
}

interface SceneHierarchyProps {
  onSelect:   (index: number) => void;
  onRename:   (index: number, newName: string) => boolean;
  onRemove:   (index: number) => void;
  onDeselect?: () => void;
}

export const SceneHierarchyComponent = forwardRef<SceneHierarchy, SceneHierarchyProps>(
  function SceneHierarchyComponent({ onSelect, onRename, onRemove, onDeselect }, ref) {
    const [rows, setRows]                   = useState<RowData[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
    const [renameValue, setRenameValue]     = useState('');
    const [renameInvalid, setRenameInvalid] = useState(false);

    // Keep stale-closure-safe ref for callbacks
    const onSelectRef   = useRef(onSelect);
    const onRenameRef   = useRef(onRename);
    const onRemoveRef   = useRef(onRemove);
    const onDeselectRef = useRef(onDeselect);
    onSelectRef.current   = onSelect;
    onRenameRef.current   = onRename;
    onRemoveRef.current   = onRemove;
    onDeselectRef.current = onDeselect;

    useImperativeHandle(ref, () => ({
      addObject(name: string) {
        setRows((previous) => [...previous, { name }]);
      },
      removeRow(index: number) {
        setRows((previous) => previous.filter((_, rowIndex) => rowIndex !== index));
        setSelectedIndex((previous) => {
          if (previous === index)  return -1;
          if (previous > index)    return previous - 1;
          return previous;
        });
      },
      setSelected(index: number) {
        setSelectedIndex(index);
      },
      renameRow(index: number, name: string) {
        setRows((previous) =>
          previous.map((row, rowIndex) => rowIndex === index ? { ...row, name } : row),
        );
      },
    }), []);

    function handleRowClick(index: number): void {
      setSelectedIndex(index);
      onSelectRef.current(index);
    }

    function handleRowDoubleClick(): void {
      setSelectedIndex(-1);
      onDeselectRef.current?.();
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
      const success = onRenameRef.current(renamingIndex, trimmed);
      if (success) {
        setRows((previous) =>
          previous.map((row, index) => index === renamingIndex ? { ...row, name: trimmed } : row),
        );
      }
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
                <IconButton
                  size="small"
                  className="hier-remove"
                  title="Remove"
                  onClick={(event) => { event.stopPropagation(); onRemoveRef.current(index); }}
                >
                  ×
                </IconButton>
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
  },
);
