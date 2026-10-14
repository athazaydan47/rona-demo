import { permanentRedirect } from "next/navigation";

// Alamat lama (Fase 7C) dialihkan ke halaman kebijakan yang baru.
export default function LegacyPrivacyPage() {
  permanentRedirect("/kebijakan/privasi");
}
