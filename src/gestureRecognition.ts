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

function distance2D(first: HandPoint, second: HandPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function getExtendedFingerCount(hand: HandPoint[], geometryHand: HandPoint[] = hand): number {
  const palmVectorX = hand[9].x - hand[0].x;
  const palmVectorY = hand[9].y - hand[0].y;
  const palmLength = Math.hypot(palmVectorX, palmVectorY);
  if (palmLength < 0.0001) return 0;

  const palmDirectionX = palmVectorX / palmLength;
  const palmDirectionY = palmVectorY / palmLength;
  const progressFromWrist = (point: HandPoint) => (
    (point.x - hand[0].x) * palmDirectionX
    + (point.y - hand[0].y) * palmDirectionY
  );
  const extendedFingers = FINGER_JOINTS.filter(({ mcp, pip, dip, tip }) => {
    const pipProgress = progressFromWrist(hand[pip]);
    const dipProgress = progressFromWrist(hand[dip]);
    const tipProgress = progressFromWrist(hand[tip]);
    const fingerLength = distance2D(hand[mcp], hand[pip]);
    const extensionRatio = distance2D(hand[mcp], hand[tip]) / Math.max(fingerLength, 0.0001);
    return tipProgress > pipProgress + palmLength * 0.08
      && tipProgress > dipProgress
      && extensionRatio > 1.1;
  }).length;

  const palmWidth = distance3D(geometryHand[5], geometryHand[17]);
  const thumbSpread = distance3D(geometryHand[4], geometryHand[5]);
  const thumbLength = distance3D(geometryHand[2], geometryHand[3])
    + distance3D(geometryHand[3], geometryHand[4]);
  const thumbStraightness = distance3D(geometryHand[2], geometryHand[4])
    / Math.max(thumbLength, 0.0001);
  const thumbExtended = thumbStraightness > 0.8 && thumbSpread > palmWidth * 0.35;

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
