import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AccountPageHead, AccountSkeleton } from "@/components/account/page-head";
import { SkinProfileForm } from "@/components/account/skin-profile-form";
import { db } from "@/db/client";
import { requireCustomer } from "@/lib/account/guard";
import { getProfile } from "@/lib/account/profile";
import { formatDateTimeWib } from "@/lib/format";

export const metadata: Metadata = { title: "Profil kulit" };

async function SkinProfileContent() {
  await connection();
  const me = await requireCustomer("/akun/profil-kulit");
  const profile = await getProfile(db, me.customerId);
  const sp = profile?.skinProfile ?? null;
  return (
    <>
      {sp?.updatedAt ? (
        <p className="mb-4 text-xs text-abu-hangat">
          Terakhir diperbarui {formatDateTimeWib(new Date(sp.updatedAt))}
          {sp.source === "kuis" ? " lewat kuis kulit" : ""}.
        </p>
      ) : null}
      <SkinProfileForm initial={sp} />
    </>
  );
}

export default function ProfilKulitPage() {
  return (
    <>
      <AccountPageHead title="Profil kulit" description="Dipakai untuk mengisi jenis kulit di ulasanmu dan, nanti, rekomendasi kuis kulit." />
      <Suspense fallback={<AccountSkeleton />}>
        <SkinProfileContent />
      </Suspense>
    </>
  );
}
