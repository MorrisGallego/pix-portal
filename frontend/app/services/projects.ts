import { BACKEND_BASE_URL } from "./shared.client";

export interface Project {
  id: string;
  name: string;
  description?: string;
  creation_time: string;
  modification_time?: string;
  deletion_time?: string;
  users_ids: string[];
  assets_ids: string[];
  processing_requests_ids: string[];
}

export async function listProjectsForUser(userId: string, token: string): Promise<Project[]> {
  const params = new URLSearchParams({ user_id: userId });
  const url = `projects/?${params}`;
  const u = new URL(url, BACKEND_BASE_URL);
  const response = await fetch(u, {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: window.location.origin,
    },
  });
  const data = await response.json();
  return data as Project[];
}

export async function removeAssetFromProject(assetId: string, projectId: string, token: string) {
  const url = `projects/${projectId}/assets/${assetId}`;
  const u = new URL(url, BACKEND_BASE_URL);
  const response = await fetch(u, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: window.location.origin,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to remove asset ${assetId} from project ${projectId}`);
  }
  console.log(`Removed asset ${assetId} from project ${projectId}`);
}