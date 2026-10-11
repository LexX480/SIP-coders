import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Leaflet's default marker icon paths break under bundlers (Vite included)
// because the images are resolved relative to the CSS, not the JS. This is
// the standard fix: point the default icon at CDN-hosted images.
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Default center: Kathmandu Valley, a reasonable fallback for Nepal-wide use
const DEFAULT_CENTER = [27.7, 85.3];

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lng, e.latlng.lat]);
    },
  });
  return null;
}

// Recenters/pans the already-mounted map whenever `center` changes - needed
// because MapContainer's `center` prop only applies on first mount, so a
// geolocation result arriving after mount wouldn't otherwise move the view.
function RecenterOnChange({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, Math.max(map.getZoom(), 14));
  }, [center, map]);
  return null;
}

// value: [lng, lat] | null.  onChange: ([lng, lat]) => void
// autoRequest: if true, asks for the browser's location permission as soon
// as this component mounts, instead of waiting for the person to tap a
// button. Either way the manual "Use my current location" button and
// tap-to-drop-a-pin fallback stay available.
export default function MapPicker({ value, onChange, wardLabel, autoRequest = true }) {
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const [hasAutoRequested, setHasAutoRequested] = useState(false);

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocateError("Your browser doesn't support location access. Tap the map instead.");
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        onChange([longitude, latitude]);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        // err.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        if (err.code === 1) {
          setLocateError("Location permission denied. Tap the map to set your location manually.");
        } else {
          setLocateError("Couldn't get your location. Tap the map to set it manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  // Ask once, automatically, the first time this picker appears - mirrors
  // "location gets pinged as soon as they grant permission" rather than
  // requiring an extra click first.
  useEffect(() => {
    if (autoRequest && !hasAutoRequested && !value) {
      setHasAutoRequested(true);
      requestLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRequest, hasAutoRequested, value]);

  const mapCenter = value ? [value[1], value[0]] : DEFAULT_CENTER;

  return (
    <div className="relative w-full h-64 rounded-xl overflow-hidden border border-surface-container-highest">
      <MapContainer center={mapCenter} zoom={value ? 14 : 12} className="w-full h-full">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onChange} />
        <RecenterOnChange center={value ? [value[1], value[0]] : null} />
        {value && <Marker position={[value[1], value[0]]} icon={defaultIcon} />}
      </MapContainer>

      {wardLabel && (
        <div className="absolute bottom-3 left-3 bg-surface-container-lowest px-3 py-1.5 rounded-lg shadow-sm z-[1000]">
          <span className="font-label-md text-label-md text-on-surface">{wardLabel}</span>
        </div>
      )}

      <button
        type="button"
        onClick={requestLocation}
        disabled={locating}
        className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1.5 rounded-lg shadow-sm font-label-sm text-label-sm text-on-surface hover:bg-surface-container transition-colors disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-[16px]">
          {locating ? "sync" : "my_location"}
        </span>
        {locating ? "Locating..." : "Use my location"}
      </button>

      {!value && !locating && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-surface-container-lowest px-3 py-1.5 rounded-lg shadow-sm z-[1000]">
          <span className="font-caption text-caption text-on-surface-variant">
            Allow location access, or tap the map to drop a pin
          </span>
        </div>
      )}

      {locateError && (
        <div className="absolute bottom-3 right-3 max-w-[70%] bg-status-critical/10 border border-status-critical/20 px-3 py-1.5 rounded-lg z-[1000]">
          <span className="font-caption text-caption text-status-critical">{locateError}</span>
        </div>
      )}
    </div>
  );
}