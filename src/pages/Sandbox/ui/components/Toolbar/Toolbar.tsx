import { useEffect, useState } from 'react';
import { AppBar, Button, Toolbar as MuiToolbar, Typography } from '@mui/material';
import { SANDBOX_EVENTS, type PubSubManager, type SceneSavedPayload } from '../../../game/events';
import "./Toolbar.css";

interface ToolbarProps {
  pubSub: PubSubManager;
}

export function Toolbar({ pubSub }: ToolbarProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const onPlayStopped = () => setIsPlaying(false);
    const onInitialized = () => setIsEnabled(true);
    const onSceneSaved  = async (raw: unknown) => {
      const { encodedString } = raw as SceneSavedPayload;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(encodedString);
        pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, { message: 'Scene saved — string copied to clipboard.', level: 'log' });
      } else {
        console.log(encodedString);
        pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, { message: 'Scene saved (see console for string).', level: 'log' });
      }
    };

    pubSub.subscribe(SANDBOX_EVENTS.PLAY_STOPPED,       onPlayStopped);
    pubSub.subscribe(SANDBOX_EVENTS.ENGINE_INITIALIZED, onInitialized);
    pubSub.subscribe(SANDBOX_EVENTS.SCENE_SAVED,        onSceneSaved);

    return () => {
      pubSub.unsubscribe(SANDBOX_EVENTS.PLAY_STOPPED,       onPlayStopped);
      pubSub.unsubscribe(SANDBOX_EVENTS.ENGINE_INITIALIZED, onInitialized);
      pubSub.unsubscribe(SANDBOX_EVENTS.SCENE_SAVED,        onSceneSaved);
    };
  }, [pubSub]);

  function handlePlayStop(): void {
    if (isPlaying) {
      pubSub.publish(SANDBOX_EVENTS.TOOLBAR_STOP);
      setIsPlaying(false);
    } else {
      pubSub.publish(SANDBOX_EVENTS.TOOLBAR_PLAY);
      setIsPlaying(true);
    }
    (document.activeElement as HTMLElement)?.blur();
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
        <div className='sandbox-toolbar-button-container'>
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
            onClick={() => pubSub.publish(SANDBOX_EVENTS.TOOLBAR_SAVE)}
          >
            Save
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={!isEnabled}
            onClick={() => pubSub.publish(SANDBOX_EVENTS.TOOLBAR_LOAD)}
          >
            Load
          </Button>
        </div>
      </MuiToolbar>
    </AppBar>
  );
}
