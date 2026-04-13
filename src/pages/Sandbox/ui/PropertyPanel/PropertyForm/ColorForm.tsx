import { InputAdornment, TextField } from '@mui/material';
import { PaddingRemover } from './Remover';

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
        <TextField
          type="text"
          value={colorHex}
          size="small"
          variant="standard"
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          onBlur={() => onApply(colorHex)}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start">#</InputAdornment>,
            },
          }}
          onKeyDown={(event) => { if (event.key === 'Enter') onApply(colorHex); }}
          sx={PaddingRemover}
        />
      </div>
    </div>
  );
}
