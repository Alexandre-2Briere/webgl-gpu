import { forwardRef, useImperativeHandle, useRef } from 'react';
import { OutlinedInput } from '@mui/material';
import { safeParseFloat } from '@engine';

export interface ScaleFormHandle {
  setValues(x: number, y: number, z: number): void;
}

interface ScaleFormProps {
  onApply: (x: number, y: number, z: number) => void;
}

export const ScaleForm = forwardRef<ScaleFormHandle, ScaleFormProps>(
  function ScaleForm({ onApply }, ref) {
    const scaleXRef = useRef<HTMLInputElement>(null);
    const scaleYRef = useRef<HTMLInputElement>(null);
    const scaleZRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      setValues(x, y, z) {
        if (scaleXRef.current) scaleXRef.current.value = x.toFixed(3);
        if (scaleYRef.current) scaleYRef.current.value = y.toFixed(3);
        if (scaleZRef.current) scaleZRef.current.value = z.toFixed(3);
      },
    }), []);

    function apply(): void {
      const x = safeParseFloat(scaleXRef.current?.value ?? '1', 1);
      const y = safeParseFloat(scaleYRef.current?.value ?? '1', 1);
      const z = safeParseFloat(scaleZRef.current?.value ?? '1', 1);
      onApply(x, y, z);
    }

    return (
      <div id="prop-section-scale" className="prop-section">
        <div className="prop-section-label">Scale</div>
        {[
          { label: 'X', inputRef: scaleXRef },
          { label: 'Y', inputRef: scaleYRef },
          { label: 'Z', inputRef: scaleZRef },
        ].map(({ label, inputRef }) => (
          <div key={label} className="prop-row">
            <span className="prop-axis-label">{label}</span>
            <OutlinedInput
              type="number"
              inputProps={{ step: 0.1, ref: inputRef }}
              size="small"
              defaultValue="1"
              onBlur={apply}
              onKeyDown={(event) => { if (event.key === 'Enter') apply(); }}
            />
          </div>
        ))}
      </div>
    );
  },
);
