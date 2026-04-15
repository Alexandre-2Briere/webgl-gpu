import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { IconButton, Typography } from '@mui/material';
import type { ISceneObject } from '@engine';
import { LightGameObject, LightType, InfiniteGroundGameObject } from '@engine';
import type { PhysicsConfig, PropertyGroup } from '../../items/types';
import { Vector3Form } from './PropertyForm/Vector3Form';
import type { Vector3FormHandle } from './PropertyForm/Vector3Form';
import { ColorForm } from './PropertyForm/ColorForm';
import { PhysicsForm } from './PropertyForm/PhysicsForm';
import type { PhysicsState } from './PropertyForm/PhysicsForm';
import { AssetForm } from './PropertyForm/AssetForm';
import type { AssetOption } from './PropertyForm/AssetForm';
import { LightForm } from './PropertyForm/LightForm';
import type { LightState } from './PropertyForm/LightForm';
import { InfiniteGroundForm } from './PropertyForm/InfiniteGroundForm';
import type { InfiniteGroundState } from './PropertyForm/InfiniteGroundForm';
import './PropertyPanel.css';

const DEG = Math.PI / 180;

interface PanelViewState {
  isOpen:           boolean;
  title:            string;
  colorHex:         string;
  visibleSections:  Set<PropertyGroup>;
  physics:          PhysicsState;
  assetOptions:     AssetOption[];
  selectedAssetUrl: string;
  light:            LightState;
  ground:           InfiniteGroundState;
}

// ── Exported interface — named PropertyPanel so SceneManager import type works ──
export interface PropertyPanel {
  show(
    gameObject:        ISceneObject,
    label:             string,
    properties:        PropertyGroup[],
    physicsConfig?:    PhysicsConfig,
    selectedAssetUrl?: string,
  ): void;
  hide(): void;
  setPosition(x: number, y: number, z: number): void;
  setTitle(label: string): void;
  setFbxCatalog(catalog: { label: string; url: string }[]): void;
  readonly currentObject: ISceneObject | null;
  onPhysicsChange:   ((config: PhysicsConfig) => void) | null;
  onScaleChange:     ((x: number, y: number, z: number) => void) | null;
  onRadiusChange:    ((radius: number) => void) | null;
  onLightTypeChange: ((type: LightType) => void) | null;
  onAssetChange:     ((url: string) => void) | null;
  onPowerChange:     ((power: number) => void) | null;
  onStrengthChange:  ((strength: number) => void) | null;
}

const INITIAL_STATE: PanelViewState = {
  isOpen:           false,
  title:            '',
  colorHex:         '',
  visibleSections:  new Set(),
  physics:          { hasRigidbody: false, isStatic: false, hasHitbox: false, layer: 'default' },
  assetOptions:     [],
  selectedAssetUrl: '',
  light:            { lightType: 0, radius: '1.0', power: '1.0', strength: '1.0' },
  ground:           { yLevel: '0', alternateColorHex: '737373', tileSize: 16 },
};

export const PropertyPanelComponent = forwardRef<PropertyPanel>(
  function PropertyPanelComponent(_, ref) {
    const [state, setState] = useState<PanelViewState>(INITIAL_STATE);

    const positionFormRef = useRef<Vector3FormHandle>(null);
    const rotationFormRef = useRef<Vector3FormHandle>(null);
    const scaleFormRef    = useRef<Vector3FormHandle>(null);

    const currentObjectRef  = useRef<ISceneObject | null>(null);
    const assetOptionsRef   = useRef<AssetOption[]>([]);
    const callbacksRef = useRef({
      onPhysicsChange:   null as ((config: PhysicsConfig) => void) | null,
      onScaleChange:     null as ((x: number, y: number, z: number) => void) | null,
      onRadiusChange:    null as ((radius: number) => void) | null,
      onLightTypeChange: null as ((type: LightType) => void) | null,
      onAssetChange:     null as ((url: string) => void) | null,
      onPowerChange:     null as ((power: number) => void) | null,
      onStrengthChange:  null as ((strength: number) => void) | null,
    });

    function _applyColor(hex: string): void {
      if (!currentObjectRef.current) return;
      const upper = hex.trim().toUpperCase();
      if (!/^[0-9A-F]{6}$/.test(upper)) return;
      const red   = parseInt(upper.slice(0, 2), 16) / 255;
      const green = parseInt(upper.slice(2, 4), 16) / 255;
      const blue  = parseInt(upper.slice(4, 6), 16) / 255;
      currentObjectRef.current.setColor(red, green, blue, 1.0);
    }

    useImperativeHandle(ref, () => {
      const handle: PropertyPanel = {
        show(gameObject, label, properties, physicsConfig, selectedAssetUrl) {
          currentObjectRef.current = gameObject;

          const [posX, posY, posZ] = gameObject.position;
          const [quaternionX, quaternionY, quaternionZ, quaternionW] = gameObject.quaternion;
          const yawDeg   = Math.atan2(2*(quaternionW*quaternionY + quaternionZ*quaternionX), 1 - 2*(quaternionY*quaternionY + quaternionZ*quaternionZ)) / DEG;
          const pitchDeg = Math.asin(Math.max(-1, Math.min(1, 2*(quaternionW*quaternionX - quaternionY*quaternionZ)))) / DEG;
          const rollDeg  = Math.atan2(2*(quaternionW*quaternionZ + quaternionX*quaternionY), 1 - 2*(quaternionZ*quaternionZ + quaternionX*quaternionX)) / DEG;
          const [scaleX, scaleY, scaleZ] = gameObject.scale;

          positionFormRef.current?.setValues(posX, posY, posZ);
          rotationFormRef.current?.setValues(yawDeg, pitchDeg, rollDeg);
          scaleFormRef.current?.setValues(scaleX, scaleY, scaleZ);

          let colorHex = '';
          if (properties.includes('color')) {
            const [red, green, blue] = gameObject.color;
            const toHex = (value: number) => Math.round(value * 255).toString(16).padStart(2, '0').toUpperCase();
            colorHex = `${toHex(red)}${toHex(green)}${toHex(blue)}`;
          }

          let lightState: LightState = { lightType: 0, radius: '1.0', power: '1.0', strength: '1.0' };
          if (gameObject instanceof LightGameObject) {
            lightState = {
              lightType: gameObject.lightType,
              radius:    gameObject.radius.toFixed(1),
              power:     gameObject.radius.toFixed(2),
              strength:  gameObject.radius.toFixed(2),
            };
          }

          let groundState: InfiniteGroundState = { yLevel: '0', alternateColorHex: '737373', tileSize: 2 };
          if (gameObject instanceof InfiniteGroundGameObject) {
            const toHex = (value: number) => Math.round(value * 255).toString(16).padStart(2, '0').toUpperCase();
            const [r2, g2, b2] = gameObject.alternateColor;
            groundState = {
              yLevel:           gameObject.yLevel.toFixed(3),
              alternateColorHex: `${toHex(r2)}${toHex(g2)}${toHex(b2)}`,
              tileSize:         gameObject.tileSize,
            };
          }

          setState({
            isOpen: true,
            title:  label,
            colorHex,
            visibleSections: new Set(properties),
            physics: physicsConfig
              ? { hasRigidbody: physicsConfig.hasRigidbody, isStatic: physicsConfig.isStatic, hasHitbox: physicsConfig.hasHitbox, layer: physicsConfig.layer }
              : { hasRigidbody: false, isStatic: false, hasHitbox: false, layer: 'default' },
            assetOptions: assetOptionsRef.current,
            selectedAssetUrl: selectedAssetUrl ?? '',
            light: lightState,
            ground: groundState,
          });
        },

        hide() {
          currentObjectRef.current = null;
          setState((previous) => ({ ...previous, isOpen: false }));
        },

        setPosition(x, y, z) {
          positionFormRef.current?.setValues(x, y, z);
          currentObjectRef.current?.setPosition([x, y, z]);
        },

        setTitle(label) {
          setState((previous) => ({ ...previous, title: label }));
        },

        setFbxCatalog(catalog) {
          assetOptionsRef.current = catalog;
          setState((previous) => ({ ...previous, assetOptions: catalog }));
        },

        get currentObject() { return currentObjectRef.current; },

        get onPhysicsChange()   { return callbacksRef.current.onPhysicsChange; },
        set onPhysicsChange(fn) { callbacksRef.current.onPhysicsChange = fn; },
        get onScaleChange()     { return callbacksRef.current.onScaleChange; },
        set onScaleChange(fn)   { callbacksRef.current.onScaleChange = fn; },
        get onRadiusChange()    { return callbacksRef.current.onRadiusChange; },
        set onRadiusChange(fn)  { callbacksRef.current.onRadiusChange = fn; },
        get onLightTypeChange()   { return callbacksRef.current.onLightTypeChange; },
        set onLightTypeChange(fn) { callbacksRef.current.onLightTypeChange = fn; },
        get onAssetChange()     { return callbacksRef.current.onAssetChange; },
        set onAssetChange(fn)   { callbacksRef.current.onAssetChange = fn; },
        get onPowerChange()      { return callbacksRef.current.onPowerChange; },
        set onPowerChange(fn)    { callbacksRef.current.onPowerChange = fn; },
        get onStrengthChange()   { return callbacksRef.current.onStrengthChange; },
        set onStrengthChange(fn) { callbacksRef.current.onStrengthChange = fn; },
      };
      return handle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { isOpen, title, colorHex, visibleSections, physics, assetOptions, selectedAssetUrl, light, ground } = state;
    const showPhysics = visibleSections.has('rigidbody') || visibleSections.has('hitbox');
    const showLight   = visibleSections.has('lightType') || visibleSections.has('lightRadius') || visibleSections.has('lightPower') || visibleSections.has('lightStrength');
    const showGround  = visibleSections.has('groundSettings');

    if (!isOpen) return null;

    return (
      <div id="property-panel" className="prop-panel open">
        <div className="prop-panel-inner">
          <div className="prop-panel-header">
            <Typography variant="subtitle2" id="prop-title" className="prop-panel-title">
              {title}
            </Typography>
            <IconButton size="small" onClick={() => { currentObjectRef.current = null; setState((previous) => ({ ...previous, isOpen: false })); }}>
              ×
            </IconButton>
          </div>
          <div className="prop-panel-body">

            {visibleSections.has('position') && (
              <Vector3Form
                label="Position"
                defaultValue={0} axisLabels={['X', 'Y', 'Z']} precision={3} transform={(v) => v}
                ref={positionFormRef}
                onApply={(x, y, z) => currentObjectRef.current?.setPosition([x, y, z])}
              />
            )}

            {visibleSections.has('rotation') && (
              <Vector3Form
                label="Rotation (deg)"
                defaultValue={0} axisLabels={['Yaw', 'Pitch', 'Roll']} precision={1} transform={(v) => v * DEG}
                ref={rotationFormRef}
                onApply={(yawRad, pitchRad, rollRad) => currentObjectRef.current?.setRotation(yawRad, pitchRad, rollRad)}
              />
            )}

            {visibleSections.has('color') && (
              <ColorForm
                colorHex={colorHex}
                onChange={(hex) => setState((previous) => ({ ...previous, colorHex: hex }))}
                onApply={_applyColor}
              />
            )}

            {visibleSections.has('scale') && (
              <Vector3Form
                label="Scale"
                defaultValue={1} axisLabels={['X', 'Y', 'Z']} precision={3} transform={(v) => v}
                ref={scaleFormRef}
                onApply={(x, y, z) => {
                  currentObjectRef.current?.setScale(x, y, z);
                  callbacksRef.current.onScaleChange?.(x, y, z);
                }}
              />
            )}

            {showPhysics && (
              <PhysicsForm
                physics={physics}
                visibleSections={visibleSections}
                onChange={(updated) => setState((previous) => ({ ...previous, physics: updated }))}
                onApply={(updated) => callbacksRef.current.onPhysicsChange?.(updated)}
              />
            )}

            {visibleSections.has('asset') && (
              <AssetForm
                selectedAssetUrl={selectedAssetUrl}
                assetOptions={assetOptions}
                onChange={(url) => {
                  setState((previous) => ({ ...previous, selectedAssetUrl: url }));
                  callbacksRef.current.onAssetChange?.(url);
                }}
              />
            )}

            {showLight && (
              <LightForm
                light={light}
                visibleSections={visibleSections}
                onLightChange={(updated) => setState((previous) => ({ ...previous, light: updated }))}
                onTypeApply={(type) => callbacksRef.current.onLightTypeChange?.(type)}
                onRadiusApply={(radius) => callbacksRef.current.onRadiusChange?.(radius)}
                onPowerApply={(power) => callbacksRef.current.onPowerChange?.(power)}
                onStrengthApply={(strength) => callbacksRef.current.onStrengthChange?.(strength)}
              />
            )}

            {showGround && currentObjectRef.current instanceof InfiniteGroundGameObject && (
              <InfiniteGroundForm
                ground={ground}
                onGroundChange={(updated) => setState((previous) => ({ ...previous, ground: updated }))}
                onYLevelApply={(y) => (currentObjectRef.current as InfiniteGroundGameObject).setYLevel(y)}
                onAltColorApply={(hex) => {
                  const upper = hex.trim().toUpperCase();
                  if (!/^[0-9A-F]{6}$/.test(upper)) return;
                  const red   = parseInt(upper.slice(0, 2), 16) / 255;
                  const green = parseInt(upper.slice(2, 4), 16) / 255;
                  const blue  = parseInt(upper.slice(4, 6), 16) / 255;
                  (currentObjectRef.current as InfiniteGroundGameObject).setAlternateColor(red, green, blue, 1);
                }}
                onTileSizeApply={(size) => (currentObjectRef.current as InfiniteGroundGameObject).setTileSize(size)}
              />
            )}

          </div>
        </div>
      </div>
    );
  },
);
