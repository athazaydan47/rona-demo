import type { MetadataRoute } from "next";

// Seluruh data toko ini fiktif, jadi situs tidak boleh diindeks mesin pencari.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
