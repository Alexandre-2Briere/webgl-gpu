import { InputAdornment, TextField } from '@mui/material';
import { ArrowRemover, PaddingRemover } from '../../PropertyPanel/PropertyForm/Remover';

interface InputPrimitiveProps {
  type: 'number' | 'text';
  label: string;
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
}

export function InputPrimitive({ type, label, value, onChange, onApply }: InputPrimitiveProps) {
  return (
    <TextField
      type={type}
      value={value}
      size="small"
      variant="standard"
      slotProps={{
        input: {
          startAdornment: <InputAdornment position="start">{label}</InputAdornment>,
        },
      }}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onApply}
      onKeyDown={(event) => { if (event.key === 'Enter') onApply(); }}
      sx={{ flex: 1, ...(type === 'number' ? ArrowRemover : PaddingRemover) }}
    />
  );
}
