import { useState } from 'react';
import { LightType, safeParseFloat, type PubSubManager } from '@engine';
import type { PropertyGroup } from '../../../../items/types';
import { SelectPrimitive } from '@components/Primitive/Select/SelectPrimitive';
import { AccordionPrimitive } from '@components/Primitive/Accordion/AccordionPrimitive';
import { InputPrimitive } from '@components/Primitive/Input/InputPrimitive';
import { SANDBOX_EVENTS } from '../../../../game/events';

const LIGHT_TYPE_OPTIONS = [
  { value: '0', label: 'Ambient' },
  { value: '1', label: 'Point' },
];

export interface LightState {
  lightType: number;
  radius: string;
}

interface LightFormProps {
  initialLight:    LightState;
  visibleSections: Set<PropertyGroup>;
  pubSub:          PubSubManager;
  objectIndex:     number;
}

export function LightForm({ initialLight, visibleSections, pubSub, objectIndex }: LightFormProps) {
  const [light, setLight] = useState(initialLight);

  return (
    <AccordionPrimitive title="Light">
      {visibleSections.has('lightType') && (
        <SelectPrimitive
          label="Type"
          labelId="light-type-label"
          value={String(light.lightType)}
          options={LIGHT_TYPE_OPTIONS}
          onChange={(value) => {
            const newType = parseInt(value, 10) as LightType;
            setLight({ ...light, lightType: newType });
            pubSub.publish(SANDBOX_EVENTS.PROPERTY_LIGHT_TYPE_CHANGED, { objectIndex, data: { lightType: newType } });
          }}
        />
      )}
      {visibleSections.has('lightRadius') && (
        <div className="prop-row prop-subrow">
          <InputPrimitive
            type="number"
            label="Radius"
            value={light.radius}
            onChange={(value) => setLight({ ...light, radius: value })}
            onApply={() => pubSub.publish(SANDBOX_EVENTS.PROPERTY_RADIUS_CHANGED, { objectIndex, data: { radius: safeParseFloat(light.radius) } })}
          />
        </div>
      )}
    </AccordionPrimitive>
  );
}
