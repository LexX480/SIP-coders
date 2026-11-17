import { useEffect, useState } from "react";

// Branded loading screen for SaajhaRahat.
//
//   <LoadingScreen />                          full-screen (page / route loading)
//   <LoadingScreen label="Loading analytics" />  custom message
//   <LoadingScreen inline />                   fits inside a card or section
//
// `delay` (ms) holds the screen back so fast loads never flash it. The
// full-screen version defaults to 0 so the first load feels deliberate;
// pass delay={200} for route changes if you want it only when things are slow.
//
// Styles are self-contained (no Tailwind tokens needed) and honour
// prefers-reduced-motion. Expects /logo-icon.png in your public folder, the
// same file the header uses.
const BLUE = "#184681";

export default function LoadingScreen({ label = "Loading", inline = false, delay = 0 }) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!visible) return null;

  return (
    <div
      className={`sr-load ${inline ? "sr-load--inline" : "sr-load--full"}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="sr-load__badge">
        <span className="sr-load__ring sr-load__ring--track" />
        <span className="sr-load__ring sr-load__ring--spin" />
        <img src="/logo-icon.png" alt="" className="sr-load__logo" />
      </div>

      {!inline && <p className="sr-load__brand">SaajhaRahat</p>}
      <p className="sr-load__label">
        {label}
        <span className="sr-load__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </p>
      {!inline && <p className="sr-load__tag">Coordinate relief, not duplication</p>}

      <div className="sr-load__bar" aria-hidden="true">
        <span />
      </div>

      <style>{`
        .sr-load {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; font-family: inherit; color: #141414;
          animation: sr-fade .35s ease-out both;
        }
        .sr-load--full { position: fixed; inset: 0; z-index: 9999; background: #F7F6F2; padding: 24px; }
        .sr-load--inline { padding: 48px 16px; width: 100%; }

        .sr-load__badge { position: relative; width: 96px; height: 96px; display: flex; align-items: center; justify-content: center; }
        .sr-load--inline .sr-load__badge { width: 64px; height: 64px; }
        .sr-load__ring { position: absolute; inset: 0; border-radius: 9999px; }
        .sr-load__ring--track { border: 3px solid rgba(24, 70, 129, .12); }
        .sr-load__ring--spin { border: 3px solid transparent; border-top-color: ${BLUE}; border-right-color: ${BLUE}; animation: sr-spin 1.1s cubic-bezier(.55,.15,.45,.85) infinite; }
        .sr-load__logo { width: 56px; height: 56px; object-fit: contain; border-radius: 12px; animation: sr-pulse 2s ease-in-out infinite; }
        .sr-load--inline .sr-load__logo { width: 36px; height: 36px; }

        .sr-load__brand { margin: 24px 0 0; font-size: 22px; font-weight: 700; letter-spacing: -.01em; color: ${BLUE}; }
        .sr-load__label { margin: 6px 0 0; font-size: 14px; color: #8A8578; display: flex; align-items: center; gap: 2px; }
        .sr-load--inline .sr-load__label { margin-top: 14px; }
        .sr-load__dots { display: inline-flex; gap: 2px; margin-left: 2px; }
        .sr-load__dots i { width: 3px; height: 3px; border-radius: 9999px; background: currentColor; animation: sr-dot 1.2s infinite ease-in-out both; }
        .sr-load__dots i:nth-child(2) { animation-delay: .15s; }
        .sr-load__dots i:nth-child(3) { animation-delay: .3s; }
        .sr-load__tag { margin: 18px 0 0; font-size: 12px; letter-spacing: .04em; color: #8A8578; }

        .sr-load__bar { margin-top: 22px; width: 160px; height: 3px; border-radius: 9999px; background: rgba(24,70,129,.12); overflow: hidden; }
        .sr-load--inline .sr-load__bar { width: 120px; }
        .sr-load__bar span { display: block; height: 100%; width: 40%; border-radius: 9999px; background: ${BLUE}; animation: sr-slide 1.3s ease-in-out infinite; }

        @keyframes sr-spin { to { transform: rotate(360deg); } }
        @keyframes sr-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes sr-dot { 0%,80%,100% { opacity: .2; } 40% { opacity: 1; } }
        @keyframes sr-slide { 0% { transform: translateX(-110%); } 100% { transform: translateX(260%); } }
        @keyframes sr-fade { from { opacity: 0; } to { opacity: 1; } }

        @media (prefers-reduced-motion: reduce) {
          .sr-load, .sr-load__ring--spin, .sr-load__logo, .sr-load__dots i, .sr-load__bar span { animation: none; }
          .sr-load__bar span { width: 100%; opacity: .5; }
          .sr-load__ring--spin { border-color: ${BLUE}; }
        }
      `}</style>
    </div>
  );
}