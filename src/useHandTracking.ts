import { useCallback, useEffect, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { getChordIndexForGesture, getChordPitches } from "./musicTheory";
import { getChordHandTilt, getExtendedFingerCount } from "./gestureRecognition";

export interface HandGesture {
  pitches: number[];
  chordIndex: number;
}

interface HandTrackingOptions {
  octave: number;
  onGesture: (gesture: HandGesture | null) => void;
}

interface HandStatus {
  count: number;
  fingerCounts: number[];
  chordIndex: number | null;
}

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
  [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const CHORD_STABLE_FRAMES = 5;

export function useHandTracking({ octave, onGesture }: HandTrackingOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const previousRef = useRef({
    sustainActive: false,
    sustainedChordIndex: -1,
    chordCandidate: null as number | null,
    chordCandidateFrames: 0,
  });
  const onGestureRef = useRef(onGesture);
  const optionsRef = useRef({ octave });
  const frameCountRef = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<HandStatus>({
    count: 0,
    fingerCounts: [],
    chordIndex: null,
  });

  useEffect(() => {
    onGestureRef.current = onGesture;
  }, [onGesture]);

  useEffect(() => {
    const nextOptions = { octave };
    const previousOptions = optionsRef.current;
    if (previousOptions.octave !== octave) {
      if (previousRef.current.sustainActive) onGestureRef.current(null);
      previousRef.current.sustainActive = false;
      previousRef.current.sustainedChordIndex = -1;
      previousRef.current.chordCandidate = null;
      previousRef.current.chordCandidateFrames = 0;
    }
    optionsRef.current = nextOptions;
  }, [octave]);

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
      sustainActive: false,
      sustainedChordIndex: -1,
      chordCandidate: null,
      chordCandidateFrames: 0,
    };
    setIsRunning(false);
    setIsLoading(false);
    setStatus({ count: 0, fingerCounts: [], chordIndex: null });
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
        numHands: 1,
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
          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d");
          const primaryHand = hands[0];
          const previous = previousRef.current;
          const fingerCounts = primaryHand ? [getExtendedFingerCount(primaryHand)] : [];
          const handTilt = primaryHand ? getChordHandTilt(primaryHand) : null;
          const chordIndex = primaryHand && handTilt
            ? getChordIndexForGesture(fingerCounts[0], handTilt)
            : null;

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
            if (!previous.sustainActive || previous.sustainedChordIndex !== chordIndex) {
              if (previous.sustainActive) onGestureRef.current(null);
              onGestureRef.current({
                chordIndex,
                pitches: getChordPitches(chordIndex, optionsRef.current.octave),
              });
              previous.sustainActive = true;
              previous.sustainedChordIndex = chordIndex;
            }
          } else if (previous.chordCandidateFrames >= CHORD_STABLE_FRAMES && previous.sustainActive) {
            onGestureRef.current(null);
            previous.sustainActive = false;
            previous.sustainedChordIndex = -1;
          }

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
                chordIndex,
              };
              return current.count === next.count
                && current.fingerCounts.length === next.fingerCounts.length
                && current.fingerCounts.every((count, index) => count === next.fingerCounts[index])
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
