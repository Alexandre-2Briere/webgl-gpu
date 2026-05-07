import { type PubSubManager } from '@engine';
import { SANDBOX_EVENTS } from '../../../../game/events';
import { Vector3Form } from './Vector3Form';

const DEG = Math.PI / 180;

interface CameraTransformFormProps {
  initialPosition: [number, number, number];
  initialYaw:      number;
  initialPitch:    number;
  pubSub:          PubSubManager;
}

export function CameraTransformForm({ initialPosition, initialYaw, initialPitch, pubSub }: CameraTransformFormProps) {
  return (
    <>
      <Vector3Form
        label="Position"
        initialValues={initialPosition}
        axisLabels={['X', 'Y', 'Z']}
        precision={3}
        transform={(value) => value}
        onApply={(x, y, z) => {
          pubSub.publish(SANDBOX_EVENTS.PROPERTY_CAMERA_POSITION_CHANGED, { x, y, z });
        }}
      />
      <Vector3Form
        label="Rotation (deg)"
        initialValues={[initialYaw / DEG, initialPitch / DEG, 0]}
        axisLabels={['Yaw', 'Pitch', 'Roll']}
        precision={1}
        transform={(value) => value * DEG}
        onApply={(yawRad, pitchRad) => {
          pubSub.publish(SANDBOX_EVENTS.PROPERTY_CAMERA_ROTATION_CHANGED, { yaw: yawRad, pitch: pitchRad });
        }}
      />
    </>
  );
}
