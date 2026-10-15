import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import MapPicker from "../components/MapPicker";
import { createWarehouse, getWards, getWarehouses } from "../api/client";

function wardLabel(ward) {
  if (!ward) return "";
  const district = ward.district === "Kathmandu" ? "KTM" : ward.district;
  return [ward.name, district, ward.locality].filter(Boolean).join(", ");
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
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

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
    setFormError("");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");

    if (!ward) return setFormError("Choose a ward.");
    if (!location) return setFormError("Pick a location on the map.");

    setSubmitting(true);
    try {
      await createWarehouse({
        name,
        ward,
        address,
        location: { coordinates: location },
        contactPhone: contactPhone || undefined,
      });
      resetForm();
      setShowForm(false);
      loadWarehouses();
    } catch (err) {
      setFormError(err.response?.data?.message || "Could not create this warehouse.");
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
                  <label className="font-label-md text-label-md text-on-surface">Ward</label>
                  <select
                    required
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
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
                <label className="font-label-md text-label-md text-on-surface">Address</label>
                <input
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                  placeholder="Street / landmark, so donors can find it"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="font-label-md text-label-md text-on-surface">Location</label>
                <MapPicker value={location} onChange={setLocation} autoRequest={false} />
              </div>

              <div className="flex flex-col space-y-1.5 max-w-[280px]">
                <label className="font-label-md text-label-md text-on-surface">Contact phone (optional)</label>
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-primary transition-colors"
                  placeholder="98XXXXXXXX"
                />
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