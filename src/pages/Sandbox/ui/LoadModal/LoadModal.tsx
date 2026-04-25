import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { SANDBOX_EVENTS, type PubSubManager } from '../../game/events';

interface LoadModalProps {
  pubSub: PubSubManager;
}

export function LoadModal({ pubSub }: LoadModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue]   = useState('');

  useEffect(() => {
    const onLoad = () => {
      setValue('');
      setIsOpen(true);
    };
    pubSub.subscribe(SANDBOX_EVENTS.TOOLBAR_LOAD, onLoad);
    return () => pubSub.unsubscribe(SANDBOX_EVENTS.TOOLBAR_LOAD, onLoad);
  }, [pubSub]);

  function handleClose(): void {
    setIsOpen(false);
  }

  function handleLoad(): void {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      pubSub.publish(SANDBOX_EVENTS.SCENE_LOAD_REQUESTED, { encodedString: trimmed });
    }
    handleClose();
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} PaperProps={{ sx: { minWidth: 440 } }}>
      <DialogTitle className="load-modal-title">Load Scene</DialogTitle>
      <DialogContent>
        <TextField
          multiline
          minRows={4}
          fullWidth
          placeholder="Paste encoded scene string here…"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="load-modal-textarea"
          variant="outlined"
          size="small"
        />
      </DialogContent>
      <DialogActions className="load-modal-actions">
        <Button onClick={handleClose} className="load-modal-cancel">Cancel</Button>
        <Button onClick={handleLoad} variant="contained" className="load-modal-confirm">
          Load
        </Button>
      </DialogActions>
    </Dialog>
  );
}
