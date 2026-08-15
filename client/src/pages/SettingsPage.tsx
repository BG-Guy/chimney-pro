import { useEffect, useState } from "react";
import { api } from "../api";
import { TAG_COLORS, type Tag, type TagColor } from "../types";

export default function SettingsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>(TAG_COLORS[0].key);
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="settings-page">
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
