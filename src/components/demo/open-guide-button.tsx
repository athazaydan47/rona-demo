"use client";

import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bacaPanduan, BUKA_EVENT, simpanPanduan } from "@/lib/demo/panduan";

export function OpenGuideButton() {
  return (
    <Button
      variant="secondary"
      onClick={() => {
        simpanPanduan({ ...bacaPanduan(), tutup: false, pernahDibuka: true });
        window.dispatchEvent(new Event(BUKA_EVENT));
      }}
      data-testid="buka-panduan-tentang"
    >
      <ListChecks /> Buka panduan demo 5 menit
    </Button>
  );
}
