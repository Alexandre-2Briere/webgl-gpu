import { LightType, safeParseFloat } from '@engine';
import type { PropertyGroup } from '../../../../items/types';
import { SelectPrimitive } from '@components/Primitive/Select/SelectPrimitive';
import { AccordionPrimitive } from '@components/Primitive/Accordion/AccordionPrimitive';
import { InputPrimitive } from '@components/Primitive/Input/InputPrimitive';

const LIGHT_TYPE_OPTIONS = [
  { value: '0', label: 'Ambient' },
  { value: '1', label: 'Point' },
];

export interface LightState {
  lightType: number;
  radius: string;
}

interface LightFormProps {
  light: LightState;
  visibleSections: Set<PropertyGroup>;
  onLightChange: (light: LightState) => void;
  onTypeApply: (type: LightType) => void;
  onRadiusApply: (radius: number) => void;
}

export function LightForm({ light, visibleSections, onLightChange, onTypeApply, onRadiusApply }: LightFormProps) {
  return (
    <AccordionPrimitive title="Light">
      {visibleSections.has('lightType') && (
        <SelectPrimitive
          label="Type"
          labelId="light-type-label"
          value={String(light.lightType)}
          options={LIGHT_TYPE_OPTIONS}
          onChange={(value) => {
            // REVIEW [BLOCKING]: parseInt without radix (ESLint radix rule) and unvalidated cast to LightType.
            // Use parseInt(value, 10) and add a bounds check before casting.
            const newType = parseInt(value) as LightType;
            onLightChange({ ...light, lightType: newType });
            onTypeApply(newType);
          }}
        />
      )}
      {visibleSections.has('lightRadius') && (
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
    </AccordionPrimitive>
  );
}
