"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type Props = { lat: number | null; lng: number | null; onChange: (lat: number, lng: number) => void };

const MALANG: [number, number] = [-7.9666, 112.6326];

// Pin peta opsional dengan Leaflet dan ubin OpenStreetMap. Dimuat hanya saat pembeli membukanya.
export function MapPicker({ lat, lng, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void import("leaflet").then((L) => {
      if (disposed || !ref.current) return;
      const start: [number, number] = lat != null && lng != null ? [lat, lng] : MALANG;
      const map = L.map(ref.current, { scrollWheelZoom: false }).setView(start, 15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
      const icon = L.divIcon({ className: "", html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#B8475D;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 10px rgba(42,31,29,.35)"></div>', iconSize: [22, 22], iconAnchor: [11, 22] });
      const marker = L.marker(start, { draggable: true, icon }).addTo(map);
      const set = (p: { lat: number; lng: number }) => changeRef.current(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
      marker.on("dragend", () => set(marker.getLatLng()));
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(e.latlng);
        set(e.latlng);
      });
      cleanup = () => map.remove();
    });
    return () => {
      disposed = true;
      cleanup();
    };
    // Peta dibuat sekali; perubahan koordinat datang dari peta itu sendiri.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className="h-64 w-full overflow-hidden rounded-card border border-garis" role="application" aria-label="Peta untuk menandai lokasi alamat" />;
}
