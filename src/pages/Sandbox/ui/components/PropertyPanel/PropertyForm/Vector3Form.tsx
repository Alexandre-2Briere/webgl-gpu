import { forwardRef, useImperativeHandle, useState } from 'react';
import { safeParseFloat } from '@engine';
import { AccordionPrimitive } from '@components/Primitive/Accordion/AccordionPrimitive';
import { InputPrimitive } from '@components/Primitive/Input/InputPrimitive';

export interface Vector3FormHandle {
  setValues(a: number, b: number, c: number): void;
}

interface Vector3FormProps {
  label:         string;
  initialValues: [number, number, number];
  axisLabels:    [string, string, string];
  precision:     number;
  transform:     (value: number) => number;
  onApply:       (a: number, b: number, c: number) => void;
}

export const Vector3Form = forwardRef<Vector3FormHandle, Vector3FormProps>(
  function Vector3Form({ label, initialValues, axisLabels, precision, transform, onApply }, ref) {
    const [aValue, setAValue] = useState(initialValues[0].toFixed(precision));
    const [bValue, setBValue] = useState(initialValues[1].toFixed(precision));
    const [cValue, setCValue] = useState(initialValues[2].toFixed(precision));

    useImperativeHandle(ref, () => ({
      setValues(a, b, c) {
        setAValue(a.toFixed(precision));
        setBValue(b.toFixed(precision));
        setCValue(c.toFixed(precision));
      },
    }), [precision]);

    function apply(): void {
      onApply(
        transform(safeParseFloat(aValue, initialValues[0])),
        transform(safeParseFloat(bValue, initialValues[1])),
        transform(safeParseFloat(cValue, initialValues[2])),
      );
    }

    return (
      <AccordionPrimitive title={label}>
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
      </AccordionPrimitive>
    );
  },
);
