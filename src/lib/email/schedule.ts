// Kirim email setelah respons selesai (after() dari Next), supaya transaksi pesanan tidak menunggu penyedia email.
// Di mode pratinjau tidak melakukan apa pun. Kegagalan dicatat di baris notifikasi dan dicoba ulang oleh cron harian.
import { after } from "next/server";
import { db } from "@/db/client";
import { siteUrl } from "@/lib/site";
import { emailConfig, emailReady } from "./index";
import { dispatchEmails } from "./dispatch";

export function scheduleEmailDispatch() {
  if (!emailReady(emailConfig())) return;
  try {
    after(async () => {
      try {
        await dispatchEmails(db, { site: siteUrl() });
      } catch (e) {
        console.error("Kirim email gagal:", e instanceof Error ? e.message : e);
      }
    });
  } catch {
    // Di luar request (skrip, uji): lewati, cron harian yang mengirim.
  }
}
