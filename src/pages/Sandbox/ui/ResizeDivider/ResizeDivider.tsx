import './ResizeDivider.css';
import { useRef } from 'react';

interface ResizeDividerProps {
  direction:    'horizontal' | 'vertical';
  onResize:     (delta: number) => void;
  onDragStart?: () => void;
  onDragEnd?:   () => void;
  disabled?:    boolean;
}

export function ResizeDivider({ direction, onResize, onDragStart, onDragEnd, disabled }: ResizeDividerProps) {
  const dragOriginRef = useRef<number>(0);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOriginRef.current = direction === 'horizontal' ? event.clientY : event.clientX;
    onDragStart?.();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const currentPosition = direction === 'horizontal' ? event.clientY : event.clientX;
    const delta = currentPosition - dragOriginRef.current;
    dragOriginRef.current = currentPosition;
    onResize(delta);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    onDragEnd?.();
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
