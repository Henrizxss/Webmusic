import { useCallback, useEffect, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { getChordIndexForHands, getChordPitches } from "./musicTheory";
import { getExtendedFingerCount, getNoteIndex, isPinching } from "./gestureRecognition";

const NOTES = [
  { note: "C", semitone: 0 },
  { note: "D", semitone: 2 },
  { note: "E", semitone: 4 },
  { note: "F", semitone: 5 },
  { note: "G", semitone: 7 },
  { note: "A", semitone: 9 },
  { note: "B", semitone: 11 },
  { note: "C", semitone: 12 },
];

export interface HandGesture {
  noteIndex: number;
  pitches: number[];
  chordIndex?: number;
}

interface HandTrackingOptions {
  octave: number;
  guitarMode: boolean;
  sustainMode: boolean;
  chordMode: boolean;
  onGesture: (gesture: HandGesture | null) => void;
}

interface HandStatus {
  count: number;
  fingerCounts: number[];
  noteIndex: number | null;
  pinching: boolean;
  chordIndex: number | null;
}

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
  [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const CHORD_STABLE_FRAMES = 5;

function getMidiNote(noteIndex: number, octave: number): number {
  return 12 * (octave + 1) + NOTES[noteIndex].semitone;
}

export function getNoteName(noteIndex: number, octave: number): string {
  const note = NOTES[noteIndex];
  return `${note.note}${octave + (note.semitone === 12 ? 1 : 0)}`;
}

export function useHandTracking({
  octave,
  guitarMode,
  sustainMode,
  chordMode,
  onGesture,
}: HandTrackingOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const previousRef = useRef({
    pinching: false,
    noteIndex: -1,
    secondY: null as number | null,
    sustainActive: false,
    sustainedNoteIndex: -1,
    sustainedGuitarMode: false,
    sustainedChordMode: false,
    chordCandidate: null as number | null,
    chordCandidateFrames: 0,
  });
  const onGestureRef = useRef(onGesture);
  const optionsRef = useRef({ octave, guitarMode, sustainMode, chordMode });
  const frameCountRef = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<HandStatus>({
    count: 0,
    fingerCounts: [],
    noteIndex: null,
    pinching: false,
    chordIndex: null,
  });

  useEffect(() => {
    onGestureRef.current = onGesture;
  }, [onGesture]);

  useEffect(() => {
    const nextOptions = { octave, guitarMode, sustainMode, chordMode };
    const previousOptions = optionsRef.current;
    if (
      previousOptions.octave !== octave
      || previousOptions.guitarMode !== guitarMode
      || previousOptions.sustainMode !== sustainMode
      || previousOptions.chordMode !== chordMode
    ) {
      if (previousRef.current.sustainActive) onGestureRef.current(null);
      previousRef.current.sustainActive = false;
      previousRef.current.sustainedNoteIndex = -1;
      previousRef.current.sustainedGuitarMode = false;
      previousRef.current.sustainedChordMode = false;
      previousRef.current.chordCandidate = null;
      previousRef.current.chordCandidateFrames = 0;
      previousRef.current.secondY = null;
      previousRef.current.pinching = false;
    }
    optionsRef.current = nextOptions;
  }, [octave, guitarMode, sustainMode, chordMode]);

  const stop = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    previousRef.current = {
      pinching: false,
      noteIndex: -1,
      secondY: null,
      sustainActive: false,
      sustainedNoteIndex: -1,
      sustainedGuitarMode: false,
      sustainedChordMode: false,
      chordCandidate: null,
      chordCandidateFrames: 0,
    };
    setIsRunning(false);
    setIsLoading(false);
    setStatus({ count: 0, fingerCounts: [], noteIndex: null, pinching: false, chordIndex: null });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const start = useCallback(async (deviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Seu navegador não permite acessar a câmera. Experimente abrir o app no Chrome ou Edge.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }),
          width: { ideal: 640, max: 640 },
          height: { ideal: 480, max: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error("Não foi possível iniciar a prévia da câmera.");
      }

      video.srcObject = stream;
      await video.play();

      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.5,
      });

      setIsRunning(true);
      let lastVideoTime = -1;
      let lastDetectionAt = 0;
      const minimumFrameInterval = 1000 / 24;

      const detectFrame = () => {
        const currentVideo = videoRef.current;
        const landmarker = landmarkerRef.current;

        if (!currentVideo || !landmarker || currentVideo.readyState < 2) {
          animationRef.current = requestAnimationFrame(detectFrame);
          return;
        }

        const now = performance.now();
        if (
          currentVideo.currentTime !== lastVideoTime
          && now - lastDetectionAt >= minimumFrameInterval
        ) {
          lastVideoTime = currentVideo.currentTime;
          lastDetectionAt = now;
          const result = landmarker.detectForVideo(currentVideo, now);
          const hands = result.landmarks;
          const geometryHands = result.worldLandmarks.length === hands.length
            ? result.worldLandmarks
            : hands;
          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d");
          const primaryHand = hands[0];
          const previous = previousRef.current;
          const noteIndex = primaryHand ? getNoteIndex(primaryHand, previous.noteIndex) : null;
          const pinching = geometryHands[0]
            ? isPinching(geometryHands[0], previous.pinching)
            : false;
          const {
            octave: currentOctave,
            guitarMode: currentGuitarMode,
            sustainMode: currentSustainMode,
            chordMode: currentChordMode,
          } = optionsRef.current;
          const fingerCounts = currentChordMode
            ? hands.map((hand, index) => getExtendedFingerCount(hand, geometryHands[index]))
            : [];
          const chordIndex = currentChordMode ? getChordIndexForHands(fingerCounts) : null;

          if (currentChordMode) {
            previous.secondY = null;
            if (chordIndex === previous.chordCandidate) {
              previous.chordCandidateFrames = Math.min(
                previous.chordCandidateFrames + 1,
                CHORD_STABLE_FRAMES,
              );
            } else {
              previous.chordCandidate = chordIndex;
              previous.chordCandidateFrames = 1;
            }

            if (previous.chordCandidateFrames >= CHORD_STABLE_FRAMES && chordIndex !== null) {
              if (
                !previous.sustainActive
                || previous.sustainedNoteIndex !== chordIndex
                || !previous.sustainedChordMode
              ) {
                if (previous.sustainActive) onGestureRef.current(null);
                onGestureRef.current({
                  noteIndex: chordIndex,
                  chordIndex,
                  pitches: getChordPitches(chordIndex, currentOctave),
                });
                previous.sustainActive = true;
                previous.sustainedNoteIndex = chordIndex;
                previous.sustainedChordMode = true;
              }
            } else if (previous.chordCandidateFrames >= CHORD_STABLE_FRAMES && previous.sustainActive) {
              onGestureRef.current(null);
              previous.sustainActive = false;
              previous.sustainedNoteIndex = -1;
              previous.sustainedChordMode = false;
            }
          } else if (currentSustainMode) {
            previous.chordCandidate = null;
            previous.chordCandidateFrames = 0;
            if (previous.sustainActive && previous.sustainedChordMode) {
              onGestureRef.current(null);
              previous.sustainActive = false;
              previous.sustainedNoteIndex = -1;
              previous.sustainedChordMode = false;
            }
            if (currentGuitarMode) {
              if (primaryHand && hands[1] && noteIndex !== null) {
                const strumY = hands[1][8].y;
                if (previous.secondY !== null && Math.abs(strumY - previous.secondY) > 0.045) {
                  const root = getMidiNote(noteIndex, currentOctave);
                  onGestureRef.current({ noteIndex, pitches: [root, root + 4, root + 7] });
                  previous.sustainActive = true;
                  previous.sustainedNoteIndex = noteIndex;
                  previous.sustainedGuitarMode = true;
                  previous.sustainedChordMode = false;
                }
                previous.secondY = strumY;
              } else {
                previous.secondY = null;
                if (previous.sustainActive) {
                  onGestureRef.current(null);
                  previous.sustainActive = false;
                  previous.sustainedNoteIndex = -1;
                  previous.sustainedChordMode = false;
                }
              }
            } else {
              previous.secondY = null;
              if (pinching && noteIndex !== null) {
                if (
                  !previous.sustainActive
                  || previous.sustainedNoteIndex !== noteIndex
                  || previous.sustainedGuitarMode
                ) {
                  if (previous.sustainActive) onGestureRef.current(null);
                  onGestureRef.current({
                    noteIndex,
                    pitches: [getMidiNote(noteIndex, currentOctave)],
                  });
                  previous.sustainActive = true;
                  previous.sustainedNoteIndex = noteIndex;
                  previous.sustainedGuitarMode = false;
                  previous.sustainedChordMode = false;
                }
              } else if (previous.sustainActive) {
                onGestureRef.current(null);
                previous.sustainActive = false;
                previous.sustainedNoteIndex = -1;
                previous.sustainedChordMode = false;
              }
            }
          } else {
            previous.chordCandidate = null;
            previous.chordCandidateFrames = 0;
            if (previous.sustainActive) {
              onGestureRef.current(null);
              previous.sustainActive = false;
              previous.sustainedNoteIndex = -1;
              previous.sustainedChordMode = false;
              previous.pinching = false;
            }

            if (currentGuitarMode && primaryHand && hands[1]) {
              const strumY = hands[1][8].y;
              if (previous.secondY !== null && Math.abs(strumY - previous.secondY) > 0.045 && noteIndex !== null) {
                const root = getMidiNote(noteIndex, currentOctave);
                onGestureRef.current({ noteIndex, pitches: [root, root + 4, root + 7] });
              }
              previous.secondY = strumY;
            } else if (pinching && noteIndex !== null && (!previous.pinching || noteIndex !== previous.noteIndex)) {
              onGestureRef.current({
                noteIndex,
                pitches: [getMidiNote(noteIndex, currentOctave)],
              });
              previous.secondY = null;
            } else if (!pinching) {
              previous.secondY = null;
            }
          }

          previous.pinching = pinching;
          previous.noteIndex = noteIndex ?? -1;

          if (canvas && context) {
            if (canvas.width !== currentVideo.videoWidth || canvas.height !== currentVideo.videoHeight) {
              canvas.width = currentVideo.videoWidth;
              canvas.height = currentVideo.videoHeight;
            }

            context.clearRect(0, 0, canvas.width, canvas.height);
            hands.forEach((hand) => {
              context.lineWidth = Math.max(2, canvas.width / 280);
              context.strokeStyle = "rgba(237, 53, 89, 0.72)";
              context.fillStyle = "#ead7f5";
              CONNECTIONS.forEach(([start, end]) => {
                context.beginPath();
                context.moveTo((1 - hand[start].x) * canvas.width, hand[start].y * canvas.height);
                context.lineTo((1 - hand[end].x) * canvas.width, hand[end].y * canvas.height);
                context.stroke();
              });
              hand.forEach((point) => {
                context.beginPath();
                context.arc((1 - point.x) * canvas.width, point.y * canvas.height, canvas.width / 110, 0, Math.PI * 2);
                context.fill();
              });
            });
          }

          frameCountRef.current += 1;
          if (frameCountRef.current % 6 === 0) {
            setStatus((current) => {
              const next = {
                count: hands.length,
                fingerCounts,
                noteIndex: currentChordMode && chordIndex !== null ? chordIndex : noteIndex,
                pinching,
                chordIndex,
              };
              return current.count === next.count
                && current.fingerCounts.length === next.fingerCounts.length
                && current.fingerCounts.every((count, index) => count === next.fingerCounts[index])
                && current.noteIndex === next.noteIndex
                && current.pinching === next.pinching
                && current.chordIndex === next.chordIndex
                ? current
                : next;
            });
          }
        }

        animationRef.current = requestAnimationFrame(detectFrame);
      };

      animationRef.current = requestAnimationFrame(detectFrame);
    } catch (caught) {
      stop();
      const message = caught instanceof Error ? caught.message : "Não foi possível iniciar a câmera.";
      const normalizedMessage = message.toLowerCase();
      setError(
        normalizedMessage.includes("permission")
          ? "Permita o acesso à câmera nas configurações do navegador e tente novamente."
          : normalizedMessage.includes("notfound") || normalizedMessage.includes("overconstrained")
            ? "A câmera escolhida não está disponível. Selecione outra câmera e tente novamente."
            : `Não foi possível iniciar o estúdio: ${message}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return {
    videoRef,
    canvasRef,
    isLoading,
    isRunning,
    error,
    clearError,
    status,
    start,
    stop,
  };
}
