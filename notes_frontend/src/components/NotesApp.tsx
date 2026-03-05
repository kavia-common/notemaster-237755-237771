"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Note, NoteInput, Tag } from "@/lib/api";
import {
  createNote,
  deleteNote,
  listNotes,
  listTags,
  updateNote,
} from "@/lib/api";
import { clearDraft, debounce, loadDraft, saveDraft } from "@/lib/utils";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { HelperText, Input, Label, TextArea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToasts } from "@/components/ui/Toasts";

type LoadState = "idle" | "loading" | "success" | "error";

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function normalizeTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function NotesApp() {
  const { push } = useToasts();

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const [notesState, setNotesState] = useState<LoadState>("idle");
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [tagsState, setTagsState] = useState<LoadState>("idle");
  const [tags, setTags] = useState<Tag[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId]
  );

  // Editor state (supports autosave via PATCH).
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editContent, setEditContent] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState<
    "idle" | "dirty" | "saving" | "saved" | "error"
  >("idle");

  const searchRef = useRef<HTMLInputElement | null>(null);

  const reloadTags = useCallback(async () => {
    setTagsState("loading");
    const res = await listTags();
    if (!res.ok) {
      setTagsState("error");
      push({ kind: "error", title: "Failed to load tags", message: res.error });
      return;
    }
    setTags(res.data);
    setTagsState("success");
  }, [push]);

  const reloadNotes = useCallback(
    async (params?: { q?: string; tag?: string }) => {
      setNotesState("loading");
      const res = await listNotes(params);
      if (!res.ok) {
        setNotesState("error");
        push({
          kind: "error",
          title: "Failed to load notes",
          message: res.error,
        });
        return;
      }
      setNotes(res.data);
      setNotesState("success");

      // Preserve selection if still exists; otherwise pick first.
      setSelectedId((prev) => {
        if (prev && res.data.some((n) => n.id === prev)) return prev;
        return res.data[0]?.id ?? null;
      });
    },
    [push]
  );

  // Initial load.
  useEffect(() => {
    void reloadTags();
    void reloadNotes({});
  }, [reloadNotes, reloadTags]);

  // Keyboard shortcut: Ctrl/⌘+K focuses search.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced search.
  const debouncedSearch = useMemo(
    () =>
      debounce((nextQ: string, nextTag: string | null) => {
        void reloadNotes({ q: nextQ || undefined, tag: nextTag || undefined });
      }, 250),
    [reloadNotes]
  );

  useEffect(() => {
    debouncedSearch(query, activeTag);
  }, [query, activeTag, debouncedSearch]);

  function openCreate() {
    setModalMode("create");
    setEditTitle("");
    setEditTags(activeTag ?? "");
    setEditContent("");
    setAutosaveStatus("idle");
    setModalOpen(true);
  }

  function openEditCurrent() {
    if (!selectedNote) return;
    setModalMode("edit");
    setEditTitle(selectedNote.title);
    setEditTags(selectedNote.tags.join(", "));
    const draft = loadDraft(selectedNote.id);
    setEditContent(draft ?? selectedNote.content);
    setAutosaveStatus(draft ? "dirty" : "idle");
    setModalOpen(true);
  }

  async function handleCreate() {
    const payload: NoteInput = {
      title: editTitle.trim() || "Untitled",
      content: editContent,
      tags: normalizeTags(editTags),
    };
    const res = await createNote(payload);
    if (!res.ok) {
      push({ kind: "error", title: "Create failed", message: res.error });
      return;
    }
    push({ kind: "success", title: "Note created" });
    setModalOpen(false);
    await reloadTags();
    await reloadNotes({ q: query || undefined, tag: activeTag || undefined });
    setSelectedId(res.data.id);
  }

  async function handleDelete(id: string) {
    const ok = window.confirm("Delete this note? This cannot be undone.");
    if (!ok) return;

    const res = await deleteNote(id);
    if (!res.ok) {
      push({ kind: "error", title: "Delete failed", message: res.error });
      return;
    }
    push({ kind: "success", title: "Deleted" });
    clearDraft(id);
    await reloadTags();
    await reloadNotes({ q: query || undefined, tag: activeTag || undefined });
  }

  // Autosave: debounced PATCH while editing existing note.
  const debouncedAutosave = useMemo(
    () =>
      debounce(async (noteId: string, patch: Partial<NoteInput>) => {
        setAutosaveStatus("saving");
        const res = await updateNote(noteId, patch);
        if (!res.ok) {
          setAutosaveStatus("error");
          push({ kind: "error", title: "Autosave failed", message: res.error });
          return;
        }
        setAutosaveStatus("saved");
        clearDraft(noteId);
        // Update note in-place to reflect server response.
        setNotes((prev) => prev.map((n) => (n.id === noteId ? res.data : n)));
        await reloadTags();
      }, 700),
    [push, reloadTags]
  );

  useEffect(() => {
    if (!modalOpen) return;
    if (modalMode !== "edit") return;
    if (!selectedNote) return;

    // If dirty, persist draft and autosave.
    setAutosaveStatus((s) => (s === "saving" ? s : "dirty"));

    saveDraft(selectedNote.id, editContent);
    debouncedAutosave(selectedNote.id, {
      title: editTitle.trim() || "Untitled",
      content: editContent,
      tags: normalizeTags(editTags),
    });
  }, [
    modalOpen,
    modalMode,
    selectedNote,
    editTitle,
    editTags,
    editContent,
    debouncedAutosave,
  ]);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border-2 border-[var(--retro-ink)] bg-[var(--retro-cyan)] font-extrabold shadow-[2px_2px_0_var(--retro-ink)]">
            N
          </span>
          <h1 className="truncate text-lg font-extrabold tracking-tight">
            NoteMaster ’96
          </h1>
        </div>
        <p className="mt-0.5 text-xs text-[var(--retro-ink-2)]">
          Retro notes with tags, search, and autosave.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={openCreate}>New Note</Button>
        <Button
          variant="ghost"
          onClick={() =>
            void reloadNotes({ q: query || undefined, tag: activeTag || undefined })
          }
        >
          Refresh
        </Button>
      </div>
    </div>
  );

  const sidebar = (
    <div className="space-y-5">
      <section>
        <Label htmlFor="search">Search</Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="search"
            ref={(el) => {
              searchRef.current = el;
            }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="title or content…"
          />
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
            }}
            aria-label="Clear search"
          >
            Clear
          </Button>
        </div>
        <HelperText className="mt-2">
          Filtered by {activeTag ? `tag: ${activeTag}` : "all tags"}.
        </HelperText>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <Label>Tags</Label>
          <button
            className="text-xs font-extrabold underline decoration-dotted"
            onClick={() => setActiveTag(null)}
          >
            Show all
          </button>
        </div>

        <div className="mt-2">
          {tagsState === "loading" ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 rounded-md border-2 border-[var(--retro-ink)] bg-black/5 shadow-[2px_2px_0_var(--retro-ink)]"
                />
              ))}
            </div>
          ) : tagsState === "error" ? (
            <div className="rounded-md border-2 border-[var(--retro-ink)] bg-[color-mix(in_srgb,var(--retro-red)_8%,var(--retro-paper))] p-3 text-sm shadow-[2px_2px_0_var(--retro-ink)]">
              <div className="font-extrabold text-[var(--retro-red)]">
                Couldn’t load tags
              </div>
              <button
                className="mt-2 text-xs font-extrabold underline"
                onClick={() => void reloadTags()}
              >
                Retry
              </button>
            </div>
          ) : tags.length === 0 ? (
            <div className="rounded-md border-2 border-[var(--retro-ink)] bg-black/5 p-3 text-sm shadow-[2px_2px_0_var(--retro-ink)]">
              No tags yet. Create a note to start tagging.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => {
                const active = activeTag === t.name;
                return (
                  <button
                    key={t.name}
                    onClick={() => setActiveTag(active ? null : t.name)}
                    className={[
                      "rounded-md border-2 border-[var(--retro-ink)] px-2 py-1 text-xs font-extrabold",
                      "shadow-[2px_2px_0_var(--retro-ink)] transition",
                      active
                        ? "bg-[var(--retro-blue)] text-[var(--retro-paper)]"
                        : "bg-[var(--retro-paper)] hover:bg-black/5",
                    ].join(" ")}
                  >
                    #{t.name}
                    {typeof t.count === "number" ? (
                      <span className="ml-1 opacity-80">({t.count})</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border-2 border-[var(--retro-ink)] bg-[var(--retro-paper)] p-3 text-xs shadow-[2px_2px_0_var(--retro-ink)]">
        <div className="font-extrabold">API base URL</div>
        <div className="mt-1 text-[var(--retro-ink-2)]">
          {process.env.NEXT_PUBLIC_NOTES_API_BASE_URL ? (
            process.env.NEXT_PUBLIC_NOTES_API_BASE_URL
          ) : (
            <span className="text-[var(--retro-red)]">
              Not set (see .env.example)
            </span>
          )}
        </div>
      </section>
    </div>
  );

  const main = (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
      <section className="rounded-md border-2 border-[var(--retro-ink)] bg-[var(--retro-paper)] shadow-[3px_3px_0_var(--retro-ink)]">
        <div className="flex items-center justify-between border-b-2 border-[var(--retro-ink)] px-3 py-2">
          <div className="text-sm font-extrabold">Notes</div>
          <div className="text-xs text-[var(--retro-ink-2)]">
            {notesState === "success" ? `${notes.length}` : ""}
          </div>
        </div>

        <div className="max-h-[55vh] overflow-auto p-2 lg:max-h-[70vh]">
          {notesState === "loading" ? (
            <div className="space-y-2 p-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-md border-2 border-[var(--retro-ink)] bg-black/5 shadow-[2px_2px_0_var(--retro-ink)]"
                />
              ))}
            </div>
          ) : notesState === "error" ? (
            <div className="rounded-md border-2 border-[var(--retro-ink)] bg-[color-mix(in_srgb,var(--retro-red)_8%,var(--retro-paper))] p-3 text-sm shadow-[2px_2px_0_var(--retro-ink)]">
              <div className="font-extrabold text-[var(--retro-red)]">
                Couldn’t load notes
              </div>
              <button
                className="mt-2 text-xs font-extrabold underline"
                onClick={() =>
                  void reloadNotes({
                    q: query || undefined,
                    tag: activeTag || undefined,
                  })
                }
              >
                Retry
              </button>
            </div>
          ) : notes.length === 0 ? (
            <div className="rounded-md border-2 border-[var(--retro-ink)] bg-black/5 p-3 text-sm shadow-[2px_2px_0_var(--retro-ink)]">
              <div className="font-extrabold">No notes found.</div>
              <div className="mt-1 text-xs text-[var(--retro-ink-2)]">
                Try clearing search/tags or create your first note.
              </div>
              <div className="mt-3">
                <Button onClick={openCreate}>Create a note</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => {
                const active = n.id === selectedId;
                return (
                  <button
                    key={n.id}
                    onClick={() => setSelectedId(n.id)}
                    className={[
                      "w-full rounded-md border-2 border-[var(--retro-ink)] p-3 text-left",
                      "shadow-[2px_2px_0_var(--retro-ink)] transition",
                      active
                        ? "bg-[color-mix(in_srgb,var(--retro-blue)_12%,var(--retro-paper))]"
                        : "bg-[var(--retro-paper)] hover:bg-black/5",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold">
                          {n.title || "Untitled"}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-xs text-[var(--retro-ink-2)]">
                          {n.content || "…"}
                        </div>
                      </div>
                      <div className="shrink-0 text-[10px] text-[var(--retro-ink-2)]">
                        {formatDate(n.updated_at)}
                      </div>
                    </div>

                    {n.tags.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {n.tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="rounded border-2 border-[var(--retro-ink)] bg-[var(--retro-paper)] px-1 py-0.5 text-[10px] font-extrabold shadow-[1px_1px_0_var(--retro-ink)]"
                          >
                            #{t}
                          </span>
                        ))}
                        {n.tags.length > 4 ? (
                          <span className="text-[10px] text-[var(--retro-ink-2)]">
                            +{n.tags.length - 4}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border-2 border-[var(--retro-ink)] bg-[var(--retro-paper)] shadow-[3px_3px_0_var(--retro-ink)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--retro-ink)] px-3 py-2">
          <div className="text-sm font-extrabold">Detail</div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={openEditCurrent}
              disabled={!selectedNote}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              onClick={() => selectedNote && void handleDelete(selectedNote.id)}
              disabled={!selectedNote}
            >
              Delete
            </Button>
          </div>
        </div>

        <div className="p-4">
          {!selectedNote ? (
            <div className="rounded-md border-2 border-[var(--retro-ink)] bg-black/5 p-4 text-sm shadow-[2px_2px_0_var(--retro-ink)]">
              Select a note to view it here.
            </div>
          ) : (
            <article>
              <h2 className="text-lg font-extrabold tracking-tight">
                {selectedNote.title || "Untitled"}
              </h2>
              <div className="mt-1 text-xs text-[var(--retro-ink-2)]">
                Updated: {formatDate(selectedNote.updated_at) || "—"}
              </div>

              {selectedNote.tags.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedNote.tags.map((t) => (
                    <button
                      key={t}
                      className="rounded-md border-2 border-[var(--retro-ink)] bg-[var(--retro-paper)] px-2 py-1 text-xs font-extrabold shadow-[2px_2px_0_var(--retro-ink)] hover:bg-black/5"
                      onClick={() => setActiveTag(t)}
                      title="Filter by tag"
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-xs text-[var(--retro-ink-2)]">
                  No tags.
                </div>
              )}

              <div className="mt-4 whitespace-pre-wrap rounded-md border-2 border-[var(--retro-ink)] bg-[var(--retro-paper)] p-3 text-sm shadow-[2px_2px_0_var(--retro-ink)]">
                {selectedNote.content || "—"}
              </div>
            </article>
          )}
        </div>
      </section>

      <Modal
        open={modalOpen}
        title={modalMode === "create" ? "Create note" : "Edit note (autosave)"}
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--retro-ink-2)]">
              {modalMode === "edit" ? (
                <>
                  Autosave:{" "}
                  <span className="font-extrabold">
                    {autosaveStatus === "idle" && "ready"}
                    {autosaveStatus === "dirty" && "pending…"}
                    {autosaveStatus === "saving" && "saving…"}
                    {autosaveStatus === "saved" && "saved"}
                    {autosaveStatus === "error" && "error"}
                  </span>
                </>
              ) : (
                "Create will save immediately."
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Close
              </Button>
              {modalMode === "create" ? (
                <Button onClick={() => void handleCreate()}>Create</Button>
              ) : (
                <Button
                  onClick={() => {
                    push({
                      kind: "info",
                      title: "Autosave enabled",
                      message: "Changes save automatically after you type.",
                    });
                  }}
                >
                  OK
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Untitled"
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="work, ideas, personal"
            />
            <HelperText className="mt-2">
              Example: <span className="font-extrabold">work, todo</span>
            </HelperText>
          </div>

          <div>
            <Label htmlFor="content">Content</Label>
            <TextArea
              id="content"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Write something delightful…"
              rows={10}
            />
          </div>

          {modalMode === "edit" && selectedNote ? (
            <div className="rounded-md border-2 border-[var(--retro-ink)] bg-black/5 p-3 text-xs shadow-[2px_2px_0_var(--retro-ink)]">
              <div className="font-extrabold">Autosave notes</div>
              <div className="mt-1 text-[var(--retro-ink-2)]">
                While you edit, a local draft is stored and a debounced PATCH is
                sent to the backend.
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );

  return <AppShell header={header} sidebar={sidebar} main={main} />;
}
