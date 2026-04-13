import { MenuItem, Select } from '@mui/material';

export interface AssetOption {
  label: string;
  url:   string;
}

interface AssetFormProps {
  selectedAssetUrl: string;
  assetOptions:     AssetOption[];
  onChange:         (url: string) => void;
}

export function AssetForm({ selectedAssetUrl, assetOptions, onChange }: AssetFormProps) {
  return (
    <div id="prop-section-asset" className="prop-section">
      <div className="prop-section-label">Asset</div>
      <div className="prop-row">
        <Select
          value={selectedAssetUrl}
          size="small"
          variant="standard"
          onChange={(event) => onChange(event.target.value)}
        >
          {assetOptions.map((option) => (
            <MenuItem key={option.url} value={option.url}>{option.label}</MenuItem>
          ))}
        </Select>
      </div>
    </div>
  );
}
