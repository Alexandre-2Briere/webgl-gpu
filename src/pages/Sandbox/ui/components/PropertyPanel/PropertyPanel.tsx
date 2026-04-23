import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { IconButton, Typography } from '@mui/material';
import { type ISceneObject, type PubSubManager, LightGameObject, InfiniteGroundGameObject } from '@engine';
import type { PhysicsConfig, PropertyGroup } from '../../../items/types';
import { SANDBOX_EVENTS } from '../../../game/events';
import { type Vector3FormHandle, Vector3Form } from './PropertyForm/Vector3Form';
import { ColorForm } from './PropertyForm/ColorForm';
import { type PhysicsState, PhysicsForm } from './PropertyForm/PhysicsForm';
import { type AssetOption, AssetForm } from './PropertyForm/AssetForm';
import { ScriptForm } from './PropertyForm/ScriptForm';
import { ScriptArgsForm } from './PropertyForm/ScriptArgsForm';
import type { ScriptArgValues } from '../../../game/scripts/ScriptContract';
import { getParamNames, getParamDefaults } from '../../../game/utils/functionParser';
import { type LightState, LightForm } from './PropertyForm/LightForm';
import { type InfiniteGroundState, InfiniteGroundForm } from './PropertyForm/InfiniteGroundForm';
import './PropertyPanel.css';

const DEG = Math.PI / 180;

const SCRIPT_LOADERS = import.meta.glob<{ newExecute: (...args: unknown[]) => unknown }>('../../game/scripts/*.ts');

const SCRIPT_NAMES = Object.keys(SCRIPT_LOADERS)
  .map(path => path.split('/').pop()!.replace(/\.ts$/, ''))
  .filter(name => name !== 'ScriptContract');

async function _loadScriptParams(scriptName: string): Promise<{ params: string[]; defaults: ScriptArgValues }> {
  const entry = Object.entries(SCRIPT_LOADERS).find(
    ([path]) => !path.includes('ScriptContract') && path.endsWith(`/${scriptName}.ts`),
  );
  if (!entry) return { params: [], defaults: {} };
  const module = await entry[1]();
  if (typeof module.newExecute !== 'function') return { params: [], defaults: {} };
  const params   = getParamNames(module.newExecute).filter(p => p !== 'engine');
  const defaults = getParamDefaults(module.newExecute) as ScriptArgValues;
  return { params, defaults };
}

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
  selectedScript:    string;
  scriptParams:      string[];
  scriptArgValues:   ScriptArgValues;
}

// ── Exported interface — named PropertyPanel so SceneManager import type works ──
export interface PropertyPanel {
  show(
    gameObject:          ISceneObject,
    objectIndex:         number,
    label:               string,
    properties:          PropertyGroup[],
    physicsConfig?:      PhysicsConfig,
    selectedAssetUrl?:   string,
    selectedScript?:     string,
    selectedScriptArgs?: ScriptArgValues,
  ): void;
  hide(): void;
  setPosition(x: number, y: number, z: number): void;
  setTitle(label: string): void;
  setFbxCatalog(catalog: { label: string; url: string }[]): void;
  readonly currentObject: ISceneObject | null;
  setPubSub(pubSub: PubSubManager): void;
}

const INITIAL_STATE: PanelViewState = {
  isOpen:           false,
  title:            '',
  colorHex:         '',
  visibleSections:  new Set(),
  physics:          { hasRigidbody: false, isStatic: false, hasHitbox: false, layer: 'default' },
  assetOptions:     [],
  selectedAssetUrl: '',
  light:            { lightType: 0, radius: '1.0' },
  ground:           { yLevel: '0', alternateColorHex: '737373', colorHex: 'FFFFFF', tileSize: 16 },
  selectedScript:   '',
  scriptParams:     [],
  scriptArgValues:  {},
};

export const PropertyPanelComponent = forwardRef<PropertyPanel>(
  function PropertyPanelComponent(_, ref) {
    const [state, setState] = useState<PanelViewState>(INITIAL_STATE);

    const positionFormRef = useRef<Vector3FormHandle>(null);
    const rotationFormRef = useRef<Vector3FormHandle>(null);
    const scaleFormRef    = useRef<Vector3FormHandle>(null);

    const currentObjectRef      = useRef<ISceneObject | null>(null);
    const currentObjectIndexRef = useRef<number>(-1);
    const assetOptionsRef       = useRef<AssetOption[]>([]);
    const pubSubRef             = useRef<PubSubManager | null>(null);

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
        show(gameObject, objectIndex, label, properties, physicsConfig, selectedAssetUrl, selectedScript, selectedScriptArgs) {
          currentObjectRef.current      = gameObject;
          currentObjectIndexRef.current = objectIndex;

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

          let lightState: LightState = { lightType: 0, radius: '1.0'};
          if (gameObject instanceof LightGameObject) {
            lightState = {
              lightType: gameObject.lightType,
              radius:    gameObject.radius.toFixed(1),
            };
          }

          // REVIEW [NITPICK]: fallback tileSize is 2 here but 16 in INITIAL_STATE — pick one default.
          let groundState: InfiniteGroundState = { yLevel: '0', colorHex: 'FFFFFF', alternateColorHex: '737373', tileSize: 2 };
          if (gameObject instanceof InfiniteGroundGameObject) {
            const toHex = (value: number) => Math.round(value * 255).toString(16).padStart(2, '0').toUpperCase();
            const [r1, g1, b1] = gameObject.color;
            const [r2, g2, b2] = gameObject.alternateColor;
            groundState = {
              yLevel:            gameObject.yLevel.toFixed(3),
              colorHex:          `${toHex(r1)}${toHex(g1)}${toHex(b1)}`,
              alternateColorHex: `${toHex(r2)}${toHex(g2)}${toHex(b2)}`,
              tileSize:          gameObject.tileSize,
            };
          }

          const resolvedScript = selectedScript ?? '';
          setState({
            isOpen: true,
            title:  label,
            colorHex,
            visibleSections: new Set(properties),
            physics: physicsConfig
              ? { hasRigidbody: physicsConfig.hasRigidbody, isStatic: physicsConfig.isStatic, hasHitbox: physicsConfig.hasHitbox, layer: physicsConfig.layer }
              : { hasRigidbody: false, isStatic: false, hasHitbox: false, layer: 'default' },
            assetOptions:     assetOptionsRef.current,
            selectedAssetUrl: selectedAssetUrl ?? '',
            light:            lightState,
            ground:           groundState,
            selectedScript:   resolvedScript,
            scriptParams:     [],
            scriptArgValues:  selectedScriptArgs ?? {},
          });

          if (resolvedScript) {
            _loadScriptParams(resolvedScript).then(({ params, defaults }) => {
              setState(previous => ({
                ...previous,
                scriptParams: params,
                scriptArgValues: { ...defaults, ...previous.scriptArgValues },
              }));
            });
          }
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

        setPubSub(pubSub: PubSubManager): void {
          pubSubRef.current = pubSub;
        },
      };
      return handle;
    }, []);

    const { isOpen, title, colorHex, visibleSections, physics, assetOptions, selectedAssetUrl, light, ground, selectedScript, scriptParams, scriptArgValues } = state;
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
            <IconButton 
              sx={{width: "32px", height: "32px"}}
              size="small" 
              onClick={() => { currentObjectRef.current = null; setState((previous) => ({ ...previous, isOpen: false })); }}
            >
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
                  pubSubRef.current?.publish(SANDBOX_EVENTS.PROPERTY_SCALE_CHANGED, {
                    objectIndex: currentObjectIndexRef.current, data: { x, y, z }
                  });
                }}
              />
            )}

            {showPhysics && (
              <PhysicsForm
                physics={physics}
                visibleSections={visibleSections}
                onChange={(updated) => setState((previous) => ({ ...previous, physics: updated }))}
                onApply={(updated) => pubSubRef.current?.publish(
                  SANDBOX_EVENTS.PROPERTY_PHYSICS_CHANGED,
                  { objectIndex: currentObjectIndexRef.current, data: { config: updated } },
                )}
              />
            )}

            {visibleSections.has('asset') && (
              <AssetForm
                selectedAssetUrl={selectedAssetUrl}
                assetOptions={assetOptions}
                onChange={(url) => {
                  setState((previous) => ({ ...previous, selectedAssetUrl: url }));
                  pubSubRef.current?.publish(SANDBOX_EVENTS.PROPERTY_ASSET_CHANGED, {
                    objectIndex: currentObjectIndexRef.current, data: { url }
                  });
                }}
              />
            )}

            {visibleSections.has('script') && (
              <ScriptForm
                scriptNames={SCRIPT_NAMES}
                selectedScript={selectedScript}
                onChange={(name) => {
                  setState((previous) => ({ ...previous, selectedScript: name, scriptParams: [], scriptArgValues: {} }));
                  pubSubRef.current?.publish(SANDBOX_EVENTS.PROPERTY_SCRIPT_CHANGED, {
                    objectIndex: currentObjectIndexRef.current, data: { scriptName: name }
                  });
                  if (name) {
                    _loadScriptParams(name).then(({ params, defaults }) => {
                      setState(previous => ({ ...previous, scriptParams: params, scriptArgValues: defaults }));
                    });
                  }
                }}
              />
            )}

            {visibleSections.has('script') && scriptParams.length > 0 && (
              <ScriptArgsForm
                params={scriptParams}
                values={scriptArgValues}
                onApply={(args) => {
                  setState((previous) => ({ ...previous, scriptArgValues: args }));
                  pubSubRef.current?.publish(SANDBOX_EVENTS.PROPERTY_SCRIPT_ARGS_CHANGED, {
                    objectIndex: currentObjectIndexRef.current, data: { args },
                  });
                }}
              />
            )}

            {showLight && (
              <LightForm
                light={light}
                visibleSections={visibleSections}
                onLightChange={(updated) => setState((previous) => ({ ...previous, light: updated }))}
                onTypeApply={(type) => pubSubRef.current?.publish(
                  SANDBOX_EVENTS.PROPERTY_LIGHT_TYPE_CHANGED,
                  { objectIndex: currentObjectIndexRef.current, data: { lightType: type } },
                )}
                onRadiusApply={(radius) => pubSubRef.current?.publish(
                  SANDBOX_EVENTS.PROPERTY_RADIUS_CHANGED,
                  { objectIndex: currentObjectIndexRef.current, data: { radius } },
                )}
              />
            )}

            {showGround && currentObjectRef.current instanceof InfiniteGroundGameObject && (
              <InfiniteGroundForm
                ground={ground}
                onGroundChange={(updated) => setState((previous) => ({ ...previous, ground: updated }))}
                // REVIEW [BLOCKING]: currentObjectRef.current can be null between render and callback invocation.
                // Add a null guard inside each callback: const ground = currentObjectRef.current; if (!(ground instanceof InfiniteGroundGameObject)) return;
                onYLevelApply={(y) => (currentObjectRef.current as InfiniteGroundGameObject).setYLevel(y)}
                onColorApply={(hex) => {
                  const upper = hex.trim().toUpperCase();
                  if (!/^[0-9A-F]{6}$/.test(upper)) return;
                  const red   = parseInt(upper.slice(0, 2), 16) / 255;
                  const green = parseInt(upper.slice(2, 4), 16) / 255;
                  const blue  = parseInt(upper.slice(4, 6), 16) / 255;
                  (currentObjectRef.current as InfiniteGroundGameObject).setColor(red, green, blue, 1);
                }}
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
