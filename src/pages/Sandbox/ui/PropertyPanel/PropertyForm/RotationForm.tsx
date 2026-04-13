import { forwardRef, useImperativeHandle, useRef } from 'react';
import { TextField } from '@mui/material';
import { safeParseFloat } from '@engine';

const DEG = Math.PI / 180;

export interface RotationFormHandle {
  setValues(yawDeg: number, pitchDeg: number, rollDeg: number): void;
}

interface RotationFormProps {
  onApply: (yawRad: number, pitchRad: number, rollRad: number) => void;
}

export const RotationForm = forwardRef<RotationFormHandle, RotationFormProps>(
  function RotationForm({ onApply }, ref) {
    const rotYawRef   = useRef<HTMLInputElement>(null);
    const rotPitchRef = useRef<HTMLInputElement>(null);
    const rotRollRef  = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      setValues(yawDeg, pitchDeg, rollDeg) {
        if (rotYawRef.current)   rotYawRef.current.value   = yawDeg.toFixed(1);
        if (rotPitchRef.current) rotPitchRef.current.value = pitchDeg.toFixed(1);
        if (rotRollRef.current)  rotRollRef.current.value  = rollDeg.toFixed(1);
      },
    }), []);

    function apply(): void {
      const yawRad   = safeParseFloat(rotYawRef.current?.value   ?? '0') * DEG;
      const pitchRad = safeParseFloat(rotPitchRef.current?.value ?? '0') * DEG;
      const rollRad  = safeParseFloat(rotRollRef.current?.value  ?? '0') * DEG;
      onApply(yawRad, pitchRad, rollRad);
    }

    return (
      <div id="prop-section-rotation" className="prop-section">
        <div className="prop-section-label">Rotation (deg)</div>
        {[
          { label: 'Y', inputRef: rotYawRef },
          { label: 'P', inputRef: rotPitchRef },
          { label: 'R', inputRef: rotRollRef },
        ].map(({ label, inputRef }) => (
          <div key={label} className="prop-row">
            <span className="prop-axis-label">{label}</span>
            <TextField
              type="number"
              inputProps={{ step: 1, ref: inputRef }}
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
