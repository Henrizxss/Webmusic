export const CHORD_GESTURE_SLOTS = [
  { id: "neutral-1", fingerCount: 1, tilt: "neutral", gesture: "1 dedo erguido" },
  { id: "neutral-2", fingerCount: 2, tilt: "neutral", gesture: "2 dedos erguidos" },
  { id: "neutral-3", fingerCount: 3, tilt: "neutral", gesture: "3 dedos erguidos" },
  { id: "neutral-4", fingerCount: 4, tilt: "neutral", gesture: "4 dedos erguidos" },
  { id: "left-1", fingerCount: 1, tilt: "left", gesture: "1 dedo, inclinação à esquerda" },
  { id: "left-2", fingerCount: 2, tilt: "left", gesture: "2 dedos, inclinação à esquerda" },
  { id: "left-3", fingerCount: 3, tilt: "left", gesture: "3 dedos, inclinação à esquerda" },
] as const;

export type ChordHandTilt = "left" | "neutral";
export type ChordGestureSlotId = (typeof CHORD_GESTURE_SLOTS)[number]["id"];
export type ChordGestureAssignments = Record<ChordGestureSlotId, string>;

const ROOTS = [
  { sharp: "C" },
  { sharp: "C♯", flat: "D♭" },
  { sharp: "D" },
  { sharp: "D♯", flat: "E♭" },
  { sharp: "E" },
  { sharp: "F" },
  { sharp: "F♯", flat: "G♭" },
  { sharp: "G" },
  { sharp: "G♯", flat: "A♭" },
  { sharp: "A" },
  { sharp: "A♯", flat: "B♭" },
  { sharp: "B" },
] as const;

const QUALITIES = [
  { id: "major", label: "Maior", suffix: "", intervals: [0, 4, 7] },
  { id: "minor", label: "Menor", suffix: "m", intervals: [0, 3, 7] },
  { id: "diminished", label: "Diminuto", suffix: "dim", intervals: [0, 3, 6] },
] as const;

export interface ChordOption {
  id: string;
  name: string;
  quality: string;
  rootSemitone: number;
  intervals: readonly number[];
}

export const CHORD_OPTIONS: ChordOption[] = ROOTS.flatMap((root, rootSemitone) => (
  QUALITIES.map((quality) => ({
    id: `${rootSemitone}-${quality.id}`,
    name: `${root.sharp}${quality.suffix}${"flat" in root ? ` / ${root.flat}${quality.suffix}` : ""}`,
    quality: quality.label,
    rootSemitone,
    intervals: quality.intervals,
  }))
));

export const DEFAULT_CHORD_ASSIGNMENTS: ChordGestureAssignments = {
  "neutral-1": "0-major",
  "neutral-2": "2-minor",
  "neutral-3": "4-minor",
  "neutral-4": "5-major",
  "left-1": "7-major",
  "left-2": "9-minor",
  "left-3": "11-diminished",
};

export function getChordGestureSlot(
  fingerCount: number,
  tilt: ChordHandTilt,
): (typeof CHORD_GESTURE_SLOTS)[number] | null {
  return CHORD_GESTURE_SLOTS.find((slot) => (
    slot.fingerCount === fingerCount && (slot.tilt ?? "neutral") === tilt
  )) ?? null;
}

export function getChordOption(chordId: string): ChordOption | null {
  return CHORD_OPTIONS.find((chord) => chord.id === chordId) ?? null;
}

export function parseChordGestureAssignments(value: unknown): ChordGestureAssignments | null {
  if (typeof value !== "object" || value === null) return null;
  const assignments = value as Partial<Record<ChordGestureSlotId, unknown>>;
  const parsed = { ...DEFAULT_CHORD_ASSIGNMENTS };
  const requiredSlots = CHORD_GESTURE_SLOTS.filter((slot) => slot.tilt === "neutral");
  for (const slot of requiredSlots) {
    const chordId = assignments[slot.id];
    if (typeof chordId !== "string" || !getChordOption(chordId)) return null;
    parsed[slot.id] = chordId;
  }
  for (const slot of CHORD_GESTURE_SLOTS.filter((gesture) => gesture.tilt === "left")) {
    const chordId = assignments[slot.id];
    if (chordId === undefined) continue;
    if (typeof chordId !== "string" || !getChordOption(chordId)) return null;
    parsed[slot.id] = chordId;
  }
  return parsed;
}

export function getChordPitches(chord: ChordOption, octave: number): number[] {
  const rootMidi = 12 * (octave + 1) + chord.rootSemitone;
  return chord.intervals
    .map((interval) => rootMidi + interval)
    .sort((first, second) => first - second);
}
