import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { TAG_COLORS, type Tag, type TagColor } from "../types";

export default function SettingsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>(TAG_COLORS[0].key);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .listTags()
      .then(setTags)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const created = await api.createTag({ name: trimmed, color });
      setTags((prev) => [...prev, created]);
      setName("");
      setColor(TAG_COLORS[0].key);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await api.deleteTag(id);
    setTags((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleExport() {
    const json = await api.exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chimney-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm("This replaces everything currently on this device with the backup file. Continue?")) return;
    setImporting(true);
    try {
      const text = await file.text();
      await api.importAll(text);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't read that backup file.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="settings-page">
      <section className="card">
        <div className="card-header">
          <h3>Backup & restore</h3>
        </div>
        <p className="card-caption">
          Data lives only on this device's browser storage — a "home screen" copy of the app has its own
          separate storage from a regular browser tab, even on the same phone. Export a backup file from
          wherever your data currently is, then import it here to bring it over.
        </p>
        <div className="form-actions">
          <button type="button" className="btn" onClick={handleExport}>
            ⬇️ Export backup
          </button>
          <button type="button" className="btn" onClick={handleImportClick} disabled={importing}>
            {importing ? "Importing..." : "⬆️ Import backup"}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={handleImportFile}
        />
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Job tags</h3>
        </div>
        <p className="card-caption">Tags you can attach to a job from the New Job tab.</p>

        <form className="job-form" onSubmit={handleSubmit}>
          <label>
            Tag name
            <input
              type="text"
              placeholder="e.g. Repeat customer"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="tag-color-picker">
            {TAG_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`tag-swatch${color === c.key ? " selected" : ""}`}
                style={{ background: `var(--${c.key})` }}
                aria-label={c.name}
                title={c.name}
                onClick={() => setColor(c.key)}
              />
            ))}
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
            {saving ? "Adding..." : "+ Add tag"}
          </button>
        </form>

        {loading ? (
          <p className="loading-text">Loading tags...</p>
        ) : tags.length === 0 ? (
          <p className="empty-hint">No tags yet. Add one above.</p>
        ) : (
          <div className="tag-list">
            {tags.map((tag) => (
              <div className="tag-row" key={tag.id}>
                <span className="tag-chip" style={{ background: `var(--${tag.color})` }}>
                  {tag.name}
                </span>
                <button className="btn btn-danger" onClick={() => handleDelete(tag.id!)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
