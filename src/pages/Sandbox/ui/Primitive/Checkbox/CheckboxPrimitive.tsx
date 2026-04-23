import { Checkbox, FormControlLabel } from '@mui/material';

interface CheckboxPrimitiveProps {
  label:    string;
  checked:  boolean;
  onChange: (checked: boolean) => void;
}

export function CheckboxPrimitive({ label, checked, onChange }: CheckboxPrimitiveProps) {
  return (
    <FormControlLabel
      label={label}
      control={
        <Checkbox
          checked={checked}
          size="small"
          onChange={(event) => onChange(event.target.checked)}
        />
      }
    />
  );
}
