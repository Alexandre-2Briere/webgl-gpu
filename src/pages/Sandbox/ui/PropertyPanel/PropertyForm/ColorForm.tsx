import { InputPrimitive } from '../../Primitive/Input/InputPrimitive';

interface ColorFormProps {
  colorHex: string;
  onChange: (hex: string) => void;
  onApply: (hex: string) => void;
}

export function ColorForm({ colorHex, onChange, onApply }: ColorFormProps) {
  return (
    <div id="prop-section-color" className="prop-section">
      <div className="prop-section-label">Color (hex)</div>
      <div className="prop-row">
        <InputPrimitive
          type="text"
          label="#"
          value={colorHex}
          onChange={(value) => onChange(value.toUpperCase())}
          onApply={() => onApply(colorHex)}
        />
      </div>
    </div>
  );
}
