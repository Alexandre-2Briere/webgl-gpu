import { SelectPrimitive } from '../../Primitive/Select/SelectPrimitive';

export interface AssetOption {
  label: string;
  url: string;
}

interface AssetFormProps {
  selectedAssetUrl: string;
  assetOptions: AssetOption[];
  onChange: (url: string) => void;
}

export function AssetForm({ selectedAssetUrl, assetOptions, onChange }: AssetFormProps) {
  const selectOptions = assetOptions.map((option) => ({ value: option.url, label: option.label }));

  return (
    <div id="prop-section-asset" className="prop-section">
      <div className="prop-section-label">Asset</div>
      <SelectPrimitive
        label="Asset"
        labelId="asset-select-label"
        value={selectedAssetUrl}
        options={selectOptions}
        onChange={onChange}
      />
    </div>
  );
}
