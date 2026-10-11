import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Header from "../components/Header";
import { getByCategory, getVolumeOverTime } from "../api/client";

export default function Analytics() {
  const [volume, setVolume] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getVolumeOverTime().then(setVolume).catch(() => setError("Could not load analytics."));
    getByCategory().then(setByCategory).catch(() => setError("Could not load analytics."));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header variant="coordination" />
      <main className="w-full pt-16 flex-1">
        <div className="max-w-[1120px] mx-auto px-margin-mobile lg:px-margin py-space-lg">
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mb-space-md">Analytics</h1>

          {error && <p className="font-caption text-caption text-status-critical mb-space-md">{error}</p>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md h-[320px]">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">
                Distribution volume over time
              </h2>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={volume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E3DE" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="totalQuantity" stroke="#1B2A4A" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-space-md h-[320px]">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">
                Resource allocation by category
              </h2>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E3DE" />
                  <XAxis dataKey="resourceType" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="totalQuantity" fill="#D7263D" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
