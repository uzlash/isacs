// ====================================================================
// File uploads. See ISACS_API_Reference "Uploads".
//   POST /uploads?purpose=<purpose>   multipart, field name "file", max 10MB
//   POST /cameras/:id/snapshot        raw image/jpeg body (overwrites)
//
// Both flow through the generic BFF proxy (app/api/[...path]), which buffers
// the request body and forwards it verbatim with its content-type — so
// multipart boundaries and raw jpeg bytes pass through untouched.
// ====================================================================

import { api } from "@/lib/api";

export type UploadPurpose = "staff-picture" | "visitor-picture" | "snapshot" | "document";

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimetype: string;
  purpose: UploadPurpose;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per the reference

/**
 * Upload a file for a given purpose. Returns the stored file's public URL +
 * metadata. Throws ApiError on 400 (bad purpose / no file / too big) or 415
 * (disallowed MIME).
 */
export async function uploadFile(purpose: UploadPurpose, file: File): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB.`);
  }
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.upload<UploadResult>(`/uploads?purpose=${encodeURIComponent(purpose)}`, form);
  return data;
}

export interface SnapshotResult {
  snapshotUrl: string;
  lastSnapshotAt: string;
}

/**
 * Upload a JPEG snapshot for a camera (raw image/jpeg body). Overwrites the
 * camera's previous snapshot. 400 if the camera is inactive or the body is
 * empty; 404 if the camera doesn't exist.
 */
export async function uploadCameraSnapshot(cameraId: string, jpeg: Blob): Promise<SnapshotResult> {
  const { data } = await api.raw<SnapshotResult>(`/cameras/${cameraId}/snapshot`, jpeg, "image/jpeg");
  return data;
}
