"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type LocationValue = {
  divisionId: number | null;
  districtId: number | null;
  areaId: number | null;
};

type Division = { id: number; name: string };
type District = { id: number; name: string; division_id: number };
type Area = { id: number; name: string; category: string | null };

const toNum = (v: string) => (v ? Number(v) : null);

function Select({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: number | null;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div className="relative">
        <select
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm text-slate-800 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  );
}

export default function LocationPicker({
  value,
  onChange,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
}) {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [d, s] = await Promise.all([
        supabase.from("divisions").select("id,name").order("name"),
        supabase.from("districts").select("id,name,division_id").order("name"),
      ]);
      setDivisions(d.data || []);
      setDistricts(s.data || []);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!value.districtId) {
      setAreas([]);
      return;
    }
    supabase
      .from("areas")
      .select("id,name,category")
      .eq("district_id", value.districtId)
      .order("name")
      .then(({ data }) => setAreas(data || []));
  }, [value.districtId]);

  const visibleDistricts = districts.filter(
    (d) => d.division_id === value.divisionId
  );

  if (ready && divisions.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        The location list is empty. Run the Phase A SQL in Supabase first.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Select
        label="Division"
        value={value.divisionId}
        onChange={(v) =>
          onChange({ divisionId: toNum(v), districtId: null, areaId: null })
        }
      >
        <option value="">Select division</option>
        {divisions.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>

      <Select
        label="District"
        value={value.districtId}
        disabled={!value.divisionId}
        onChange={(v) =>
          onChange({ ...value, districtId: toNum(v), areaId: null })
        }
      >
        <option value="">Select district</option>
        {visibleDistricts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>

      <Select
        label="Area (optional)"
        value={value.areaId}
        disabled={!value.districtId || areas.length === 0}
        onChange={(v) => onChange({ ...value, areaId: toNum(v) })}
      >
        <option value="">
          {value.districtId && areas.length === 0 ? "No areas listed" : "Select area"}
        </option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.category ? ` (${a.category})` : ""}
          </option>
        ))}
      </Select>
    </div>
  );
}