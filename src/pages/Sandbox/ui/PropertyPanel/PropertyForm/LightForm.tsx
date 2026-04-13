import { MenuItem, Select, TextField } from '@mui/material';
import { LightType, safeParseFloat } from '@engine';
import type { PropertyGroup } from '../../../items/types';

export interface LightState {
  lightType: number;
  radius:    string;
  power:     string;
}

interface LightFormProps {
  light:           LightState;
  visibleSections: Set<PropertyGroup>;
  onLightChange:   (light: LightState) => void;
  onTypeApply:     (type: LightType) => void;
  onRadiusApply:   (radius: number) => void;
  onPowerApply:    (power: number) => void;
}

export function LightForm({ light, visibleSections, onLightChange, onTypeApply, onRadiusApply, onPowerApply }: LightFormProps) {
  return (
    <div id="prop-section-light" className="prop-section">
      <div className="prop-section-label">Light</div>
      {visibleSections.has('lightType') && (
        <div className="prop-row">
          <span className="prop-label">Type</span>
          <Select
            value={String(light.lightType)}
            size="small"
            variant="standard"
            onChange={(event) => {
              const newType = parseInt(event.target.value) as LightType;
              onLightChange({ ...light, lightType: newType });
              onTypeApply(newType);
            }}
          >
            <MenuItem value="0">Ambient</MenuItem>
            <MenuItem value="1">Point</MenuItem>
          </Select>
        </div>
      )}
      {visibleSections.has('lightRadius') && light.lightType === LightType.Point && (
        <div className="prop-row prop-subrow">
          <span className="prop-label">Radius</span>
          <TextField
            type="number"
            value={light.radius}
            size="small"
            variant="standard"
            onChange={(event) => onLightChange({ ...light, radius: event.target.value })}
            onBlur={() => onRadiusApply(safeParseFloat(light.radius))}
            onKeyDown={(event) => { if (event.key === 'Enter') onRadiusApply(safeParseFloat(light.radius)); }}
          />
        </div>
      )}
      {visibleSections.has('lightPower') && (
        <div className="prop-row">
          <span className="prop-label">Power</span>
          <TextField
            type="number"
            value={light.power}
            size="small"
            variant="standard"
            onChange={(event) => onLightChange({ ...light, power: event.target.value })}
            onBlur={() => onPowerApply(safeParseFloat(light.power))}
            onKeyDown={(event) => { if (event.key === 'Enter') onPowerApply(safeParseFloat(light.power)); }}
          />
        </div>
      )}
    </div>
  );
}
