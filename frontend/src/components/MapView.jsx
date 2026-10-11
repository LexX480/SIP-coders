import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

const DEFAULT_CENTER = [27.9, 84.8]; // roughly central over Gorkha/Dhading

// Resource-type color coding, sparse per the design system (one accent
// family per marker type, not per screen)
const RESOURCE_COLORS = {
  food: "#E8A33D",
  water: "#1B2A4A",
  shelter: "#D7263D",
  medical: "#1FAA59",
};

// markers: [{ id, lng, lat, resourceType, label }]
export default function MapView({ markers = [], center }) {
  return (
    <div className="w-full h-full min-h-[280px] rounded-xl overflow-hidden border border-surface-container-highest">
      <MapContainer center={center || DEFAULT_CENTER} zoom={9} className="w-full h-full">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lng]}
            radius={8}
            pathOptions={{
              color: RESOURCE_COLORS[m.resourceType] || "#8A8578",
              fillColor: RESOURCE_COLORS[m.resourceType] || "#8A8578",
              fillOpacity: 0.85,
              weight: 1,
            }}
          >
            {m.label && <Popup>{m.label}</Popup>}
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
