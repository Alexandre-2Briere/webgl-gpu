import { Checkbox, FormControlLabel } from '@mui/material';
import type { PropertyGroup } from '../../../items/types';
import { InputPrimitive } from '../../Primitive/Input/InputPrimitive';

export interface PhysicsState {
  hasRigidbody: boolean;
  isStatic:     boolean;
  hasHitbox:    boolean;
  layer:        string;
}

interface PhysicsFormProps {
  physics:         PhysicsState;
  visibleSections: Set<PropertyGroup>;
  /** Called on every change — parent updates state. */
  onChange:        (physics: PhysicsState) => void;
  /** Called when a change should be propagated to the engine — parent fires onPhysicsChange. */
  onApply:         (physics: PhysicsState) => void;
}

export function PhysicsForm({ physics, visibleSections, onChange, onApply }: PhysicsFormProps) {
  const showRigidbody = visibleSections.has('rigidbody');
  const showHitbox    = visibleSections.has('hitbox');

  function handleCheckbox(updated: PhysicsState): void {
    onChange(updated);
    onApply(updated);
  }

  return (
    <div id="prop-section-physics" className="prop-section">
      <div className="prop-section-label">Physics</div>
      {showRigidbody && (
        <FormControlLabel
          id="prop-rb-row"
          className="prop-row"
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
      )}
      {showRigidbody && physics.hasRigidbody && (
        <FormControlLabel
          id="prop-static-row"
          className="prop-row prop-subrow secondary-field"
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
      )}
      {showHitbox && (
        <FormControlLabel
          id="prop-hb-row"
          className="prop-row"
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
      )}
      {showHitbox && physics.hasHitbox && (
        <div id="prop-layer-row" className="prop-row prop-subrow">
          <InputPrimitive
            type="text"
            label="Layer"
            value={physics.layer}
            onChange={(value) => onChange({ ...physics, layer: value })}
            onApply={() => onApply(physics)}
          />
        </div>
      )}
    </div>
  );
}
