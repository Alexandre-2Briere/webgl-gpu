import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { AppBar, Button, Toolbar as MuiToolbar, Typography } from '@mui/material';

export interface ToolbarHandle {
  setPlaying(playing: boolean): void;
  setEnabled(enabled: boolean): void;
  setOnPlay(fn: () => void): void;
  setOnStop(fn: () => void): void;
  setOnSave(fn: () => Promise<void>): void;
  setOnLoad(fn: () => void): void;
}

export const Toolbar = forwardRef<ToolbarHandle>(function Toolbar(_, ref) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  const onPlayRef = useRef<(() => void) | null>(null);
  const onStopRef = useRef<(() => void) | null>(null);
  const onSaveRef = useRef<(() => Promise<void>) | null>(null);
  const onLoadRef = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({
    setPlaying: setIsPlaying,
    setEnabled: setIsEnabled,
    setOnPlay:  (fn) => { onPlayRef.current  = fn; },
    setOnStop:  (fn) => { onStopRef.current  = fn; },
    setOnSave:  (fn) => { onSaveRef.current  = fn; },
    setOnLoad:  (fn) => { onLoadRef.current  = fn; },
  }), []);

  function handlePlayStop(): void {
    if (isPlaying) {
      onStopRef.current?.();
      setIsPlaying(false);
    } else {
      onPlayRef.current?.();
      setIsPlaying(true);
    }
  }

  return (
    <AppBar position="static" color="default" elevation={0} className="sandbox-toolbar">
      <MuiToolbar variant="dense" disableGutters className="sandbox-toolbar-inner">
        <Typography variant="subtitle1" className="sandbox-toolbar-title" aria-hidden="true">
          WebGPU Sandbox
        </Typography>
        <h1 className="sr-only">WebGPU Sandbox — 3D scene editor</h1>
        <p className="sr-only">
          This application is a WebGPU canvas-based 3D editor.
          It is not designed for screen readers or keyboard navigation.
        </p>
        <Button
          id="play-btn"
          variant="contained"
          color={isPlaying ? 'error' : 'success'}
          size="small"
          disabled={!isEnabled}
          onClick={handlePlayStop}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </Button>
        <Button
          variant="outlined"
          size="small"
          disabled={!isEnabled}
          onClick={() => { onSaveRef.current?.(); }}
        >
          Save
        </Button>
        <Button
          variant="outlined"
          size="small"
          disabled={!isEnabled}
          onClick={() => { onLoadRef.current?.(); }}
        >
          Load
        </Button>
      </MuiToolbar>
    </AppBar>
  );
});
