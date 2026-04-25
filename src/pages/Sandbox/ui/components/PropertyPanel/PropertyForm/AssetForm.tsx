import { useState } from 'react';
import { type PubSubManager } from '@engine';
import { SelectPrimitive } from '@components/Primitive/Select/SelectPrimitive';
import { AccordionPrimitive } from '@components/Primitive/Accordion/AccordionPrimitive';
import { SANDBOX_EVENTS } from '../../../../game/events';

export interface AssetOption {
  label: string;
  url: string;
}

interface AssetFormProps {
  initialSelectedAssetUrl: string;
  assetOptions:            AssetOption[];
  pubSub:                  PubSubManager;
  objectIndex:             number;
}

export function AssetForm({ initialSelectedAssetUrl, assetOptions, pubSub, objectIndex }: AssetFormProps) {
  const [selectedAssetUrl, setSelectedAssetUrl] = useState(initialSelectedAssetUrl);

  const selectOptions = assetOptions.map((option) => ({ value: option.url, label: option.label }));

  return (
    <AccordionPrimitive title="Asset">
      <div className="prop-row">
        <SelectPrimitive
          label="Asset"
          labelId="asset-select-label"
          value={selectedAssetUrl}
          options={selectOptions}
          onChange={(url) => {
            setSelectedAssetUrl(url);
            pubSub.publish(SANDBOX_EVENTS.PROPERTY_ASSET_CHANGED, { objectIndex, data: { url } });
          }}
        />
      </div>
    </AccordionPrimitive>
  );
}
