import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { LogoutAllButton, LogoutButton } from "@/components/account/logout-buttons";
import { AccountPageHead, AccountSkeleton } from "@/components/account/page-head";
import { PhoneChange, ProfileForm } from "@/components/account/profile-forms";
import { db } from "@/db/client";
import { requireCustomer } from "@/lib/account/guard";
import { getProfile } from "@/lib/account/profile";
import { formatDateWib } from "@/lib/format";

export const metadata: Metadata = { title: "Profil dan keamanan" };

async function ProfileContent() {
  await connection();
  const me = await requireCustomer("/akun/profil");
  const p = await getProfile(db, me.customerId);
  return (
    <div className="space-y-6">
      <ProfileForm name={p?.name ?? me.name} email={p?.email ?? ""} />
      <PhoneChange current={p?.phone ?? me.phone} />
      <div className="rounded-card border border-garis bg-putih p-5">
        <h2 className="font-serif text-xl text-kopi">Sesi masuk</h2>
        <p className="mt-1 text-sm text-abu-hangat">
          Akun dibuat {p ? formatDateWib(p.registeredAt) : ""}. Sesi berlaku 30 hari dan diperpanjang selama kamu aktif.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <LogoutButton />
          <LogoutAllButton />
        </div>
      </div>
    </div>
  );
}

export default function ProfilPage() {
  return (
    <>
      <AccountPageHead title="Profil dan keamanan" />
      <Suspense fallback={<AccountSkeleton />}>
        <ProfileContent />
      </Suspense>
    </>
  );
}
