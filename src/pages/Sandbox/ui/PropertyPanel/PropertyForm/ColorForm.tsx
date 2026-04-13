import { TextField } from '@mui/material';

interface ColorFormProps {
  colorHex: string;
  onChange: (hex: string) => void;
  onApply:  (hex: string) => void;
}

export function ColorForm({ colorHex, onChange, onApply }: ColorFormProps) {
  return (
    <div id="prop-section-color" className="prop-section">
      <div className="prop-section-label">Color (hex)</div>
      <div className="prop-color-row">
        <span className="prop-color-prefix">#</span>
        <div
          id="prop-color-swatch"
          className="prop-color-swatch"
          style={{ background: /^[0-9A-Fa-f]{6}$/.test(colorHex) ? `#${colorHex}` : '' }}
        />
        <TextField
          type="text"
          value={colorHex}
          size="small"
          variant="standard"
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          onBlur={() => onApply(colorHex)}
          onKeyDown={(event) => { if (event.key === 'Enter') onApply(colorHex); }}
        />
      </div>
    </div>
  );
}
