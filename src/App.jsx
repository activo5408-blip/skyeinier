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
const EXPANDED_SIZE = { width: 760, height: 760 };
const MIN_SIZE_NORMAL = { width: 680, height: 640 };
const LATERAL_SIZE = { width: 350, height: 720 };
const EDGE_STRIP_WIDTH = 12;
const DOCK_MARGIN = 18;

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

// Alturas "de onda" pseudoaleatorias pero estables para un mismo video.
const alturasOnda = (semilla, cantidad = 56) => {
  let x = 0;
  const s = String(semilla || "silencio");
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
  const alturas = [];
  for (let i = 0; i < cantidad; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    alturas.push(18 + (x % 82));
  }
  return alturas;
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

  // ---------- Auto-ocultado en el borde del monitor ----------
  const [autoHide, setAutoHide] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [docked, setDocked] = useState(false);
  const expandedBoundsRef = useRef(null);
  const lateralBoundsRef = useRef(null);
  const hideTimerRef = useRef(null);
  const autoHideListoRef = useRef(false);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { repeatAllRef.current = repeatAll; }, [repeatAll]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

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

  // Reproduce el índice indicado de la cola. Usa refs, así que es una función
  // 100% estable: puede llamarse sin problema desde los callbacks del
  // reproductor de YouTube (que se registran una sola vez al iniciar).
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
        // Compatibilidad con el formato viejo (videoId en vez de id).
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
    // Evita que la ventana se esconda apenas se abre la app.
    const t = setTimeout(() => { autoHideListoRef.current = true; }, 3500);
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

  // ---------- Acoplar a la izquierda / modo lateral ----------
  const guardarBordesActuales = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      const pos = await win.outerPosition();
      const size = await win.outerSize();
      if (size.width > EDGE_STRIP_WIDTH * 2 && size.width > LATERAL_SIZE.width) {
        expandedBoundsRef.current = { pos, size };
      }
    } catch {}
  }, []);

  const colapsarVentana = useCallback(async () => {
    if (collapsed) return;
    try {
      const win = getCurrentWindow();
      if (!expandedBoundsRef.current) await guardarBordesActuales();
      const monitor = await win.currentMonitor();
      if (!monitor) return;
      const alturaFranja = Math.round(Math.min(monitor.size.height * 0.46, 420));
      const y = monitor.position.y + Math.round((monitor.size.height - alturaFranja) / 2);
      const x = monitor.position.x - EDGE_STRIP_WIDTH + 2;
      await win.setSizeConstraints({ minWidth: 0, minHeight: 0 });
      await win.setSize(new PhysicalSize(EDGE_STRIP_WIDTH, alturaFranja));
      await win.setPosition(new PhysicalPosition(x, y));
      await win.setAlwaysOnTop(true);
      setDocked(true);
      setCollapsed(true);
    } catch {}
  }, [collapsed, guardarBordesActuales]);

  const mostrarLateral = useCallback(async () => {
    if (!collapsed) return;
    try {
      const win = getCurrentWindow();
      const monitor = await win.currentMonitor();
      if (!monitor) return;
      const h = Math.min(LATERAL_SIZE.height, monitor.size.height - 36);
      const y = monitor.position.y + Math.round((monitor.size.height - h) / 2);
      const x = monitor.position.x + DOCK_MARGIN;
      await win.setSize(new PhysicalSize(LATERAL_SIZE.width, h));
      await win.setPosition(new PhysicalPosition(x, y));
      await win.setAlwaysOnTop(true);
      setCollapsed(false);
    } catch {}
  }, [collapsed]);

  const expandirVentana = useCallback(async () => {
    if (!collapsed) return;
    try {
      const win = getCurrentWindow();
      await win.setAlwaysOnTop(false);
      const b = expandedBoundsRef.current;
      if (b) {
        await win.setSize(b.size);
        await win.setPosition(b.pos);
      } else {
        await win.setSize(new PhysicalSize(EXPANDED_SIZE.width, EXPANDED_SIZE.height));
        await win.center();
      }
      await win.setSizeConstraints({ minWidth: MIN_SIZE_NORMAL.width, minHeight: MIN_SIZE_NORMAL.height });
      setDocked(false);
      setCollapsed(false);
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    if (!autoHide) {
      if (collapsed) expandirVentana();
      return;
    }
    const onEnter = () => {
      if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
      if (collapsed && docked) mostrarLateral();
      else if (collapsed) expandirVentana();
    };
    const onLeave = () => {
      if (!autoHideListoRef.current) return;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(async () => {
        try {
          const win = getCurrentWindow();
          const pos = await win.outerPosition();
          const monitor = await win.currentMonitor();
          if (!monitor) return;
          const nearLeft = pos.x <= monitor.position.x + 28;
          if (nearLeft || docked) colapsarVentana();
        } catch {}
      }, 800);
    };
    document.addEventListener("mouseenter", onEnter);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("mouseenter", onEnter);
      document.removeEventListener("mouseleave", onLeave);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [autoHide, collapsed, docked, colapsarVentana, expandirVentana, mostrarLateral]);

  const cambiarAutoHide = (valor) => {
    setAutoHide(valor);
    try { localStorage.setItem(AUTO_HIDE_KEY, valor ? "1" : "0"); } catch {}
  };

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const duracionTotalSeg = useMemo(
    () => queue.reduce((acc, v) => acc + segundosDeDuracion(v.duration), 0),
    [queue]
  );
  const ondas = useMemo(
    () => alturasOnda(queue[currentIndex]?.id),
    [queue, currentIndex]
  );

  if (collapsed) {
    return (
      <div className="edge-strip" onMouseEnter={expandirVentana} title="Mostrar MiniTube Player">
        <div ref={playerElRef} className="youtube-host" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={`app ${docked ? "app-lateral" : ""}`}>
      {/* El iframe NO usa display:none: YouTube puede detener un reproductor completamente oculto. */}
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
            <Icon name={cat.icon} size={24} />
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
          <Icon name="star" size={22} />
          <span className="category-name">FAVORITOS</span>
        </button>
      </div>

      <main className="content">
        <section className="results-card">
          <div className="results-header">
            <span>RESULTADOS ({queue.length}){queue.length ? ` · ${formatMin(duracionTotalSeg)}` : ""}</span>
            {loading && <span className="results-loading">Buscando...</span>}
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
                  {index === currentIndex && playing && <span className="queue-bars"><Icon name="bars" size={18} /></span>}
                  <span className="queue-duration">{video.duration || "--:--"}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="now-playing">
          <div className="art-frame">
            {queue[currentIndex] ? (
              <img src={queue[currentIndex].thumbnail.replace("mqdefault", "hqdefault")} alt="" />
            ) : (
              <div className="art-placeholder"><Icon name="music" size={48} /></div>
            )}
          </div>

          <div className="np-title" title={title}>{title}</div>
          <div className="np-channel" title={channel}>{channel}</div>

          {message && <div className="player-message">{message}</div>}

          <div className="waveform-wrap">
            <div className="waveform">
              {ondas.map((h, i) => <div key={i} className="waveform-bar" style={{ height: `${h}%` }} />)}
            </div>
            <div className="waveform-overlay" style={{ width: `${progressPct}%` }}>
              <div className="waveform">
                {ondas.map((h, i) => <div key={i} className="waveform-bar" style={{ height: `${h}%` }} />)}
              </div>
            </div>
            <input
              type="range" min="0" max="100" value={progressPct}
              onChange={seek} className="waveform-seek"
              disabled={!ready || duration <= 0}
            />
          </div>
          <div className="time-row">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>

          <button className="fav-add" title="Agregar a favoritos" onClick={agregarFavorito} disabled={!ready || currentIndex < 0}>
            <Icon name="star" size={16} /> Agregar a favoritos
          </button>
        </section>
      </main>

      <section className="compact-current">
        <div className="compact-art">
          {queue[currentIndex] ? <img src={queue[currentIndex].thumbnail} alt="" /> : <Icon name="music" size={24} />}
        </div>
        <div className="compact-meta">
          <div className="compact-title" title={title}>{title}</div>
          <div className="compact-channel" title={channel}>{channel}</div>
          <div className="compact-progress"><span style={{ width: `${progressPct}%` }} /></div>
          <div className="compact-times"><span>{fmt(currentTime)}</span><span>{fmt(duration)}</span></div>
        </div>
        <button className="compact-heart" onClick={agregarFavorito} disabled={!ready || currentIndex < 0} title="Agregar a favoritos"><Icon name="star" size={18} /></button>
      </section>

      <footer className="controls-bar">
        <button
          className={`ctrl-btn ${repeatAll ? "ctrl-btn-active" : ""}`}
          onClick={() => setRepeatAll((v) => !v)}
          title={repeatAll ? "Repetir todo: activado" : "Repetir todo: desactivado"}
        >
          <Icon name="repeat" size={17} />
        </button>
        <button className="ctrl-btn" onClick={anterior} disabled={!ready || queue.length < 2} title="Anterior">
          <Icon name="prev" size={18} />
        </button>
        <button className="ctrl-btn ctrl-btn-main" onClick={togglePlay} disabled={!ready || !queue.length} title={playing ? "Pausar" : "Reproducir"}>
          <Icon name={playing ? "pause" : "play"} size={24} />
        </button>
        <button className="ctrl-btn" onClick={siguiente} disabled={!ready || queue.length < 2} title="Siguiente">
          <Icon name="next" size={18} />
        </button>
        <div className="volume-box">
          <Icon name="volume" size={16} />
          <input type="range" min="0" max="100" value={volume} onChange={changeVolume} className="volume-slider" />
          <span className="volume-pct">{volume}%</span>
        </div>
      </footer>

      <footer className="statusbar">
        <span className={`status-dot ${ready ? "connected" : ""}`} />
        <span>{ready ? "Reproduciendo desde YouTube" : "Conectando..."}</span>
        <span className="status-sep">·</span>
        <span>Auto-ocultar: <b>{autoHide ? "activado" : "desactivado"}</b></span>
        <span className="status-gear" onClick={() => setShowSettings((s) => !s)} title="Ajustes">
          <Icon name="gear" size={16} /> Ajustes
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
              Con esto activado, la ventana se esconde en el borde derecho de la pantalla poco
              después de sacar el mouse, y vuelve a aparecer con el diseño completo apenas
              pasás el mouse por ese borde otra vez.
            </p>
            <button className="settings-close" onClick={() => setShowSettings(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
