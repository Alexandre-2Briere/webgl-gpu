import { forwardRef, useImperativeHandle, useRef } from 'react';
import { TextField } from '@mui/material';
import { safeParseFloat } from '@engine';

export interface PositionFormHandle {
  setValues(x: number, y: number, z: number): void;
}

interface PositionFormProps {
  onApply: (x: number, y: number, z: number) => void;
}

export const PositionForm = forwardRef<PositionFormHandle, PositionFormProps>(
  function PositionForm({ onApply }, ref) {
    const posXRef = useRef<HTMLInputElement>(null);
    const posYRef = useRef<HTMLInputElement>(null);
    const posZRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      setValues(x, y, z) {
        if (posXRef.current) posXRef.current.value = x.toFixed(3);
        if (posYRef.current) posYRef.current.value = y.toFixed(3);
        if (posZRef.current) posZRef.current.value = z.toFixed(3);
      },
    }), []);

    function apply(): void {
      const x = safeParseFloat(posXRef.current?.value ?? '0');
      const y = safeParseFloat(posYRef.current?.value ?? '0');
      const z = safeParseFloat(posZRef.current?.value ?? '0');
      onApply(x, y, z);
    }

    return (
      <div id="prop-section-position" className="prop-section">
        <div className="prop-section-label">Position</div>
        {[
          { label: 'X', inputRef: posXRef },
          { label: 'Y', inputRef: posYRef },
          { label: 'Z', inputRef: posZRef },
        ].map(({ label, inputRef }) => (
          <div key={label} className="prop-row">
            <span className="prop-axis-label">{label}</span>
            <TextField
              type="number"
              size="small"
              variant="standard"
              defaultValue="0"
              onBlur={apply}
              onKeyDown={(event) => { if (event.key === 'Enter') apply(); }}
            />
          </div>
        ))}
      </div>
    );
  },
);
