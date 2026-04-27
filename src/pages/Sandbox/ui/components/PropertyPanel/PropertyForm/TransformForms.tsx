import { useEffect, useRef } from 'react';
import { type ISceneObject, type PubSubManager } from '@engine';
import type { PropertyGroup } from '../../../../items/types';
import { SANDBOX_EVENTS, type PropertyPanelSetPositionPayload } from '../../../../game/events';
import { type Vector3FormHandle, Vector3Form } from './Vector3Form';

const DEG = Math.PI / 180;

interface TransformFormsProps {
  pubSub:          PubSubManager;
  gameObject:      ISceneObject;
  visibleSections: Set<PropertyGroup>;
  objectIndex:     number;
}

export function TransformForms({ pubSub, gameObject, visibleSections, objectIndex }: TransformFormsProps) {
  const positionFormRef = useRef<Vector3FormHandle>(null);
  const rotationFormRef = useRef<Vector3FormHandle>(null);
  const scaleFormRef    = useRef<Vector3FormHandle>(null);

  useEffect(() => {
    const onSetPosition = (raw: unknown) => {
      const { x, y, z } = raw as PropertyPanelSetPositionPayload;
      positionFormRef.current?.setValues(x, y, z);
      gameObject.setPosition([x, y, z]);
    };
    pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_PANEL_SET_POSITION, onSetPosition);
    return () => pubSub.unsubscribe(SANDBOX_EVENTS.PROPERTY_PANEL_SET_POSITION, onSetPosition);
  }, [pubSub, gameObject]);

  const [posX, posY, posZ]   = gameObject.position;
  const [qX, qY, qZ, qW]    = gameObject.quaternion;
  const yawDeg   = Math.atan2(2 * (qW * qY + qZ * qX), 1 - 2 * (qY * qY + qZ * qZ)) / DEG;
  const pitchDeg = Math.asin(Math.max(-1, Math.min(1, 2 * (qW * qX - qY * qZ))))     / DEG;
  const rollDeg  = Math.atan2(2 * (qW * qZ + qX * qY), 1 - 2 * (qZ * qZ + qX * qX)) / DEG;
  const [scaleX, scaleY, scaleZ] = gameObject.scale;

  return (
    <>
      {visibleSections.has('position') && (
        <Vector3Form
          label="Position"
          initialValues={[posX, posY, posZ]}
          axisLabels={['X', 'Y', 'Z']}
          precision={3}
          transform={(value) => value}
          ref={positionFormRef}
          onApply={(x, y, z) => gameObject.setPosition([x, y, z])}
        />
      )}
      {visibleSections.has('rotation') && (
        <Vector3Form
          label="Rotation (deg)"
          initialValues={[yawDeg, pitchDeg, rollDeg]}
          axisLabels={['Yaw', 'Pitch', 'Roll']}
          precision={1}
          transform={(value) => value * DEG}
          ref={rotationFormRef}
          onApply={(yawRad, pitchRad, rollRad) => gameObject.setRotation(yawRad, pitchRad, rollRad)}
        />
      )}
      {visibleSections.has('scale') && (
        <Vector3Form
          label="Scale"
          initialValues={[scaleX, scaleY, scaleZ]}
          axisLabels={['X', 'Y', 'Z']}
          precision={3}
          transform={(value) => value}
          ref={scaleFormRef}
          onApply={(x, y, z) => {
            gameObject.setScale(x, y, z);
            pubSub.publish(SANDBOX_EVENTS.PROPERTY_SCALE_CHANGED, { objectIndex, data: { x, y, z } });
          }}
        />
      )}
    </>
  );
}
