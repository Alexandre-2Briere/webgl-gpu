import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { IconButton, Typography } from '@mui/material';
import type { ISceneObject } from '@engine';
import { LightGameObject, LightType } from '@engine';
import type { PhysicsConfig, PropertyGroup } from '../../items/types';
import { PositionForm } from './PropertyForm/PositionForm';
import type { PositionFormHandle } from './PropertyForm/PositionForm';
import { RotationForm } from './PropertyForm/RotationForm';
import type { RotationFormHandle } from './PropertyForm/RotationForm';
import { ScaleForm } from './PropertyForm/ScaleForm';
import type { ScaleFormHandle } from './PropertyForm/ScaleForm';
import { ColorForm } from './PropertyForm/ColorForm';
import { PhysicsForm } from './PropertyForm/PhysicsForm';
import type { PhysicsState } from './PropertyForm/PhysicsForm';
import { AssetForm } from './PropertyForm/AssetForm';
import type { AssetOption } from './PropertyForm/AssetForm';
import { LightForm } from './PropertyForm/LightForm';
import type { LightState } from './PropertyForm/LightForm';
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
}

const INITIAL_STATE: PanelViewState = {
  isOpen:           false,
  title:            '',
  colorHex:         '',
  visibleSections:  new Set(),
  physics:          { hasRigidbody: false, isStatic: false, hasHitbox: false, layer: 'default' },
  assetOptions:     [],
  selectedAssetUrl: '',
  light:            { lightType: 0, radius: '1.0', power: '1.0' },
};

export const PropertyPanelComponent = forwardRef<PropertyPanel>(
  function PropertyPanelComponent(_, ref) {
    const [state, setState] = useState<PanelViewState>(INITIAL_STATE);

    const positionFormRef = useRef<PositionFormHandle>(null);
    const rotationFormRef = useRef<RotationFormHandle>(null);
    const scaleFormRef    = useRef<ScaleFormHandle>(null);

    const currentObjectRef  = useRef<ISceneObject | null>(null);
    const assetOptionsRef   = useRef<AssetOption[]>([]);
    const callbacksRef = useRef({
      onPhysicsChange:   null as ((config: PhysicsConfig) => void) | null,
      onScaleChange:     null as ((x: number, y: number, z: number) => void) | null,
      onRadiusChange:    null as ((radius: number) => void) | null,
      onLightTypeChange: null as ((type: LightType) => void) | null,
      onAssetChange:     null as ((url: string) => void) | null,
      onPowerChange:     null as ((power: number) => void) | null,
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

          let lightState: LightState = { lightType: 0, radius: '1.0', power: '1.0' };
          if (gameObject instanceof LightGameObject) {
            lightState = {
              lightType: gameObject.lightType,
              radius:    gameObject.radius.toFixed(1),
              power:     gameObject.radius.toFixed(2),
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
        get onPowerChange()     { return callbacksRef.current.onPowerChange; },
        set onPowerChange(fn)   { callbacksRef.current.onPowerChange = fn; },
      };
      return handle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { isOpen, title, colorHex, visibleSections, physics, assetOptions, selectedAssetUrl, light } = state;
    const showPhysics = visibleSections.has('rigidbody') || visibleSections.has('hitbox');
    const showLight   = visibleSections.has('lightType') || visibleSections.has('lightRadius') || visibleSections.has('lightPower');

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
              <PositionForm
                ref={positionFormRef}
                onApply={(x, y, z) => currentObjectRef.current?.setPosition([x, y, z])}
              />
            )}

            {visibleSections.has('rotation') && (
              <RotationForm
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
              <ScaleForm
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
              />
            )}

          </div>
        </div>
      </div>
    );
  },
);
