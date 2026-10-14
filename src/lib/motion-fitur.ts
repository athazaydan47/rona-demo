// Fitur animasi Motion yang dimuat terpisah (Fase 8B): animate, exit, dan transisi dasar (domAnimation, sekitar 15 KB)
// tanpa drag dan layout. Komponen memakai `m` dari motion/react-m, jadi inti Motion tidak ikut di bundel awal.
import { domAnimation } from "motion/react";

export default domAnimation;
