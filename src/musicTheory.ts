export const CHORD_GESTURE_SLOTS = [
  { id: "neutral-1", fingerCount: 1, tilt: "neutral", gesture: "1 dedo, mão reta ou à direita" },
  { id: "neutral-2", fingerCount: 2, tilt: "neutral", gesture: "2 dedos, mão reta ou à direita" },
  { id: "neutral-3", fingerCount: 3, tilt: "neutral", gesture: "3 dedos, mão reta ou à direita" },
  { id: "neutral-4", fingerCount: 4, tilt: "neutral", gesture: "4 dedos, mão reta ou à direita" },
  { id: "neutral-5", fingerCount: 5, tilt: "neutral", gesture: "5 dedos, mão reta ou à direita" },
  { id: "left-2", fingerCount: 2, tilt: "left", gesture: "2 dedos, mão inclinada à esquerda" },
  { id: "left-3", fingerCount: 3, tilt: "left", gesture: "3 dedos, mão inclinada à esquerda" },
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
  "neutral-5": "7-major",
  "left-2": "9-minor",
  "left-3": "11-diminished",
};

export function getChordGestureSlot(
  fingerCount: number,
  tilt: ChordHandTilt,
): (typeof CHORD_GESTURE_SLOTS)[number] | null {
  return CHORD_GESTURE_SLOTS.find((slot) => (
    slot.fingerCount === fingerCount && slot.tilt === tilt
  )) ?? null;
}

export function getChordOption(chordId: string): ChordOption | null {
  return CHORD_OPTIONS.find((chord) => chord.id === chordId) ?? null;
}

export function isChordGestureAssignments(value: unknown): value is ChordGestureAssignments {
  if (typeof value !== "object" || value === null) return false;
  const assignments = value as Partial<Record<ChordGestureSlotId, unknown>>;
  return CHORD_GESTURE_SLOTS.every((slot) => {
    const chordId = assignments[slot.id];
    return typeof chordId === "string" && getChordOption(chordId) !== null;
  });
}

export function getChordPitches(chord: ChordOption, octave: number): number[] {
  const rootMidi = 12 * (octave + 1) + chord.rootSemitone;
  return chord.intervals.map((interval) => rootMidi + interval);
}
