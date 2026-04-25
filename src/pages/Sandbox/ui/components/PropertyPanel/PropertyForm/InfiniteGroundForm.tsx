import { useState } from 'react';
import { InfiniteGroundGameObject, safeParseFloat } from '@engine';
import { AccordionPrimitive } from '@components/Primitive/Accordion/AccordionPrimitive';
import { InputPrimitive } from '@components/Primitive/Input/InputPrimitive';
import { SelectPrimitive } from '@components/Primitive/Select/SelectPrimitive';
import { safeParseInt } from '@lib/utils/math/math';
import { hexToRGBA } from '@lib/utils/color/color';

const TILE_SIZES = [2, 4, 8, 16, 32, 64];
const TILE_SIZE_OPTIONS = TILE_SIZES.map((size) => ({ value: String(size), label: String(size) }));

export interface InfiniteGroundState {
  yLevel:            string;
  colorHex:          string;
  alternateColorHex: string;
  tileSize:          number;
}

interface InfiniteGroundFormProps {
  initialGround: InfiniteGroundState;
  gameObject:    InfiniteGroundGameObject;
}

export function InfiniteGroundForm({ initialGround, gameObject }: InfiniteGroundFormProps) {
  const [ground, setGround] = useState(initialGround);

  function applyColor(hex: string): void {
    const upper = hex.trim().toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(upper)) return;
    const { r, g, b, a } = hexToRGBA(`#${upper}`);
    gameObject.setColor(r, g, b, a);
  }

  function applyAlternateColor(hex: string): void {
    const upper = hex.trim().toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(upper)) return;
    const { r, g, b, a } = hexToRGBA(`#${upper}`);
    gameObject.setAlternateColor(r, g, b, a);
  }

  return (
    <AccordionPrimitive title="Ground">
      <div className="prop-row">
        <InputPrimitive
          type="number"
          label="Y-level"
          value={ground.yLevel}
          onChange={(event) => setGround({ ...ground, yLevel: event })}
          onApply={() => gameObject.setYLevel(safeParseFloat(ground.yLevel))}
        />
      </div>
      <div className="prop-row">
        <InputPrimitive
          type="text"
          label="Color 1 #"
          value={ground.colorHex}
          onChange={(value) => setGround({ ...ground, colorHex: value.toUpperCase() })}
          onApply={() => applyColor(ground.colorHex)}
        />
      </div>
      <div className="prop-row">
        <InputPrimitive
          type="text"
          label="Color 2 #"
          value={ground.alternateColorHex}
          onChange={(value) => setGround({ ...ground, alternateColorHex: value.toUpperCase() })}
          onApply={() => applyAlternateColor(ground.alternateColorHex)}
        />
      </div>
      <div className='prop-row'>
        <SelectPrimitive
          label="Tile Size"
          labelId="tile-size-label"
          value={String(ground.tileSize)}
          options={TILE_SIZE_OPTIONS}
          onChange={(value) => {
            const size = safeParseInt(value);
            setGround({ ...ground, tileSize: size });
            gameObject.setTileSize(size);
          }}
        />
      </div>
    </AccordionPrimitive>
  );
}
