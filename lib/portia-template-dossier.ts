/**
 * RED-phase skeleton (20-38 Task 1): the public surface exists so the tests load, every function is deliberately wrong.
 */
import type { RichTextDocument, RichTextStyle, Virus } from "./portia-content.ts";
import type { TemplateImage } from "./portia-template-export.ts";

export const templateVirusId = "template";

export type TemplateDossier = {
  virus: Virus;
  formattedText: Record<string, RichTextDocument>;
  images: { infected: TemplateImage | null; mutations: (TemplateImage | null)[] };
};

export type TemplateRun = { text: string; style?: RichTextStyle };

export function emptyTemplateDossier(): TemplateDossier {
  return {
    virus: {
      id: "", code: "x", name: "x", status: "x", infectedImage: "", external: "", ppu: { health: "", speed: "", abilities: "" }, physiology: "", mutations: [],
      classification: { danger: "", spread: "", transmission: "", escapeRisk: "", mind: "", appearance: "", behavior: "" },
      scientistLogs: [],
    },
    formattedText: {},
    images: { infected: null, mutations: [] },
  };
}

export function editTemplateText(
  dossier: TemplateDossier,
  _key: string,
  _text: string,
  _document: RichTextDocument,
  _apply: (next: TemplateDossier, text: string) => void,
): TemplateDossier {
  return dossier;
}

export function safeTemplateRunStyle(_style: unknown): RichTextStyle {
  return { color: "#000000" };
}

export function templateRunBackground(_style: RichTextStyle): string | undefined {
  return undefined;
}

export function templateFieldRuns(_dossier: TemplateDossier, _key: string, _text: string): TemplateRun[] {
  return [];
}
