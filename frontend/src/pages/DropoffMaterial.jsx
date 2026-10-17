import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import ResourceGrid from "../components/ResourceGrid";
import { CapacityBar, HoursList, OpenBadge } from "../components/WarehouseStatus";
import { getWarehouses, submitDropoff } from "../api/client";

function wardLabel(ward) {
  if (!ward) return "";
  const district = ward.district === "Kathmandu" ? "KTM" : ward.district;
  return [ward.name, district, ward.locality].filter(Boolean).join(", ");
}

function directionsUrl(location) {
  if (!location?.coordinates) return "#";
  const [lng, lat] = location.coordinates;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export default function DropoffMaterial() {
  const [warehouses, setWarehouses] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [resourceType, setResourceType] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorPhone, setDonorPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    getWarehouses()
      .then(setWarehouses)
      .catch(() => setLoadError("Could not load drop-off locations."));
  }, []);

  function resetForm() {
    setResourceType("");
    setSubCategory("");
    setQuantity("");
    setWarehouseId("");
    setDonorName("");
    setDonorPhone("");
    setResult(null);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!resourceType) return setError("Choose what you're bringing.");
    if (!warehouseId) return setError("Choose where you'll drop it off.");

    // Quick local check so people don't wait on the server to hear there's
    // no room - the server enforces the same limit.
    const chosen = warehouses.find((w) => w._id === warehouseId);
    if (chosen?.isFull) return setError("That location is full. Please choose another one.");
    if (chosen?.capacity && Number(quantity) > chosen.spaceLeft) {
      return setError(
        `${chosen.name} only has room for about ${chosen.spaceLeft} more units. Bring less or choose another location.`
      );
    }

    setSubmitting(true);
    try {
      const data = await submitDropoff({
        warehouse: warehouseId,
        resourceType,
        subCategory: subCategory || undefined,
        quantity: Number(quantity),
        donorName,
        donorPhone,
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit your drop-off. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const { warehouse } = result;
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center p-gutter pt-20">
          <div className="w-full max-w-[480px] mx-auto py-space-lg">
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-lg text-center">
              <span className="material-symbols-outlined text-[40px] text-status-confirmed mb-space-sm">
                check_circle
              </span>
              <h1 className="font-headline-md text-headline-md text-on-surface mb-1">Thank you!</h1>
              <p className="font-body-md text-body-md text-on-surface-variant mb-space-lg">
                Bring what you pledged to this location. A coordinator will confirm it on arrival.
              </p>

              <div className="text-left bg-surface-container rounded-lg p-space-md mb-space-lg">
                <p className="font-label-md text-label-md text-on-surface">{warehouse.name}</p>
                <p className="font-caption text-caption text-on-surface-variant mt-0.5">{warehouse.address}</p>
                {warehouse.ward && (
                  <p className="font-caption text-caption text-on-surface-variant">{wardLabel(warehouse.ward)}</p>
                )}
                {warehouse.contactPhone && (
                  <p className="font-caption text-caption text-on-surface-variant mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">call</span>
                    {warehouse.contactPhone}
                  </p>
                )}
                {warehouse.openingHours?.length > 0 && (
                  <div className="mt-space-sm pt-space-sm border-t border-surface-container-highest flex flex-col gap-space-xs">
                    <OpenBadge openingHours={warehouse.openingHours} showDetail />
                    <HoursList openingHours={warehouse.openingHours} />
                  </div>
                )}
              </div>

              <div className="flex gap-space-sm">
                <a
                  href={directionsUrl(warehouse.location)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 h-11 rounded-lg bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[18px]">directions</span>
                  Get Directions
                </a>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 h-11 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition-colors"
                >
                  Submit Another
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />
      <main className="flex-1 w-full pt-16">
        <div className="bg-secondary">
          <div className="max-w-[720px] mx-auto px-margin-mobile lg:px-margin py-space-lg">
            <h1 className="font-headline-lg text-headline-lg text-on-secondary tracking-tight">
              Drop Off Materials
            </h1>
            <p className="font-body-md text-body-md text-on-secondary/80 mt-1 max-w-[520px]">
              Have food, water, clothing, or other relief supplies to give? Pledge what you're bringing and we'll
              show you the nearest storage point.
            </p>
          </div>
        </div>

        <div className="max-w-[720px] mx-auto px-margin-mobile lg:px-margin py-space-lg">
          <form onSubmit={handleSubmit} className="flex flex-col gap-space-lg">
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">What are you bringing?</h2>
              <ResourceGrid
                value={resourceType}
                onChange={setResourceType}
                subCategory={subCategory}
                onSubCategoryChange={setSubCategory}
                accent="secondary"
              />

              <div className="mt-space-md flex flex-col space-y-1.5 max-w-[200px]">
                <label className="font-label-md text-label-md text-on-surface">Quantity</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-secondary transition-colors"
                  placeholder="e.g. 10"
                />
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">
                Where will you drop it off?
              </h2>

              {loadError && <p className="font-caption text-caption text-status-critical mb-space-sm">{loadError}</p>}

              <div className="flex flex-col gap-space-sm max-h-[320px] overflow-y-auto pr-1">
                {warehouses.map((w) => {
                  const selected = warehouseId === w._id;
                  return (
                    <button
                      key={w._id}
                      type="button"
                      disabled={w.isFull}
                      onClick={() => setWarehouseId(w._id)}
                      className={`text-left p-space-sm rounded-lg border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${selected
                          ? "border-secondary bg-secondary/5"
                          : `border-surface-container-highest ${w.isFull ? "" : "hover:bg-surface-container"}`
                        }`}
                    >
                      <div className="flex items-start justify-between gap-space-sm">
                        <p className="font-label-md text-label-md text-on-surface">{w.name}</p>
                        {w.isFull && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-status-critical/10 text-status-critical font-caption text-caption">
                            Full
                          </span>
                        )}
                      </div>
                      <p className="font-caption text-caption text-on-surface-variant">{w.address}</p>
                      {w.ward && (
                        <p className="font-caption text-caption text-on-surface-variant/70">{wardLabel(w.ward)}</p>
                      )}
                      {w.openingHours?.length > 0 && (
                        <div className="mt-1.5">
                          <OpenBadge openingHours={w.openingHours} showDetail />
                        </div>
                      )}
                      {w.capacity && !w.isFull && <CapacityBar warehouse={w} className="mt-1.5" />}
                      {selected && w.openingHours?.length > 0 && (
                        <div className="mt-space-sm pt-space-sm border-t border-surface-container-highest">
                          <HoursList openingHours={w.openingHours} />
                        </div>
                      )}
                    </button>
                  );
                })}
                {warehouses.length === 0 && !loadError && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    No drop-off locations have been set up yet.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Your details</h2>
              <div className="grid sm:grid-cols-2 gap-space-sm">
                <div className="flex flex-col space-y-1.5">
                  <label className="font-label-md text-label-md text-on-surface">Your name</label>
                  <input
                    required
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-secondary transition-colors"
                    placeholder="Your full name"
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="font-label-md text-label-md text-on-surface">Phone number</label>
                  <input
                    required
                    type="tel"
                    value={donorPhone}
                    onChange={(e) => setDonorPhone(e.target.value)}
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-lg border border-surface-container-highest focus:outline-none focus:border-secondary transition-colors"
                    placeholder="98XXXXXXXX"
                  />
                </div>
              </div>
            </div>

            {error && <p className="font-caption text-caption text-status-critical">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Pledge"}
            </button>

            <p className="text-center font-caption text-caption text-on-surface-variant">
              Registered relief organization?{" "}
              <Link to="/responder/auth" className="text-secondary underline">
                Log distributions from your dashboard instead
              </Link>
              .
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}