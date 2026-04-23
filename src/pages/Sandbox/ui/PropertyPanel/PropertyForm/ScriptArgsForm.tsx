import { useState } from 'react';
import type { ScriptArgValues } from '../../../game/scripts/ScriptContract';
import { getRuntimeType } from '../../../game/utils/functionParser';
import { InputPrimitive } from '../../Primitive/Input/InputPrimitive';
import { CheckboxPrimitive } from '../../Primitive/Checkbox/CheckboxPrimitive';
import { AccordionPrimitive } from '../../Primitive/Accordion/AccordionPrimitive';

interface ScriptArgsFormProps {
  params:  string[];
  values:  ScriptArgValues;
  onApply: (args: ScriptArgValues) => void;
}

export function ScriptArgsForm({ params, values, onApply }: ScriptArgsFormProps) {
  const [localValues, setLocalValues] = useState<ScriptArgValues>(() => {
    const initial: ScriptArgValues = {};
    for (const param of params) {
      const runtimeType = getRuntimeType(param);
      initial[param] = values[param] ?? (runtimeType === 'boolean' ? false : runtimeType === 'number' ? 0 : '');
    }
    return initial;
  });

  if (params.length === 0) return null;

  function applyAll(updated: ScriptArgValues): void {
    onApply(updated);
  }

  function handleChange(param: string, value: string | number | boolean): void {
    const updated = { ...localValues, [param]: value };
    setLocalValues(updated);
    const runtimeType = getRuntimeType(param);
    if (runtimeType === 'boolean') applyAll(updated);
  }

  function handleApply(): void {
    applyAll(localValues);
  }

  return (
    <AccordionPrimitive title="Script Args">
      {params.map((param) => {
        const runtimeType = getRuntimeType(param);
        const label = param.split('_')[0];

        if (runtimeType === 'boolean') {
          return (
            <div key={param} className="prop-row">
              <CheckboxPrimitive
                label={label}
                checked={Boolean(localValues[param])}
                onChange={(checked) => handleChange(param, checked)}
              />
            </div>
          );
        }

        return (
          <div key={param} className="prop-row">
            <InputPrimitive
              type={runtimeType === 'number' ? 'number' : 'text'}
              label={label}
              value={String(localValues[param] ?? '')}
              onChange={(value) => handleChange(param, runtimeType === 'number' ? Number(value) : value)}
              onApply={handleApply}
            />
          </div>
        );
      })}
    </AccordionPrimitive>
  );
}
