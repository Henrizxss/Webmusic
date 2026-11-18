export const HARMONIC_FIELD = [
  {
    name: "C",
    quality: "Maior",
    rootSemitone: 0,
    intervals: [0, 4, 7],
    fingerCount: 2,
    handsRequired: 1,
    gesture: "2 dedos erguidos em uma mão (indicador e médio)",
  },
  {
    name: "Dm",
    quality: "Menor",
    rootSemitone: 2,
    intervals: [0, 3, 7],
    fingerCount: 3,
    handsRequired: 1,
    gesture: "3 dedos erguidos em uma mão",
  },
  {
    name: "Em",
    quality: "Menor",
    rootSemitone: 4,
    intervals: [0, 3, 7],
    fingerCount: 4,
    handsRequired: 1,
    gesture: "4 dedos erguidos em uma mão",
  },
  {
    name: "F",
    quality: "Maior",
    rootSemitone: 5,
    intervals: [0, 4, 7],
    fingerCount: 5,
    handsRequired: 1,
    gesture: "5 dedos erguidos em uma mão",
  },
  {
    name: "G",
    quality: "Maior",
    rootSemitone: 7,
    intervals: [0, 4, 7],
    fingerCount: 6,
    handsRequired: 2,
    gesture: "6 dedos no total, usando as duas mãos (ex.: 3 + 3)",
  },
  {
    name: "Am",
    quality: "Menor",
    rootSemitone: 9,
    intervals: [0, 3, 7],
    fingerCount: 7,
    handsRequired: 2,
    gesture: "7 dedos no total, usando as duas mãos (ex.: 3 + 4)",
  },
  {
    name: "Bdim",
    quality: "Diminuto",
    rootSemitone: 11,
    intervals: [0, 3, 6],
    fingerCount: 8,
    handsRequired: 2,
    gesture: "8 dedos no total, usando as duas mãos (ex.: 4 + 4)",
  },
] as const;

export function getChordIndexForHands(fingerCounts: number[]): number | null {
  const totalFingers = fingerCounts.reduce((total, count) => total + count, 0);
  const index = HARMONIC_FIELD.findIndex((chord) => (
    chord.fingerCount === totalFingers
    && chord.handsRequired === fingerCounts.length
  ));
  return index < 0 ? null : index;
}

export function getChordPitches(chordIndex: number, octave: number): number[] {
  const chord = HARMONIC_FIELD[chordIndex];
  const rootMidi = 12 * (octave + 1) + chord.rootSemitone;
  return chord.intervals.map((interval) => rootMidi + interval);
}
