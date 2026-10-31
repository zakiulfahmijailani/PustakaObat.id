import { describe, it, expect } from "vitest";
import { shapiroWilk } from "../batch-statistics";
// Independent reference: SciPy 1.17.0 scipy.stats.shapiro; numeric parity, not clinical validation.
const scipyFixtures = [
  { x: [1,2,3,4,5,6], w: 0.9818894288744925, p: 0.9605549608523386 },
  { x: [0.1,0.2,0.5,0.7,1.1,4.2], w: 0.7078985862927898, p: 0.007479514236198527 },
  { x: [3,4,5,3,4,7,8,9], w: 0.8862541205178274, p: 0.215888214875049 },
  { x: [1,1.5,2.1,4.9,6.4,8.2,12.4,22.8], w: 0.8465085139212248, p: 0.08779962544612045 },
  { x: [0.05,-0.1,0.2,0.3,0.1,-0.1], w: 0.9288381986996361, p: 0.5711601917679849 },
];
describe("Shapiro-Wilk exploratory parity versus independent SciPy 1.17", () => {
  it.each(scipyFixtures)("W and p near SciPy reference for %#", ({x,w,p})=>{
    const result = shapiroWilk(x);
    expect(result).not.toBeNull();
    expect(Math.abs((result?.w ?? NaN) - w)).toBeLessThan(0.015);
    expect(Math.abs((result?.p ?? NaN) - p)).toBeLessThan(0.03);
  });
});
