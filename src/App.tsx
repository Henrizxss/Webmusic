import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowDownRight,
  AudioLines,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  Github,
  Guitar,
  Hand,
  Headphones,
  Keyboard,
  Linkedin,
  Mic2,
  Moon,
  Music2,
  Play,
  RotateCcw,
  Sun,
  Volume2,
  Webcam,
  X,
} from "lucide-react";
import { useHandTracking, type HandGesture } from "./useHandTracking";
import {
  CHORD_GESTURE_SLOTS,
  CHORD_OPTIONS,
  DEFAULT_CHORD_ASSIGNMENTS,
  getChordOption,
  parseChordGestureAssignments,
  type ChordGestureAssignments,
} from "./musicTheory";

const PIANO_NOTES = ["C", "D", "E", "F", "G", "A", "B", "C"];
const CHROMATIC_ROOTS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const BLACK_KEYS = [
  { note: "C♯", semitone: 1, after: 0, keyboard: "W" },
  { note: "D♯", semitone: 3, after: 1, keyboard: "E" },
  { note: "F♯", semitone: 6, after: 3, keyboard: "T" },
  { note: "G♯", semitone: 8, after: 4, keyboard: "Y" },
  { note: "A♯", semitone: 10, after: 5, keyboard: "U" },
];
const KEY_LABELS = ["A", "S", "D", "F", "G", "H", "J", "K"];
const WHITE_KEY_SEMITONES = [0, 2, 4, 5, 7, 9, 11, 12];
function getKeyboardNoteName(noteIndex: number, octave: number): string {
  return `${PIANO_NOTES[noteIndex]}${octave + (noteIndex === 7 ? 1 : 0)}`;
}
const TIMBRES = [
  "Piano elétrico",
  "Guitarra",
  "Sintetizador",
  "Flauta",
  "Sino",
] as const;
type Timbre = (typeof TIMBRES)[number];

interface TimbrePreset {
  waveform: OscillatorType;
  partials: number[];
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cutoff: number;
}

const TIMBRE_PRESETS: Record<Timbre, TimbrePreset> = {
  "Piano elétrico": {
    waveform: "triangle",
    partials: [1, 0.2],
    attack: 0.008,
    decay: 0.1,
    sustain: 0.2,
    release: 0.32,
    cutoff: 3600,
  },
  Guitarra: {
    waveform: "sawtooth",
    partials: [1, 0.16],
    attack: 0.004,
    decay: 0.08,
    sustain: 0.12,
    release: 0.2,
    cutoff: 2200,
  },
  Sintetizador: {
    waveform: "square",
    partials: [1, 0.12],
    attack: 0.02,
    decay: 0.12,
    sustain: 0.32,
    release: 0.35,
    cutoff: 5200,
  },
  Flauta: {
    waveform: "sine",
    partials: [1, 0.06],
    attack: 0.055,
    decay: 0.12,
    sustain: 0.55,
    release: 0.3,
    cutoff: 4600,
  },
  Sino: {
    waveform: "sine",
    partials: [1, 0.48, 0.2, 0.08],
    attack: 0.004,
    decay: 0.16,
    sustain: 0.08,
    release: 0.8,
    cutoff: 7000,
  },
};

interface SustainedVoice {
  oscillator: OscillatorNode;
  filter: BiquadFilterNode;
  envelope: GainNode;
  release: number;
}

type MediaDevicesWithOutputSelection = MediaDevices & {
  selectAudioOutput?: () => Promise<MediaDeviceInfo>;
};

const CHORD_ASSIGNMENTS_STORAGE_KEY = "tkgesture.chord-gesture-assignments.v1";

interface ChordAssignmentState {
  assignments: ChordGestureAssignments;
  storageError: string | null;
}

function loadChordAssignmentState(): ChordAssignmentState {
  try {
    const stored = window.localStorage.getItem(CHORD_ASSIGNMENTS_STORAGE_KEY);
    if (!stored) {
      return { assignments: { ...DEFAULT_CHORD_ASSIGNMENTS }, storageError: null };
    }

    const parsed: unknown = JSON.parse(stored);
    const assignments = parseChordGestureAssignments(parsed);
    if (!assignments) {
      throw new Error("A configuração salva não corresponde aos gestos disponíveis.");
    }
    return { assignments, storageError: null };
  } catch (caught: unknown) {
    console.error("Não foi possível carregar os acordes dos gestos:", caught);
    return {
      assignments: { ...DEFAULT_CHORD_ASSIGNMENTS },
      storageError: "Não foi possível carregar as configurações salvas. Os padrões estão ativos; edite um gesto para salvar novamente.",
    };
  }
}

function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [octave, setOctave] = useState(4);
  const [volume, setVolume] = useState(80);
  const [instrument, setInstrument] = useState<Timbre>("Piano elétrico");
  const [chordAssignmentState, setChordAssignmentState] = useState(loadChordAssignmentState);
  const chordAssignments = chordAssignmentState.assignments;
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [motionReady, setMotionReady] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const audioOutputRef = useRef<HTMLAudioElement>(null);
  const scrollProgressRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const sustainedVoicesRef = useRef<Map<number, SustainedVoice[]>>(new Map());

  useEffect(() => {
    if (chordAssignmentState.storageError) return;
    try {
      window.localStorage.setItem(
        CHORD_ASSIGNMENTS_STORAGE_KEY,
        JSON.stringify(chordAssignmentState.assignments),
      );
    } catch (caught: unknown) {
      console.error("Não foi possível salvar os acordes dos gestos:", caught);
      setChordAssignmentState((current) => ({
        ...current,
        storageError: "Não foi possível salvar os acordes neste navegador.",
      }));
    }
  }, [chordAssignmentState]);

  const refreshMediaDevices = useCallback(async () => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return;

    const devices = await mediaDevices.enumerateDevices();
    setCameraDevices(devices.filter((device) => device.kind === "videoinput"));
    setAudioOutputDevices(devices.filter(
      (device) => device.kind === "audiooutput" && device.deviceId !== "" && device.deviceId !== "default",
    ));
  }, []);

  const handleRefreshDevices = async () => {
    try {
      await refreshMediaDevices();
      setDeviceError(null);
    } catch (caught: unknown) {
      console.error("Não foi possível atualizar os dispositivos:", caught);
      setDeviceError("Não foi possível atualizar a lista de dispositivos.");
    }
  };

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) {
      setDeviceError("Este navegador não permite acessar os dispositivos de câmera e áudio.");
      return;
    }

    const updateDevices = () => {
      void refreshMediaDevices().catch((caught: unknown) => {
        console.error("Não foi possível atualizar a lista de dispositivos:", caught);
        setDeviceError("Não foi possível listar os dispositivos conectados.");
      });
    };

    updateDevices();
    mediaDevices.addEventListener("devicechange", updateDevices);
    return () => mediaDevices.removeEventListener("devicechange", updateDevices);
  }, [refreshMediaDevices]);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });

      document.querySelectorAll<HTMLElement>(".app-shell [data-reveal]").forEach((element) => {
        observer?.observe(element);
      });
      setMotionReady(true);
    }

    let scheduledFrame = 0;
    const updateScrollProgress = () => {
      if (scheduledFrame) return;
      scheduledFrame = window.requestAnimationFrame(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
        scrollProgressRef.current?.style.setProperty("transform", `scaleX(${progress})`);
        scheduledFrame = 0;
      });
    };

    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    updateScrollProgress();

    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", updateScrollProgress);
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
    };
  }, []);

  const ensureAudio = useCallback(async () => {
    try {
      let context = audioContextRef.current;
      if (!context || context.state === "closed") {
        context = new window.AudioContext({ latencyHint: "interactive" });
        const masterGain = context.createGain();
        const audioOutput = audioOutputRef.current;
        masterGain.gain.value = (volume / 100) * 0.42;

        if (audioOutput && typeof audioOutput.setSinkId === "function") {
          const outputDestination = context.createMediaStreamDestination();
          masterGain.connect(outputDestination);
          audioOutput.srcObject = outputDestination.stream;
          const playback = audioOutput.play();
          audioContextRef.current = context;
          masterGainRef.current = masterGain;
          if (context.state !== "running") await context.resume();
          await playback;
          return;
        }

        masterGain.connect(context.destination);
        audioContextRef.current = context;
        masterGainRef.current = masterGain;
      }

      if (context.state !== "running") {
        await context.resume();
      }
    } catch (caught: unknown) {
      console.error("Erro ao ativar o estúdio:", caught);
      setAudioError("Não foi possível iniciar o áudio. Verifique as permissões do navegador e tente novamente.");
      throw caught;
    }
  }, [volume]);

  const changeAudioOutput = async (deviceId: string) => {
    try {
      await ensureAudio();
      const audioOutput = audioOutputRef.current;
      if (!audioOutput || typeof audioOutput.setSinkId !== "function") {
        throw new Error("Seu navegador não permite selecionar uma saída de áudio.");
      }

      await audioOutput.setSinkId(deviceId);
      setSelectedAudioOutputId(deviceId);
      setDeviceError(null);
    } catch (caught: unknown) {
      console.error("Erro ao selecionar a saída de áudio:", caught);
      setDeviceError("Não foi possível selecionar essa saída de áudio. Confira as permissões do navegador.");
    }
  };

  const chooseAudioOutput = async () => {
    const mediaDevices = navigator.mediaDevices as MediaDevicesWithOutputSelection;
    if (!mediaDevices.selectAudioOutput) {
      setDeviceError("Seu navegador não permite escolher a saída de áudio pelo aplicativo.");
      return;
    }

    try {
      const audioReady = ensureAudio();
      const selection = mediaDevices.selectAudioOutput();
      const [selectedDevice] = await Promise.all([selection, audioReady.then(() => null)]);
      await changeAudioOutput(selectedDevice.deviceId);
      await handleRefreshDevices();
    } catch (caught: unknown) {
      if (caught instanceof Error && caught.name === "NotAllowedError") return;
      console.error("Erro ao escolher uma saída de áudio:", caught);
      setDeviceError("Não foi possível abrir a seleção de saída de áudio.");
    }
  };

  const playMidiNotes = useCallback((midiNotes: number[]) => {
    const context = audioContextRef.current;
    const masterGain = masterGainRef.current;
    if (!context || !masterGain || context.state !== "running") {
      throw new Error("O áudio ainda não está pronto. Toque novamente para ativá-lo.");
    }

    const preset = TIMBRE_PRESETS[instrument];
    const now = context.currentTime;
    const noteDuration = 0.22;

    midiNotes.forEach((midi) => {
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      preset.partials.forEach((partial, index) => {
        const oscillator = context.createOscillator();
        const filter = context.createBiquadFilter();
        const envelope = context.createGain();
        const peak = partial * 0.68;
        const releaseTime = now + noteDuration;

        oscillator.type = preset.waveform;
        oscillator.frequency.setValueAtTime(frequency * (index + 1), now);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(preset.cutoff, now);
        filter.Q.setValueAtTime(0.7, now);

        envelope.gain.setValueAtTime(0.0001, now);
        envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + preset.attack);
        envelope.gain.setTargetAtTime(
          Math.max(0.0001, peak * preset.sustain),
          now + preset.attack,
          preset.decay,
        );
        envelope.gain.setValueAtTime(Math.max(0.0001, peak * preset.sustain), releaseTime);
        envelope.gain.exponentialRampToValueAtTime(0.0001, releaseTime + preset.release);

        oscillator.connect(filter);
        filter.connect(envelope);
        envelope.connect(masterGain);
        oscillator.start(now);
        oscillator.stop(releaseTime + preset.release + 0.03);
      });
    });
  }, [instrument]);

  const releaseSustainedNotes = useCallback(() => {
    const context = audioContextRef.current;
    const voicesByNote = sustainedVoicesRef.current;
    if (voicesByNote.size === 0) return;
    if (!context || context.state === "closed") {
      voicesByNote.clear();
      setActiveNotes([]);
      return;
    }

    const now = context.currentTime;

    voicesByNote.forEach((voices) => {
      voices.forEach(({ oscillator, filter, envelope, release }) => {
        envelope.gain.cancelScheduledValues(now);
        envelope.gain.setTargetAtTime(0.0001, now, Math.max(0.015, release / 5));
        oscillator.stop(now + release);
        oscillator.addEventListener("ended", () => {
          oscillator.disconnect();
          filter.disconnect();
          envelope.disconnect();
        }, { once: true });
      });
    });
    voicesByNote.clear();
    setActiveNotes([]);
  }, []);

  const playSustainedNotes = useCallback((midiNotes: number[]) => {
    const context = audioContextRef.current;
    const masterGain = masterGainRef.current;
    if (!context || !masterGain || context.state !== "running") {
      throw new Error("O áudio ainda não está pronto. Toque novamente para ativá-lo.");
    }

    releaseSustainedNotes();
    const preset = TIMBRE_PRESETS[instrument];
    const now = context.currentTime;
    const uniqueNotes = [...new Set(midiNotes)];

    uniqueNotes.forEach((midi) => {
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      const voices: SustainedVoice[] = [];

      preset.partials.forEach((partial, index) => {
        const oscillator = context.createOscillator();
        const filter = context.createBiquadFilter();
        const envelope = context.createGain();
        const peak = partial * 0.68;

        oscillator.type = preset.waveform;
        oscillator.frequency.setValueAtTime(frequency * (index + 1), now);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(preset.cutoff, now);
        filter.Q.setValueAtTime(0.7, now);

        envelope.gain.setValueAtTime(0.0001, now);
        envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + preset.attack);
        envelope.gain.setTargetAtTime(
          Math.max(0.0001, peak * preset.sustain),
          now + preset.attack,
          preset.decay,
        );

        oscillator.connect(filter);
        filter.connect(envelope);
        envelope.connect(masterGain);
        oscillator.start(now);
        voices.push({ oscillator, filter, envelope, release: preset.release });
      });

      sustainedVoicesRef.current.set(midi, voices);
    });
    setActiveNotes(uniqueNotes);
  }, [instrument, releaseSustainedNotes]);

  const playGesture = useCallback((gesture: HandGesture | null) => {
    if (!gesture) {
      releaseSustainedNotes();
      return;
    }

    try {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      playSustainedNotes(gesture.pitches);
    } catch (caught: unknown) {
      console.error("Erro ao tocar uma nota reconhecida:", caught);
      setAudioError("Não foi possível tocar a nota. Verifique o volume e o dispositivo de saída.");
    }
  }, [playSustainedNotes, releaseSustainedNotes]);

  const camera = useHandTracking({
    octave,
    assignments: chordAssignments,
    onGesture: playGesture,
  });

  const startCamera = async (deviceId = selectedCameraId) => {
    try {
      setAudioError(null);
      await ensureAudio();
      await camera.start(deviceId || undefined);
      await handleRefreshDevices();
    } catch (caught: unknown) {
      console.error("Erro ao iniciar a câmera:", caught);
      releaseSustainedNotes();
      setAudioError("Não foi possível iniciar o áudio ou a câmera. Confira as permissões e tente novamente.");
    }
  };

  const stopCamera = () => {
    releaseSustainedNotes();
    camera.stop();
  };

  const playKey = useCallback((noteIndex: number) => {
    const midi = 12 * (octave + 1) + WHITE_KEY_SEMITONES[noteIndex];
    void ensureAudio().then(() => {
      releaseSustainedNotes();
      playMidiNotes([midi]);
      setActiveNotes((current) => [...new Set([...current, midi])]);
      window.setTimeout(() => setActiveNotes((current) => current.filter((note) => note !== midi)), 220);
    }).catch((caught: unknown) => {
      console.error("Erro ao tocar a nota:", caught);
      setAudioError("Não foi possível tocar a nota. Verifique o volume e o dispositivo de saída.");
    });
  }, [ensureAudio, octave, playMidiNotes, releaseSustainedNotes]);

  const playBlackKey = useCallback((semitone: number) => {
    const midi = 12 * (octave + 1) + semitone;
    void ensureAudio().then(() => {
      releaseSustainedNotes();
      playMidiNotes([midi]);
      setActiveNotes((current) => [...new Set([...current, midi])]);
      window.setTimeout(() => setActiveNotes((current) => current.filter((note) => note !== midi)), 220);
    }).catch((caught: unknown) => {
      console.error("Erro ao tocar a nota:", caught);
      setAudioError("Não foi possível tocar a nota. Verifique o volume e o dispositivo de saída.");
    });
  }, [ensureAudio, octave, playMidiNotes, releaseSustainedNotes]);

  useEffect(() => {
    const keyMap = new Map([
      ...KEY_LABELS.map((key, index) => [key.toLowerCase(), () => playKey(index)] as const),
      ...BLACK_KEYS.map((key) => [key.keyboard.toLowerCase(), () => playBlackKey(key.semitone)] as const),
    ]);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      keyMap.get(event.key.toLowerCase())?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [playBlackKey, playKey]);

  useEffect(() => () => {
    camera.stop();
    const context = audioContextRef.current;
    audioContextRef.current = null;
    masterGainRef.current = null;
    if (context && context.state !== "closed") void context.close();
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  }, [camera.stop]);

  const changeCamera = (deviceId: string) => {
    setSelectedCameraId(deviceId);
    if (camera.isRunning) {
      releaseSustainedNotes();
      camera.stop();
      void startCamera(deviceId);
    }
  };

  const clearError = () => {
    camera.clearError();
    setAudioError(null);
  };

  return (
    <main className={`app-shell${motionReady ? " motion-ready" : ""}`} data-theme={theme}>
      <div className="scroll-progress" aria-hidden="true"><span ref={scrollProgressRef} /></div>
      <header className="topbar">
        <a className="brand" href="#" aria-label="TKGesture — início">
          <span className="brand-mark"><img src="/images/tkgesture-chibi.png" alt="Chibi de olho vermelho bebendo café" /></span>
          <span className="brand-name">TK<span>Gesture</span></span>
          <span className="brand-divider" />
          <span className="brand-caption">SEU INSTRUMENTO INTERATIVO</span>
        </a>
        <audio ref={audioOutputRef} className="audio-output" autoPlay aria-hidden="true" />

        <div className="topbar-actions">
          <button className="icon-button help-button" aria-label="Como funciona" onClick={() => setShowHelp(true)}>
            <CircleHelp size={18} />
          </button>
          <span className="topbar-divider" />
          <button
            className="theme-toggle"
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun size={16} className={theme === "light" ? "theme-active" : ""} />
            <span className="theme-thumb"><span /></span>
            <Moon size={15} className={theme === "dark" ? "theme-active" : ""} />
          </button>
          <div className="social-links" aria-label="Redes sociais">
            <a href="https://github.com/Henrizxss" target="_blank" rel="noopener noreferrer" aria-label="GitHub de Henrique Alves">
              <Github size={16} />
            </a>
            <a href="https://www.linkedin.com/in/henriquealvessantos/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn de Henrique Alves">
              <Linkedin size={16} />
            </a>
          </div>
        </div>
      </header>

      <section className="studio">
        <div className="intro-row" data-reveal="up">
          <div className="intro-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> SEU ESPAÇO PARA TOCAR</div>
            <h1>Suas mãos. <span>Seu som.</span></h1>
            <p className="intro-description">Um instrumento inteiro, à distância de um gesto.</p>
          </div>
          <div className="session-badge"><span className="session-dot" /> ESTÚDIO PESSOAL <span className="badge-separator">/</span> 01</div>
        </div>

        <div className="studio-grid">
          <section className="camera-card card-surface" data-reveal="left">
            <div className="camera-topline">
              <span className="section-label"><Webcam size={14} /> CÂMERA AO VIVO</span>
              <span className={`live-badge ${camera.isRunning ? "is-live" : ""}`}>
                <span /> {camera.isRunning ? "AO VIVO" : "EM ESPERA"}
              </span>
            </div>

            <div className={`camera-view ${camera.isRunning ? "camera-active" : ""}`}>
              <video ref={camera.videoRef} className="camera-video" autoPlay muted playsInline />
              <canvas ref={camera.canvasRef} className="camera-overlay" aria-hidden="true" />
              <div className="camera-corner corner-tl" />
              <div className="camera-corner corner-tr" />
              <div className="camera-corner corner-bl" />
              <div className="camera-corner corner-br" />

              {!camera.isRunning && (
                <div className="camera-placeholder">
                  <div className="camera-orbit orbit-one" />
                  <div className="camera-orbit orbit-two" />
                  <div className="camera-illustration">
                    <Hand size={44} strokeWidth={1.15} />
                    <span className="illustration-spark spark-one">✳</span>
                    <span className="illustration-spark spark-two">✳</span>
                    <span className="illustration-spark spark-three">·</span>
                  </div>
                  <p className="camera-placeholder-title">
                    {camera.isLoading ? "Preparando seu estúdio..." : "Tudo começa com suas mãos"}
                  </p>
                  <p className="camera-placeholder-subtitle">
                    {camera.isLoading
                      ? "Ativando a câmera e carregando o instrumento."
                      : "Posicione-se em um lugar iluminado para tocar."}
                  </p>
                </div>
              )}

              {camera.isRunning && (
                <>
                  <span className="camera-chip"><span /> RECONHECIMENTO ATIVO</span>
                  <div className="camera-readout">
                    <AudioLines size={12} />
                    {camera.status.count} {camera.status.count === 1 ? "mão" : "mãos"} detectada{camera.status.count === 1 ? "" : "s"}
                    {camera.status.fingerCounts.length > 0 && (
                      <> · {camera.status.fingerCounts.join(" + ")} {camera.status.fingerCounts.reduce((total, count) => total + count, 0) === 1 ? "dedo" : "dedos"}</>
                    )}
                  </div>
                  {camera.status.chordName !== null && (
                    <div className="note-cursor note-cursor-active">
                      <span>{camera.status.chordName}</span>
                      <span className="cursor-line" />
                    </div>
                  )}
                  {camera.status.count === 0 && (
                    <div className="camera-tip"><Hand size={15} /> Mostre a palma da mão para começar</div>
                  )}
                </>
              )}
            </div>

            {(camera.error || audioError) && (
              <div className="camera-error" role="alert">
                <span>{camera.error || audioError}</span>
                <button aria-label="Fechar mensagem de erro" onClick={clearError}><X size={15} /></button>
              </div>
            )}

            <div className="camera-footer">
              <div className="privacy-note"><span className="privacy-lock">⌑</span> Sua câmera, sua privacidade. Nada é gravado.</div>
              {!camera.isRunning ? (
                <button className="camera-action button-primary" disabled={camera.isLoading} onClick={() => void startCamera()}>
                  {camera.isLoading
                    ? <><span className="button-spinner" /> Preparando...</>
                    : <><Play size={15} fill="currentColor" /> Ativar minha câmera <ArrowDownRight size={14} /></>}
                </button>
              ) : (
                <button className="camera-action button-stop" onClick={stopCamera}>
                  <span className="stop-square" /> Encerrar sessão
                </button>
              )}
            </div>
          </section>

          <section className="instrument-card card-surface" data-reveal="right" style={{ "--reveal-delay": "90ms" } as CSSProperties}>
            <div className="instrument-topline">
              <span className="section-label"><Music2 size={14} /> SEU TIMBRE</span>
              <label className="instrument-select">
                {instrument === "Guitarra" ? <Guitar size={13} /> : <AudioLines size={13} />}
                <span>{instrument}</span>
                <select
                  aria-label="Escolher timbre"
                  value={instrument}
                  onChange={(event) => {
                    const selected = TIMBRES.find((timbre) => timbre === event.target.value);
                    if (selected) {
                      setInstrument(selected);
                    }
                  }}
                >
                  {TIMBRES.map((timbre) => <option key={timbre} value={timbre}>{timbre}</option>)}
                </select>
                <ChevronDown size={13} />
              </label>
            </div>

            <div className="instrument-display">
              <div className="instrument-visual">
                <div className="soundwave">
                  {[17, 31, 23, 40, 26, 47, 33, 56, 38, 48, 28, 41, 22, 33, 17, 26, 14].map((height, index) => (
                    <span key={index} style={{ "--bar-height": `${height}px`, "--bar-delay": `${index * 0.055}s` } as CSSProperties} />
                  ))}
                </div>
                <div className="instrument-orb"><AudioLines size={22} strokeWidth={1.6} /></div>
                <span className="orb-ring" />
              </div>
              <div className="instrument-caption">
                <span>12 TÔNICAS CROMÁTICAS</span>
                <div>{CHROMATIC_ROOTS.map((note) => <span className="note-pill" key={note}>{note}</span>)}</div>
              </div>
            </div>

            <div className="control-divider" />

            <div className="controls-heading">
              <div><span className="section-label"><Command size={13} /> CONTROLES</span><span className="controls-hint">Ajuste seu som</span></div>
              <button className="reset-button" onClick={() => {
                releaseSustainedNotes();
                setOctave(4);
                setVolume(80);
                setInstrument("Piano elétrico");
              }}><RotateCcw size={12} /> REDEFINIR</button>
            </div>

            <div className="octave-control">
              <div className="control-label"><span>Oitava</span><span className="octave-value">C{octave} — C{octave + 1}</span></div>
              <div className="octave-slider-row">
                <span className="octave-edge">C2</span>
                <input aria-label="Oitava do instrumento" type="range" min="2" max="6" step="1" value={octave} onChange={(event) => setOctave(Number(event.target.value))} />
                <span className="octave-edge">C6</span>
              </div>
              <div className="slider-marks" aria-hidden="true">{[2, 3, 4, 5, 6].map((number) => <span key={number} className={number === octave ? "mark-active" : ""} />)}</div>
            </div>

            <div className="volume-control">
              <div className="control-label"><span>Volume</span><span className="volume-value"><Volume2 size={13} /> {volume}%</span></div>
              <input aria-label="Volume do instrumento" type="range" min="0" max="100" value={volume} onChange={(event) => {
                const nextVolume = Number(event.target.value);
                setVolume(nextVolume);
                const context = audioContextRef.current;
                const masterGain = masterGainRef.current;
                if (context && masterGain) {
                  masterGain.gain.setTargetAtTime((nextVolume / 100) * 0.42, context.currentTime, 0.02);
                }
              }} />
            </div>

            <p className="sustain-auto-note"><AudioLines size={13} />Modo acorde: o som permanece enquanto o gesto for reconhecido.</p>
          </section>
        </div>

        <section className="devices-card card-surface" aria-labelledby="devices-title" data-reveal="up">
          <div className="devices-heading">
            <div>
              <span className="section-label"><Webcam size={14} /> DISPOSITIVOS</span>
              <h2 id="devices-title">Escolha sua câmera e saída de áudio</h2>
            </div>
            <button className="device-refresh-button" type="button" onClick={() => void handleRefreshDevices()}>
            <RotateCcw size={12} /> ATUALIZAR
            </button>
          </div>
          <div className="device-controls">
            <label className="device-field">
              <span><Webcam size={14} /> Câmera</span>
              <select aria-label="Dispositivo de câmera" value={selectedCameraId} onChange={(event) => changeCamera(event.target.value)}>
                <option value="">Câmera padrão</option>
                {cameraDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Câmera ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="device-field">
              <span><Headphones size={14} /> Saída de áudio</span>
              <select aria-label="Dispositivo de saída de áudio" value={selectedAudioOutputId} onChange={(event) => void changeAudioOutput(event.target.value)}>
                <option value="">Saída padrão do sistema</option>
                {audioOutputDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Saída de áudio ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
            <button className="device-choose-button" type="button" onClick={chooseAudioOutput}>
              <Headphones size={13} /> ESCOLHER SAÍDA
            </button>
            <button className="test-sound-button" type="button" onClick={() => playKey(0)}>
              <Play size={13} fill="currentColor" /> TESTAR SOM
            </button>
          </div>
          {(deviceError || audioOutputDevices.length === 0) && (
            <p className={deviceError ? "device-message device-error-message" : "device-message"}>
              {deviceError || "Nenhuma saída adicional detectada. Use “Escolher saída” ou conecte um fone ou alto-falante."}
            </p>
          )}
        </section>

        <section className="gesture-guide card-surface" aria-labelledby="gesture-guide-title" data-reveal="up">
          <div className="gesture-guide-heading">
            <div>
              <span className="section-label"><Hand size={14} /> GESTOS &amp; ACORDES</span>
              <h2 id="gesture-guide-title">Configure os acordes dos gestos</h2>
              <p className="gesture-guide-description">
                Use uma mão e conte até quatro dedos, sem contar o polegar. Mão reta/direita: 1=C, 2=Dm, 3=Em, 4=F. Incline à esquerda: 1=G, 2=Am, 3=Bdim. Personalize na tabela.
              </p>
            </div>
            <div className="gesture-guide-mode">
              <Music2 size={14} /> MODO ACORDE
            </div>
          </div>

          <div className="gesture-steps" aria-label="Instruções para tocar">
            <div><span>01</span><Hand size={15} /><span>
              Vire a palma para a câmera e levante a quantidade de dedos indicada na tabela.
            </span></div>
            <div><span>02</span><Music2 size={15} /><span>
              Mantenha o gesto para sustentar; mude a quantidade de dedos ou incline a mão à esquerda para trocar.
            </span></div>
          </div>

          <div className="gesture-editor-tools">
            <p>Escolha entre acordes maiores, menores e diminutos nas 12 notas cromáticas. As alterações são salvas neste navegador.</p>
            <button
              className="reset-button"
              type="button"
              onClick={() => setChordAssignmentState({
                assignments: { ...DEFAULT_CHORD_ASSIGNMENTS },
                storageError: null,
              })}
            >
              <RotateCcw size={12} /> RESTAURAR PADRÕES
            </button>
          </div>
          {chordAssignmentState.storageError && (
            <p className="gesture-config-error" role="alert">{chordAssignmentState.storageError}</p>
          )}

          <div className="gesture-table-scroll">
            <table className="gesture-table chord-gesture-table">
              <thead>
                <tr>
                  <th scope="col">GESTO</th>
                  <th scope="col">DEDOS</th>
                  <th scope="col">INCLINAÇÃO</th>
                  <th scope="col">ACORDE TOCADO</th>
                </tr>
              </thead>
              <tbody>
                {CHORD_GESTURE_SLOTS.map((slot) => (
                  <tr key={slot.id} className={camera.status.gestureId === slot.id ? "gesture-row-active" : ""}>
                    <td><span className="gesture-action"><Hand size={14} /> {slot.gesture}</span></td>
                    <td><span className="gesture-shortcut">{slot.fingerCount}</span></td>
                    <td>{slot.tilt === "left" ? "Esquerda" : "Reta/direita"}</td>
                    <td>
                      <select
                        className="gesture-chord-select"
                        aria-label={`Acorde para o gesto ${slot.gesture}`}
                        value={chordAssignments[slot.id]}
                        onChange={(event) => {
                          const chordId = event.target.value;
                          if (!getChordOption(chordId)) {
                            console.error("O acorde selecionado não está disponível:", chordId);
                            setChordAssignmentState((current) => ({
                              ...current,
                              storageError: "Esse acorde não está disponível. Tente escolher outra opção.",
                            }));
                            return;
                          }
                          setChordAssignmentState((current) => ({
                            assignments: { ...current.assignments, [slot.id]: chordId },
                            storageError: null,
                          }));
                        }}
                      >
                        {CHORD_OPTIONS.map((chord) => (
                          <option key={chord.id} value={chord.id}>{chord.name} · {chord.quality}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="gesture-guide-footnote">
            <span className="guide-footnote-dot" />
            Mantenha o gesto para sustentar o acorde. A fundamental permanece na nota e oitava do acorde; a oitava base selecionada só muda pelo controle.
          </p>
        </section>

        <section className="keyboard-card card-surface" data-reveal="up">
          <div className="keyboard-heading">
            <div><span className="section-label"><Keyboard size={14} /> TECLADO DE APOIO</span><span className="keyboard-subtitle">Acompanhe as notas do acorde em tempo real</span></div>
            <div className="keyboard-shortcut"><span className="keyboard-dot" /> {camera.isRunning ? "Aguardando seus movimentos" : "Experimente clicar nas teclas"} <span className="shortcut-divider" /> <span className="shortcut-key">A</span> — <span className="shortcut-key">K</span> <span className="shortcut-separator">·</span> Sustenidos <span className="shortcut-key">W</span><span className="shortcut-key">E</span><span className="shortcut-key">T</span><span className="shortcut-key">Y</span><span className="shortcut-key">U</span></div>
          </div>
          <div className="piano-keyboard" role="group" aria-label="Teclado musical">
            {PIANO_NOTES.map((note, index) => {
              const midi = 12 * (octave + 1) + WHITE_KEY_SEMITONES[index];
              return (
                <button
                  type="button"
                  key={`${note}-${index}`}
                  className={`piano-key ${activeNotes.includes(midi) ? "piano-key-active" : ""}`}
                  onClick={() => playKey(index)}
                  aria-label={`Tocar nota ${getKeyboardNoteName(index, octave)}`}
                >
                  <span className="white-key-label">{KEY_LABELS[index]}<span>{note}</span></span>
                </button>
              );
            })}
            {BLACK_KEYS.map((key) => {
              const midi = 12 * (octave + 1) + key.semitone;
              return (
                <button
                  type="button"
                  key={key.note}
                  className={`piano-key piano-key-black ${activeNotes.includes(midi) ? "piano-key-active" : ""}`}
                  style={{ left: `${((key.after + 1) / PIANO_NOTES.length) * 100}%` }}
                  onClick={() => playBlackKey(key.semitone)}
                  aria-label={`Tocar nota ${key.note}${octave}`}
                >
                  <span className="black-key-label">{key.note}<span>{key.keyboard}</span></span>
                </button>
              );
            })}
          </div>
        </section>

        <footer className="page-footer" data-reveal="up">
          <div className="footer-note"><span>FEITO PARA ESTE MOMENTO</span><span className="footer-spark">✳</span> <span>FEITO PARA VOCÊ SENTIR</span></div>
          <div className="footer-meta"><Headphones size={13} /> USE FONES PARA A MELHOR EXPERIÊNCIA <span className="footer-separator">·</span> TKGESTURE © {new Date().getFullYear()}</div>
        </footer>
      </section>

      {showHelp && (
        <div className="help-backdrop" role="presentation" onClick={() => setShowHelp(false)}>
          <section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(event) => event.stopPropagation()}>
            <button className="help-close" aria-label="Fechar" onClick={() => setShowHelp(false)}><X size={17} /></button>
            <span className="section-label"><Hand size={14} /> UM INSTRUMENTO. UM GESTO.</span>
            <h2 id="help-title">Como fazer música?</h2>
            <div className="help-step"><span>01</span><div><strong>Ative a câmera</strong><p>Encontre um lugar iluminado e autorize o acesso à câmera.</p></div><Check size={16} /></div>
            <div className="help-step"><span>02</span><div><strong>Mostre sua mão</strong><p>Vire a palma para a câmera e levante os dedos indicados. O polegar não entra na contagem.</p></div><Check size={16} /></div>
            <div className="help-step"><span>03</span><div><strong>Faça o gesto do acorde</strong><p>Mão reta/direita: 1=C, 2=Dm, 3=Em e 4=F. Incline à esquerda: 1=G, 2=Am e 3=Bdim. Você pode personalizar os acordes na tabela.</p></div><Check size={16} /></div>
            <div className="help-shortcuts"><Mic2 size={14} /> Ou use o teclado: <kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><kbd>F</kbd><kbd>G</kbd><kbd>H</kbd><kbd>J</kbd><kbd>K</kbd></div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
