import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import MapPicker from "../components/MapPicker";
import OpeningHoursEditor from "../components/OpeningHoursEditor";
import { CapacityBar, OpenBadge } from "../components/WarehouseStatus";
import { findHoursError } from "../utils/warehouseHours";
import { createWarehouse, getWards, getWarehouses } from "../api/client";

function wardLabel(ward) {
  if (!ward) return "";
  const district = ward.district === "Kathmandu" ? "KTM" : ward.district;
  return [ward.name, district, ward.locality].filter(Boolean).join(", ");
}

// Great-circle distance in km - plenty accurate for picking the nearest
// ward centroid over Nepal-scale distances.
function distanceKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestWard(wards, [lng, lat]) {
  let best = null;
  let bestDist = Infinity;
  for (const w of wards) {
    if (!w.location?.coordinates) continue;
    const d = distanceKm(w.location.coordinates, [lng, lat]);
    if (d < bestDist) {
      bestDist = d;
      best = w;
    }
  }
  return best;
}

// Reverse-geocodes a point to a short street/landmark string via Nominatim
// (OpenStreetMap), the same tile provider MapPicker already uses. Falls
// back to null on any failure - the field just stays empty for manual entry.
async function reverseGeocodeAddress(lat, lng) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error("reverse geocode failed");
  const data = await res.json();
  const a = data.address || {};
  const parts = [
    a.road || a.pedestrian || a.neighbourhood,
    a.suburb && a.suburb !== (a.road || a.pedestrian) ? a.suburb : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : data.display_name || null;
}

// Server validation errors come back as { errors: [{ msg }] }, other
// failures as { message } - show whichever is there.
function apiError(err, fallback) {
  const data = err.response?.data;
  return data?.message || data?.errors?.[0]?.msg || fallback;
}

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [wards, setWards] = useState([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [ward, setWard] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState(null);
  const [contactPhone, setContactPhone] = useState("");
  const [capacity, setCapacity] = useState("");
  const [openingHours, setOpeningHours] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);
  const [wardAutoFilled, setWardAutoFilled] = useState(false);
  const [addressAutoFilled, setAddressAutoFilled] = useState(false);
  const [coordsAutoFilled, setCoordsAutoFilled] = useState(false);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [coordsError, setCoordsError] = useState("");

  function loadWarehouses() {
    getWarehouses()
      .then(setWarehouses)
      .catch(() => setError("Could not load warehouses."));
  }

  useEffect(() => {
    loadWarehouses();
    getWards().then(setWards).catch(() => { });
  }, []);

  function resetForm() {
    setName("");
    setWard("");
    setAddress("");
    setLocation(null);
    setContactPhone("");
    setCapacity("");
    setOpeningHours([]);
    setFormError("");
    setWardAutoFilled(false);
    setAddressAutoFilled(false);
    setCoordsAutoFilled(false);
    setLatInput("");
    setLngInput("");
    setCoordsError("");
  }

  // Dropping or moving the pin auto-fills ward (nearest ward centroid,
  // computed locally) and address (reverse-geocoded street/landmark), but
  // both fields stay normal, editable inputs - picking a different ward or
  // retyping the address afterward simply overrides the suggestion.
  async function handleLocationChange(coords) {
    setLocation(coords);
    setLatInput(coords[1].toFixed(6));
    setLngInput(coords[0].toFixed(6));
    setCoordsAutoFilled(true);
    setCoordsError("");
    setAutoFilling(true);

    const nearest = findNearestWard(wards, coords);
    if (nearest) {
      setWard(nearest._id);
      setWardAutoFilled(true);
    }

    try {
      const addr = await reverseGeocodeAddress(coords[1], coords[0]);
      if (addr) {
        setAddress(addr);
        setAddressAutoFilled(true);
      }
    } catch {
      // Reverse geocoding is a convenience, not a requirement - the address
      // field is still right there to fill in by hand.
    } finally {
      setAutoFilling(false);
    }
  }

  // Lets someone type exact coordinates instead of tapping the map - e.g.
  // pasted in from another source. Treated the same as dropping a pin: it
  // moves the map marker and re-runs the ward/address lookup for that point.
  function handleCoordsApply() {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return setCoordsError("Enter both latitude and longitude as numbers.");
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return setCoordsError("Latitude must be -90 to 90, longitude -180 to 180.");
    }
    setCoordsError("");
    handleLocationChange([lng, lat]);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");

    if (!ward) return setFormError("Choose a ward.");
    if (!location) return setFormError("Pick a location on the map.");
    if (capacity !== "" && !(Number(capacity) >= 1)) return setFormError("Capacity must be 1 or more.");
    const hoursProblem = findHoursError(openingHours);
    if (hoursProblem) return setFormError(hoursProblem);

    setSubmitting(true);
    try {
      await createWarehouse({
        name,
        ward,
        address,
        location: { coordinates: location },
        contactPhone: contactPhone || undefined,
        capacity: capacity !== "" ? Number(capacity) : undefined,
        openingHours: openingHours.length > 0 ? openingHours : undefined,
      });
      resetForm();
      setShowForm(false);
      loadWarehouses();
    } catch (err) {
      setFormError(apiError(err, "Could not create this warehouse."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header variant="coordination" />
      <main className="w-full pt-16 flex-1">
        <div className="bg-primary">
          <div className="max-w-[1120px] mx-auto px-margin-mobile lg:px-margin py-space-lg flex items-center justify-between gap-space-md flex-wrap">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-primary tracking-tight">Warehouses</h1>
              <p className="font-body-md text-body-md text-on-primary/80 mt-0.5 max-w-[520px]">
                Storage points where anyone can drop off relief materials in person. Track what's actually in stock
                at each one.
              </p>
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="h-11 px-space-md rounded-lg bg-on-primary/10 text-on-primary font-label-md text-label-md flex items-center gap-1.5 hover:bg-on-primary/20 transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">{showForm ? "close" : "add"}</span>
              {showForm ? "Cancel" : "Add Warehouse"}
            </button>
          </div>
        </div>

        <div className="max-w-[1120px] mx-auto px-margin-mobile lg:px-margin py-space-lg">
          {error && <p className="font-caption text-caption text-status-critical mb-space-md">{error}</p>}

          {showForm && (
            <form
              onSubmit={handleCreate}
              className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md mb-space-lg flex flex-col gap-space-md"
            >
              <h2 className="font-headline-sm text-headline-sm text-on-surface">New Warehouse</h2>

              <div className="grid sm:grid-cols-2 gap-space-sm">
                <div className="flex flex-col space-y-1.5">
                  <label className="font-label-md text-label-md text-on-surface">Name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                    placeholder="e.g. Ward 14 Relief Storage"
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="font-label-md text-label-md text-on-surface flex items-center gap-1.5">
                    Ward
                    {wardAutoFilled && (
                      <span className="font-caption text-caption text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        Auto-filled
                      </span>
                    )}
                  </label>
                  <select
                    required
                    value={ward}
                    onChange={(e) => {
                      setWard(e.target.value);
                      setWardAutoFilled(false);
                    }}
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    <option value="">Select a ward</option>
                    {wards.map((w) => (
                      <option key={w._id} value={w._id}>
                        {wardLabel(w)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1.5">
                  Address
                  {addressAutoFilled && (
                    <span className="font-caption text-caption text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                      Auto-filled
                    </span>
                  )}
                </label>
                <input
                  required
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setAddressAutoFilled(false);
                  }}
                  className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                  placeholder="Street / landmark, so donors can find it"
                />
                <p className="font-caption text-caption text-on-surface-variant">
                  Filled in automatically from the pin below - edit freely if it's not quite right.
                </p>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1.5">
                  Coordinates
                  {coordsAutoFilled && (
                    <span className="font-caption text-caption text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                      Auto-filled
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-space-sm flex-wrap">
                  <input
                    value={latInput}
                    onChange={(e) => {
                      setLatInput(e.target.value);
                      setCoordsAutoFilled(false);
                    }}
                    inputMode="decimal"
                    className="w-full sm:w-[150px] h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                    placeholder="Latitude"
                  />
                  <input
                    value={lngInput}
                    onChange={(e) => {
                      setLngInput(e.target.value);
                      setCoordsAutoFilled(false);
                    }}
                    inputMode="decimal"
                    className="w-full sm:w-[150px] h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                    placeholder="Longitude"
                  />
                  <button
                    type="button"
                    onClick={handleCoordsApply}
                    className="h-11 px-space-md rounded-lg border border-surface-container-highest font-label-md text-label-md text-on-surface hover:bg-surface-container transition-colors shrink-0"
                  >
                    Use these coordinates
                  </button>
                </div>
                {coordsError && <p className="font-caption text-caption text-status-critical">{coordsError}</p>}
                <p className="font-caption text-caption text-on-surface-variant">
                  Filled in automatically when you pin the location on the map - or type coordinates here and apply
                  them to move the pin.
                </p>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1.5">
                  Location
                  {autoFilling && (
                    <span className="font-caption text-caption text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                      Looking up ward &amp; address...
                    </span>
                  )}
                </label>
                <MapPicker value={location} onChange={handleLocationChange} autoRequest={false} />
              </div>

              <div className="grid sm:grid-cols-2 gap-space-sm">
                <div className="flex flex-col space-y-1.5">
                  <label className="font-label-md text-label-md text-on-surface">Contact phone (optional)</label>
                  <input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                    placeholder="98XXXXXXXX"
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="font-label-md text-label-md text-on-surface">Capacity in units (optional)</label>
                  <input
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                    placeholder="e.g. 500"
                  />
                  <p className="font-caption text-caption text-on-surface-variant">
                    Leave empty for no limit. Donors are turned away once it's full.
                  </p>
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="font-label-md text-label-md text-on-surface">Opening hours</label>
                <OpeningHoursEditor value={openingHours} onChange={setOpeningHours} />
              </div>

              {formError && <p className="font-caption text-caption text-status-critical">{formError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="h-11 rounded-lg bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60 self-start px-space-lg"
              >
                {submitting ? "Creating..." : "Create Warehouse"}
              </button>
            </form>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
            {warehouses.map((w) => (
              <Link
                key={w._id}
                to={`/coordination/warehouses/${w._id}`}
                className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-space-sm">
                  <span className="material-symbols-outlined text-[20px]">warehouse</span>
                </div>
                <p className="font-label-md text-label-md text-on-surface">{w.name}</p>
                <p className="font-caption text-caption text-on-surface-variant mt-0.5">{w.address}</p>
                {w.ward && (
                  <p className="font-caption text-caption text-on-surface-variant/70 mt-0.5">{wardLabel(w.ward)}</p>
                )}
                {(w.openingHours?.length > 0 || w.capacity) && (
                  <div className="mt-space-sm flex flex-col gap-space-xs">
                    <OpenBadge openingHours={w.openingHours} showDetail />
                    <CapacityBar warehouse={w} />
                  </div>
                )}
              </Link>
            ))}

            {warehouses.length === 0 && !error && (
              <div className="sm:col-span-2 lg:col-span-3 flex flex-col items-center justify-center text-center py-space-xl px-space-md rounded-xl border border-dashed border-surface-container-highest">
                <span className="material-symbols-outlined text-[40px] text-on-surface-variant mb-space-sm">
                  warehouse
                </span>
                <p className="font-label-md text-label-md text-on-surface mb-1">No warehouses yet</p>
                <p className="font-caption text-caption text-on-surface-variant max-w-[280px]">
                  Add one so donors have somewhere to bring relief materials.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}