import type { Metadata } from "next";
import { Heart, Search, ShoppingBag } from "lucide-react";
import { packagingValues } from "@/db/schema/enums";
import { contrastRatio } from "@/lib/color";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { HelpText, Input, Label } from "@/components/ui/input";
import { PriceTag } from "@/components/ui/price-tag";
import { RatingStars } from "@/components/ui/rating-stars";
import { SwatchDots } from "@/components/ui/swatch-dots";
import { ProductArt, packagingLabels } from "@/components/product-art";
import { ChipDemo } from "./chip-demo";

export const metadata: Metadata = { title: "Design system" };

const colors = [
  { token: "porselen", hex: "#FAF7F5", use: "Latar halaman" },
  { token: "putih", hex: "#FFFFFF", use: "Kartu, laci, dialog" },
  { token: "kopi", hex: "#2A1F1D", use: "Teks utama" },
  { token: "abu-hangat", hex: "#6E615D", use: "Teks sekunder" },
  { token: "garis", hex: "#EAE2DE", use: "Garis pemisah, border" },
  { token: "rona", hex: "#B8475D", use: "Aksen utama: tombol, tautan aktif" },
  { token: "rona-gelap", hex: "#93364A", use: "Tombol saat ditekan" },
  { token: "blush", hex: "#F4DCDF", use: "Latar lembut, chip terpilih" },
  { token: "sage", hex: "#8FA58E", use: "Label aman untuk kulit sensitif" },
  { token: "emas", hex: "#C9A35C", use: "Badge flash sale dan Terlaris" },
  { token: "sukses", hex: "#2F7A55", use: "Status berhasil" },
  { token: "peringatan", hex: "#C77D1A", use: "Stok menipis, batas waktu" },
  { token: "bahaya", hex: "#B3261E", use: "Error, habis" },
];

const typeScale = [
  { cls: "text-4xl", px: 48, sample: "Temukan rona terbaikmu" },
  { cls: "text-3xl", px: 36, sample: "Terlaris minggu ini" },
  { cls: "text-2xl", px: 28, sample: "Pualam Velvet Matte Cushion" },
  { cls: "text-xl", px: 22, sample: "Shade yang pas untuk kulitmu" },
  { cls: "text-lg", px: 18, sample: "Pesan sebelum 15.00, dikirim hari ini" },
  { cls: "text-base", px: 16, sample: "Teks badan 16 px di HP, nyaman dibaca lama." },
  { cls: "text-sm", px: 14, sample: "Teks pendukung, label, dan keterangan." },
  { cls: "text-xs", px: 12, sample: "Badge, catatan kaki, dan keterangan kecil." },
];

const sampleShades: { label: string; shade: string; brand: string; brandName: string }[] = [
  { label: "Lumi, Mawar Tua", shade: "#B8475D", brand: "#C2416B", brandName: "Lumi" },
  { label: "Pualam, 05W Madu", shade: "#DAB085", brand: "#B98A6A", brandName: "Pualam" },
  { label: "Kirana Lab, hijau", shade: "#D9EBE7", brand: "#2F5D62", brandName: "Kirana Lab" },
  { label: "Dayu, Samudra", shade: "#4F6C8A", brand: "#3B3A4A", brandName: "Dayu Cosmetics" },
];

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-garis py-10 first:border-t-0">
      <h2 className="font-serif text-2xl font-medium text-kopi">{title}</h2>
      {intro ? <p className="mt-1 max-w-2xl text-sm text-abu-hangat">{intro}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="container-rona py-10">
      <header className="mb-4">
        <p className="text-xs font-semibold tracking-wide text-rona uppercase">Halaman internal</p>
        <h1 className="mt-2 font-serif text-4xl font-medium text-kopi">Design system Rona</h1>
        <p className="mt-3 max-w-2xl text-abu-hangat">
          Editorial kecantikan yang hangat: latar porselen, mawar tua sebagai aksen, judul serif Fraunces, teks Plus Jakarta Sans, dan banyak ruang
          kosong.
        </p>
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Bagian">
          {["warna", "huruf", "bentuk", "tombol", "input", "chip", "badge", "kartu", "harga", "rating", "productart"].map((s) => (
            <Chip key={s} asChild>
              <a href={`#${s}`}>{s === "productart" ? "ProductArt" : s[0].toUpperCase() + s.slice(1)}</a>
            </Chip>
          ))}
        </nav>
      </header>

      <Section id="warna" title="Warna" intro="Kontras diukur terhadap teks kopi atau putih, mana yang dipakai di atas warna itu.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {colors.map((c) => {
            const onWhite = contrastRatio(c.hex, "#FFFFFF");
            const onKopi = contrastRatio(c.hex, "#2A1F1D");
            const textColor = onWhite >= onKopi ? "#FFFFFF" : "#2A1F1D";
            const ratio = Math.max(onWhite, onKopi);
            return (
              <li key={c.token} className="overflow-hidden rounded-card border border-garis bg-putih">
                <div className="flex h-20 items-end p-3" style={{ backgroundColor: c.hex, color: textColor }}>
                  <span className="text-xs font-semibold tabular-nums">{ratio.toFixed(1)}:1</span>
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-kopi">{c.token}</p>
                  <p className="text-xs text-abu-hangat tabular-nums">{c.hex}</p>
                  <p className="mt-1 text-xs text-abu-hangat">{c.use}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="huruf" title="Huruf dan ukuran" intro="Fraunces untuk judul, Plus Jakarta Sans untuk teks. Skala 12, 14, 16, 18, 22, 28, 36, 48 px. Angka harga memakai angka tabular.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-card border border-garis bg-putih p-5">
            <p className="mb-3 text-xs font-semibold tracking-wide text-abu-hangat uppercase">Fraunces</p>
            {typeScale.slice(0, 4).map((t) => (
              <p key={t.cls} className={`font-serif ${t.cls} text-kopi`}>
                {t.sample} <span className="ml-2 font-sans text-xs text-abu-hangat tabular-nums">{t.px}px</span>
              </p>
            ))}
          </div>
          <div className="rounded-card border border-garis bg-putih p-5">
            <p className="mb-3 text-xs font-semibold tracking-wide text-abu-hangat uppercase">Plus Jakarta Sans</p>
            {typeScale.slice(3).map((t) => (
              <p key={t.cls} className={`${t.cls} text-kopi`}>
                {t.sample} <span className="ml-2 text-xs text-abu-hangat tabular-nums">{t.px}px</span>
              </p>
            ))}
            <p className="mt-4 text-2xl font-semibold text-kopi tabular-nums">Rp 1.250.000</p>
            <p className="text-xs text-abu-hangat">Angka tabular supaya kolom harga sejajar.</p>
          </div>
        </div>
      </Section>

      <Section id="bentuk" title="Sudut, jarak, bayangan" intro="Jarak kelipatan 4 px, sudut kartu 16 px, tombol dan chip berbentuk pil, bayangan sangat lembut.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-card border border-garis bg-putih p-5 shadow-soft">
            <p className="font-semibold text-kopi">shadow-soft</p>
            <p className="text-sm text-abu-hangat">Kartu produk, panel.</p>
          </div>
          <div className="rounded-card border border-garis bg-putih p-5 shadow-lift">
            <p className="font-semibold text-kopi">shadow-lift</p>
            <p className="text-sm text-abu-hangat">Kartu saat hover, menu, laci.</p>
          </div>
          <div className="flex items-center gap-3 rounded-card border border-garis bg-putih p-5">
            <span className="size-12 rounded-card bg-blush" title="radius 16px" />
            <span className="h-12 w-20 rounded-pill bg-blush" title="pil" />
            <span className="size-12 rounded-[8px] bg-blush" title="radius 8px" />
          </div>
        </div>
      </Section>

      <Section id="tombol" title="Tombol">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Tambah ke Keranjang</Button>
          <Button variant="secondary">Beli Sekarang</Button>
          <Button variant="outline">Kabari aku</Button>
          <Button variant="ghost">Batal</Button>
          <Button variant="dark">Masuk</Button>
          <Button variant="link">Lihat semua</Button>
          <Button disabled>Habis</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Kecil</Button>
          <Button size="md">Sedang</Button>
          <Button size="lg">Besar</Button>
          <Button size="icon" aria-label="Wishlist" variant="outline">
            <Heart />
          </Button>
          <Button size="icon" aria-label="Keranjang">
            <ShoppingBag />
          </Button>
          <Button size="icon-sm" aria-label="Cari" variant="ghost">
            <Search />
          </Button>
        </div>
      </Section>

      <Section id="input" title="Input">
        <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="d-nama">Nama penerima</Label>
            <Input id="d-nama" placeholder="Nama lengkap" />
            <HelpText>Sesuai KTP supaya kurir mudah mencari.</HelpText>
          </div>
          <div>
            <Label htmlFor="d-wa">Nomor WhatsApp</Label>
            <Input id="d-wa" type="tel" placeholder="08xx" defaultValue="0812" aria-invalid />
            <HelpText tone="error">Nomor terlalu pendek.</HelpText>
          </div>
          <div>
            <Label htmlFor="d-disabled">Kode voucher</Label>
            <Input id="d-disabled" placeholder="RONABARU" disabled />
          </div>
        </div>
      </Section>

      <Section id="chip" title="Chip" intro="Untuk sub kategori, filter aktif, dan pilihan jenis kulit.">
        <ChipDemo />
      </Section>

      <Section id="badge" title="Badge">
        <div className="flex flex-wrap gap-2">
          <Badge variant="flash">Flash Sale</Badge>
          <Badge variant="terlaris">Terlaris</Badge>
          <Badge variant="baru">Baru</Badge>
          <Badge variant="diskon">23%</Badge>
          <Badge variant="habis">Habis</Badge>
          <Badge variant="menipis">Sisa 3</Badge>
          <Badge variant="sensitif">Aman untuk kulit sensitif</Badge>
          <Badge variant="sukses">Dibayar</Badge>
          <Badge>Netral</Badge>
        </div>
      </Section>

      <Section id="kartu" title="Kartu">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Rona Dinoyo</CardTitle>
              <CardDescription>Jl. MT Haryono No. 45 (fiktif)</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-kopi">Buka 09.00 sampai 21.00 WIB. Stok shade ini: 4, bisa diambil hari ini.</CardContent>
            <CardFooter>
              <Button size="sm" variant="secondary">
                Ambil di sini
              </Button>
            </CardFooter>
          </Card>
          <Card className="overflow-hidden">
            <ProductArt packaging="cushion" shade="#DAB085" brandColor="#B98A6A" brandName="Pualam" title="Contoh kartu produk" />
            <CardContent className="pt-4">
              <p className="text-xs font-semibold tracking-wide text-abu-hangat uppercase">Pualam</p>
              <h3 className="mt-1 text-sm font-medium text-kopi">Pualam Velvet Matte Cushion SPF 50</h3>
              <RatingStars value={4.7} count={128} size="sm" className="mt-1" />
              <PriceTag price={159000} normalPrice={179000} size="sm" className="mt-2" />
              <SwatchDots hexes={["#F4DECB", "#ECCDA9", "#DAB085", "#C5956B", "#A1724E", "#865A3C", "#F1D6B9"]} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section id="harga" title="PriceTag" intro="Diskon dihitung dari harga normal dan dibulatkan ke bawah.">
        <div className="flex flex-col gap-4">
          <PriceTag price={129000} normalPrice={149000} size="lg" />
          <PriceTag price={89000} normalPrice={99000} />
          <PriceTag price={49000} size="sm" prefix="Mulai" />
          <PriceTag price={1250000} normalPrice={1500000} size="sm" />
        </div>
      </Section>

      <Section id="rating" title="RatingStars" intro="Bintang disembunyikan bila belum ada ulasan.">
        <div className="flex flex-col gap-3">
          <RatingStars value={4.7} count={128} size="lg" />
          <RatingStars value={3.5} count={12} />
          <RatingStars value={5} count={1} size="sm" />
          <div className="text-sm text-abu-hangat">
            0 ulasan: <RatingStars value={0} count={0} /> (tidak ditampilkan)
          </div>
          <RatingStars value={2.3} force showValue={false} size="sm" />
        </div>
      </Section>

      <Section id="productart" title="ProductArt" intro="14 bentuk kemasan digambar dari data: bentuk, warna shade, warna merek, dan nama merek. Kolom pertama tampak depan, berikutnya shade lain, kolom terakhir tampak samping.">
        <div className="space-y-8">
          {packagingValues.map((packaging) => (
            <div key={packaging}>
              <h3 className="mb-3 text-sm font-semibold text-kopi">
                {packagingLabels[packaging]} <span className="ml-1 font-mono text-xs font-normal text-abu-hangat">{packaging}</span>
              </h3>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {sampleShades.map((s) => (
                  <div key={s.label} className="rounded-card border border-garis bg-putih p-1.5">
                    <ProductArt packaging={packaging} shade={s.shade} brandColor={s.brand} brandName={s.brandName} title={`${packagingLabels[packaging]} ${s.label}`} />
                    <p className="mt-1 truncate px-1 text-[11px] text-abu-hangat">{s.label}</p>
                  </div>
                ))}
                <div className="rounded-card border border-dashed border-garis bg-putih p-1.5">
                  <ProductArt packaging={packaging} shade={sampleShades[0].shade} brandColor={sampleShades[0].brand} brandName={sampleShades[0].brandName} view="side" title={`${packagingLabels[packaging]} tampak samping`} />
                  <p className="mt-1 truncate px-1 text-[11px] text-abu-hangat">Tampak samping</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
