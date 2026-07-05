"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadFile, type UploadPurpose } from "@/lib/api/uploads";

interface Props {
  purpose: UploadPurpose;
  /** current stored URL (from the record being edited), if any */
  value?: string | null;
  /** called with the uploaded file's public URL (or null when cleared) */
  onChange: (url: string | null) => void;
  /** accepted MIME list — defaults to the image set the purpose allows */
  accept?: string;
  label?: string;
}

// Picks a file, uploads it via POST /uploads, and hands back the stored URL.
// Shows a live preview from the picked file (or the existing value) and a
// clear button. Errors (too big / wrong type / 415) surface inline.
export default function ImageUpload({ purpose, value, onChange, accept = "image/jpeg,image/png,image/webp", label = "IMAGE" }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = () => inputRef.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    // optimistic local preview
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setBusy(true);
    try {
      const res = await uploadFile(purpose, file);
      setPreview(res.url);
      onChange(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setPreview(value ?? null); // roll back to the prior value
      onChange(value ?? null);
    } finally {
      setBusy(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  const clear = () => {
    setPreview(null);
    setError("");
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <div className="field-label" style={{ marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          onClick={pick}
          style={{
            width: 64,
            height: 64,
            borderRadius: 10,
            border: "1px dashed var(--border2)",
            background: "var(--bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            cursor: "pointer",
            flex: "0 0 64px",
            position: "relative",
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <ImagePlus size={20} strokeWidth={1.7} color="var(--faint)" />
          )}
          {busy && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 size={18} className="isacs-spin" color="#fff" />
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 7 }}>
            <button type="button" onClick={pick} disabled={busy} className="btn" style={{ height: 32, padding: "0 12px", font: "600 9.5px var(--font-mono-stack)", letterSpacing: ".4px", opacity: busy ? 0.7 : 1 }}>
              {busy ? "UPLOADING…" : preview ? "REPLACE" : "UPLOAD"}
            </button>
            {preview && !busy && (
              <button type="button" onClick={clear} className="mono" style={{ height: 32, minWidth: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, cursor: "pointer", background: "transparent", border: "1px solid var(--border2)", color: "var(--danger)" }} title="Remove">
                <X size={13} strokeWidth={2} />
              </button>
            )}
          </div>
          <span className="mono" style={{ font: "500 8.5px var(--font-mono-stack)", color: "var(--faint)" }}>JPEG · PNG · WebP · max 10 MB</span>
        </div>
      </div>
      {error && (
        <div role="alert" style={{ marginTop: 8, font: "500 10.5px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "8px 10px" }}>⚠ {error}</div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  );
}
