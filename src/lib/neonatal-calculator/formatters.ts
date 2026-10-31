import { notebookNumber } from "./python-rounding";
import type { IntervalRecommendation } from "./types";

export function formatNumber(value: number, maximumFractionDigits = 3): string {
  return notebookNumber(value,maximumFractionDigits);
}

export function formatInterval(interval: IntervalRecommendation): string {
  switch (interval.kind) {
    case "single":
      return `tiap ${interval.hours} jam`;
    case "discrete":
      return interval.allowedHours.map((hours) => `tiap ${hours} jam`).join(" atau ");
    case "continuous-range":
      return `tiap ${interval.minHours}-${interval.maxHours} jam`;
    case "single-dose-only":
      return "Dosis tunggal, bukan regimen rutin";
  }
}
