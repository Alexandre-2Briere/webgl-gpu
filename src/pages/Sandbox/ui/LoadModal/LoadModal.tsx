import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

export interface LoadModalHandle {
  open(onConfirm: (encodedString: string) => void): void;
}

export const LoadModal = forwardRef<LoadModalHandle>(function LoadModal(_, ref) {
  const [isOpen, setIsOpen]     = useState(false);
  const [value, setValue]       = useState('');
  const onConfirmRef            = useRef<((encodedString: string) => void) | null>(null);

  useImperativeHandle(ref, () => ({
    open(onConfirm) {
      onConfirmRef.current = onConfirm;
      setValue('');
      setIsOpen(true);
    },
  }), []);

  function handleClose(): void {
    setIsOpen(false);
    onConfirmRef.current = null;
  }

  function handleLoad(): void {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      onConfirmRef.current?.(trimmed);
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
});
