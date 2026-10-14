"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { KeyRound, Loader2, Lock, Pencil, Plus, Power, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { HelpText } from "@/components/ui/input";
import { resetStaffPasswordAction, saveStaffAction, setStaffActiveAction } from "@/lib/admin/actions";
import { PERMISSIONS, ROLE_SLUGS, ROLE_TEMPLATES, type RoleSlug } from "@/lib/admin/permissions";
import { formatDateTimeWib } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fieldClass } from "./ui";

export type StaffRow = { id: number; name: string; email: string; roleSlug: RoleSlug; isActive: boolean; lastLoginAt: string | null; locationIds: number[]; grants: string[]; revokes: string[]; isDemo: boolean };
type Loc = { id: number; name: string };
type Draft = { name: string; email: string; roleSlug: RoleSlug; locationIds: number[]; grants: string[]; revokes: string[]; password: string };

const GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))];

function Editor({ draft, setDraft, locations, isNew }: { draft: Draft; setDraft: (d: Draft) => void; locations: Loc[]; isNew: boolean }) {
  const template = new Set<string>(ROLE_TEMPLATES[draft.roleSlug].permissions);
  const has = (k: string) => (template.has(k) ? !draft.revokes.includes(k) : draft.grants.includes(k));
  const toggle = (k: string) => {
    if (template.has(k)) setDraft({ ...draft, revokes: draft.revokes.includes(k) ? draft.revokes.filter((x) => x !== k) : [...draft.revokes, k] });
    else setDraft({ ...draft, grants: draft.grants.includes(k) ? draft.grants.filter((x) => x !== k) : [...draft.grants, k] });
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Nama</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={fieldClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={fieldClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Peran (templat izin)</span>
          <select value={draft.roleSlug} onChange={(e) => setDraft({ ...draft, roleSlug: e.target.value as RoleSlug, grants: [], revokes: [] })} className={fieldClass}>
            {ROLE_SLUGS.map((r) => (
              <option key={r} value={r}>
                {ROLE_TEMPLATES[r].name}
              </option>
            ))}
          </select>
          <HelpText>{ROLE_TEMPLATES[draft.roleSlug].description}</HelpText>
        </label>
        {isNew ? (
          <label className="text-sm">
            <span className="mb-1 block font-medium">Kata sandi awal</span>
            <input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} autoComplete="new-password" className={fieldClass} />
            <HelpText>Minimal 10 karakter.</HelpText>
          </label>
        ) : null}
      </div>
      {draft.roleSlug !== "owner" ? (
        <fieldset>
          <legend className="text-sm font-medium">Lokasi yang diampu</legend>
          <p className="text-xs text-abu-hangat">{ROLE_TEMPLATES[draft.roleSlug].needsLocation ? "Wajib minimal satu." : "Kosongkan untuk semua lokasi."}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {locations.map((l) => {
              const on = draft.locationIds.includes(l.id);
              return (
                <label key={l.id} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-pill border px-3 py-1.5 text-sm", on ? "border-kopi bg-kopi text-putih" : "border-garis")}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => setDraft({ ...draft, locationIds: on ? draft.locationIds.filter((x) => x !== l.id) : [...draft.locationIds, l.id] })} />
                  {l.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      <fieldset>
        <legend className="text-sm font-medium">Izin</legend>
        <p className="text-xs text-abu-hangat">Centang menambah izin di luar templat; hapus centang mencabut izin templat untuk akun ini saja.</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g} className="rounded-lg border border-garis p-2.5">
              <p className="mb-1 text-xs font-semibold tracking-wide text-abu-hangat uppercase">{g}</p>
              {PERMISSIONS.filter((p) => p.group === g).map((p) => {
                const inTemplate = template.has(p.key);
                const changed = inTemplate ? draft.revokes.includes(p.key) : draft.grants.includes(p.key);
                return (
                  <label key={p.key} className="flex items-center gap-2 py-0.5 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--color-kopi)]" checked={has(p.key)} onChange={() => toggle(p.key)} disabled={draft.roleSlug === "owner"} />
                    <span className="flex-1">{p.label}</span>
                    {changed ? <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", inTemplate ? "bg-[#F7E3E1] text-bahaya" : "bg-[#DFF0E6] text-sukses")}>{inTemplate ? "dicabut" : "tambahan"}</span> : null}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function StaffManager({ staff, locations, meId, demoMode }: { staff: StaffRow[]; locations: Loc[]; meId: number; demoMode: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: number | null; draft: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<{ kind: "aktif" | "sandi"; staff: StaffRow } | null>(null);
  const locName = (id: number) => locations.find((l) => l.id === id)?.name ?? "";

  const save = () =>
    start(async () => {
      if (!editing) return;
      setError(null);
      const d = editing.draft;
      const r = await saveStaffAction(editing.id, { name: d.name, email: d.email, roleSlug: d.roleSlug, locationIds: d.locationIds, grants: d.grants, revokes: d.revokes, password: editing.id == null ? d.password : undefined });
      if (!r.ok) return setError(r.message);
      setEditing(null);
      setNotice(editing.id == null ? "Akun staf ditambahkan." : "Perubahan disimpan.");
      router.refresh();
    });


  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {notice ? (
          <p className="rounded-lg bg-porselen px-3 py-1.5 text-sm" role="status">
            {notice}
          </p>
        ) : (
          <span />
        )}
        <Button size="sm" onClick={() => (setError(null), setEditing({ id: null, draft: { name: "", email: "", roleSlug: "staf_cabang", locationIds: [], grants: [], revokes: [], password: "" } }))}>
          <Plus /> Tambah akun
        </Button>
      </div>
      <ul className="space-y-2" data-testid="daftar-staf">
        {staff.map((s) => {
          const locked = demoMode && s.isDemo;
          return (
            <li key={s.id} className={cn("rounded-xl border border-garis bg-putih p-4", !s.isActive && "opacity-60")}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {s.name}
                    <Badge variant={s.roleSlug === "owner" ? "terlaris" : "netral"}>{ROLE_TEMPLATES[s.roleSlug].name}</Badge>
                    {!s.isActive ? <Badge variant="habis">Nonaktif</Badge> : null}
                    {s.isDemo ? <Badge variant="flash">Akun demo</Badge> : null}
                    {s.id === meId ? <span className="text-xs font-normal text-abu-hangat">(kamu)</span> : null}
                  </p>
                  <p className="text-sm text-abu-hangat">{s.email}</p>
                  <p className="mt-1 text-xs text-abu-hangat">
                    Lokasi: {s.roleSlug === "owner" || !s.locationIds.length ? "semua" : s.locationIds.map(locName).join(", ")} · Terakhir masuk: {s.lastLoginAt ? formatDateTimeWib(new Date(s.lastLoginAt)) : "belum pernah"}
                  </p>
                  {s.grants.length || s.revokes.length ? (
                    <p className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      {s.grants.map((g) => (
                        <span key={g} className="rounded-full bg-[#DFF0E6] px-2 text-sukses">
                          + {PERMISSIONS.find((p) => p.key === g)?.label ?? g}
                        </span>
                      ))}
                      {s.revokes.map((g) => (
                        <span key={g} className="rounded-full bg-[#F7E3E1] px-2 text-bahaya">
                          - {PERMISSIONS.find((p) => p.key === g)?.label ?? g}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
                {locked ? (
                  <span className="inline-flex items-center gap-1 text-xs text-abu-hangat" title="Akun demo terkunci selama mode demo">
                    <Lock className="size-3.5" aria-hidden /> Terkunci di mode demo
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => (setError(null), setEditing({ id: s.id, draft: { name: s.name, email: s.email, roleSlug: s.roleSlug, locationIds: s.locationIds, grants: s.grants, revokes: s.revokes, password: "" } }))}>
                      <Pencil /> Ubah
                    </Button>
                    {s.id !== meId ? (
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setDialog({ kind: "aktif", staff: s })}>
                        <Power /> {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setDialog({ kind: "sandi", staff: s })}
                    >
                      <KeyRound /> Atur ulang sandi
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={dialog?.kind === "aktif"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.staff.isActive ? `Nonaktifkan ${dialog.staff.name}?` : `Aktifkan lagi ${dialog?.staff.name ?? ""}?`}
        description={dialog?.staff.isActive ? "Akun tidak bisa masuk lagi dan semua sesinya yang sedang aktif langsung dicabut." : "Akun bisa masuk lagi dengan kata sandinya."}
        confirmLabel={dialog?.staff.isActive ? "Nonaktifkan" : "Aktifkan"}
        danger={dialog?.staff.isActive}
        onConfirm={async () => {
          if (!dialog) return null;
          const r = await setStaffActiveAction(dialog.staff.id, !dialog.staff.isActive);
          if (!r.ok) return r.message;
          setNotice(dialog.staff.isActive ? "Akun dinonaktifkan, sesinya dicabut." : "Akun diaktifkan.");
          router.refresh();
          return null;
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === "sandi"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Atur ulang kata sandi ${dialog?.staff.name ?? ""}`}
        description="Semua sesi akun ini ikut dicabut. Sampaikan kata sandi baru lewat jalur yang aman."
        confirmLabel="Simpan kata sandi"
        input={{ label: "Kata sandi baru", type: "password", hint: "Minimal 10 karakter.", minLength: 10 }}
        onConfirm={async (pw) => {
          if (!dialog) return null;
          const r = await resetStaffPasswordAction(dialog.staff.id, pw);
          if (!r.ok) return r.message;
          setNotice("Kata sandi diganti, semua sesinya dicabut.");
          router.refresh();
          return null;
        }}
      />

      <Dialog.Root open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-kopi/40" />
          <Dialog.Content className="fixed inset-x-3 top-6 bottom-6 z-50 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-card bg-putih shadow-lift outline-none">
            <div className="flex items-center justify-between border-b border-garis px-5 py-3">
              <Dialog.Title className="font-serif text-xl">{editing?.id == null ? "Tambah akun staf" : "Ubah akun staf"}</Dialog.Title>
              <Dialog.Close className="grid size-9 place-items-center rounded-full hover:bg-porselen" aria-label="Tutup">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">Atur peran, izin, dan lokasi akun staf.</Dialog.Description>
            <div className="flex-1 overflow-y-auto p-5">{editing ? <Editor draft={editing.draft} setDraft={(d) => setEditing({ ...editing, draft: d })} locations={locations} isNew={editing.id == null} /> : null}</div>
            <div className="flex items-center justify-end gap-2 border-t border-garis px-5 py-3">
              {error ? (
                <p className="mr-auto text-sm text-bahaya" role="alert">
                  {error}
                </p>
              ) : null}
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Batal
              </Button>
              <Button onClick={save} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null} Simpan
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
