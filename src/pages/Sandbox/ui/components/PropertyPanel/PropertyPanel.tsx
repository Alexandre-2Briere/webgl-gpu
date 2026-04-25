import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { IconButton, Typography } from '@mui/material';
import { type ISceneObject, type PubSubManager, LightGameObject, InfiniteGroundGameObject } from '@engine';
import type { PropertyGroup } from '../../../items/types';
import {
  SANDBOX_EVENTS,
  type PropertyPanelShowPayload,
  type PropertyPanelSetPositionPayload,
  type PropertyPanelSetTitlePayload,
  type PropertyPanelFbxCatalogPayload,
  type ObjectRemovedPayload,
  type HierarchyRowRenamedPayload,
} from '../../../game/events';
import { type Vector3FormHandle, Vector3Form } from './PropertyForm/Vector3Form';
import { ColorForm } from './PropertyForm/ColorForm';
import { type PhysicsState, PhysicsForm } from './PropertyForm/PhysicsForm';
import { type AssetOption, AssetForm } from './PropertyForm/AssetForm';
import { ScriptForm } from './PropertyForm/ScriptForm';
import type { ScriptArgValues } from '../../../game/scripts/ScriptContract';
import { type LightState, LightForm } from './PropertyForm/LightForm';
import { type InfiniteGroundState, InfiniteGroundForm } from './PropertyForm/InfiniteGroundForm';
import './PropertyPanel.css';
import { rgbToHex } from '@lib/utils/color/color';

const DEG = Math.PI / 180;

interface PanelViewState {
  isOpen:           boolean;
  title:            string;
  selectionKey:     number;
  objectIndex:      number;
  visibleSections:  Set<PropertyGroup>;
  assetOptions:     AssetOption[];
  initialColorHex:  string;
  initialPhysics:   PhysicsState;
  initialAssetUrl:  string;
  initialLight:     LightState;
  initialGround:    InfiniteGroundState;
  initialScript:    string;
  initialScriptArgs: ScriptArgValues;
}

export interface PropertyPanel {
  hide(): void;
}

interface PropertyPanelProps {
  pubSub: PubSubManager;
}

const INITIAL_STATE: PanelViewState = {
  isOpen:           false,
  title:            '',
  selectionKey:     0,
  objectIndex:      -1,
  visibleSections:  new Set(),
  assetOptions:     [],
  initialColorHex:  '',
  initialPhysics:   { hasRigidbody: false, isStatic: false, hasHitbox: false, layer: 'default' },
  initialAssetUrl:  '',
  initialLight:     { lightType: 0, radius: '1.0' },
  initialGround:    { yLevel: '0', alternateColorHex: '737373', colorHex: 'FFFFFF', tileSize: 16 },
  initialScript:    '',
  initialScriptArgs: {},
};

export const PropertyPanelComponent = forwardRef<PropertyPanel, PropertyPanelProps>(
  function PropertyPanelComponent({ pubSub }, ref) {
    const [state, setState] = useState<PanelViewState>(INITIAL_STATE);

    const positionFormRef = useRef<Vector3FormHandle>(null);
    const rotationFormRef = useRef<Vector3FormHandle>(null);
    const scaleFormRef    = useRef<Vector3FormHandle>(null);

    const currentObjectRef      = useRef<ISceneObject | null>(null);
    const currentObjectIndexRef = useRef<number>(-1);
    const assetOptionsRef       = useRef<AssetOption[]>([]);

    function _show(payload: PropertyPanelShowPayload): void {
      const { gameObject, objectIndex, label, properties, physicsConfig, selectedAssetUrl, selectedScript, selectedScriptArgs } = payload;

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

      const initialColorHex = properties.includes('color')
        ? rgbToHex({ r: gameObject.color[0], g: gameObject.color[1], b: gameObject.color[2] })
        : '';

      let initialLight: LightState = { lightType: 0, radius: '1.0' };
      if (gameObject instanceof LightGameObject) {
        initialLight = {
          lightType: gameObject.lightType,
          radius:    gameObject.radius.toFixed(1),
        };
      }

      let initialGround: InfiniteGroundState = { yLevel: '0', colorHex: 'FFFFFF', alternateColorHex: '737373', tileSize: 2 };
      if (gameObject instanceof InfiniteGroundGameObject) {
        const [r1, g1, b1] = gameObject.color;
        const [r2, g2, b2] = gameObject.alternateColor;
        initialGround = {
          yLevel:            gameObject.yLevel.toFixed(3),
          colorHex:          rgbToHex({ r: r1, g: g1, b: b1 }),
          alternateColorHex: rgbToHex({ r: r2, g: g2, b: b2 }),
          tileSize:          gameObject.tileSize,
        };
      }

      setState(previous => ({
        isOpen:           true,
        title:            label,
        selectionKey:     previous.selectionKey + 1,
        objectIndex:      objectIndex,
        visibleSections:  new Set(properties),
        assetOptions:     assetOptionsRef.current,
        initialColorHex,
        initialPhysics: physicsConfig
          ? { hasRigidbody: physicsConfig.hasRigidbody, isStatic: physicsConfig.isStatic, hasHitbox: physicsConfig.hasHitbox, layer: physicsConfig.layer }
          : { hasRigidbody: false, isStatic: false, hasHitbox: false, layer: 'default' },
        initialAssetUrl:  selectedAssetUrl ?? '',
        initialLight,
        initialGround,
        initialScript:    selectedScript ?? '',
        initialScriptArgs: selectedScriptArgs ?? {},
      }));
    }

    useImperativeHandle(ref, () => ({
      hide() {
        currentObjectRef.current = null;
        setState((previous) => ({ ...previous, isOpen: false }));
      },
    }), []);

    useEffect(() => {
      const onShow = (raw: unknown) => _show(raw as PropertyPanelShowPayload);

      const onHide = () => {
        currentObjectRef.current = null;
        setState((previous) => ({ ...previous, isOpen: false }));
      };

      const onSetPosition = (raw: unknown) => {
        const { x, y, z } = raw as PropertyPanelSetPositionPayload;
        positionFormRef.current?.setValues(x, y, z);
        currentObjectRef.current?.setPosition([x, y, z]);
      };

      const onSetTitle = (raw: unknown) => {
        const { label } = raw as PropertyPanelSetTitlePayload;
        setState((previous) => ({ ...previous, title: label }));
      };

      const onFbxCatalog = (raw: unknown) => {
        const { catalog } = raw as PropertyPanelFbxCatalogPayload;
        assetOptionsRef.current = catalog;
        setState((previous) => ({ ...previous, assetOptions: catalog }));
      };

      const onObjectRemoved = (raw: unknown) => {
        const { removedIndex } = raw as ObjectRemovedPayload;
        if (currentObjectIndexRef.current === removedIndex) {
          currentObjectRef.current = null;
          setState((previous) => ({ ...previous, isOpen: false }));
        } else if (currentObjectIndexRef.current > removedIndex) {
          currentObjectIndexRef.current--;
          setState((previous) => ({ ...previous, objectIndex: previous.objectIndex - 1 }));
        }
      };

      const onRowRenamed = (raw: unknown) => {
        const { index, name } = raw as HierarchyRowRenamedPayload;
        if (currentObjectIndexRef.current === index) {
          setState((previous) => ({ ...previous, title: name }));
        }
      };

      pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_PANEL_SHOW,         onShow);
      pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_PANEL_HIDE,         onHide);
      pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_PANEL_SET_POSITION, onSetPosition);
      pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_PANEL_SET_TITLE,    onSetTitle);
      pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_PANEL_FBX_CATALOG,  onFbxCatalog);
      pubSub.subscribe(SANDBOX_EVENTS.OBJECT_REMOVED,              onObjectRemoved);
      pubSub.subscribe(SANDBOX_EVENTS.HIERARCHY_ROW_RENAMED,       onRowRenamed);

      return () => {
        pubSub.unsubscribe(SANDBOX_EVENTS.PROPERTY_PANEL_SHOW,         onShow);
        pubSub.unsubscribe(SANDBOX_EVENTS.PROPERTY_PANEL_HIDE,         onHide);
        pubSub.unsubscribe(SANDBOX_EVENTS.PROPERTY_PANEL_SET_POSITION, onSetPosition);
        pubSub.unsubscribe(SANDBOX_EVENTS.PROPERTY_PANEL_SET_TITLE,    onSetTitle);
        pubSub.unsubscribe(SANDBOX_EVENTS.PROPERTY_PANEL_FBX_CATALOG,  onFbxCatalog);
        pubSub.unsubscribe(SANDBOX_EVENTS.OBJECT_REMOVED,              onObjectRemoved);
        pubSub.unsubscribe(SANDBOX_EVENTS.HIERARCHY_ROW_RENAMED,       onRowRenamed);
      };
    }, [pubSub]);

    const {
      isOpen, title, selectionKey, objectIndex, visibleSections, assetOptions,
      initialColorHex, initialPhysics, initialAssetUrl, initialLight, initialGround,
      initialScript, initialScriptArgs,
    } = state;

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
                key={selectionKey}
                initialColorHex={initialColorHex}
                gameObject={currentObjectRef.current!}
              />
            )}

            {visibleSections.has('scale') && (
              <Vector3Form
                label="Scale"
                defaultValue={1} axisLabels={['X', 'Y', 'Z']} precision={3} transform={(v) => v}
                ref={scaleFormRef}
                onApply={(x, y, z) => {
                  currentObjectRef.current?.setScale(x, y, z);
                  pubSub.publish(SANDBOX_EVENTS.PROPERTY_SCALE_CHANGED, {
                    objectIndex: currentObjectIndexRef.current, data: { x, y, z }
                  });
                }}
              />
            )}

            {showPhysics && (
              <PhysicsForm
                key={selectionKey}
                initialPhysics={initialPhysics}
                visibleSections={visibleSections}
                pubSub={pubSub}
                objectIndex={objectIndex}
              />
            )}

            {visibleSections.has('asset') && (
              <AssetForm
                key={selectionKey}
                initialSelectedAssetUrl={initialAssetUrl}
                assetOptions={assetOptions}
                pubSub={pubSub}
                objectIndex={objectIndex}
              />
            )}

            {visibleSections.has('script') && (
              <ScriptForm
                key={selectionKey}
                initialSelectedScript={initialScript}
                initialScriptArgs={initialScriptArgs}
                pubSub={pubSub}
                objectIndex={objectIndex}
              />
            )}

            {showLight && (
              <LightForm
                key={selectionKey}
                initialLight={initialLight}
                visibleSections={visibleSections}
                pubSub={pubSub}
                objectIndex={objectIndex}
              />
            )}

            {showGround && currentObjectRef.current instanceof InfiniteGroundGameObject && (
              <InfiniteGroundForm
                key={selectionKey}
                initialGround={initialGround}
                gameObject={currentObjectRef.current}
              />
            )}

          </div>
        </div>
      </div>
    );
  },
);
