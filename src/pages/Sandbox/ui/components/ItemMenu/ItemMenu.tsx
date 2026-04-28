import { useEffect, useState } from 'react';
import { Chip, List, ListItemButton, Typography } from '@mui/material';
import type { ItemEntry, ItemRegistry } from '../../../items/types';
import { SANDBOX_EVENTS, type PubSubManager } from '../../../game/events';
import './ItemMenu.css';

interface ItemMenuProps {
  pubSub:   PubSubManager;
  registry: ItemRegistry;
}

export function ItemMenu({ pubSub, registry }: ItemMenuProps) {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const onInitialized = () => setIsEnabled(true);
    pubSub.subscribe(SANDBOX_EVENTS.ENGINE_INITIALIZED, onInitialized);
    return () => pubSub.unsubscribe(SANDBOX_EVENTS.ENGINE_INITIALIZED, onInitialized);
  }, [pubSub]);

  return (
    <aside id="item-menu">
      <List dense disablePadding>
        {Object.entries(registry).map(([sectionName, entries]) => (
          <li key={sectionName}>
            <Typography variant="caption" className="menu-section-label">
              {sectionName}
            </Typography>
            {entries.map((entry: ItemEntry) => (
              <ListItemButton
                key={entry.key}
                disabled={!entry.isReady || !isEnabled}
                onClick={() => pubSub.publish(SANDBOX_EVENTS.ITEM_SPAWN, { key: entry.key, entry })}
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
      </List>
    </aside>
  );
}
