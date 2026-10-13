import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AddressBook } from "@/components/account/address-book";
import { AccountPageHead, AccountSkeleton } from "@/components/account/page-head";
import { db } from "@/db/client";
import { listAddresses, MAX_ADDRESSES } from "@/lib/account/addresses";
import { requireCustomer } from "@/lib/account/guard";

export const metadata: Metadata = { title: "Alamat" };

async function Addresses() {
  await connection();
  const me = await requireCustomer("/akun/alamat");
  const rows = await listAddresses(db, me.customerId);
  return (
    <AddressBook
      max={MAX_ADDRESSES}
      defaults={{ name: me.name, phone: me.phone }}
      addresses={rows.map((a) => ({ id: a.id, label: a.label, recipient: a.recipient, phone: a.phone, province: a.province, city: a.city, district: a.district, provinceCode: a.provinceCode, regencyCode: a.regencyCode, districtCode: a.districtCode, postalCode: a.postalCode, street: a.street, lat: a.lat, lng: a.lng, isPrimary: a.isPrimary }))}
    />
  );
}

export default function AlamatPage() {
  return (
    <>
      <AccountPageHead title="Alamat" description="Maksimal 10 alamat. Alamat utama dipilih otomatis saat checkout." />
      <Suspense fallback={<AccountSkeleton />}>
        <Addresses />
      </Suspense>
    </>
  );
}
