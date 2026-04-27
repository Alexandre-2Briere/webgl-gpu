import { forwardRef, useImperativeHandle } from 'react';
import { IconButton, Typography } from '@mui/material';
import { type PubSubManager, LightGameObject, InfiniteGroundGameObject } from '@engine';
import { ColorForm } from './PropertyForm/ColorForm';
import { type PhysicsState, PhysicsForm } from './PropertyForm/PhysicsForm';
import { AssetForm } from './PropertyForm/AssetForm';
import { ScriptForm } from './PropertyForm/ScriptForm';
import { LightForm } from './PropertyForm/LightForm';
import { InfiniteGroundForm } from './PropertyForm/InfiniteGroundForm';
import { TransformForms } from './PropertyForm/TransformForms';
import { usePropertyPanel } from './usePropertyPanel';
import './PropertyPanel.css';

export interface PropertyPanel {
  hide(): void;
}

interface PropertyPanelProps {
  pubSub: PubSubManager;
}

export const PropertyPanelComponent = forwardRef<PropertyPanel, PropertyPanelProps>(
  function PropertyPanelComponent({ pubSub }, ref) {
    const { state, hide } = usePropertyPanel(pubSub);

    useImperativeHandle(ref, () => ({ hide }), [hide]);

    const {
      isOpen, title, selectionKey, objectIndex, visibleSections, assetOptions,
      physicsConfig, selectedAssetUrl, selectedScript, selectedScriptArgs, gameObject,
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
              sx={{ width: '32px', height: '32px' }}
              size="small"
              onClick={hide}
            >
              ×
            </IconButton>
          </div>
          <div className="prop-panel-body">

            <TransformForms
              key={`transform-${selectionKey}`}
              pubSub={pubSub}
              gameObject={gameObject!}
              visibleSections={visibleSections}
              objectIndex={objectIndex}
            />

            {visibleSections.has('color') && (
              <ColorForm
                key={`color-${selectionKey}`}
                gameObject={gameObject!}
              />
            )}

            {showPhysics && (
              <PhysicsForm
                key={`physics-${selectionKey}`}
                initialPhysics={physicsConfig as PhysicsState}
                visibleSections={visibleSections}
                pubSub={pubSub}
                objectIndex={objectIndex}
              />
            )}

            {visibleSections.has('asset') && (
              <AssetForm
                key={`asset-${selectionKey}`}
                initialSelectedAssetUrl={selectedAssetUrl}
                assetOptions={assetOptions}
                pubSub={pubSub}
                objectIndex={objectIndex}
              />
            )}

            {visibleSections.has('script') && (
              <ScriptForm
                key={`script-${selectionKey}`}
                initialSelectedScript={selectedScript}
                initialScriptArgs={selectedScriptArgs}
                pubSub={pubSub}
                objectIndex={objectIndex}
              />
            )}

            {showLight && gameObject instanceof LightGameObject && (
              <LightForm
                key={`light-${selectionKey}`}
                gameObject={gameObject}
                visibleSections={visibleSections}
                pubSub={pubSub}
                objectIndex={objectIndex}
              />
            )}

            {showGround && gameObject instanceof InfiniteGroundGameObject && (
              <InfiniteGroundForm
                key={`ground-${selectionKey}`}
                gameObject={gameObject}
              />
            )}

          </div>
        </div>
      </div>
    );
  },
);
