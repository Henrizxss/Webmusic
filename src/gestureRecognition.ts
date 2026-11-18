interface HandPoint {
  x: number;
  y: number;
}

const FINGER_JOINTS = [
  { mcp: 5, pip: 6, dip: 7, tip: 8 },
  { mcp: 9, pip: 10, dip: 11, tip: 12 },
  { mcp: 13, pip: 14, dip: 15, tip: 16 },
  { mcp: 17, pip: 18, dip: 19, tip: 20 },
] as const;

function distance2D(first: HandPoint, second: HandPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function getExtendedFingerCount(hand: HandPoint[]): number {
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

  if (extendedFingers < FINGER_JOINTS.length) return extendedFingers;

  const palmWidth = distance2D(hand[5], hand[17]);
  const thumbSpread = distance2D(hand[4], hand[5]);
  const thumbLength = distance2D(hand[2], hand[3]) + distance2D(hand[3], hand[4]);
  const thumbStraightness = distance2D(hand[2], hand[4]) / Math.max(thumbLength, 0.0001);
  return thumbStraightness > 0.8 && thumbSpread > palmWidth * 0.35 ? 5 : 4;
}

export function getChordHandTilt(hand: HandPoint[]): "left" | "neutral" {
  const horizontal = hand[0].x - hand[9].x;
  const vertical = hand[0].y - hand[9].y;
  const angleDegrees = Math.atan2(horizontal, vertical) * (180 / Math.PI);
  return angleDegrees < -26 ? "left" : "neutral";
}
