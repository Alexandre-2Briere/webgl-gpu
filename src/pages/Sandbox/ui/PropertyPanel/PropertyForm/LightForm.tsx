import { LightType, safeParseFloat } from '@engine';
import type { PropertyGroup } from '../../../items/types';
import { InputPrimitive } from '../../Primitive/Input/InputPrimitive';
import { SelectPrimitive } from '../../Primitive/Select/SelectPrimitive';

const LIGHT_TYPE_OPTIONS = [
  { value: '0', label: 'Ambient' },
  { value: '1', label: 'Point' },
];

export interface LightState {
  lightType: number;
  radius: string;
  power: string;
  strength: string;
}

interface LightFormProps {
  light: LightState;
  visibleSections: Set<PropertyGroup>;
  onLightChange: (light: LightState) => void;
  onTypeApply: (type: LightType) => void;
  onRadiusApply: (radius: number) => void;
  onPowerApply: (power: number) => void;
  onStrengthApply: (strength: number) => void;
}

export function LightForm({ light, visibleSections, onLightChange, onTypeApply, onRadiusApply, onPowerApply, onStrengthApply }: LightFormProps) {
  return (
    <div id="prop-section-light" className="prop-section">
      <div className="prop-section-label">Light</div>
      {visibleSections.has('lightType') && (
        <SelectPrimitive
          label="Type"
          labelId="light-type-label"
          value={String(light.lightType)}
          options={LIGHT_TYPE_OPTIONS}
          onChange={(value) => {
            const newType = parseInt(value) as LightType;
            onLightChange({ ...light, lightType: newType });
            onTypeApply(newType);
          }}
        />
      )}
      {visibleSections.has('lightRadius') && light.lightType === LightType.Point && (
        <div className="prop-row prop-subrow">
          <InputPrimitive
            type="number"
            label="Radius"
            value={light.radius}
            onChange={(value) => onLightChange({ ...light, radius: value })}
            onApply={() => onRadiusApply(safeParseFloat(light.radius))}
          />
        </div>
      )}
      {visibleSections.has('lightPower') && (
        <div className="prop-row">
          <InputPrimitive
            type="number"
            label="Power"
            value={light.power}
            onChange={(value) => onLightChange({ ...light, power: value })}
            onApply={() => onPowerApply(safeParseFloat(light.power))}
          />
        </div>
      )}
      {visibleSections.has('lightStrength') && light.lightType === LightType.Ambient && (
        <div className="prop-row prop-subrow">
          <InputPrimitive
            type="number"
            label="Strength"
            value={light.strength}
            onChange={(value) => onLightChange({ ...light, strength: value })}
            onApply={() => onStrengthApply(safeParseFloat(light.strength))}
          />
        </div>
      )}
    </div>
  );
}
