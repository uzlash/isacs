"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, Upload } from "lucide-react";
import FacilityKmlMap from "@/components/map/FacilityKmlMap";
import { PanelHeader } from "@/components/ui";
import { useSessionUser } from "@/lib/auth";
import {
  deleteMapLayer,
  listMapLayers,
  MAP_LAYER_TYPES,
  type MapLayer,
  type MapLayerType,
  mapTypeMeta,
  updateMapLayer,
  uploadMapLayer,
} from "@/lib/api/map";
import type { Role } from "@/lib/types";

const WRITE_ROLES: Role[] = ["super_admin", "security_manager"];
const LAYER_COLS = "1.5fr 120px 60px 1.6fr 1.2fr 120px";

export default function MapPage() {
  const user = useSessionUser();
  const canWrite = !!user && (WRITE_ROLES as string[]).includes(user.role);

  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<null | { kind: "upload" } | { kind: "edit"; layer: MapLayer }>(null);
  const [form, setForm] = useState<{ name: string; description: string; level: number; type: MapLayerType }>({
    name: "",
    description: "",
    level: 0,
    type: "other",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLayers(await listMapLayers());
    } catch {
      setLayers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const bump = async () => {
    await load();
    setRefreshKey((k) => k + 1);
  };

  const openUpload = () => {
    setForm({ name: "", description: "", level: 0, type: "other" });
    setFile(null);
    setError("");
    setModal({ kind: "upload" });
  };
  const openEdit = (layer: MapLayer) => {
    setForm({ name: layer.name, description: layer.description ?? "", level: layer.level, type: layer.type ?? "other" });
    setError("");
    setModal({ kind: "edit", layer });
  };
  const close = () => {
    setModal(null);
    setBusy(false);
    setError("");
  };
  const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

  const submitUpload = async () => {
    if (!file) return setError("Choose a .kml file.");
    if (!form.name.trim()) return setError("Give the layer a name.");
    setBusy(true);
    setError("");
    try {
      await uploadMapLayer(file, form.name.trim(), form.description.trim(), Number(form.level) || 0, form.type);
      await bump();
      close();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async () => {
    if (modal?.kind !== "edit") return;
    setBusy(true);
    setError("");
    try {
      await updateMapLayer(modal.layer.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        level: Number(form.level) || 0,
        type: form.type,
      });
      await bump();
      close();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (layer: MapLayer) => {
    if (!confirm(`Delete map layer "${layer.name}"? This removes the KML file permanently.`)) return;
    try {
      await deleteMapLayer(layer.id);
      await bump();
    } catch {
      /* ignore for now */
    }
  };

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* COMPOSITE MAP */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <PanelHeader title="FACILITY MAP" sub="· composite KML · layers stacked by level" right={<span className="panel-sub">{layers.length} layer(s)</span>} />
        <div style={{ padding: 14 }}>
          <FacilityKmlMap height={520} refreshKey={refreshKey} />
        </div>
      </div>

      {/* LAYER MANAGER */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
          <span className="panel-title">MAP LAYERS</span>
          <div style={{ flex: 1 }} />
          {canWrite && (
            <button onClick={openUpload} className="btn-accent" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={13} strokeWidth={2.4} /> UPLOAD LAYER
            </button>
          )}
        </div>
        <div className="thead" style={{ display: "grid", gridTemplateColumns: LAYER_COLS, gap: 10, padding: "10px 16px" }}>
          <span>Name</span><span>Type</span><span>Level</span><span>Description</span><span>Created By</span><span>Actions</span>
        </div>
        {layers.map((l) => {
          const tm = mapTypeMeta(l.type);
          return (
          <div key={l.id} style={{ display: "grid", gridTemplateColumns: LAYER_COLS, gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
            <span style={{ font: "600 12.5px var(--font-sans-stack)", color: "var(--fg)" }}>{l.name}</span>
            <span className="mono" style={{ font: "600 9px var(--font-mono-stack)", color: tm.color, border: `1px solid ${tm.color}`, borderRadius: 4, padding: "2px 7px", justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: tm.color }} />{tm.label}
            </span>
            <span className="mono" style={{ font: "600 10px var(--font-mono-stack)", color: "var(--accent)", border: "1px solid var(--border2)", borderRadius: 4, padding: "1px 6px", justifySelf: "start" }}>L{l.level}</span>
            <span style={{ font: "500 11.5px var(--font-sans-stack)", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.description || "—"}</span>
            <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>{l.creator?.email || "—"}</span>
            <span style={{ display: "flex", gap: 6 }}>
              {canWrite ? (
                <>
                  <IconBtn onClick={() => openEdit(l)} title="Edit"><Pencil size={13} strokeWidth={1.9} /></IconBtn>
                  <IconBtn onClick={() => remove(l)} title="Delete" tone="var(--danger)"><Trash2 size={13} strokeWidth={1.9} /></IconBtn>
                </>
              ) : (
                <span className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)" }}>read-only</span>
              )}
            </span>
          </div>
          );
        })}
        {!loading && layers.length === 0 && (
          <div style={{ padding: 26, textAlign: "center", color: "var(--faint)", font: "500 12px var(--font-sans-stack)" }}>
            No map layers yet{canWrite ? " — upload a KML to build the facility map." : "."}
          </div>
        )}
      </div>

      {/* MODALS */}
      {modal && (
        <div onClick={() => !busy && close()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
              <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>{modal.kind === "upload" ? "Upload map layer" : "Edit map layer"}</span>
              <div style={{ flex: 1 }} />
              <button onClick={close} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 13 }}>
              {modal.kind === "upload" && (
                <div>
                  <div className="field-label" style={{ marginBottom: 5 }}>KML FILE (MAX 20MB)</div>
                  <input ref={fileInputRef} type="file" accept=".kml,application/vnd.google-earth.kml+xml" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
                  <button onClick={() => fileInputRef.current?.click()} className="btn" style={{ width: "100%", height: 42, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, font: "600 11px var(--font-mono-stack)" }}>
                    <Upload size={14} strokeWidth={1.8} />
                    {file ? file.name : "CHOOSE .KML FILE"}
                  </button>
                </div>
              )}
              <div>
                <div className="field-label" style={{ marginBottom: 5 }}>NAME</div>
                <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ground Floor — Building A" autoFocus={modal.kind === "edit"} />
              </div>
              <div>
                <div className="field-label" style={{ marginBottom: 5 }}>DESCRIPTION (OPTIONAL)</div>
                <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Base floor plan, corridors, entries" />
              </div>
              <div>
                <div className="field-label" style={{ marginBottom: 5 }}>TYPE</div>
                <select className="select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MapLayerType }))}>
                  {MAP_LAYER_TYPES.map((t) => (
                    <option key={t} value={t}>{mapTypeMeta(t).label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="field-label" style={{ marginBottom: 5 }}>LEVEL (Z-ORDER · LOWER = BASE)</div>
                <input className="input mono" type="number" value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) }))} style={{ font: "600 13px var(--font-mono-stack)" }} />
              </div>
              {error && (
                <div role="alert" style={{ font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>⚠ {error}</div>
              )}
              <button onClick={modal.kind === "upload" ? submitUpload : submitEdit} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
                {busy ? "SAVING…" : modal.kind === "upload" ? "UPLOAD LAYER" : "SAVE CHANGES"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title, tone }: { children: React.ReactNode; onClick: () => void; title: string; tone?: string }) {
  return (
    <button onClick={onClick} title={title} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid var(--border2)`, background: "transparent", color: tone || "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
      {children}
    </button>
  );
}
