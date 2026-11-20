"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, MapPin } from "lucide-react";

const COVERAGE = [
  { division: "Muzaffarabad", districts: ["Muzaffarabad", "Hattian Bala", "Neelum"] },
  { division: "Poonch", districts: ["Poonch (Rawalakot)", "Bagh", "Sudhnoti", "Haveli"] },
  { division: "Mirpur", districts: ["Mirpur", "Kotli", "Bhimber"] },
];

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/register") return null;

  return (
    <footer className="mt-20 bg-slate-900 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
              <Compass className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold text-white">AJK Lost &amp; Found</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            A district-wide platform for recovering lost property across Azad Jammu &amp; Kashmir.
          </p>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-white">Platform</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/report-lost" className="hover:text-white">Report lost item</Link></li>
            <li><Link href="/report-found" className="hover:text-white">Report found item</Link></li>
            <li><Link href="/matches" className="hover:text-white">Find matches</Link></li>
            <li><Link href="/dashboard" className="hover:text-white">My dashboard</Link></li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-white">Coverage</h4>
          <div className="grid gap-6 sm:grid-cols-3">
            {COVERAGE.map((c) => (
              <div key={c.division}>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white">
                  <MapPin className="h-3.5 w-3.5 text-brand" /> {c.division}
                </p>
                <ul className="space-y-1.5 text-sm text-slate-400">
                  {c.districts.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} AJK Lost &amp; Found · Final Year Project
      </div>
    </footer>
  );
}