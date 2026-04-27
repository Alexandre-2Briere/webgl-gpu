import { useState, useRef, useEffect } from 'react';
import { type ISceneObject, type PubSubManager } from '@engine';
import type { PhysicsConfig, PropertyGroup } from '../../../items/types';
import type { ScriptArgValues } from '../../../game/scripts/ScriptContract';
import {
  SANDBOX_EVENTS,
  type PropertyPanelShowPayload,
  type PropertyPanelSetTitlePayload,
  type PropertyPanelFbxCatalogPayload,
  type ObjectRemovedPayload,
  type HierarchyRowRenamedPayload,
} from '../../../game/events';
import type { AssetOption } from './PropertyForm/AssetForm';

const EMPTY_PHYSICS: PhysicsConfig = { hasRigidbody: false, isStatic: false, hasHitbox: false, layer: 'default' };

interface PanelViewState {
  isOpen:             boolean;
  title:              string;
  selectionKey:       number;
  objectIndex:        number;
  visibleSections:    Set<PropertyGroup>;
  assetOptions:       AssetOption[];
  physicsConfig:      PhysicsConfig;
  selectedAssetUrl:   string;
  selectedScript:     string;
  selectedScriptArgs: ScriptArgValues;
  gameObject:         ISceneObject | null;
}

const INITIAL_STATE: PanelViewState = {
  isOpen:             false,
  title:              '',
  selectionKey:       0,
  objectIndex:        -1,
  visibleSections:    new Set(),
  assetOptions:       [],
  physicsConfig:      EMPTY_PHYSICS,
  selectedAssetUrl:   '',
  selectedScript:     '',
  selectedScriptArgs: {},
  gameObject:         null,
};

export function usePropertyPanel(pubSub: PubSubManager) {
  const [state, setState]         = useState<PanelViewState>(INITIAL_STATE);
  const currentObjectRef          = useRef<ISceneObject | null>(null);
  const currentObjectIndexRef     = useRef<number>(-1);
  const assetOptionsRef           = useRef<AssetOption[]>([]);

  function _show(payload: PropertyPanelShowPayload): void {
    currentObjectRef.current      = payload.gameObject;
    currentObjectIndexRef.current = payload.objectIndex;
    setState(previous => ({
      isOpen:             true,
      title:              payload.label,
      selectionKey:       previous.selectionKey + 1,
      objectIndex:        payload.objectIndex,
      visibleSections:    new Set(payload.properties),
      assetOptions:       assetOptionsRef.current,
      physicsConfig:      payload.physicsConfig ?? EMPTY_PHYSICS,
      selectedAssetUrl:   payload.selectedAssetUrl  ?? '',
      selectedScript:     payload.selectedScript    ?? '',
      selectedScriptArgs: payload.selectedScriptArgs ?? {},
      gameObject:         payload.gameObject,
    }));
  }

  function hide(): void {
    currentObjectRef.current = null;
    setState(previous => ({ ...previous, isOpen: false, gameObject: null }));
  }

  useEffect(() => {
    const onShow = (raw: unknown) => _show(raw as PropertyPanelShowPayload);

    const onHide = () => {
      currentObjectRef.current = null;
      setState(previous => ({ ...previous, isOpen: false, gameObject: null }));
    };

    const onSetTitle = (raw: unknown) => {
      const { label } = raw as PropertyPanelSetTitlePayload;
      setState(previous => ({ ...previous, title: label }));
    };

    const onFbxCatalog = (raw: unknown) => {
      const { catalog } = raw as PropertyPanelFbxCatalogPayload;
      assetOptionsRef.current = catalog;
      setState(previous => ({ ...previous, assetOptions: catalog }));
    };

    const onObjectRemoved = (raw: unknown) => {
      const { removedIndex } = raw as ObjectRemovedPayload;
      if (currentObjectIndexRef.current === removedIndex) {
        currentObjectRef.current = null;
        setState(previous => ({ ...previous, isOpen: false, gameObject: null }));
      } else if (currentObjectIndexRef.current > removedIndex) {
        currentObjectIndexRef.current--;
        setState(previous => ({ ...previous, objectIndex: previous.objectIndex - 1 }));
      }
    };

    const onRowRenamed = (raw: unknown) => {
      const { index, name } = raw as HierarchyRowRenamedPayload;
      if (currentObjectIndexRef.current === index) {
        setState(previous => ({ ...previous, title: name }));
      }
    };

    pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_PANEL_SHOW,        onShow);
    pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_PANEL_HIDE,        onHide);
    pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_PANEL_SET_TITLE,   onSetTitle);
    pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_PANEL_FBX_CATALOG, onFbxCatalog);
    pubSub.subscribe(SANDBOX_EVENTS.OBJECT_REMOVED,             onObjectRemoved);
    pubSub.subscribe(SANDBOX_EVENTS.HIERARCHY_ROW_RENAMED,      onRowRenamed);

    return () => {
      pubSub.unsubscribe(SANDBOX_EVENTS.PROPERTY_PANEL_SHOW,        onShow);
      pubSub.unsubscribe(SANDBOX_EVENTS.PROPERTY_PANEL_HIDE,        onHide);
      pubSub.unsubscribe(SANDBOX_EVENTS.PROPERTY_PANEL_SET_TITLE,   onSetTitle);
      pubSub.unsubscribe(SANDBOX_EVENTS.PROPERTY_PANEL_FBX_CATALOG, onFbxCatalog);
      pubSub.unsubscribe(SANDBOX_EVENTS.OBJECT_REMOVED,             onObjectRemoved);
      pubSub.unsubscribe(SANDBOX_EVENTS.HIERARCHY_ROW_RENAMED,      onRowRenamed);
    };
  }, [pubSub]);

  return { state, hide };
}
