import { forwardRef, useImperativeHandle, useState } from 'react';
import { safeParseFloat } from '@engine';
import { InputPrimitive } from '../../Primitive/Input/InputPrimitive';

export interface Vector3FormHandle {
  setValues(a: number, b: number, c: number): void;
}

interface Vector3FormProps {
  label:        string;
  sectionId:    string;
  defaultValue: number;
  axisLabels:   [string, string, string];
  precision:    number;
  transform:    (value: number) => number;
  onApply:      (a: number, b: number, c: number) => void;
}

export const Vector3Form = forwardRef<Vector3FormHandle, Vector3FormProps>(
  function Vector3Form({ label, sectionId, defaultValue, axisLabels, precision, transform, onApply }, ref) {
    const [aValue, setAValue] = useState(String(defaultValue));
    const [bValue, setBValue] = useState(String(defaultValue));
    const [cValue, setCValue] = useState(String(defaultValue));

    useImperativeHandle(ref, () => ({
      setValues(a, b, c) {
        setAValue(a.toFixed(precision));
        setBValue(b.toFixed(precision));
        setCValue(c.toFixed(precision));
      },
    }), [precision]);

    function apply(): void {
      onApply(
        transform(safeParseFloat(aValue, defaultValue)),
        transform(safeParseFloat(bValue, defaultValue)),
        transform(safeParseFloat(cValue, defaultValue)),
      );
    }

    return (
      <div id={sectionId} className="prop-section">
        <div className="prop-section-label">{label}</div>
        {[
          { label: axisLabels[0], value: aValue, onChange: setAValue },
          { label: axisLabels[1], value: bValue, onChange: setBValue },
          { label: axisLabels[2], value: cValue, onChange: setCValue },
        ].map(({ label: axisLabel, value, onChange }) => (
          <div key={axisLabel} className="prop-row">
            <InputPrimitive
              type="number"
              label={axisLabel}
              value={value}
              onChange={onChange}
              onApply={apply}
            />
          </div>
        ))}
      </div>
    );
  },
);
