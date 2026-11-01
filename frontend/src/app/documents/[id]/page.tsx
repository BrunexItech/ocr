"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import DocThumb from "@/components/DocThumb";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, DocumentOut, IntegrationOut } from "@/lib/api";
import { Check, Pencil, X as XIcon } from "lucide-react";

function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [doc, setDoc] = useState<DocumentOut | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationOut[]>([]);
  const [pushFields, setPushFields] = useState<string[]>([]);
  const [pushIntegration, setPushIntegration] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const load = useCallback(() => {
    api.getDocument(id, reveal).then((d) => {
      setDoc(d);
      setDraft(d.fields);
    });
  }, [id, reveal]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (user && (user.role === "admin" || user.role === "approver")) {
      api.listIntegrations().then(setIntegrations).catch(() => setIntegrations([]));
    }
  }, [user]);

  if (!doc) return <p className="text-sm text-zinc-500">Loading…</p>;

  const canEdit = !doc.locked && ["admin", "reviewer", "approver"].includes(user?.role || "");
  const dirty = JSON.stringify(draft) !== JSON.stringify(doc.fields);

  async function saveTitle() {
    await withBusy(async () => {
      const updated = await api.renameDocument(doc!.id, titleDraft.trim());
      setDoc(updated);
      setEditingTitle(false);
    });
  }

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <button onClick={() => router.push("/documents")} className="text-sm text-zinc-500 hover:text-zinc-200 mb-3">
        ← Back to documents
      </button>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                placeholder="Name this document"
                className="text-xl font-semibold bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-zinc-100 placeholder-zinc-500 w-full"
              />
              <button onClick={saveTitle} disabled={busy} className="p-1.5 text-emerald-400 hover:text-emerald-300" aria-label="Save name">
                <Check className="w-5 h-5" />
              </button>
              <button onClick={() => setEditingTitle(false)} className="p-1.5 text-zinc-500 hover:text-zinc-300" aria-label="Cancel">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <h1
              className="text-xl font-semibold break-all group inline-flex items-center gap-2 cursor-pointer"
              onClick={() => {
                setTitleDraft(doc.title || "");
                setEditingTitle(true);
              }}
            >
              {doc.title || <span className="font-mono">{doc.tracking_no}</span>}
              <Pencil className="w-4 h-4 text-zinc-500 opacity-0 group-hover:opacity-100 transition shrink-0" />
            </h1>
          )}
          <p className="text-sm text-zinc-500 mt-1">
            {doc.title && <span className="font-mono">{doc.tracking_no}</span>}{doc.title && " · "}
            {doc.detected_kind} · {doc.file_name} · {doc.status.replace("_", " ")} · confidence{" "}
            {doc.ocr_confidence != null ? `${(doc.ocr_confidence * 100).toFixed(0)}%` : "—"}
            {doc.locked && <span className="ml-2 text-zinc-500">· locked</span>}
          </p>
        </div>
        <button
          className="text-sm rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-1.5 hover:bg-zinc-800 self-start sm:self-auto whitespace-nowrap"
          onClick={() => withBusy(() => api.downloadOriginal(doc.id, doc.file_name))}
        >
          Download original
        </button>
      </div>

      {doc.reasons.length > 0 && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-400 mb-4">
          <b>Needs attention:</b> {doc.reasons.join("; ")}
        </div>
      )}
      {error && <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400 mb-4">{error}</div>}
      {notice && <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-400 mb-4">{notice}</div>}

      <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-black mb-4 max-h-[420px]">
        <DocThumb docId={doc.id} fit="contain" className="w-full max-h-[420px]" />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-300">Extracted fields</h2>
          {(user?.role === "admin" || user?.role === "approver") && (
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
              Reveal sensitive fields
            </label>
          )}
        </div>
        <div className="space-y-3">
          {Object.entries(draft).map(([key, value]) => (
            <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-3 sm:items-center">
              <label className="text-sm text-zinc-400 sm:col-span-1">
                {key}
                {doc.field_confidence[key] != null && (
                  <span className="block text-xs text-zinc-500">{(doc.field_confidence[key] * 100).toFixed(0)}% confidence</span>
                )}
              </label>
              <input
                className="sm:col-span-2 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-1.5 text-sm disabled:bg-zinc-800 disabled:text-zinc-500"
                value={String(value ?? "")}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              />
            </div>
          ))}
          {Object.keys(draft).length === 0 && <p className="text-sm text-zinc-500">No fields extracted.</p>}
        </div>

        {canEdit && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-800">
            <button
              disabled={!dirty || busy}
              onClick={() =>
                withBusy(async () => {
                  const updated = await api.correctFields(doc.id, draft);
                  setDoc(updated);
                  setDraft(updated.fields);
                  setNotice("Corrections saved as a new version.");
                })
              }
              className="rounded-md bg-zinc-700 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            >
              Save corrections
            </button>
            <button
              disabled={!dirty || busy}
              onClick={() => setDraft(doc.fields)}
              className="rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Discard
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {doc.status === "awaiting_review" && ["admin", "reviewer"].includes(user?.role || "") && (
          <button
            disabled={busy}
            onClick={() => withBusy(async () => setDoc(await api.submitDocument(doc.id)))}
            className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium"
          >
            Submit for approval
          </button>
        )}
        {doc.status === "awaiting_approval" && ["admin", "approver"].includes(user?.role || "") && (
          <button
            disabled={busy}
            onClick={() => withBusy(async () => setDoc(await api.approveDocument(doc.id)))}
            className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium"
          >
            Approve & lock
          </button>
        )}
        {["awaiting_review", "awaiting_approval"].includes(doc.status) && ["admin", "approver"].includes(user?.role || "") && (
          <button
            disabled={busy}
            onClick={() => withBusy(async () => setDoc(await api.rejectDocument(doc.id, "Rejected by approver")))}
            className="rounded-md border border-red-300 text-red-400 px-3 py-1.5 text-sm font-medium"
          >
            Reject
          </button>
        )}
      </div>

      {doc.status === "approved" && ["admin", "approver"].includes(user?.role || "") && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Push selected fields to a database</h2>
          {integrations.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No integrations configured yet. Add one under Admin → Integrations (or via the API) to push approved
              data onward.
            </p>
          ) : (
            <>
              <select
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-2 text-sm mb-3"
                value={pushIntegration}
                onChange={(e) => setPushIntegration(e.target.value)}
              >
                <option value="">Choose a destination…</option>
                {integrations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.kind})
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-3 mb-3">
                {Object.keys(doc.fields).map((k) => (
                  <label key={k} className="flex items-center gap-1.5 text-sm text-zinc-400">
                    <input
                      type="checkbox"
                      checked={pushFields.includes(k)}
                      onChange={(e) =>
                        setPushFields((prev) => (e.target.checked ? [...prev, k] : prev.filter((x) => x !== k)))
                      }
                    />
                    {k}
                  </label>
                ))}
              </div>
              <button
                disabled={busy || !pushIntegration || pushFields.length === 0}
                onClick={() =>
                  withBusy(async () => {
                    await api.pushDocument(doc.id, pushIntegration, pushFields);
                    setNotice(`Pushed ${pushFields.length} field(s) to the selected destination.`);
                  })
                }
                className="rounded-md bg-zinc-700 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-40"
              >
                Push selected fields
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocumentDetailPage() {
  return (
    <RequireAuth>
      <DocumentDetail />
    </RequireAuth>
  );
}
