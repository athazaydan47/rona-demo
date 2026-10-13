// Nama kurir untuk dialog resi dan label (dipakai di server dan browser).
const COURIER_NAMES: Record<string, string> = { jne_reg: "JNE", jne_yes: "JNE", jnt_ez: "J&T Express", sicepat_reg: "SiCepat", instan: "Kurir Instan" };
export const courierName = (code: string) => COURIER_NAMES[code] ?? code;
