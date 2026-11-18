export const HARMONIC_FIELD = [
  {
    name: "C",
    quality: "Maior",
    rootSemitone: 0,
    intervals: [0, 4, 7],
    fingerCount: 2,
    tilt: "neutral",
    gesture: "2 dedos erguidos, mão reta ou inclinada para a direita",
  },
  {
    name: "Dm",
    quality: "Menor",
    rootSemitone: 2,
    intervals: [0, 3, 7],
    fingerCount: 3,
    tilt: "neutral",
    gesture: "3 dedos erguidos, mão reta ou inclinada para a direita",
  },
  {
    name: "Em",
    quality: "Menor",
    rootSemitone: 4,
    intervals: [0, 3, 7],
    fingerCount: 4,
    tilt: "neutral",
    gesture: "4 dedos erguidos, mão reta ou inclinada para a direita",
  },
  {
    name: "F",
    quality: "Maior",
    rootSemitone: 5,
    intervals: [0, 4, 7],
    fingerCount: 5,
    tilt: "neutral",
    gesture: "5 dedos erguidos, mão reta ou inclinada para a direita",
  },
  {
    name: "G",
    quality: "Maior",
    rootSemitone: 7,
    intervals: [0, 4, 7],
    fingerCount: 3,
    tilt: "left",
    gesture: "3 dedos erguidos, mão inclinada para a esquerda",
  },
  {
    name: "Am",
    quality: "Menor",
    rootSemitone: 9,
    intervals: [0, 3, 7],
    fingerCount: 2,
    tilt: "left",
    gesture: "2 dedos erguidos, mão inclinada para a esquerda",
  },
  {
    name: "Bdim",
    quality: "Diminuto",
    rootSemitone: 11,
    intervals: [0, 3, 6],
    fingerCount: 4,
    tilt: "left",
    gesture: "4 dedos erguidos, mão inclinada para a esquerda",
  },
] as const;

export type ChordHandTilt = "left" | "neutral";

export function getChordIndexForGesture(
  fingerCount: number,
  tilt: ChordHandTilt,
): number | null {
  const index = HARMONIC_FIELD.findIndex((chord) => (
    chord.fingerCount === fingerCount
    && chord.tilt === tilt
  ));
  return index < 0 ? null : index;
}

export function getChordPitches(chordIndex: number, octave: number): number[] {
  const chord = HARMONIC_FIELD[chordIndex];
  const rootMidi = 12 * (octave + 1) + chord.rootSemitone;
  return chord.intervals.map((interval) => rootMidi + interval);
}
