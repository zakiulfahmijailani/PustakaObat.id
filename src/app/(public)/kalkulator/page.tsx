import type { Metadata } from "next";
import { NeonatalCalculator } from "@/components/neonatal-calculator/NeonatalCalculator";

export const metadata: Metadata = {
  title: "Kalkulator Antibiotik Neonatus — PustakaObat.id",
  description:
    "Clinical decision support lokal dan deterministik untuk rekomendasi serta evaluasi regimen gentamisin, amikasin, dan vankomisin pada neonatus.",
};

export default function CalculatorPage() {
  return <NeonatalCalculator />;
}
