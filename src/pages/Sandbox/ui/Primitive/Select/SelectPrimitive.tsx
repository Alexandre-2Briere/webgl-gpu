import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectPrimitiveProps {
  label: string;
  labelId: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

export function SelectPrimitive({ label, labelId, value, options, onChange }: SelectPrimitiveProps) {
  return (
    <FormControl variant="standard" size="small" sx={{ m: 1, minWidth: 120 }}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
