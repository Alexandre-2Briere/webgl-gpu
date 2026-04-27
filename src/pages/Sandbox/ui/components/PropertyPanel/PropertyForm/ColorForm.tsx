import { useState } from 'react';
import { type ISceneObject } from '@engine';
import { AccordionPrimitive } from "@components/Primitive/Accordion/AccordionPrimitive";
import { InputPrimitive } from "@components/Primitive/Input/InputPrimitive";
import { hexToRGBA, rgbToHex } from '@lib/utils/color/color';

interface ColorFormProps {
  gameObject: ISceneObject;
}

export function ColorForm({ gameObject }: ColorFormProps) {
  const [colorHex, setColorHex] = useState<string>(() =>
    rgbToHex({ r: gameObject.color[0], g: gameObject.color[1], b: gameObject.color[2] })
  );

  function applyColor(): void {
    const upper = colorHex.trim().toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(upper)) return;
    const { r, g, b } = hexToRGBA(`#${upper}`);
    gameObject.setColor(r / 255, g / 255, b / 255, 1.0);
  }

  return (
    <AccordionPrimitive title="Color (hex)">
      <div className="prop-row">
        <InputPrimitive
          type="text"
          label="#"
          value={colorHex}
          onChange={(value) => setColorHex(value.toUpperCase())}
          onApply={applyColor}
        />
      </div>
    </AccordionPrimitive>
  );
}
