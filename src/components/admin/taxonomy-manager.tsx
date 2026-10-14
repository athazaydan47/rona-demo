"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { ArrowDown, ArrowUp, GripVertical, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { ProductArt } from "@/components/product-art";
import { Button } from "@/components/ui/button";
import { deleteBrandAction, deleteCategoryAction, moveCategoryProductsAction, reorderCategoriesAction, saveBrandAction, saveCategoryAction } from "@/lib/admin/catalog-actions";
import type { SimilarHit } from "@/lib/admin/similar";
import { MAX_CHILDREN, validateTree } from "@/lib/admin/tree";
import { cn, slugify } from "@/lib/utils";
import { fieldClass } from "./ui";

export type Node = { id: number; name: string; slug: string; description: string; productCount: number; children: Node[] };
export type BrandRow = { id: number; name: string; slug: string; color: string; tagline: string; description: string; productCount: number };

const hitsOf = (r: object): SimilarHit[] => ("similar" in r && Array.isArray(r.similar) ? (r.similar as SimilarHit[]) : []);

type Flat = { id: number; parentId: number | null; sortOrder: number };
const flatten = (tree: Node[]): Flat[] => tree.flatMap((r, i) => [{ id: r.id, parentId: null, sortOrder: i }, ...r.children.map((c, j) => ({ id: c.id, parentId: r.id, sortOrder: j }))]);

function SimilarWarning({ hits, onForce, busy }: { hits: SimilarHit[]; onForce: () => void; busy: boolean }) {
  return (
    <div className="rounded-lg border border-peringatan/40 bg-[#FBEEDC] p-3 text-sm" role="alert" data-testid="peringatan-mirip">
      <p className="font-semibold text-[#8A5512]">Nama ini mirip dengan yang sudah ada:</p>
      <ul className="mt-1 list-inside list-disc text-[#8A5512]">
        {hits.map((h) => (
          <li key={h.name}>
            {h.name} <span className="text-xs">(kemiripan {Math.round(h.similarity * 100)}%, beda {h.distance} huruf)</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-[#8A5512]">Pastikan bukan salah ketik supaya tidak ada kategori atau merek kembar.</p>
      <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onForce} disabled={busy}>
        Tetap simpan
      </Button>
    </div>
  );
}

export function CategoryTree({ initial }: { initial: Node[] }) {
  const router = useRouter();
  const [tree, setTree] = useState<Node[]>(initial);
  const [dirty, setDirty] = useState(false);
  // Data baru dari server (setelah simpan) menggantikan pohon lokal tanpa memasang ulang komponen, jadi pesan tetap tampil.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setTree(initial);
    setDirty(false);
  }
  const [drag, setDrag] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [edit, setEdit] = useState<{ id: number | null; name: string; parentId: number | null; description: string } | null>(null);
  const [similar, setSimilar] = useState<SimilarHit[]>([]);
  const [removing, setRemoving] = useState<Node | null>(null);
  const [moveTo, setMoveTo] = useState<number>(0);
  const [pending, start] = useTransition();

  const parentOf = (id: number) => tree.find((r) => r.children.some((c) => c.id === id)) ?? null;
  const isRoot = (id: number) => tree.some((r) => r.id === id);
  const leaves = tree.flatMap((r) => r.children.map((c) => ({ ...c, parentName: r.name })));

  // Pindahkan node: ke dalam induk lain (sub kategori) atau sebelum node lain (urutan).
  const apply = (next: Node[]) => {
    const err = validateTree(flatten(next));
    if (err) return setNotice({ ok: false, text: err });
    setTree(next);
    setDirty(true);
    setNotice(null);
  };
  const moveNode = (dragId: number, targetId: number) => {
    if (dragId === targetId) return;
    const clone: Node[] = tree.map((r) => ({ ...r, children: [...r.children] }));
    if (isRoot(dragId)) {
      if (!isRoot(targetId)) return setNotice({ ok: false, text: "Kategori induk hanya bisa diurutkan di antara induk lain (maksimal 2 tingkat)." });
      const from = clone.findIndex((r) => r.id === dragId);
      const [node] = clone.splice(from, 1);
      clone.splice(clone.findIndex((r) => r.id === targetId), 0, node);
      return apply(clone);
    }
    const srcParent = clone.find((r) => r.children.some((c) => c.id === dragId))!;
    const node = srcParent.children.find((c) => c.id === dragId)!;
    srcParent.children = srcParent.children.filter((c) => c.id !== dragId);
    if (isRoot(targetId)) {
      const dest = clone.find((r) => r.id === targetId)!;
      if (dest.id !== srcParent.id && dest.children.length >= MAX_CHILDREN) return setNotice({ ok: false, text: `Maksimal ${MAX_CHILDREN} sub kategori per induk.` });
      dest.children.push(node);
    } else {
      const dest = clone.find((r) => r.children.some((c) => c.id === targetId))!;
      if (dest.id !== srcParent.id && dest.children.length >= MAX_CHILDREN) return setNotice({ ok: false, text: `Maksimal ${MAX_CHILDREN} sub kategori per induk.` });
      dest.children.splice(dest.children.findIndex((c) => c.id === targetId), 0, node);
    }
    apply(clone);
  };
  const step = (id: number, dir: -1 | 1) => {
    const clone: Node[] = tree.map((r) => ({ ...r, children: [...r.children] }));
    const list = isRoot(id) ? clone : clone.find((r) => r.children.some((c) => c.id === id))!.children;
    const i = list.findIndex((n) => n.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    apply(clone);
  };

  const saveLayout = () =>
    start(async () => {
      const r = await reorderCategoriesAction(flatten(tree));
      setNotice(r.ok ? { ok: true, text: "Susunan kategori tersimpan." } : { ok: false, text: r.message });
      if (r.ok) {
        setDirty(false);
        router.refresh();
      }
    });

  const saveCat = (force = false) =>
    start(async () => {
      if (!edit) return;
      const r = await saveCategoryAction({ ...edit, force });
      if (!r.ok) {
        const hits = hitsOf(r);
        setSimilar(hits);
        if (!hits.length) setNotice({ ok: false, text: r.message });
        return;
      }
      setEdit(null);
      setSimilar([]);
      setNotice({ ok: true, text: "Kategori tersimpan." });
      router.refresh();
    });

  const row = (n: Node, depth: 0 | 1) => (
    <div
      draggable
      onDragStart={() => setDrag(n.id)}
      onDragEnd={() => setDrag(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (drag != null) moveNode(drag, n.id);
        setDrag(null);
      }}
      data-kategori={n.slug}
      className={cn("flex items-center gap-2 rounded-lg border bg-putih px-2 py-2 text-sm", depth === 0 ? "border-garis font-semibold" : "ml-6 border-garis/70", drag === n.id && "opacity-40", drag != null && drag !== n.id && "border-dashed")}
    >
      <GripVertical className="size-4 shrink-0 cursor-grab text-abu-hangat" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{n.name}</span>
      <span className="shrink-0 text-xs font-normal text-abu-hangat tabular-nums">{n.productCount} produk</span>
      <button type="button" onClick={() => step(n.id, -1)} className="grid size-7 place-items-center rounded text-abu-hangat hover:bg-porselen" aria-label={`Naikkan ${n.name}`}>
        <ArrowUp className="size-3.5" />
      </button>
      <button type="button" onClick={() => step(n.id, 1)} className="grid size-7 place-items-center rounded text-abu-hangat hover:bg-porselen" aria-label={`Turunkan ${n.name}`}>
        <ArrowDown className="size-3.5" />
      </button>
      <button type="button" onClick={() => (setSimilar([]), setEdit({ id: n.id, name: n.name, parentId: depth === 0 ? null : (parentOf(n.id)?.id ?? null), description: n.description }))} className="grid size-7 place-items-center rounded text-abu-hangat hover:bg-porselen" aria-label={`Ubah ${n.name}`}>
        <Pencil className="size-3.5" />
      </button>
      <button type="button" onClick={() => (setRemoving(n), setMoveTo(0))} className="grid size-7 place-items-center rounded text-abu-hangat hover:bg-porselen hover:text-bahaya" aria-label={`Hapus ${n.name}`}>
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );

  return (
    <section className="rounded-xl border border-garis bg-porselen/40 p-3" aria-label="Pohon kategori">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => (setSimilar([]), setEdit({ id: null, name: "", parentId: tree[0]?.id ?? null, description: "" }))}>
          <Plus /> Tambah kategori
        </Button>
        <Button size="sm" variant={dirty ? "dark" : "outline"} disabled={!dirty || pending} onClick={saveLayout}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Simpan susunan
        </Button>
        <span className="text-xs text-abu-hangat">Seret untuk mengurutkan atau memindah sub kategori ke induk lain. Maksimal 2 tingkat dan {MAX_CHILDREN} sub per induk.</span>
      </div>
      {notice ? (
        <p className={cn("mb-2 rounded-lg px-3 py-2 text-sm", notice.ok ? "bg-[#E5F2EA] text-sukses" : "bg-[#F7E3E1] text-bahaya")} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      ) : null}
      <ul className="space-y-2" data-testid="pohon-kategori">
        {tree.map((r) => (
          <li key={r.id} className="space-y-1">
            {row(r, 0)}
            <ul className="space-y-1">
              {r.children.map((c) => (
                <li key={c.id}>{row(c, 1)}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <Dialog.Root open={edit != null} onOpenChange={(o) => !o && setEdit(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40" />
          <Dialog.Content className="fixed inset-x-3 top-[10dvh] z-50 mx-auto max-w-md rounded-card bg-putih p-5 shadow-lift outline-none">
            <div className="flex items-start justify-between">
              <Dialog.Title className="font-serif text-xl">{edit?.id ? "Ubah kategori" : "Tambah kategori"}</Dialog.Title>
              <Dialog.Close className="grid size-9 place-items-center rounded-full hover:bg-porselen" aria-label="Tutup">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">Nama, induk, dan deskripsi kategori.</Dialog.Description>
            {edit ? (
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveCat(false);
                }}
              >
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Nama</span>
                  <input value={edit.name} onChange={(e) => (setSimilar([]), setEdit({ ...edit, name: e.target.value }))} className={fieldClass} aria-label="Nama kategori" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Induk</span>
                  <select value={edit.parentId ?? ""} onChange={(e) => setEdit({ ...edit, parentId: e.target.value ? Number(e.target.value) : null })} className={fieldClass}>
                    <option value="">Tanpa induk (kategori utama)</option>
                    {tree
                      .filter((r) => r.id !== edit.id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Deskripsi</span>
                  <textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value.slice(0, 300) })} rows={2} className="w-full rounded-lg border border-garis px-3 py-2 text-sm" />
                </label>
                {similar.length ? <SimilarWarning hits={similar} busy={pending} onForce={() => saveCat(true)} /> : null}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? <Loader2 className="animate-spin" /> : null} Simpan
                  </Button>
                </div>
              </form>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={removing != null} onOpenChange={(o) => !o && setRemoving(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40" />
          <Dialog.Content className="fixed inset-x-3 top-[14dvh] z-50 mx-auto max-w-md rounded-card bg-putih p-5 shadow-lift outline-none">
            <Dialog.Title className="font-serif text-xl">Hapus {removing?.name}?</Dialog.Title>
            <Dialog.Description asChild>
              <div className="mt-1 text-sm text-abu-hangat">
                {removing && removing.children.length ? "Kategori ini punya sub kategori. Pindahkan atau hapus sub kategorinya dulu." : removing && removing.productCount > 0 ? `Masih ada ${removing.productCount} produk. Pindahkan dulu ke sub kategori lain, lalu hapus.` : "Kategori kosong ini akan dihapus."}
              </div>
            </Dialog.Description>
            {removing && !removing.children.length && removing.productCount > 0 ? (
              <div className="mt-3 flex gap-2">
                <select value={moveTo} onChange={(e) => setMoveTo(Number(e.target.value))} className={fieldClass} aria-label="Pindahkan produk ke">
                  <option value={0}>Pindahkan produk ke...</option>
                  {leaves
                    .filter((l) => l.id !== removing.id)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.parentName}, {l.name}
                      </option>
                    ))}
                </select>
                <Button
                  disabled={!moveTo || pending}
                  onClick={() =>
                    start(async () => {
                      const r = await moveCategoryProductsAction(removing.id, moveTo);
                      if (!r.ok) return setNotice({ ok: false, text: r.message });
                      setRemoving({ ...removing, productCount: 0 });
                      router.refresh();
                    })
                  }
                >
                  Pindahkan
                </Button>
              </div>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRemoving(null)}>
                Batal
              </Button>
              <Button
                variant="dark"
                disabled={pending || !removing || removing.children.length > 0 || removing.productCount > 0}
                onClick={() =>
                  start(async () => {
                    if (!removing) return;
                    const r = await deleteCategoryAction(removing.id);
                    setNotice(r.ok ? { ok: true, text: "Kategori dihapus." } : { ok: false, text: r.message });
                    setRemoving(null);
                    router.refresh();
                  })
                }
              >
                Hapus
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

export function BrandManager({ brands }: { brands: BrandRow[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<{ id: number | null; name: string; slug: string; color: string; tagline: string; description: string } | null>(null);
  const [similar, setSimilar] = useState<SimilarHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (force = false) =>
    start(async () => {
      if (!edit) return;
      setError(null);
      const r = await saveBrandAction({ ...edit, force });
      if (!r.ok) {
        const hits = hitsOf(r);
        setSimilar(hits);
        if (!hits.length) setError(r.message);
        return;
      }
      setEdit(null);
      setNotice("Merek tersimpan. Halaman merek dan produk terkait diperbarui.");
      router.refresh();
    });
  return (
    <section aria-label="Merek">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-serif text-xl">Merek</h2>
        <Button size="sm" onClick={() => (setSimilar([]), setError(null), setEdit({ id: null, name: "", slug: "", color: "#B8475D", tagline: "", description: "" }))}>
          <Plus /> Tambah merek
        </Button>
      </div>
      {notice ? (
        <p className="mb-2 rounded-lg bg-[#E5F2EA] px-3 py-2 text-sm text-sukses" role="status">
          {notice}
        </p>
      ) : null}
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {brands.map((b) => (
          <li key={b.id} className="flex items-center gap-3 rounded-xl border border-garis bg-putih p-3">
            <span className="w-10 shrink-0 overflow-hidden rounded-md">
              <ProductArt packaging="lipstick" shade="#D9A98B" brandColor={b.color} brandName={b.name} title="" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{b.name}</span>
              <span className="block truncate text-xs text-abu-hangat">
                <span className="mr-1 inline-block size-2.5 rounded-full align-middle" style={{ background: b.color }} aria-hidden />
                {b.color} · {b.productCount} produk
              </span>
            </span>
            <button type="button" onClick={() => (setSimilar([]), setError(null), setEdit({ id: b.id, name: b.name, slug: b.slug, color: b.color, tagline: b.tagline, description: b.description }))} className="grid size-8 place-items-center rounded-lg text-abu-hangat hover:bg-porselen" aria-label={`Ubah ${b.name}`}>
              <Pencil className="size-4" />
            </button>
            {b.productCount === 0 ? (
              <button type="button" onClick={() => start(async () => void ((await deleteBrandAction(b.id)).ok && router.refresh()))} className="grid size-8 place-items-center rounded-lg text-abu-hangat hover:bg-porselen hover:text-bahaya" aria-label={`Hapus ${b.name}`}>
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <Dialog.Root open={edit != null} onOpenChange={(o) => !o && setEdit(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40" />
          <Dialog.Content className="fixed inset-x-3 top-[8dvh] z-50 mx-auto max-w-md rounded-card bg-putih p-5 shadow-lift outline-none">
            <div className="flex items-start justify-between">
              <Dialog.Title className="font-serif text-xl">{edit?.id ? "Ubah merek" : "Tambah merek"}</Dialog.Title>
              <Dialog.Close className="grid size-9 place-items-center rounded-full hover:bg-porselen" aria-label="Tutup">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">Nama, slug, warna, dan deskripsi merek.</Dialog.Description>
            {edit ? (
              <form
                className="mt-3 grid grid-cols-[1fr_auto] gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(false);
                }}
              >
                <div className="space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Nama</span>
                    <input value={edit.name} onChange={(e) => (setSimilar([]), setEdit({ ...edit, name: e.target.value, slug: edit.id ? edit.slug : slugify(e.target.value) }))} className={fieldClass} aria-label="Nama merek" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Slug</span>
                    <input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: slugify(e.target.value) })} className={cn(fieldClass, "font-mono")} />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Warna merek</span>
                    <span className="flex gap-1.5">
                      <input type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value.toUpperCase() })} className="h-10 w-12 rounded-lg border border-garis p-1" aria-label="Pilih warna merek" />
                      <input value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className={cn(fieldClass, "font-mono uppercase")} aria-label="Kode warna merek" />
                    </span>
                  </label>
                </div>
                <div className="w-24 pt-6">
                  <ProductArt packaging="cushion" shade="#DAB085" brandColor={/^#[0-9a-f]{6}$/i.test(edit.color) ? edit.color : "#B8475D"} brandName={edit.name || "Merek"} title="Pratinjau warna merek" />
                </div>
                <label className="col-span-2 block text-sm">
                  <span className="mb-1 block font-medium">Tagline</span>
                  <input value={edit.tagline} onChange={(e) => setEdit({ ...edit, tagline: e.target.value.slice(0, 120) })} className={fieldClass} />
                </label>
                <label className="col-span-2 block text-sm">
                  <span className="mb-1 block font-medium">Deskripsi</span>
                  <textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value.slice(0, 600) })} rows={3} className="w-full rounded-lg border border-garis px-3 py-2 text-sm" />
                </label>
                {similar.length ? (
                  <div className="col-span-2">
                    <SimilarWarning hits={similar} busy={pending} onForce={() => save(true)} />
                  </div>
                ) : null}
                {error ? (
                  <p className="col-span-2 text-sm text-bahaya" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? <Loader2 className="animate-spin" /> : null} Simpan
                  </Button>
                </div>
              </form>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
