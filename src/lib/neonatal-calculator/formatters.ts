import type { IntervalRecommendation } from "./types";

export function formatNumber(value: number, maximumFractionDigits = 3): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

export function formatInterval(interval: IntervalRecommendation): string {
  switch (interval.kind) {
    case "single":
      return `q${interval.hours}h`;
    case "discrete":
      return interval.allowedHours.map((hours) => `q${hours}h`).join(" atau ");
    case "continuous-range":
      return `q${interval.minHours}h–q${interval.maxHours}h`;
    case "single-dose-only":
      return "Dosis tunggal, bukan regimen rutin";
  }
}
