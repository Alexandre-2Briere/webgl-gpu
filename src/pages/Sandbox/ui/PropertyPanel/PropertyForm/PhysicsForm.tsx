import { Checkbox, TextField } from '@mui/material';
import type { PropertyGroup } from '../../../items/types';

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
        <div id="prop-rb-row" className="prop-row">
          <span className="prop-label">Rigidbody</span>
          <Checkbox
            size="small"
            checked={physics.hasRigidbody}
            onChange={(event) => handleCheckbox({ ...physics, hasRigidbody: event.target.checked })}
          />
        </div>
      )}
      {showRigidbody && physics.hasRigidbody && (
        <div id="prop-static-row" className="prop-row prop-subrow">
          <span className="prop-label">Static</span>
          <Checkbox
            size="small"
            checked={physics.isStatic}
            onChange={(event) => handleCheckbox({ ...physics, isStatic: event.target.checked })}
          />
        </div>
      )}
      {showHitbox && (
        <div id="prop-hb-row" className="prop-row">
          <span className="prop-label">Hitbox</span>
          <Checkbox
            size="small"
            checked={physics.hasHitbox}
            onChange={(event) => handleCheckbox({ ...physics, hasHitbox: event.target.checked })}
          />
        </div>
      )}
      {showHitbox && physics.hasHitbox && (
        <div id="prop-layer-row" className="prop-row prop-subrow">
          <span className="prop-label">Layer</span>
          <TextField
            type="text"
            value={physics.layer}
            size="small"
            variant="standard"
            onChange={(event) => onChange({ ...physics, layer: event.target.value })}
            onBlur={() => onApply(physics)}
            onKeyDown={(event) => { if (event.key === 'Enter') onApply(physics); }}
          />
        </div>
      )}
    </div>
  );
}
