import { CloudOffIcon, PauseIcon, PlayIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { LessonItem } from "@shared/curriculum";
import { useActiveStopwatch } from "@/hooks/useActiveStopwatch";
import { cn } from "@/lib/utils";

export interface AttentionSnapshot {
  videoCompletionRatio: number;
  keyPartWatched: boolean;
  /** False for the Drive embed, where progress can only be estimated. */
  measured: boolean;
}

export interface LessonVideoHandle {
  snapshot: () => AttentionSnapshot;
  playKeySegment: () => void;
}

interface LessonVideoProps {
  lesson: LessonItem;
  active: boolean;
  near: boolean;
  onKeyWatched?: () => void;
  ref?: Ref<LessonVideoHandle>;
  className?: string;
}

/** Drive's player exposes no progress API, so watch time after the learner taps into it is the proxy. */
const ESTIMATED_CLIP_SECONDS = 45;

function keyWindow(lesson: LessonItem, duration: number): [number, number] {
  if (lesson.keyTimestampSeconds !== undefined) {
    return [Math.max(0, lesson.keyTimestampSeconds - 1), Math.min(duration, lesson.keyTimestampSeconds + 3)];
  }
  return [duration * 0.4, duration * 0.6];
}

/**
 * Plays /videos/<lessonId>.mp4 when it is self-hosted (exact per-second
 * tracking for V and K, offline-capable), otherwise embeds the lesson's clip
 * from the shared Google Drive folder.
 */
export function LessonVideo({ lesson, active, near, onKeyWatched, ref, className }: LessonVideoProps) {
  const [source, setSource] = useState<"local" | "drive">("local");
  const [online, setOnline] = useState(() => navigator.onLine);

  const videoRef = useRef<HTMLVideoElement>(null);
  const watched = useRef(new Set<number>());
  const lastTime = useRef(0);
  const keyReported = useRef(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [driveEngaged, setDriveEngaged] = useState(false);
  const driveWatchSeconds = useActiveStopwatch(source === "drive" && active && driveEngaged);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const snapshot = useCallback((): AttentionSnapshot => {
    if (source === "local" && duration > 0) {
      const [start, end] = keyWindow(lesson, duration);
      const keySeconds: number[] = [];
      for (let s = Math.floor(start); s < Math.ceil(end); s++) keySeconds.push(s);
      const keyHits = keySeconds.filter((s) => watched.current.has(s)).length;
      return {
        videoCompletionRatio: Math.min(1, watched.current.size / Math.ceil(duration)),
        keyPartWatched: keySeconds.length > 0 && keyHits / keySeconds.length >= 0.8,
        measured: true,
      };
    }
    const seconds = driveWatchSeconds();
    const keyAt = lesson.keyTimestampSeconds !== undefined ? lesson.keyTimestampSeconds + 3 : ESTIMATED_CLIP_SECONDS * 0.6;
    return {
      videoCompletionRatio: Math.min(1, seconds / ESTIMATED_CLIP_SECONDS),
      keyPartWatched: seconds >= keyAt,
      measured: false,
    };
  }, [source, duration, lesson, driveWatchSeconds]);

  const reportKeyIfWatched = useCallback(() => {
    if (!keyReported.current && snapshot().keyPartWatched) {
      keyReported.current = true;
      onKeyWatched?.();
    }
  }, [snapshot, onKeyWatched]);

  useImperativeHandle(
    ref,
    () => ({
      snapshot,
      playKeySegment: () => {
        const video = videoRef.current;
        if (source === "local" && video && duration > 0) {
          video.currentTime = keyWindow(lesson, duration)[0];
          lastTime.current = video.currentTime;
          void video.play();
        }
        video?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        iframeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      },
    }),
    [snapshot, source, duration, lesson],
  );

  // Autoplay (muted) while the card is on screen, like a reel; pause when it leaves.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || source !== "local") return;
    if (active) void video.play().catch(() => setPlaying(false));
    else video.pause();
  }, [active, source, near]);

  // Detect a tap into the cross-origin Drive player: focus moves into the iframe.
  useEffect(() => {
    if (source !== "drive" || !active) return;
    const onBlur = () => window.setTimeout(() => document.activeElement === iframeRef.current && setDriveEngaged(true), 0);
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [source, active]);

  useEffect(() => {
    if (source !== "drive" || !driveEngaged || !active) return;
    const timer = window.setInterval(reportKeyIfWatched, 1000);
    return () => window.clearInterval(timer);
  }, [source, driveEngaged, active, reportKeyIfWatched]);

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;
    // Only continuous playback counts — seeking past the rule doesn't.
    if (!video.paused && !video.seeking && t >= lastTime.current && t - lastTime.current < 1.5) {
      watched.current.add(Math.floor(t));
    }
    lastTime.current = t;
    if (duration > 0) setProgress(t / duration);
    reportKeyIfWatched();
  };

  if (!near) return <div className={cn("bg-black", className)} />;

  if (source === "drive") {
    if (!online) {
      return (
        <div className={cn("grid place-items-center bg-[#08101f] p-6 text-center", className)}>
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <CloudOffIcon className="size-6" />
            <p>The clip needs a connection. The rule card below has everything for the question.</p>
          </div>
        </div>
      );
    }
    return (
      <div className={cn("relative bg-black", className)}>
        <iframe
          ref={iframeRef}
          title={lesson.videoTitle}
          src={`https://drive.google.com/file/d/${lesson.driveFileId}/preview`}
          className="absolute inset-0 size-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  const [keyStart, keyEnd] = duration > 0 ? keyWindow(lesson, duration) : [0, 0];

  return (
    <div className={cn("relative bg-black", className)}>
      <video
        ref={videoRef}
        src={`/videos/${lesson.id}.mp4`}
        className="absolute inset-0 size-full object-contain"
        playsInline
        muted={muted}
        loop
        preload={active ? "auto" : "metadata"}
        onError={() => setSource("drive")}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={(event) => (event.currentTarget.paused ? void event.currentTarget.play() : event.currentTarget.pause())}
      />

      {!playing && duration > 0 && (
        <button
          type="button"
          aria-label="Play clip"
          onClick={() => void videoRef.current?.play()}
          className="absolute inset-0 m-auto grid size-16 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
        >
          <PlayIcon className="size-7 translate-x-0.5" fill="currentColor" />
        </button>
      )}

      <div className="absolute right-3 bottom-4 flex gap-2">
        <button
          type="button"
          aria-label={playing ? "Pause clip" : "Play clip"}
          onClick={() => (playing ? videoRef.current?.pause() : void videoRef.current?.play())}
          className="grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur"
        >
          {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
        </button>
        <button
          type="button"
          aria-label={muted ? "Unmute clip" : "Mute clip"}
          onClick={() => setMuted((m) => !m)}
          className="grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur"
        >
          {muted ? <VolumeXIcon className="size-4" /> : <Volume2Icon className="size-4" />}
        </button>
      </div>

      {duration > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20" aria-hidden>
          <div
            className="absolute inset-y-0 bg-lane/70"
            style={{ left: `${(keyStart / duration) * 100}%`, width: `${((keyEnd - keyStart) / duration) * 100}%` }}
          />
          <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </div>
  );
}
