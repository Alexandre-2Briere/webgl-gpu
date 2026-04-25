import { useState } from 'react';
import { Checkbox, FormControlLabel } from '@mui/material';
import { type PubSubManager } from '@engine';
import type { PropertyGroup } from '../../../../items/types';
import { AccordionPrimitive } from '@components/Primitive/Accordion/AccordionPrimitive';
import { InputPrimitive } from '@components/Primitive/Input/InputPrimitive';
import { SANDBOX_EVENTS } from '../../../../game/events';

export interface PhysicsState {
  hasRigidbody: boolean;
  isStatic: boolean;
  hasHitbox: boolean;
  layer: string;
}

interface PhysicsFormProps {
  initialPhysics:  PhysicsState;
  visibleSections: Set<PropertyGroup>;
  pubSub:          PubSubManager;
  objectIndex:     number;
}

export function PhysicsForm({ initialPhysics, visibleSections, pubSub, objectIndex }: PhysicsFormProps) {
  const [physics, setPhysics] = useState(initialPhysics);

  const showRigidbody = visibleSections.has('rigidbody');
  const showHitbox    = visibleSections.has('hitbox');

  function publishChange(updated: PhysicsState): void {
    pubSub.publish(SANDBOX_EVENTS.PROPERTY_PHYSICS_CHANGED, {
      objectIndex,
      data: { config: updated },
    });
  }

  function handleCheckbox(updated: PhysicsState): void {
    setPhysics(updated);
    publishChange(updated);
  }

  return (
    <AccordionPrimitive title="Physics">
      {showRigidbody && (

        <div className="prop-row">
          <FormControlLabel
            id="prop-rb-row"
            labelPlacement="start"
            label="Rigidbody"
            control={
              <Checkbox
                size="small"
                checked={physics.hasRigidbody}
                onChange={(event) => handleCheckbox({ ...physics, hasRigidbody: event.target.checked })}
              />
            }
            sx={{ margin: 0, width: '100%', '& .MuiFormControlLabel-label': { flex: 1 } }}
          />
        </div>
      )}
      {showRigidbody && physics.hasRigidbody && (

        <div className="prop-row">
          <FormControlLabel
            id="prop-static-row"
            labelPlacement="start"
            label="Static"
            control={
              <Checkbox
                size="small"
                checked={physics.isStatic}
                onChange={(event) => handleCheckbox({ ...physics, isStatic: event.target.checked })}
              />
            }
            sx={{ margin: 0, width: '100%', '& .MuiFormControlLabel-label': { flex: 1 } }}
          />
        </div>
      )}
      {showHitbox && (

        <div className="prop-row">
          <FormControlLabel
            id="prop-hb-row"
            labelPlacement="start"
            label="Hitbox"
            control={
              <Checkbox
                size="small"
                checked={physics.hasHitbox}
                onChange={(event) => handleCheckbox({ ...physics, hasHitbox: event.target.checked })}
              />
            }
            sx={{ margin: 0, width: '100%', '& .MuiFormControlLabel-label': { flex: 1 } }}
          />
        </div>
      )}
      {showHitbox && physics.hasHitbox && (

        <div className="prop-row">
          <InputPrimitive
            type="text"
            label="Layer"
            value={physics.layer}
            onChange={(value) => setPhysics({ ...physics, layer: value })}
            onApply={() => publishChange(physics)}
          />
        </div>
      )}
    </AccordionPrimitive>
  );
}
