import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import logoAsset from "@/assets/logo.png";
import { isHlsUrl } from "@/lib/download";
import {
  Check,
  Info,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  Settings,
  SkipForward,
  Subtitles,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";

export type Subtitle = { label: string; src: string; lang?: string };

type Level = { id: number; label: string; height: number; bitrate: number };

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** Human label for a rendition height (360P … 4K). */
export const heightLabel = (h: number) => {
  if (h >= 2160) return "4K";
  if (h >= 1440) return "1440P";
  if (h >= 1080) return "1080P";
  if (h >= 720) return "720P";
  if (h >= 480) return "480P";
  if (h >= 360) return "360P";
  return h ? `${h}P` : "SD";
};

const fmtSpeed = (bps: number) => {
  if (bps >= 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${Math.max(1, Math.round(bps / 1024))} KB/s`;
};

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

/**
 * Private liquid-glass player.
 * No native browser chrome, no default right-click menu.
 * Adaptive quality (HLS renditions 360P → 4K), subtitles, speed, volume,
 * loop, picture-in-picture, theater mode and fullscreen — all wired to the
 * real media element.
 */
export function Player({
  src,
  poster,
  title,
  subtitles = [],
  onNext,
  onTheater,
  theater,
  className,
}: {
  src: string;
  poster?: string | undefined;
  title?: string | undefined;
  subtitles?: Subtitle[];
  onNext?: (() => void) | undefined;
  onTheater?: (() => void) | undefined;
  theater?: boolean | undefined;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [loadPct, setLoadPct] = useState(0);
  const [netSpeed, setNetSpeed] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [fs, setFs] = useState(false);
  const [levels, setLevels] = useState<Level[]>([]);
  const [level, setLevel] = useState(-1);
  const [autoHeight, setAutoHeight] = useState(0);
  const [nativeHeight, setNativeHeight] = useState(0);
  const [sub, setSub] = useState(-1);
  const [menu, setMenu] = useState<"none" | "quality" | "speed" | "subs" | "settings">("none");
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const [uiVisible, setUiVisible] = useState(true);
  const [scrub, setScrub] = useState<number | null>(null);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [flash, setFlash] = useState<{ icon: "back" | "fwd" | "play" | "pause"; k: number } | null>(
    null,
  );
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------------- source loading (mp4 / webm / hls) ---------------- */
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    setLevels([]);
    setLevel(-1);
    setAutoHeight(0);
    setReady(false);

    const isHls = isHlsUrl(src);
    if (!isHls) {
      video.src = src;
      return;
    }
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    let cancelled = false;
    void import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) return;
      const hls = new Hls({ enableWorker: true, capLevelToPlayerSize: false });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLevels(
          hls.levels.map((l: { height?: number; bitrate: number }, i: number) => ({
            id: i,
            height: l.height ?? 0,
            bitrate: l.bitrate,
            label: l.height ? heightLabel(l.height) : `${Math.round(l.bitrate / 1000)}k`,
          })),
        );
      });
      hls.on(
        Hls.Events.FRAG_LOADED,
        (
          _e: unknown,
          d: { frag?: { stats?: { loaded?: number; loading?: { start: number; end: number } } } },
        ) => {
          const st = d.frag?.stats;
          const bytes = st?.loaded ?? 0;
          const ms = (st?.loading?.end ?? 0) - (st?.loading?.start ?? 0);
          if (bytes > 0 && ms > 0) setNetSpeed((bytes / ms) * 1000);
        },
      );
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e: unknown, d: { level: number }) => {
        setAutoHeight(hls.levels[d.level]?.height ?? 0);
      });
    });

    return () => {
      cancelled = true;
      hlsRef.current?.destroy?.();
      hlsRef.current = null;
    };
  }, [src]);

  /* ---------------- download speed (progressive sources) ---------------- */
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    const tail = (src.split("?")[0] ?? "").split("/").pop() ?? "";
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceResourceTiming[]) {
        if (!tail || !e.name.includes(tail)) continue;
        const bytes = e.transferSize || e.encodedBodySize;
        if (bytes > 0 && e.duration > 0) setNetSpeed((bytes / e.duration) * 1000);
      }
    });
    try {
      obs.observe({ type: "resource", buffered: true });
    } catch {
      /* unsupported */
    }
    return () => obs.disconnect();
  }, [src]);

  /* ---------------- media events ---------------- */
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onTime = () => {
      setTime(v.currentTime);
      const b = v.buffered;
      const end = b.length ? b.end(b.length - 1) : 0;
      setBuffered(end);
      const ahead = Math.max(0, end - v.currentTime);
      setLoadPct(Math.max(0, Math.min(100, Math.round((ahead / 6) * 100))));
    };
    const onMeta = () => {
      setDuration(v.duration);
      setNativeHeight(v.videoHeight);
      setReady(true);
    };
    const on = <K extends keyof HTMLVideoElementEventMap>(
      k: K,
      fn: (e: HTMLVideoElementEventMap[K]) => void,
    ) => {
      v.addEventListener(k, fn);
      return () => v.removeEventListener(k, fn);
    };
    const offs = [
      on("timeupdate", onTime),
      on("progress", onTime),
      on("loadedmetadata", onMeta),
      on("durationchange", onMeta),
      on("resize", () => setNativeHeight(v.videoHeight)),
      on("play", () => setPlaying(true)),
      on("pause", () => setPlaying(false)),
      on("waiting", () => setWaiting(true)),
      on("playing", () => setWaiting(false)),
      on("canplay", () => setWaiting(false)),
      on("ratechange", () => setSpeed(v.playbackRate)),
      on("volumechange", () => {
        setVolume(v.volume);
        setMuted(v.muted);
      }),
    ];
    return () => offs.forEach((f) => f());
  }, [src]);

  useEffect(() => {
    const onFs = () => setFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* ---------------- subtitle tracks ---------------- */
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const tracks = v.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (t) t.mode = i === sub ? "showing" : "disabled";
    }
  }, [sub, subtitles.length, src]);

  /* ---------------- actions ---------------- */
  const ping = (icon: "back" | "fwd" | "play" | "pause") =>
    setFlash({ icon, k: Date.now() });

  const toggle = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      ping("play");
    } else {
      v.pause();
      ping("pause");
    }
  }, []);

  const seek = useCallback((t: number) => {
    const v = ref.current;
    if (!v || !Number.isFinite(t)) return;
    v.currentTime = Math.max(0, Math.min(t, v.duration || t));
    setTime(v.currentTime);
  }, []);

  const nudge = useCallback(
    (d: number) => {
      seek((ref.current?.currentTime ?? 0) + d);
      ping(d < 0 ? "back" : "fwd");
    },
    [seek],
  );

  const setQuality = (id: number) => {
    setLevel(id);
    if (hlsRef.current) hlsRef.current.currentLevel = id;
    setMenu("none");
  };

  const changeSpeed = (r: number) => {
    setSpeed(r);
    if (ref.current) ref.current.playbackRate = r;
    setMenu("none");
  };

  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen();
  }, []);

  const togglePip = async () => {
    const v = ref.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* pip unavailable */
    }
  };

  const setVol = (val: number) => {
    const v = ref.current;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, val));
    v.muted = v.volume === 0;
  };

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && ["INPUT", "TEXTAREA"].includes(el.tagName)) return;
      if (!wrapRef.current) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          toggle();
          break;
        case "ArrowRight":
          nudge(10);
          break;
        case "ArrowLeft":
          nudge(-10);
          break;
        case "ArrowUp":
          e.preventDefault();
          setVol((ref.current?.volume ?? 0) + 0.05);
          break;
        case "ArrowDown":
          e.preventDefault();
          setVol((ref.current?.volume ?? 0) - 0.05);
          break;
        case "f":
          toggleFs();
          break;
        case "m":
          if (ref.current) ref.current.muted = !ref.current.muted;
          break;
        case "Escape":
          setMenu("none");
          setCtx(null);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, nudge, toggleFs]);

  /* ---------------- auto-hide chrome ---------------- */
  const poke = () => {
    setUiVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!ref.current?.paused && menu === "none" && !ctx) setUiVisible(false);
    }, 2600);
  };
  useEffect(() => () => void (hideTimer.current && clearTimeout(hideTimer.current)), []);

  useEffect(() => {
    if (!ctx && menu === "none") return;
    const close = () => {
      setCtx(null);
      setMenu("none");
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [ctx, menu]);

  /* ---------------- scrubbing ---------------- */
  const posToTime = (clientX: number) => {
    const r = barRef.current?.getBoundingClientRect();
    if (!r || !duration) return 0;
    return ((clientX - r.left) / r.width) * duration;
  };

  const startScrub = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setScrub(Math.max(0, Math.min(posToTime(e.clientX), duration)));
  };
  const moveScrub = (e: React.PointerEvent) => {
    const r = barRef.current?.getBoundingClientRect();
    const t = Math.max(0, Math.min(posToTime(e.clientX), duration));
    if (r) setHover({ x: Math.max(0, Math.min(e.clientX - r.left, r.width)), t });
    if (scrub !== null) setScrub(t);
  };
  const endScrub = (e: React.PointerEvent) => {
    if (scrub === null) return;
    seek(scrub);
    setScrub(null);
    e.stopPropagation();
  };

  const shownTime = scrub ?? time;
  const pct = duration ? (shownTime / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;

  const qualityLabel = useMemo(() => {
    if (level >= 0) return levels.find((l) => l.id === level)?.label ?? "AUTO";
    if (levels.length) return autoHeight ? `AUTO ${heightLabel(autoHeight)}` : "AUTO";
    return nativeHeight ? heightLabel(nativeHeight) : "HD";
  }, [level, levels, autoHeight, nativeHeight]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 520);
    return () => clearTimeout(t);
  }, [flash]);

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={wrapRef}
      className={`group relative select-none overflow-hidden rounded-[1.25rem] bg-black ${
        className ?? ""
      } ${uiVisible ? "" : "cursor-none"}`}
      onMouseMove={poke}
      onMouseLeave={() => !ref.current?.paused && setUiVisible(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        const r = wrapRef.current?.getBoundingClientRect();
        setCtx({ x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) });
      }}
    >
      <video
        ref={ref}
        key={src}
        poster={poster}
        playsInline
        autoPlay
        preload="metadata"
        controlsList="nodownload noplaybackrate noremoteplayback"
        disableRemotePlayback
        loop={loop}
        onClick={toggle}
        onDoubleClick={toggleFs}
        className="size-full bg-black object-contain"
      >
        {subtitles.map((s, i) => (
          <track
            key={s.src}
            kind="subtitles"
            src={s.src}
            label={s.label}
            srcLang={s.lang ?? "en"}
            default={i === sub}
          />
        ))}
      </video>

      {/* top bar */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-3 transition-all duration-300 ${
          uiVisible ? "opacity-100" : "-translate-y-2 opacity-0"
        }`}
      >
        <span className="glass-pill max-w-[70%] truncate text-[13px] font-medium text-white">
          {title}
        </span>
        <span className="glass-pill text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
          Nexus Player
        </span>
      </div>

      {/* branded loading */}
      {(waiting || !ready) && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/45 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="relative grid size-24 place-items-center">
              <span className="absolute inset-0 rounded-full border border-white/10" />
              <span className="absolute inset-0 animate-[liquid-orbit_1.5s_linear_infinite] rounded-full border-2 border-transparent border-t-white/85 border-r-white/35" />
              <span className="glass-orb grid size-16 place-items-center animate-[liquid-breathe_2.2s_ease-in-out_infinite]">
                <img src={logoAsset} alt="" className="size-9 object-contain" />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.42em] text-white/90">
                Loading
              </span>
              <span className="text-[11px] font-bold tabular-nums text-brand">{loadPct}%</span>
              <span className="flex items-end gap-1 pb-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1 rounded-full bg-white animate-[liquid-dot_1.1s_ease-in-out_infinite]"
                    style={{ animationDelay: `${i * 0.16}s` }}
                  />
                ))}
              </span>
            </div>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-300"
                style={{ width: `${loadPct}%` }}
              />
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/60 tabular-nums">
              {netSpeed > 0 ? `${fmtSpeed(netSpeed)} · buffering` : "connecting…"}
            </span>
          </div>
        </div>
      )}


      {/* gesture flash */}
      {flash && (
        <div key={flash.k} className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="glass-orb grid size-16 animate-[fade-out_0.5s_ease-out_forwards] place-items-center">
            {flash.icon === "back" && <RotateCcw className="size-6 text-white" />}
            {flash.icon === "fwd" && <RotateCw className="size-6 text-white" />}
            {flash.icon === "play" && <Play className="size-6 fill-white text-white" />}
            {flash.icon === "pause" && <Pause className="size-6 fill-white text-white" />}
          </span>
        </div>
      )}

      {/* big play */}
      {!playing && ready && !flash && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Play"
          className="absolute inset-0 grid place-items-center"
        >
          <span className="brand-orb liquid-hover grid size-20 place-items-center">
            <Play className="size-8 translate-x-0.5 fill-white text-white" />
          </span>
        </button>
      )}

      {/* controls */}
      <div
        className={`absolute inset-x-0 bottom-0 p-3 transition-all duration-300 ${
          uiVisible ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <div className="px-0 pb-1 pt-2">
          {/* progress */}
          <div
            ref={barRef}
            className="group/bar relative h-5 cursor-pointer touch-none"
            onPointerDown={startScrub}
            onPointerMove={moveScrub}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            onPointerLeave={() => setHover(null)}
          >
            <div className="absolute inset-x-0 top-1/2 h-[5px] -translate-y-1/2 overflow-hidden rounded-full bg-white/20 backdrop-blur">
              <div className="h-full rounded-full bg-white/35" style={{ width: `${bufPct}%` }} />
            </div>
            <div
              className="pointer-events-none absolute left-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-brand shadow-[0_0_14px_color-mix(in_oklab,var(--brand)_70%,transparent)]"
              style={{ width: `${pct}%` }}
            />

            {hover && (
              <span
                className="glass-pill pointer-events-none absolute -top-8 -translate-x-1/2 text-[11px] tabular-nums text-white"
                style={{ left: hover.x }}
              >
                {fmt(hover.t)}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2 text-white">
            <GlassBtn label={playing ? "Pause" : "Play"} onClick={toggle}>
              {playing ? <Pause className="size-4 fill-white" /> : <Play className="size-4 fill-white" />}
            </GlassBtn>
            <GlassBtn label="Back 10 seconds" onClick={() => nudge(-10)}>
              <RotateCcw className="size-4" />
            </GlassBtn>
            <GlassBtn label="Forward 10 seconds" onClick={() => nudge(10)}>
              <RotateCw className="size-4" />
            </GlassBtn>
            {onNext && (
              <GlassBtn label="Next episode" onClick={onNext}>
                <SkipForward className="size-4 fill-white" />
              </GlassBtn>
            )}

            <div className="group/vol flex items-center gap-2">
              <GlassBtn
                label={muted ? "Unmute" : "Mute"}
                onClick={() => {
                  if (ref.current) ref.current.muted = !ref.current.muted;
                }}
              >
                <VolIcon className="size-4" />
              </GlassBtn>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => setVol(Number(e.target.value))}
                className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 transition-all duration-300 group-hover/vol:w-20 group-hover/vol:opacity-100 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
            </div>

            <span className="ml-1 text-[11px] tabular-nums text-white/85">
              {fmt(shownTime)} <span className="text-white/45">/ {fmt(duration)}</span>
            </span>

            <div className="ml-auto flex items-center gap-2 text-[11px]">
              {/* subtitles */}
              <div className="relative">
                <GlassBtn
                  label="Subtitles"
                  active={sub >= 0}
                  onClick={() => setMenu(menu === "subs" ? "none" : "subs")}
                >
                  <Subtitles className="size-4" />
                </GlassBtn>
                {menu === "subs" && (
                  <Menu title="Subtitles">
                    <MenuItem active={sub === -1} onClick={() => (setSub(-1), setMenu("none"))}>
                      Off
                    </MenuItem>
                    {subtitles.map((s, i) => (
                      <MenuItem
                        key={s.src}
                        active={sub === i}
                        onClick={() => (setSub(i), setMenu("none"))}
                      >
                        {s.label}
                      </MenuItem>
                    ))}
                    {!subtitles.length && (
                      <div className="px-3 py-2 text-white/50">No subtitles</div>
                    )}
                  </Menu>
                )}
              </div>

              {/* speed */}
              <div className="relative">
                <GlassBtn
                  label="Playback speed"
                  wide
                  onClick={() => setMenu(menu === "speed" ? "none" : "speed")}
                >
                  {speed}x
                </GlassBtn>
                {menu === "speed" && (
                  <Menu title="Speed">
                    {SPEEDS.map((r) => (
                      <MenuItem key={r} active={speed === r} onClick={() => changeSpeed(r)}>
                        {r === 1 ? "Normal" : `${r}x`}
                      </MenuItem>
                    ))}
                  </Menu>
                )}
              </div>

              {/* quality */}
              <div className="relative">
                <GlassBtn
                  label="Quality"
                  wide
                  onClick={() => setMenu(menu === "quality" ? "none" : "quality")}
                >
                  {qualityLabel}
                </GlassBtn>
                {menu === "quality" && (
                  <Menu title="Quality">
                    <MenuItem active={level === -1} onClick={() => setQuality(-1)}>
                      Auto
                    </MenuItem>
                    {[...levels]
                      .sort((a, b) => b.height - a.height)
                      .map((l) => (
                        <MenuItem key={l.id} active={level === l.id} onClick={() => setQuality(l.id)}>
                          <span className="flex items-center gap-2">
                            {l.label}
                            {l.height >= 2160 && (
                              <span className="rounded bg-white/15 px-1 text-[9px]">UHD</span>
                            )}
                          </span>
                        </MenuItem>
                      ))}
                    {!levels.length && (
                      <div className="whitespace-nowrap px-3 py-2 text-white/50">
                        {nativeHeight ? `Source ${heightLabel(nativeHeight)}` : "Single source"}
                      </div>
                    )}
                  </Menu>
                )}
              </div>

              {/* settings */}
              <div className="relative">
                <GlassBtn
                  label="Settings"
                  active={loop}
                  onClick={() => setMenu(menu === "settings" ? "none" : "settings")}
                >
                  <Settings className="size-4" />
                </GlassBtn>
                {menu === "settings" && (
                  <Menu title="Settings">
                    <MenuItem active={loop} onClick={() => setLoop(!loop)}>
                      Loop
                    </MenuItem>
                    <MenuItem active={false} onClick={() => (void togglePip(), setMenu("none"))}>
                      Picture in picture
                    </MenuItem>
                    {onTheater && (
                      <MenuItem active={!!theater} onClick={() => (onTheater(), setMenu("none"))}>
                        Theater mode
                      </MenuItem>
                    )}
                  </Menu>
                )}
              </div>

              <GlassBtn label="Picture in picture" onClick={() => void togglePip()}>
                <PictureInPicture2 className="size-4" />
              </GlassBtn>
              <GlassBtn label="Fullscreen" onClick={toggleFs}>
                {fs ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
              </GlassBtn>
            </div>
          </div>
        </div>
      </div>

      {/* private context menu */}
      {ctx && (
        <div
          className="glass-panel absolute z-30 w-60 overflow-hidden p-1 text-xs text-white"
          style={{ left: Math.max(8, ctx.x), top: Math.max(8, ctx.y) }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <CtxItem
            icon={playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            onClick={() => (toggle(), setCtx(null))}
          >
            {playing ? "Pause" : "Play"}
          </CtxItem>
          <CtxItem
            icon={<Repeat className="size-3.5" />}
            onClick={() => (setLoop(!loop), setCtx(null))}
          >
            Loop: {loop ? "On" : "Off"}
          </CtxItem>
          <CtxItem
            icon={<PictureInPicture2 className="size-3.5" />}
            onClick={() => (void togglePip(), setCtx(null))}
          >
            Picture in picture
          </CtxItem>
          <CtxItem
            icon={<Maximize className="size-3.5" />}
            onClick={() => (toggleFs(), setCtx(null))}
          >
            Fullscreen
          </CtxItem>
          <div className="my-1 h-px bg-white/10" />
          <CtxItem
            icon={<Info className="size-3.5" />}
            onClick={() => {
              window.open("https://nexusplatform.site", "_blank", "noopener,noreferrer");
              setCtx(null);
            }}
          >
            About us — Nexus Platform
          </CtxItem>
        </div>
      )}
    </div>
  );
}

function GlassBtn({
  children,
  label,
  onClick,
  active,
  wide,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`brand-btn liquid-hover grid h-8 place-items-center rounded-full ${
        wide ? "min-w-11 px-2.5 text-[11px] font-semibold" : "w-8"
      } ${active ? "ring-2 ring-white/60" : ""}`}
    >
      {children}
    </button>
  );
}

function Menu({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="glass-panel absolute bottom-11 right-0 z-30 min-w-36 overflow-hidden p-1 text-white"
    >
      <div className="px-3 pb-1 pt-1.5 text-[10px] uppercase tracking-[0.16em] text-white/45">
        {title}
      </div>
      {children}
    </div>
  );
}

function MenuItem({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`liquid-hover flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-[12px] ${
        active ? "bg-white/10 font-semibold text-white" : "text-white/80"
      }`}
    >
      {children}
      {active && <Check className="size-3.5" />}
    </button>
  );
}

function CtxItem({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="liquid-hover flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left"
    >
      <span className="text-white/70">{icon}</span>
      {children}
    </button>
  );
}
