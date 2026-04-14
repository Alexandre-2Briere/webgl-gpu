import { InputAdornment, MenuItem, Select, TextField } from '@mui/material';
import { safeParseFloat } from '@engine';
import { PaddingRemover } from './Remover';

const TILE_SIZES = [4, 8, 16, 32, 64];

export interface InfiniteGroundState {
  yLevel:          string;
  alternateColorHex: string;
  tileSize:        number;
}

interface InfiniteGroundFormProps {
  ground:              InfiniteGroundState;
  onGroundChange:      (ground: InfiniteGroundState) => void;
  onYLevelApply:       (y: number) => void;
  onAltColorApply:     (hex: string) => void;
  onTileSizeApply:     (size: number) => void;
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
        <span className="prop-label">Y Level</span>
        <TextField
          type="number"
          value={ground.yLevel}
          size="small"
          variant="standard"
          onChange={(event) => onGroundChange({ ...ground, yLevel: event.target.value })}
          onBlur={() => onYLevelApply(safeParseFloat(ground.yLevel))}
          onKeyDown={(event) => { if (event.key === 'Enter') onYLevelApply(safeParseFloat(ground.yLevel)); }}
          sx={PaddingRemover}
        />
      </div>

      <div className="prop-row">
        <span className="prop-label">Alt Color</span>
        <TextField
          type="text"
          value={ground.alternateColorHex}
          size="small"
          variant="standard"
          onChange={(event) => onGroundChange({ ...ground, alternateColorHex: event.target.value.toUpperCase() })}
          onBlur={() => onAltColorApply(ground.alternateColorHex)}
          onKeyDown={(event) => { if (event.key === 'Enter') onAltColorApply(ground.alternateColorHex); }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start">#</InputAdornment>,
            },
          }}
          sx={PaddingRemover}
        />
      </div>

      <div className="prop-row">
        <span className="prop-label">Tile Size</span>
        <Select
          value={String(ground.tileSize)}
          size="small"
          variant="standard"
          onChange={(event) => {
            const size = parseInt(event.target.value);
            onGroundChange({ ...ground, tileSize: size });
            onTileSizeApply(size);
          }}
        >
          {TILE_SIZES.map(size => (
            <MenuItem key={size} value={String(size)}>{size}</MenuItem>
          ))}
        </Select>
      </div>
    </div>
  );
}
