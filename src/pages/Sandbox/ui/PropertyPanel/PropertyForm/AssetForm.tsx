import { SelectPrimitive } from '../../Primitive/Select/SelectPrimitive';
import { AccordionPrimitive } from '../../Primitive/Accordion/AccordionPrimitive';

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
    <AccordionPrimitive title="Asset">
      <div className="prop-row">
        <SelectPrimitive
          label="Asset"
          labelId="asset-select-label"
          value={selectedAssetUrl}
          options={selectOptions}
          onChange={onChange}
        />
      </div>
    </AccordionPrimitive>
  );
}
