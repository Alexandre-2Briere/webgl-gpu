import './ResizeDivider.css';
import { useEffect, useRef, useState } from 'react';
import { SANDBOX_EVENTS, type PubSubManager } from '../../game/events';

interface ResizeDividerProps {
  direction: 'horizontal' | 'vertical';
  onResize:  (delta: number) => void;
  pubSub:    PubSubManager;
}

export function ResizeDivider({ direction, onResize, pubSub }: ResizeDividerProps) {
  const dragOriginRef  = useRef<number>(0);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    const onDragStarted = () => setDisabled(true);
    const onDragEnded   = () => setDisabled(false);
    pubSub.subscribe(SANDBOX_EVENTS.CAMERA_DRAG_STARTED, onDragStarted);
    pubSub.subscribe(SANDBOX_EVENTS.CAMERA_DRAG_ENDED,   onDragEnded);
    return () => {
      pubSub.unsubscribe(SANDBOX_EVENTS.CAMERA_DRAG_STARTED, onDragStarted);
      pubSub.unsubscribe(SANDBOX_EVENTS.CAMERA_DRAG_ENDED,   onDragEnded);
    };
  }, [pubSub]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOriginRef.current = direction === 'horizontal' ? event.clientY : event.clientX;
    pubSub.publish(SANDBOX_EVENTS.UI_RESIZE_STARTED);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const currentPosition = direction === 'horizontal' ? event.clientY : event.clientX;
    const delta = currentPosition - dragOriginRef.current;
    dragOriginRef.current = currentPosition;
    onResize(delta);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    pubSub.publish(SANDBOX_EVENTS.UI_RESIZE_ENDED);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div
      className={`resize-divider resize-divider--${direction}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
