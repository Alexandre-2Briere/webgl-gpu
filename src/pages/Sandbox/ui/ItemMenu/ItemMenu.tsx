import { forwardRef, useImperativeHandle, useState } from 'react';
import { Chip, Divider, List, ListItemButton, Typography } from '@mui/material';
import type { ItemEntry, ItemRegistry } from '../../items/types';
import './ItemMenu.css';

export interface ItemMenuHandle {
  setEnabled(enabled: boolean): void;
}

interface ItemMenuProps {
  registry: ItemRegistry;
  onSpawn: (key: string, entry: ItemEntry) => void;
}

export const ItemMenu = forwardRef<ItemMenuHandle, ItemMenuProps>(
  function ItemMenu({ registry, onSpawn }, ref) {
    const [isEnabled, setIsEnabled] = useState(false);

    useImperativeHandle(ref, () => ({ setEnabled: setIsEnabled }), []);

    return (
      <aside id="item-menu">
        <List dense disablePadding>
          {Object.entries(registry).map(([sectionName, entries]) => (
            <li key={sectionName}>
              <Typography variant="caption" className="menu-section-label">
                {sectionName}
              </Typography>
              {entries.map((entry) => (
                <ListItemButton
                  key={entry.key}
                  disabled={!entry.isReady || !isEnabled}
                  onClick={() => onSpawn(entry.key, entry)}
                  className="sb-btn-sidebar"
                >
                  <span className="sb-btn-label">{entry.label}</span>
                  {!entry.isReady && (
                    <Chip label="soon" size="small" className="item-badge" />
                  )}
                </ListItemButton>
              ))}
            </li>
          ))}
          <Divider className='separator' variant="middle" component="li" />
        </List>
      </aside>
    );
  },
);
