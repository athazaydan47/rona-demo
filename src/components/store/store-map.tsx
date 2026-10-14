"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type Pin = { slug: string; name: string; lat: number; lng: number };

// Peta cabang (Leaflet dimuat saat dibutuhkan, hanya di halaman ini). Ubin dari OpenStreetMap.
export function StoreMap({ pins, className }: { pins: Pin[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !pins.length) return;
    let map: import("leaflet").Map | null = null;
    void import("leaflet").then((L) => {
      if (!el.isConnected) return;
      map = L.map(el, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(map);
      const icon = L.divIcon({ className: "", html: '<span style="display:block;width:16px;height:16px;border-radius:999px;background:#B8475D;border:3px solid #fff;box-shadow:0 2px 6px rgba(42,31,29,.35)"></span>', iconSize: [16, 16], iconAnchor: [8, 8] });
      const group = L.featureGroup(pins.map((p) => L.marker([p.lat, p.lng], { icon, alt: p.name, title: p.name }).bindPopup(`<strong>${p.name}</strong>`)));
      group.addTo(map);
      map.fitBounds(group.getBounds().pad(0.3));
    });
    return () => {
      map?.remove();
    };
  }, [pins]);
  return <div ref={ref} className={className} role="region" aria-label="Peta lokasi cabang" />;
}
