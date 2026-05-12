import { useState } from 'react';
import { Slider } from '@mui/material';
import type { IGameObject, PubSubManager } from '@engine';
import { safeParseFloat } from '@engine';
import { AccordionPrimitive } from '@components/Primitive/Accordion/AccordionPrimitive';
import { InputPrimitive } from '@components/Primitive/Input/InputPrimitive';
import { SANDBOX_EVENTS } from '../../../../game/events';

interface MaterialFormProps {
  gameObject:  IGameObject;
  pubSub:      PubSubManager;
  objectIndex: number;
}

export function MaterialForm({ gameObject, pubSub, objectIndex }: MaterialFormProps) {
  const [shininess,        setShininess]        = useState(String(gameObject.material?.shininess ?? 32));
  const [specularStrength, setSpecularStrength] = useState(gameObject.material?.specularStrength ?? 0);

  return (
    <AccordionPrimitive title="Material">
      <div className="prop-row prop-subrow">
        <InputPrimitive
          type="number"
          label="Shininess"
          value={shininess}
          onChange={(value) => setShininess(value)}
          onApply={() =>
            pubSub.publish(SANDBOX_EVENTS.PROPERTY_SHININESS_CHANGED, {
              objectIndex,
              data: { shininess: safeParseFloat(shininess) },
            })
          }
        />
      </div>
      <div className="prop-row prop-subrow">
        <Slider
          min={0}
          max={10000}
          step={10}
          value={specularStrength}
          valueLabelDisplay="auto"
          onChange={(_, value) => setSpecularStrength(value as number)}
          onChangeCommitted={(_, value) =>
            pubSub.publish(SANDBOX_EVENTS.PROPERTY_SPECULAR_STRENGTH_CHANGED, {
              objectIndex,
              data: { specularStrength: value as number },
            })
          }
        />
      </div>
    </AccordionPrimitive>
  );
}
