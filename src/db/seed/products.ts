import { productSeedA } from "./products-a";
import { productSeedB } from "./products-b";
import type { ProductSeed } from "./types";

export const productSeed: ProductSeed[] = [...productSeedA, ...productSeedB];
