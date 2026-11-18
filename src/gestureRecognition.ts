interface HandPoint {
  x: number;
  y: number;
  z: number;
}

const FINGER_JOINTS = [
  { mcp: 5, pip: 6, dip: 7, tip: 8 },
  { mcp: 9, pip: 10, dip: 11, tip: 12 },
  { mcp: 13, pip: 14, dip: 15, tip: 16 },
  { mcp: 17, pip: 18, dip: 19, tip: 20 },
] as const;

function distance3D(first: HandPoint, second: HandPoint): number {
  return Math.hypot(
    first.x - second.x,
    first.y - second.y,
    first.z - second.z,
  );
}

function jointAngle(first: HandPoint, joint: HandPoint, last: HandPoint): number {
  const firstVector = {
    x: first.x - joint.x,
    y: first.y - joint.y,
    z: first.z - joint.z,
  };
  const lastVector = {
    x: last.x - joint.x,
    y: last.y - joint.y,
    z: last.z - joint.z,
  };
  const vectorLengths = distance3D(firstVector, { x: 0, y: 0, z: 0 })
    * distance3D(lastVector, { x: 0, y: 0, z: 0 });
  if (vectorLengths === 0) return 0;

  const dotProduct = firstVector.x * lastVector.x
    + firstVector.y * lastVector.y
    + firstVector.z * lastVector.z;
  const cosine = Math.max(-1, Math.min(1, dotProduct / vectorLengths));
  return Math.acos(cosine) * (180 / Math.PI);
}

export function getExtendedFingerCount(hand: HandPoint[]): number {
  const extendedFingers = FINGER_JOINTS.filter(({ mcp, pip, dip, tip }) => {
    const pipAngle = jointAngle(hand[mcp], hand[pip], hand[dip]);
    const dipAngle = jointAngle(hand[pip], hand[dip], hand[tip]);
    const extensionRatio = distance3D(hand[mcp], hand[tip])
      / Math.max(distance3D(hand[mcp], hand[pip]), 0.0001);
    return pipAngle > 150 && dipAngle > 140 && extensionRatio > 1.18;
  }).length;

  const thumbMcpAngle = jointAngle(hand[1], hand[2], hand[3]);
  const thumbIpAngle = jointAngle(hand[2], hand[3], hand[4]);
  const palmWidth = distance3D(hand[5], hand[17]);
  const thumbSpread = distance3D(hand[4], hand[5]);
  const thumbExtended = thumbMcpAngle > 140
    && thumbIpAngle > 140
    && thumbSpread > palmWidth * 0.42;

  return extendedFingers + (thumbExtended ? 1 : 0);
}

export function isPinching(hand: HandPoint[], wasPinching: boolean): boolean {
  const palmWidth = distance3D(hand[5], hand[17]);
  if (palmWidth < 0.0001) return wasPinching;

  const pinchRatio = distance3D(hand[4], hand[8]) / palmWidth;
  return pinchRatio < (wasPinching ? 0.55 : 0.4);
}

export function getNoteIndex(hand: HandPoint[], previousIndex: number): number {
  const x = Math.max(0, Math.min(1, 1 - hand[8].x));
  const nextIndex = Math.min(7, Math.floor(x * 8));
  if (previousIndex < 0 || nextIndex === previousIndex) return nextIndex;

  const margin = 0.015;
  const boundary = nextIndex > previousIndex
    ? (previousIndex + 1) / 8
    : previousIndex / 8;
  if (nextIndex > previousIndex && x < boundary + margin) return previousIndex;
  if (nextIndex < previousIndex && x > boundary - margin) return previousIndex;
  return nextIndex;
}
