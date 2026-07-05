// Map layers (KML) API. See map_and_lockdown_reference "Map Layers".
import { api } from "@/lib/api";

export type MapLayerType =
  | "road"
  | "site_plan"
  | "building"
  | "floor_plan"
  | "electrical"
  | "mechanical"
  | "other";

export const MAP_LAYER_TYPES: MapLayerType[] = [
  "road",
  "site_plan",
  "building",
  "floor_plan",
  "electrical",
  "mechanical",
  "other",
];

// Distinct colors per layer type — used for both the map geometry and the legend.
export const MAP_TYPE_META: Record<MapLayerType, { label: string; color: string }> = {
  road: { label: "Road", color: "#8a97a8" },
  site_plan: { label: "Site Plan", color: "#34d3c0" },
  building: { label: "Building", color: "#58a6ff" },
  floor_plan: { label: "Floor Plan", color: "#a371f7" },
  electrical: { label: "Electrical", color: "#e3a008" },
  mechanical: { label: "Mechanical", color: "#3fb950" },
  other: { label: "Other", color: "#566578" },
};

export function mapTypeMeta(t?: string | null): { label: string; color: string } {
  return MAP_TYPE_META[(t as MapLayerType) ?? "other"] ?? MAP_TYPE_META.other;
}

export interface MapLayer {
  id: string;
  name: string;
  description: string | null;
  type: MapLayerType;
  level: number;
  fileUrl: string;
  fileKey: string;
  createdBy: string;
  creator?: { id: string; email: string };
  createdAt: string;
  updatedAt: string;
}

/** All layers, already ordered level ASC then createdAt ASC. */
export async function listMapLayers(): Promise<MapLayer[]> {
  const { data } = await api.get<MapLayer[]>("/map/layers");
  return data;
}

export async function uploadMapLayer(
  file: File,
  name: string,
  description: string,
  level: number,
  type: MapLayerType
): Promise<MapLayer> {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  if (description) form.append("description", description);
  form.append("level", String(level));
  form.append("type", type);
  const { data } = await api.upload<MapLayer>("/map/layers", form);
  return data;
}

export async function updateMapLayer(
  id: string,
  body: { name?: string; description?: string; level?: number; type?: MapLayerType }
): Promise<MapLayer> {
  const { data } = await api.put<MapLayer>(`/map/layers/${id}`, body);
  return data;
}

export async function deleteMapLayer(id: string): Promise<void> {
  await api.del(`/map/layers/${id}`);
}
