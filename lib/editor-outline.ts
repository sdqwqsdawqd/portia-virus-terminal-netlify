import type { Broadcast, OutlineSection, PortiaContent, RecommendationSection, RichTextDocument } from "./portia-content.ts";

// RED stub (D-41): every function compiles and returns an empty answer; the real behaviour comes with the GREEN commit.
export const SYNTHETIC_RECOMMENDATION_ID = "search-recommendations-all";
export type BroadcastGroup = { id: string; kind: "none" | "section" | "subsection"; title: string; parentId: string; broadcasts: Broadcast[] };

export const normalizeOutlineSections = (_value: unknown, _idPrefix: string): OutlineSection[] => [];
export const normalizeRecommendationSections = (_value: unknown, _flat: string[]): RecommendationSection[] => [];
export const flattenRecommendationSections = (_sections: RecommendationSection[]): string[] => [];
export const recommendationView = (_content: PortiaContent): { sections: RecommendationSection[]; synthetic: boolean } => ({ sections: [], synthetic: false });
export const recommendationGroupText = (_content: PortiaContent, _groupId: string): { text: string; document: RichTextDocument } => ({ text: "", document: { runs: [{ text: "" }] } });
export const writeRecommendationGroup = (_content: PortiaContent, _groupId: string, _text: string, _document: RichTextDocument): void => {};
export const addRecommendationSection = (_content: PortiaContent, _id: string, _title: string): void => {};
export const addRecommendationSubsection = (_content: PortiaContent, _sectionId: string, _id: string, _title: string): void => {};
export const removeRecommendationGroup = (_content: PortiaContent, _groupId: string): void => {};
export const moveRecommendationSection = (_content: PortiaContent, _from: number, _to: number): void => {};
export const moveRecommendationSubsection = (_content: PortiaContent, _sectionId: string, _from: number, _to: number): void => {};
export const moveRecommendationLine = (_content: PortiaContent, _groupId: string, _from: number, _to: number): void => {};
export const trimRecommendationSections = (_content: PortiaContent): void => {};
export const broadcastGroupsView = (_content: PortiaContent, _tab: "news" | "quests"): BroadcastGroup[] => [];
export const addBroadcastSection = (_content: PortiaContent, _id: string, _title: string): void => {};
export const addBroadcastSubsection = (_content: PortiaContent, _sectionId: string, _id: string, _title: string): void => {};
export const removeBroadcastOutlineGroup = (_content: PortiaContent, _groupId: string): void => {};
export const moveBroadcastSection = (_content: PortiaContent, _from: number, _to: number): void => {};
export const moveBroadcastSubsection = (_content: PortiaContent, _sectionId: string, _from: number, _to: number): void => {};
export const setBroadcastSection = (_content: PortiaContent, _broadcastId: string, _groupId: string): void => {};
