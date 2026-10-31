/** Decimal formatting of the exact IEEE-754 value, with Python's ties-to-even.
 * Multiplying by 10**digits first would introduce a second rounding operation.
 */
export function pythonFixed(value: number, digits: number): string {
  if (!Number.isFinite(value)) return String(value);
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0,Math.abs(value));
  const bits=view.getBigUint64(0), exponent=Number((bits>>BigInt(52))&BigInt(2047));
  const significand=(bits&((BigInt(1)<<BigInt(52))-BigInt(1)))+(exponent?BigInt(1)<<BigInt(52):BigInt(0));
  const shift=(exponent?exponent-1023:-1022)-52;
  let numerator=significand*BigInt(10)**BigInt(digits), denominator=BigInt(1);
  if(shift>=0) numerator<<=BigInt(shift); else denominator<<=BigInt(-shift);
  let quotient=numerator/denominator; const remainder=numerator%denominator;
  if(remainder*BigInt(2)>denominator || (remainder*BigInt(2)===denominator && quotient%BigInt(2)===BigInt(1))) quotient++;
  let text=quotient.toString().padStart(digits+1,"0");
  if(digits) text=text.slice(0,-digits)+"."+text.slice(-digits);
  return (value<0?"-":"")+text;
}
export const pythonRound = (value: number, digits: number) => Number(pythonFixed(value,digits));
export function notebookNumber(value: number, digits=3): string {
  if(Math.abs(value-Math.round(value))<1e-9) return String(Math.round(value));
  return pythonFixed(value,digits).replace(/\.?0+$/, "").replace(".",",");
}
