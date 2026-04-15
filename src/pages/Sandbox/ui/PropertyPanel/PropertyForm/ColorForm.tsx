import { InputPrimitive } from '../../Primitive/Input/InputPrimitive';
import { AccordionPrimitive } from '../../Primitive/Accordion/AccordionPrimitive';

interface ColorFormProps {
  colorHex: string;
  onChange: (hex: string) => void;
  onApply: (hex: string) => void;
}

export function ColorForm({ colorHex, onChange, onApply }: ColorFormProps) {
  return (
    <AccordionPrimitive title="Color (hex)">
      <div className="prop-row">
        <InputPrimitive
          type="text"
          label="#"
          value={colorHex}
          onChange={(value) => onChange(value.toUpperCase())}
          onApply={() => onApply(colorHex)}
        />
      </div>
    </AccordionPrimitive>
  );
}
