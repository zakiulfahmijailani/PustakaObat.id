export type InterpretationParagraph = { kind: "normal" | "poin" | "penting"; text: string };
export type InterpretationSection = { title: string; paragraphs: InterpretationParagraph[] };
export { buildBatchInterpretation } from "./batch-interpretation-v20";
