// Access node create API. See ISACS_API_Reference "Access Nodes" (POST /nodes).
import { api } from "@/lib/api";

export interface CreateNodeInput {
  name: string;
  location?: string;
  longitude?: number;
  latitude?: number;
  level?: number;
  parentId?: string;
  maxFailedTries?: number;
}

export async function createNode(input: CreateNodeInput): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>("/nodes", input);
  return data;
}

export interface UpdateNodeInput {
  name?: string;
  location?: string | null;
  longitude?: number | null;
  latitude?: number | null;
  level?: number;
  parentId?: string | null;
  maxFailedTries?: number;
}

export async function updateNode(id: string, body: UpdateNodeInput): Promise<{ id: string }> {
  const { data } = await api.put<{ id: string }>(`/nodes/${id}`, body);
  return data;
}

/** DELETE /nodes/:id — 409 if the node has children (delete those first). */
export async function deleteNode(id: string): Promise<void> {
  await api.del(`/nodes/${id}`);
}
