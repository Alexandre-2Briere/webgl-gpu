import { safeParseFloat } from '@engine';
import { InputPrimitive } from '../../Primitive/Input/InputPrimitive';
import { SelectPrimitive } from '../../Primitive/Select/SelectPrimitive';

const TILE_SIZES = [2, 4, 8, 16, 32, 64];
const TILE_SIZE_OPTIONS = TILE_SIZES.map((size) => ({ value: String(size), label: String(size) }));

export interface InfiniteGroundState {
  yLevel:            string;
  alternateColorHex: string;
  tileSize:          number;
}

interface InfiniteGroundFormProps {
  ground:          InfiniteGroundState;
  onGroundChange:  (ground: InfiniteGroundState) => void;
  onYLevelApply:   (y: number) => void;
  onAltColorApply: (hex: string) => void;
  onTileSizeApply: (size: number) => void;
}

export function InfiniteGroundForm({
  ground,
  onGroundChange,
  onYLevelApply,
  onAltColorApply,
  onTileSizeApply,
}: InfiniteGroundFormProps) {
  return (
    <div id="prop-section-ground" className="prop-section">
      <div className="prop-section-label">Ground</div>

      <div className="prop-row">
        <InputPrimitive
          type="number"
          label="Y-level"
          value={ground.yLevel}
          onChange={(event) => onGroundChange({ ...ground, yLevel: event })}
          onApply={() => onYLevelApply(safeParseFloat(ground.yLevel))}
        />
      </div>

      <div className="prop-row">
        <InputPrimitive
          type="text"
          label="#"
          value={ground.alternateColorHex}
          onChange={(value) => onGroundChange({ ...ground, alternateColorHex: value.toUpperCase() })}
          onApply={() => onAltColorApply(ground.alternateColorHex)}
        />
      </div>

      <SelectPrimitive
        label="Tile Size"
        labelId="tile-size-label"
        value={String(ground.tileSize)}
        options={TILE_SIZE_OPTIONS}
        onChange={(value) => {
          const size = parseInt(value);
          onGroundChange({ ...ground, tileSize: size });
          onTileSizeApply(size);
        }}
      />
    </div>
  );
}
