import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";

// Cada categoría dispara 2 búsquedas reales en YouTube (en vivo, sin API key) y
// combina los resultados. Esto soluciona el bug de "solo 2 canciones": ya no
// dependemos de la lista interna del reproductor de YouTube, sino que traemos
// nosotros mismos la lista completa (título, canal y duración de cada video)
// antes de reproducir nada. Al ser búsquedas en vivo, el contenido es siempre
// actual y, al combinar 2 búsquedas, la duración total suele superar la hora.
const CATEGORIES = [
  {
    id: "regueton",
    label: "Reguetón",
    queries: ["reggaeton mix 2026 lo mas nuevo", "reggaeton estrenos 2026"],
    icon: "music",
    color: "#8b5cf6",
    colorTo: "#5b21b6",
  },
  {
    id: "romantico",
    label: "Romántico",
    queries: ["mix musica romantica 2026", "baladas romanticas estrenos 2026"],
    icon: "heart",
    color: "#f43f5e",
    colorTo: "#9f1239",
  },
  {
    id: "bachata",
    label: "Bachata",
    queries: ["bachata mix 2026 nuevo", "bachata estrenos 2026"],
    icon: "guitar",
    color: "#f59e0b",
    colorTo: "#b45309",
  },
];

const FAVORITES_KEY = "yt-variados-favoritos";
const AUTO_HIDE_KEY = "yt-variados-autohide";

// Tamaños: al abrir = ventana compacta (izquierda de la foto).
// Al acoplar al borde derecho = modo lateral (derecha de la foto).
const NORMAL_SIZE = { width: 520, height: 720 };
const MIN_SIZE_NORMAL = { width: 400, height: 560 };
const DOCKED_SIZE = { width: 340, height: 720 };
const EDGE_STRIP_WIDTH = 10;
const DOCK_THRESHOLD = 48; // px desde el borde derecho para considerar "acoplado"

const Icon = ({ name, size = 22 }) => {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
  };
  switch (name) {
    case "music": return <svg {...common}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
    case "heart": return <svg {...common} fill="currentColor" stroke="none"><path d="M12 21s-6.7-4.3-9.4-8.2C.7 9.9 1.5 6.4 4.4 5c2.3-1.1 4.8-.2 6.1 1.7C11.8 4.8 14.3 3.9 16.6 5c2.9 1.4 3.7 4.9 1.8 7.8C18.7 16.7 12 21 12 21z" /></svg>;
    case "guitar": return <svg {...common}><circle cx="8" cy="16" r="4" /><path d="M11 13l7-7" /><path d="M16 4l4 4" /><path d="M14 6l1.5 1.5" /><path d="M17 3l1.5 1.5" /></svg>;
    case "star": return <svg {...common} fill="currentColor" stroke="none"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6L12 2z" /></svg>;
    case "prev": return <svg {...common} fill="currentColor" stroke="none"><path d="M6 6h2v12H6zM20 6L10 12l10 6z" /></svg>;
    case "next": return <svg {...common} fill="currentColor" stroke="none"><path d="M16 6h2v12h-2zM4 6l10 6-10 6z" /></svg>;
    case "play": return <svg {...common} fill="currentColor" stroke="none"><path d="M7 5l12 7-12 7z" /></svg>;
    case "pause": return <svg {...common} fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>;
    case "repeat": return <svg {...common}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" /></svg>;
    case "volume": return <svg {...common}><path d="M4 9v6h4l5 5V4l-5 5H4z" /><path d="M16.5 8.5a5 5 0 010 7" /></svg>;
    case "search": return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>;
    case "gear": return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>;
    case "bars": return <svg {...common} fill="currentColor" stroke="none"><rect x="4" y="10" width="3" height="8"><animate attributeName="height" values="8;16;4;8" dur="0.9s" repeatCount="indefinite" /><animate attributeName="y" values="10;6;14;10" dur="0.9s" repeatCount="indefinite" /></rect><rect x="10.5" y="4" width="3" height="16"><animate attributeName="height" values="16;6;18;16" dur="1.1s" repeatCount="indefinite" /><animate attributeName="y" values="4;9;3;4" dur="1.1s" repeatCount="indefinite" /></rect><rect x="17" y="8" width="3" height="10"><animate attributeName="height" values="10;18;6;10" dur="0.7s" repeatCount="indefinite" /><animate attributeName="y" values="8;3;9;8" dur="0.7s" repeatCount="indefinite" /></rect></svg>;
    case "shuffle": return <svg {...common}><path d="M16 3h5v5" /><path d="M4 20L21 3" /><path d="M21 16v5h-5" /><path d="M15 15l6 6" /><path d="M4 4l5 5" /></svg>;
    case "list": return <svg {...common}><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>;
    default: return null;
  }
};

const segundosDeDuracion = (txt) => {
  if (!txt) return 0;
  const partes = txt.split(":").map((n) => parseInt(n, 10));
  if (partes.some((n) => Number.isNaN(n))) return 0;
  return partes.reduce((acc, v) => acc * 60 + v, 0);
};

const formatMin = (segundos) => {
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem ? `${h} h ${rem} min` : `${h} h`;
};

const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export default function App() {
  const playerRef = useRef(null);
  const playerElRef = useRef(null);
  const progressTimerRef = useRef(null);
  const requestIdRef = useRef(0);

  const queueRef = useRef([]);
  const currentIndexRef = useRef(-1);
  const repeatAllRef = useRef(true);
  const volumeRef = useRef(80);

  const [ready, setReady] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [title, setTitle] = useState("Elegí un variado o buscá algo");
  const [channel, setChannel] = useState("para empezar a escuchar");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [favorites, setFavorites] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [repeatAll, setRepeatAll] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  // ---------- Modos de ventana ----------
  // normal  = ventana cuadrada/compacta (izquierda de la foto) — al abrir
  // docked  = modo lateral compacto (derecha de la foto) — al acoplar al borde derecho
  // collapsed = franja fina (auto-ocultar)
  const [docked, setDocked] = useState(false);
  const [autoHide, setAutoHide] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const expandedBoundsRef = useRef(null);
  const hideTimerRef = useRef(null);
  const autoHideListoRef = useRef(false);
  const dockedRef = useRef(false);
  const isResizingRef = useRef(false);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { repeatAllRef.current = repeatAll; }, [repeatAll]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { dockedRef.current = docked; }, [docked]);

  const stopProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    stopProgress();
    progressTimerRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      try {
        setCurrentTime(p.getCurrentTime() || 0);
        setDuration(p.getDuration() || 0);
      } catch {}
    }, 300);
  }, [stopProgress]);

  const reproducirIndice = useCallback((index, listaExplicita) => {
    const lista = listaExplicita || queueRef.current;
    const p = playerRef.current;
    if (!p || index < 0 || index >= lista.length) return;
    const video = lista[index];
    try {
      p.loadVideoById(video.id);
    } catch {
      setMessage("No se pudo reproducir ese video.");
      return;
    }
    currentIndexRef.current = index;
    setCurrentIndex(index);
    setTitle(video.title);
    setChannel(video.channel || "");
    setCurrentTime(0);
    setMessage("");
  }, []);

  const siguiente = useCallback(() => {
    const lista = queueRef.current;
    if (!lista.length) return;
    let idx = currentIndexRef.current + 1;
    if (idx >= lista.length) {
      if (!repeatAllRef.current) { setPlaying(false); return; }
      idx = 0;
    }
    reproducirIndice(idx, lista);
  }, [reproducirIndice]);

  const anterior = useCallback(() => {
    const lista = queueRef.current;
    if (!lista.length) return;
    let idx = currentIndexRef.current - 1;
    if (idx < 0) idx = repeatAllRef.current ? lista.length - 1 : 0;
    reproducirIndice(idx, lista);
  }, [reproducirIndice]);

  const onPlayerStateChange = useCallback((e) => {
    const state = window.YT?.PlayerState;
    if (!state) return;
    if (e.data === state.PLAYING) {
      setPlaying(true);
      setMessage("");
      try { setDuration(playerRef.current.getDuration() || 0); } catch {}
      startProgress();
    } else if (e.data === state.PAUSED) {
      setPlaying(false);
      stopProgress();
    } else if (e.data === state.ENDED) {
      setPlaying(false);
      stopProgress();
      siguiente();
    } else if (e.data === state.BUFFERING) {
      setMessage("Cargando...");
    }
  }, [startProgress, stopProgress, siguiente]);

  const initPlayer = useCallback(() => {
    if (!window.YT?.Player || !playerElRef.current || playerRef.current) return;
    playerRef.current = new window.YT.Player(playerElRef.current, {
      height: "2",
      width: "2",
      playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1 },
      events: {
        onReady: () => {
          setReady(true);
          try { playerRef.current.setVolume(volumeRef.current); } catch {}
        },
        onStateChange: onPlayerStateChange,
        onError: () => {
          setMessage("Ese video no está disponible. Probando el siguiente...");
          setTimeout(() => siguiente(), 400);
        },
      },
    });
  }, [onPlayerStateChange, siguiente]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) {
        const datos = JSON.parse(raw);
        setFavorites(datos.map((f) => ({
          id: f.id || f.videoId,
          title: f.title || "Sin título",
          channel: f.channel || "",
          duration: f.duration || "",
          thumbnail: f.thumbnail || `https://i.ytimg.com/vi/${f.id || f.videoId}/mqdefault.jpg`,
        })).filter((f) => f.id));
      }
    } catch {}
    try {
      const savedAutoHide = localStorage.getItem(AUTO_HIDE_KEY);
      if (savedAutoHide !== null) setAutoHide(savedAutoHide === "1");
    } catch {}
    const t = setTimeout(() => { autoHideListoRef.current = true; }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (window.YT?.Player) { initPlayer(); return; }
    const oldCallback = window.onYouTubeIframeAPIReady;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => { oldCallback?.(); initPlayer(); };
    return () => {
      if (window.onYouTubeIframeAPIReady === initPlayer) window.onYouTubeIframeAPIReady = null;
      stopProgress();
    };
  }, [initPlayer, stopProgress]);

  useEffect(() => {
    return () => {
      stopProgress();
      try { playerRef.current?.destroy(); } catch {}
    };
  }, [stopProgress]);

  const cargarCola = useCallback((videos) => {
    queueRef.current = videos;
    setQueue(videos);
    reproducirIndice(0, videos);
  }, [reproducirIndice]);

  const playCategory = useCallback(async (cat) => {
    const requestId = ++requestIdRef.current;
    setActiveCategory(cat.id);
    setMessage("");
    setLoading(true);
    try {
      const listas = await Promise.all(
        cat.queries.map((q) => invoke("buscar_youtube", { consulta: q }).catch(() => []))
      );
      if (requestId !== requestIdRef.current) return;
      const vistos = new Set();
      const combinados = [];
      for (const lista of listas) {
        for (const v of lista) {
          if (!vistos.has(v.id)) { vistos.add(v.id); combinados.push(v); }
        }
      }
      if (!combinados.length) {
        setMessage("No se pudo cargar esta categoría. Probá de nuevo en unos segundos.");
        return;
      }
      cargarCola(combinados);
    } catch {
      if (requestId === requestIdRef.current) setMessage("No se pudo conectar con YouTube.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [cargarCola]);

  const playFavorites = useCallback(() => {
    setActiveCategory("favoritos");
    setMessage("");
    if (!favorites.length) {
      queueRef.current = [];
      setQueue([]);
      currentIndexRef.current = -1;
      setCurrentIndex(-1);
      setTitle("No tenés favoritos todavía");
      setChannel("Agregá canciones con la estrella ⭐");
      return;
    }
    cargarCola(favorites);
  }, [favorites, cargarCola]);

  const buscar = useCallback(async (textoOpcional) => {
    const q = (textoOpcional ?? searchText).trim();
    if (!q || !ready) return;
    setActiveCategory(null);
    setMessage("");
    setLoading(true);
    const requestId = ++requestIdRef.current;
    try {
      const resultados = await invoke("buscar_youtube", { consulta: q });
      if (requestId !== requestIdRef.current) return;
      if (!resultados.length) {
        setMessage("No se encontraron resultados para esa búsqueda.");
        return;
      }
      cargarCola(resultados);
    } catch {
      if (requestId === requestIdRef.current) setMessage("No se pudo buscar en YouTube. Revisá tu conexión.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [searchText, ready, cargarCola]);

  const playAt = useCallback((index) => reproducirIndice(index), [reproducirIndice]);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    try { playing ? p.pauseVideo() : p.playVideo(); } catch {}
  };

  const seek = (e) => {
    const pct = Number(e.target.value);
    const t = duration > 0 ? (pct / 100) * duration : 0;
    try { playerRef.current?.seekTo(t, true); } catch {}
    setCurrentTime(t);
  };

  const changeVolume = (e) => {
    const v = Number(e.target.value);
    setVolume(v);
    try { playerRef.current?.setVolume(v); } catch {}
  };

  const agregarFavorito = () => {
    const video = queueRef.current[currentIndexRef.current];
    if (!video) return;
    setFavorites((prev) => {
      if (prev.some((f) => f.id === video.id)) return prev;
      const actualizado = [...prev, video];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(actualizado)); } catch {}
      return actualizado;
    });
    setMessage("Añadido a favoritos ⭐");
  };

  // ---------- Guardar bordes actuales (solo si no es strip) ----------
  const guardarBordesActuales = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      const pos = await win.outerPosition();
      const size = await win.outerSize();
      if (size.width > EDGE_STRIP_WIDTH * 2) {
        expandedBoundsRef.current = { pos, size, wasDocked: dockedRef.current };
      }
    } catch {}
  }, []);

  // ---------- Acoplar al borde derecho → modo lateral compacto ----------
  const acoplarLateral = useCallback(async () => {
    if (dockedRef.current || isResizingRef.current) return;
    isResizingRef.current = true;
    try {
      const win = getCurrentWindow();
      if (!expandedBoundsRef.current) await guardarBordesActuales();
      const monitor = await win.currentMonitor();
      if (!monitor) return;
      const h = Math.min(DOCKED_SIZE.height, Math.round(monitor.size.height * 0.85));
      const y = monitor.position.y + Math.round((monitor.size.height - h) / 2);
      const x = monitor.position.x + monitor.size.width - DOCKED_SIZE.width;
      await win.setSizeConstraints({ minWidth: 280, minHeight: 400 });
      await win.setSize(new PhysicalSize(DOCKED_SIZE.width, h));
      await win.setPosition(new PhysicalPosition(x, y));
      await win.setAlwaysOnTop(true);
      setDocked(true);
      setCollapsed(false);
    } catch {}
    finally { isResizingRef.current = false; }
  }, [guardarBordesActuales]);

  // ---------- Desacoplar → volver a ventana compacta normal ----------
  const desacoplar = useCallback(async () => {
    if (!dockedRef.current || isResizingRef.current) return;
    isResizingRef.current = true;
    try {
      const win = getCurrentWindow();
      await win.setAlwaysOnTop(false);
      const b = expandedBoundsRef.current;
      if (b && !b.wasDocked) {
        await win.setSize(b.size);
        await win.setPosition(b.pos);
      } else {
        await win.setSize(new PhysicalSize(NORMAL_SIZE.width, NORMAL_SIZE.height));
        await win.center();
      }
      await win.setSizeConstraints({ minWidth: MIN_SIZE_NORMAL.width, minHeight: MIN_SIZE_NORMAL.height });
      setDocked(false);
      setCollapsed(false);
    } catch {}
    finally { isResizingRef.current = false; }
  }, []);

  // ---------- Auto-ocultar a franja fina ----------
  const colapsarVentana = useCallback(async () => {
    if (collapsed || isResizingRef.current) return;
    isResizingRef.current = true;
    try {
      const win = getCurrentWindow();
      if (!expandedBoundsRef.current) await guardarBordesActuales();
      const monitor = await win.currentMonitor();
      if (!monitor) return;
      const alturaFranja = Math.round(monitor.size.height * 0.45);
      const y = monitor.position.y + Math.round((monitor.size.height - alturaFranja) / 2);
      const x = monitor.position.x + monitor.size.width - EDGE_STRIP_WIDTH;
      await win.setSizeConstraints({ minWidth: 0, minHeight: 0 });
      await win.setSize(new PhysicalSize(EDGE_STRIP_WIDTH, alturaFranja));
      await win.setPosition(new PhysicalPosition(x, y));
      await win.setAlwaysOnTop(true);
      setCollapsed(true);
    } catch {}
    finally { isResizingRef.current = false; }
  }, [collapsed, guardarBordesActuales]);

  const expandirVentana = useCallback(async () => {
    if (!collapsed || isResizingRef.current) return;
    isResizingRef.current = true;
    try {
      const win = getCurrentWindow();
      const b = expandedBoundsRef.current;
      if (b?.wasDocked || dockedRef.current) {
        // Volver al modo lateral
        const monitor = await win.currentMonitor();
        if (monitor) {
          const h = Math.min(DOCKED_SIZE.height, Math.round(monitor.size.height * 0.85));
          const y = monitor.position.y + Math.round((monitor.size.height - h) / 2);
          const x = monitor.position.x + monitor.size.width - DOCKED_SIZE.width;
          await win.setSizeConstraints({ minWidth: 280, minHeight: 400 });
          await win.setSize(new PhysicalSize(DOCKED_SIZE.width, h));
          await win.setPosition(new PhysicalPosition(x, y));
          await win.setAlwaysOnTop(true);
          setDocked(true);
        }
      } else if (b) {
        await win.setAlwaysOnTop(false);
        await win.setSize(b.size);
        await win.setPosition(b.pos);
        await win.setSizeConstraints({ minWidth: MIN_SIZE_NORMAL.width, minHeight: MIN_SIZE_NORMAL.height });
        setDocked(false);
      } else {
        await win.setAlwaysOnTop(false);
        await win.setSize(new PhysicalSize(NORMAL_SIZE.width, NORMAL_SIZE.height));
        await win.center();
        await win.setSizeConstraints({ minWidth: MIN_SIZE_NORMAL.width, minHeight: MIN_SIZE_NORMAL.height });
        setDocked(false);
      }
      setCollapsed(false);
    } catch {}
    finally { isResizingRef.current = false; }
  }, [collapsed]);

  // Detectar movimiento: si se acerca al borde derecho → acoplar (modo lateral)
  useEffect(() => {
    let unlisten = null;
    let checkTimer = null;

    const setup = async () => {
      try {
        const win = getCurrentWindow();
        unlisten = await win.onMoved(async () => {
          if (isResizingRef.current || collapsed) return;
          if (checkTimer) clearTimeout(checkTimer);
          checkTimer = setTimeout(async () => {
            try {
              const monitor = await win.currentMonitor();
              if (!monitor) return;
              const pos = await win.outerPosition();
              const size = await win.outerSize();
              const rightEdge = monitor.position.x + monitor.size.width;
              const windowRight = pos.x + size.width;
              const distToRight = rightEdge - windowRight;

              if (distToRight <= DOCK_THRESHOLD && distToRight >= -20) {
                // Cerca del borde derecho → modo lateral
                if (!dockedRef.current) {
                  await acoplarLateral();
                }
              } else if (distToRight > DOCK_THRESHOLD + 80) {
                // Lejos del borde → modo normal
                if (dockedRef.current) {
                  await desacoplar();
                }
              }
            } catch {}
          }, 120);
        });
      } catch {}
    };
    setup();
    return () => {
      if (unlisten) unlisten();
      if (checkTimer) clearTimeout(checkTimer);
    };
  }, [acoplarLateral, desacoplar, collapsed]);

  // Auto-ocultar:
  // 1) Si perdés el foco (clic fuera de la ventana) → se esconde solo
  // 2) Si sacás el mouse de la ventana unos segundos → también se esconde
  // 3) Al pasar el mouse por la franja o recuperar el foco → vuelve a aparecer
  useEffect(() => {
    if (!autoHide) {
      if (collapsed) expandirVentana();
      return;
    }

    const cancelHide = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const scheduleHide = (ms = 400) => {
      if (!autoHideListoRef.current) return;
      cancelHide();
      hideTimerRef.current = setTimeout(() => {
        colapsarVentana();
      }, ms);
    };

    // --- Clic fuera / perder foco de la ventana (lo más fiable en Windows) ---
    const onBlur = () => {
      scheduleHide(300);
    };
    const onFocus = () => {
      cancelHide();
      if (collapsed) expandirVentana();
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    // --- Mouse sale de la ventana ---
    const onMouseLeave = (e) => {
      // Solo si realmente salió de la ventana (relatedTarget null)
      if (e.relatedTarget === null) {
        scheduleHide(600);
      }
    };
    const onMouseEnter = () => {
      cancelHide();
      if (collapsed) expandirVentana();
    };
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    // --- Tauri: evento nativo de foco de la ventana ---
    let unlistenFocus = null;
    (async () => {
      try {
        const win = getCurrentWindow();
        unlistenFocus = await win.onFocusChanged(({ payload: focused }) => {
          if (focused) {
            cancelHide();
            if (collapsed) expandirVentana();
          } else {
            scheduleHide(300);
          }
        });
      } catch {}
    })();

    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      cancelHide();
      if (unlistenFocus) unlistenFocus();
    };
  }, [autoHide, collapsed, colapsarVentana, expandirVentana]);

  const cambiarAutoHide = (valor) => {
    setAutoHide(valor);
    try { localStorage.setItem(AUTO_HIDE_KEY, valor ? "1" : "0"); } catch {}
  };

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const duracionTotalSeg = useMemo(
    () => queue.reduce((acc, v) => acc + segundosDeDuracion(v.duration), 0),
    [queue]
  );

  const siguientes = useMemo(() => {
    if (currentIndex < 0 || !queue.length) return [];
    const out = [];
    for (let i = 1; i <= 9; i++) {
      const idx = (currentIndex + i) % queue.length;
      out.push({ ...queue[idx], _idx: idx });
    }
    return out;
  }, [queue, currentIndex]);

  // ---------- Franja de auto-ocultar ----------
  if (collapsed) {
    return (
      <div className="edge-strip" onMouseEnter={expandirVentana} onClick={expandirVentana} title="Mostrar MiniTube Player">
        <div ref={playerElRef} className="youtube-host" aria-hidden="true" />
      </div>
    );
  }

  // ---------- MODO LATERAL COMPACTO (derecha de la foto) ----------
  if (docked) {
    return (
      <div className="app app-docked">
        <div ref={playerElRef} className="youtube-host" aria-hidden="true" />

        <header className="titlebar titlebar-docked" data-tauri-drag-region>
          <div className="brand" data-tauri-drag-region>
            <span className="brand-badge"><Icon name="music" size={16} /></span>
            <span className="brand-text" data-tauri-drag-region><b>MiniTube</b> Player</span>
          </div>
          <div className="titlebar-actions">
            <button className="tb-btn" onClick={() => getCurrentWindow().minimize()} title="Minimizar">&#8211;</button>
            <button className="tb-btn tb-btn-close" onClick={() => getCurrentWindow().close()} title="Cerrar">&#10005;</button>
          </div>
        </header>

        <div className="docked-art">
          {queue[currentIndex] ? (
            <img src={queue[currentIndex].thumbnail.replace("mqdefault", "hqdefault")} alt="" />
          ) : (
            <div className="art-placeholder"><Icon name="music" size={40} /></div>
          )}
        </div>

        <div className="docked-info">
          <div className="docked-title" title={title}>{title}</div>
          <div className="docked-channel" title={channel}>{channel}</div>
        </div>

        <div className="docked-progress">
          <input
            type="range" min="0" max="100" value={progressPct}
            onChange={seek} className="docked-seek"
            disabled={!ready || duration <= 0}
          />
          <div className="time-row">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        <div className="docked-controls">
          <button className="ctrl-btn" onClick={anterior} disabled={!ready || queue.length < 2} title="Anterior">
            <Icon name="prev" size={16} />
          </button>
          <button className="ctrl-btn ctrl-btn-main" onClick={togglePlay} disabled={!ready || !queue.length} title={playing ? "Pausar" : "Reproducir"}>
            <Icon name={playing ? "pause" : "play"} size={22} />
          </button>
          <button className="ctrl-btn" onClick={siguiente} disabled={!ready || queue.length < 2} title="Siguiente">
            <Icon name="next" size={16} />
          </button>
        </div>

        <div className="docked-extra">
          <button
            className={`ctrl-btn ${repeatAll ? "ctrl-btn-active" : ""}`}
            onClick={() => setRepeatAll((v) => !v)}
            title={repeatAll ? "Repetir todo: activado" : "Repetir todo: desactivado"}
          >
            <Icon name="repeat" size={15} />
          </button>
          <div className="volume-box volume-box-docked">
            <Icon name="volume" size={14} />
            <input type="range" min="0" max="100" value={volume} onChange={changeVolume} className="volume-slider" />
            <span className="volume-pct">{volume}%</span>
          </div>
          <button className="ctrl-btn heart-btn" onClick={agregarFavorito} disabled={!ready || currentIndex < 0} title="Favorito">
            <Icon name="heart" size={15} />
          </button>
        </div>

        <section className="docked-next">
          <div className="docked-next-header">
            <Icon name="list" size={14} /> SIGUIENTES ({siguientes.length})
          </div>
          <div className="docked-next-list">
            {siguientes.map((v) => (
              <button key={`${v.id}-${v._idx}`} className="docked-next-item" onClick={() => playAt(v._idx)}>
                <img src={v.thumbnail} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                <span className="docked-next-text">
                  <span className="docked-next-title">{v.title}</span>
                  <span className="docked-next-dur">{v.duration || "--:--"}</span>
                </span>
              </button>
            ))}
            {siguientes.length === 0 && (
              <div className="queue-empty">Elegí un variado para cargar canciones</div>
            )}
          </div>
        </section>

        {message && <div className="docked-message">{message}</div>}
      </div>
    );
  }

  // ---------- MODO NORMAL / COMPACTO (izquierda de la foto) — al abrir ----------
  return (
    <div className="app app-normal">
      <div ref={playerElRef} className="youtube-host" aria-hidden="true" />

      <header className="titlebar" data-tauri-drag-region>
        <div className="brand" data-tauri-drag-region>
          <span className="brand-badge"><Icon name="music" size={18} /></span>
          <span className="brand-text" data-tauri-drag-region><b>MiniTube</b> Player</span>
        </div>

        <div className="search-box">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Buscar en YouTube..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
            disabled={!ready}
          />
          <button className="search-btn" onClick={() => buscar()} disabled={!ready || !searchText.trim()} title="Buscar">
            <Icon name="search" size={15} />
          </button>
        </div>

        <div className="titlebar-actions">
          <button className="tb-btn" onClick={() => getCurrentWindow().minimize()} title="Minimizar">&#8211;</button>
          <button className="tb-btn" onClick={() => getCurrentWindow().toggleMaximize()} title="Maximizar">&#9633;</button>
          <button className="tb-btn tb-btn-close" onClick={() => getCurrentWindow().close()} title="Cerrar">&#10005;</button>
        </div>
      </header>

      <div className="categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`category-btn ${activeCategory === cat.id ? "active" : ""}`}
            style={{ "--cat-color": cat.color, "--cat-color-to": cat.colorTo }}
            onClick={() => playCategory(cat)}
            disabled={!ready}
          >
            <Icon name={cat.icon} size={20} />
            <span className="category-text">
              <span className="category-kicker">VARIADO</span>
              <span className="category-name">{cat.label.toUpperCase()}</span>
            </span>
          </button>
        ))}
        <button
          className={`category-btn category-fav ${activeCategory === "favoritos" ? "active" : ""}`}
          onClick={playFavorites}
          disabled={!ready}
        >
          <Icon name="star" size={18} />
          <span className="category-name">FAVORITOS</span>
        </button>
      </div>

      <section className="playlist-card">
        <div className="playlist-header">
          <span className="playlist-label">
            <Icon name="list" size={14} /> LISTA DE REPRODUCCIÓN
          </span>
          <span className="playlist-meta">
            {queue.length ? formatMin(duracionTotalSeg) : ""}
          </span>
          <button
            className={`ctrl-btn shuffle-btn ${repeatAll ? "ctrl-btn-active" : ""}`}
            onClick={() => setRepeatAll((v) => !v)}
            title={repeatAll ? "Repetir todo: activado" : "Repetir todo: desactivado"}
          >
            <Icon name="repeat" size={14} />
          </button>
        </div>

        {queue.length === 0 ? (
          <div className="queue-empty">
            {loading ? "Buscando canciones..." : "Elegí un variado o buscá algo para cargar canciones."}
          </div>
        ) : (
          <div className="queue-list">
            {queue.map((video, index) => (
              <button
                key={`${video.id}-${index}`}
                className={`queue-item ${index === currentIndex ? "current" : ""}`}
                onClick={() => playAt(index)}
              >
                <img
                  src={video.thumbnail}
                  alt=""
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                />
                <span className="queue-text">
                  <span className="queue-title" title={video.title}>{video.title}</span>
                  <span className="queue-channel" title={video.channel}>{video.channel}</span>
                </span>
                {index === currentIndex && playing && <span className="queue-bars"><Icon name="bars" size={16} /></span>}
                <span className="queue-duration">{video.duration || "--:--"}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Barra inferior de reproducción (como en la foto izquierda) */}
      <footer className="mini-player">
        <div className="mini-art">
          {queue[currentIndex] ? (
            <img src={queue[currentIndex].thumbnail} alt="" />
          ) : (
            <div className="art-placeholder-sm"><Icon name="music" size={20} /></div>
          )}
        </div>
        <div className="mini-info">
          <div className="mini-title" title={title}>{title}</div>
          <div className="mini-channel" title={channel}>{channel}</div>
          <div className="mini-progress-wrap">
            <input
              type="range" min="0" max="100" value={progressPct}
              onChange={seek} className="mini-seek"
              disabled={!ready || duration <= 0}
            />
            <div className="mini-times">
              <span>{fmt(currentTime)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>
        </div>
        <div className="mini-controls">
          <button className="ctrl-btn" onClick={anterior} disabled={!ready || queue.length < 2} title="Anterior">
            <Icon name="prev" size={16} />
          </button>
          <button className="ctrl-btn ctrl-btn-main" onClick={togglePlay} disabled={!ready || !queue.length} title={playing ? "Pausar" : "Reproducir"}>
            <Icon name={playing ? "pause" : "play"} size={20} />
          </button>
          <button className="ctrl-btn" onClick={siguiente} disabled={!ready || queue.length < 2} title="Siguiente">
            <Icon name="next" size={16} />
          </button>
          <button
            className={`ctrl-btn ${repeatAll ? "ctrl-btn-active" : ""}`}
            onClick={() => setRepeatAll((v) => !v)}
            title="Repetir"
          >
            <Icon name="repeat" size={14} />
          </button>
          <div className="volume-box volume-box-mini">
            <Icon name="volume" size={14} />
            <input type="range" min="0" max="100" value={volume} onChange={changeVolume} className="volume-slider" />
            <span className="volume-pct">{volume}%</span>
          </div>
          <button className="ctrl-btn heart-btn" onClick={agregarFavorito} disabled={!ready || currentIndex < 0} title="Favorito">
            <Icon name="heart" size={15} />
          </button>
        </div>
      </footer>

      <footer className="statusbar">
        <span className={`status-dot ${ready ? "connected" : ""}`} />
        <span>{ready ? "Reproduciendo desde YouTube" : "Conectando..."}</span>
        <span className="status-sep">·</span>
        <span>Auto-ocultar: <b>{autoHide ? "activado" : "desactivado"}</b></span>
        <span className="status-hint"> · Arrastrá al borde derecho para modo lateral</span>
        <span className="status-gear" onClick={() => setShowSettings((s) => !s)} title="Ajustes">
          <Icon name="gear" size={16} />
        </span>
      </footer>

      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Ajustes</h3>
            <label className="settings-row">
              <input type="checkbox" checked={autoHide} onChange={(e) => cambiarAutoHide(e.target.checked)} />
              Ocultar la ventana en el borde derecho del monitor
            </label>
            <p className="settings-hint">
              Con auto-ocultar activado, la ventana se esconde sola cuando:
              <br />• Hacés clic fuera del reproductor (en otra app o en el escritorio)
              <br />• Sacás el mouse de la ventana unos segundos
              <br /><br />
              Para recuperarla: pasá el mouse o hacé clic en la franja de color del borde derecho.
              <br /><br />
              <b>Tip:</b> Arrastrá la ventana hacia el borde derecho de la pantalla para pasar
              al modo lateral compacto (diseño vertical).
            </p>
            <button className="settings-close" onClick={() => setShowSettings(false)}>Cerrar</button>
          </div>
        </div>
      )}

      {message && !loading && (
        <div className="toast-message">{message}</div>
      )}
    </div>
  );
}
