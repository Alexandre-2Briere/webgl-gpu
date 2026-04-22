import { SelectPrimitive } from '../../Primitive/Select/SelectPrimitive';
import { AccordionPrimitive } from '../../Primitive/Accordion/AccordionPrimitive';

interface ScriptFormProps {
  scriptNames:    string[];
  selectedScript: string;
  onChange:       (name: string) => void;
}

export function ScriptForm({ scriptNames, selectedScript, onChange }: ScriptFormProps) {
  const options = scriptNames.map((name) => ({ value: name, label: name }));

  return (
    <AccordionPrimitive title="Script">
      <div className="prop-row">
        <SelectPrimitive
          label="Script"
          labelId="script-select-label"
          value={selectedScript}
          options={options}
          onChange={onChange}
        />
      </div>
    </AccordionPrimitive>
  );
}
