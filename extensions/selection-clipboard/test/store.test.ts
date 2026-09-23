import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ITEMS_STATE_KEY,
  MAX_SNAPSHOT_LENGTH,
  type SelectionItem,
  type SelectionRange,
} from "../src/protocol";
import {
  SelectionStore,
  UnsupportedStateError,
  type MementoLike,
  type NewSelection,
} from "../src/store";

/** In-memory memento whose `update` is a spy; `stored` mirrors the latest write. */
function createMemento(initial?: unknown) {
  const state = new Map<string, unknown>();
  if (initial !== undefined) {
    state.set(ITEMS_STATE_KEY, initial);
  }
  const update = vi.fn((key: string, value: unknown) => {
    state.set(key, value);
    return Promise.resolve();
  });
  const memento: MementoLike = {
    get: <T>(key: string) => state.get(key) as T | undefined,
    update,
  };
  return { memento, update, stored: () => state.get(ITEMS_STATE_KEY) };
}

/** Store with deterministic ids (`id-1`, `id-2`, ...) and a fixed clock. */
function createStore(initial?: unknown) {
  const backing = createMemento(initial);
  let counter = 0;
  const store = new SelectionStore(backing.memento, {
    now: () => 1_000,
    createId: () => `id-${++counter}`,
  });
  return { store, ...backing };
}

function range(startLine: number, endLine = startLine): SelectionRange {
  return { startLine, startCharacter: 0, endLine, endCharacter: 4 };
}

function selection(line: number, overrides: Partial<NewSelection> = {}): NewSelection {
  return {
    uri: "file:///a.ts",
    range: range(line),
    text: `line ${line}`,
    languageId: "typescript",
    ...overrides,
  };
}

function storedItem(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    uri: "file:///a.ts",
    range: range(0),
    text: "x",
    truncated: false,
    languageId: "typescript",
    createdAt: 5,
    ...overrides,
  };
}

async function seeded(count: number) {
  const context = createStore();
  // Adds apply in memory synchronously, so ids follow call order even when run together.
  await Promise.all(Array.from({ length: count }, (_, line) => context.store.add(selection(line))));
  context.update.mockClear();
  return context;
}

const ids = (store: SelectionStore) => store.list().map((item) => item.id);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SelectionStore loading", () => {
  it("starts empty and writable when nothing is stored", () => {
    const { store } = createStore();
    expect(store.list()).toEqual([]);
    expect(store.readOnly).toBe(false);
  });

  it("loads valid items in stored order", () => {
    const { store } = createStore({
      version: 1,
      items: [storedItem("b", { note: "keep" }), storedItem("a")],
    });
    expect(ids(store)).toEqual(["b", "a"]);
    expect(store.get("b")?.note).toBe("keep");
    expect(store.get("a")).not.toHaveProperty("note");
  });

  it("drops invalid and duplicate-id items individually", () => {
    const { store } = createStore({
      version: 1,
      items: [
        storedItem("ok"),
        null,
        "item",
        storedItem("", {}),
        storedItem("bad-uri", { uri: 3 }),
        storedItem("bad-text", { text: null }),
        storedItem("bad-truncated", { truncated: "no" }),
        storedItem("bad-language", { languageId: undefined }),
        storedItem("bad-note", { note: 7 }),
        storedItem("bad-created", { createdAt: Number.NaN }),
        storedItem("bad-range", { range: { ...range(0), endLine: -1 } }),
        storedItem("fractional-range", { range: { ...range(0), startCharacter: 1.5 } }),
        storedItem("missing-range", { range: undefined }),
        storedItem("ok", { text: "second copy" }),
        storedItem("blank-note", { note: "   " }),
      ],
    });
    expect(ids(store)).toEqual(["ok", "blank-note"]);
    expect(store.get("ok")?.text).toBe("x");
    expect(store.get("blank-note")).not.toHaveProperty("note");
  });

  it("strips unknown fields from loaded items", () => {
    const { store } = createStore({ version: 1, items: [storedItem("a", { extra: true })] });
    expect(store.get("a")).not.toHaveProperty("extra");
  });

  it.each([null, "garbage", 42, [storedItem("a")], {}, { items: [] }])(
    "treats non-envelope value %j as empty and writable",
    (value) => {
      const { store } = createStore(value);
      expect(store.list()).toEqual([]);
      expect(store.readOnly).toBe(false);
    },
  );

  it("treats a current-version envelope without an items array as empty and writable", () => {
    const { store } = createStore({ version: 1, items: "nope" });
    expect(store.list()).toEqual([]);
    expect(store.readOnly).toBe(false);
  });

  it.each([2, 0, "1", null])("becomes read-only for unknown version %j", async (version) => {
    const { store, update } = createStore({ version, items: [storedItem("a")] });
    expect(store.readOnly).toBe(true);
    expect(store.list()).toEqual([]);

    await expect(store.add(selection(0))).rejects.toBeInstanceOf(UnsupportedStateError);
    await expect(store.updateNote("a", "n")).rejects.toBeInstanceOf(UnsupportedStateError);
    await expect(store.replaceSelection("a", selection(1))).rejects.toBeInstanceOf(
      UnsupportedStateError,
    );
    await expect(store.move("a", 1)).rejects.toBeInstanceOf(UnsupportedStateError);
    await expect(store.remove(["a"])).rejects.toBeInstanceOf(UnsupportedStateError);
    await expect(store.clear()).rejects.toBeInstanceOf(UnsupportedStateError);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("SelectionStore.add", () => {
  it("appends items with generated id and timestamp", async () => {
    const { store } = createStore();
    const first = await store.add(selection(0));
    const second = await store.add(selection(1));

    expect(first).toEqual({
      added: true,
      item: {
        id: "id-1",
        uri: "file:///a.ts",
        range: range(0),
        text: "line 0",
        truncated: false,
        languageId: "typescript",
        createdAt: 1_000,
      },
    });
    expect(second.item.id).toBe("id-2");
    expect(ids(store)).toEqual(["id-1", "id-2"]);
  });

  it("returns the existing item for the same uri and range without writing", async () => {
    const { store, update } = await seeded(1);
    const listener = vi.fn();
    store.onDidChange(listener);

    const result = await store.add(selection(0, { text: "changed" }));

    expect(result.added).toBe(false);
    expect(result.item).toBe(store.get("id-1"));
    expect(result.item.text).toBe("line 0");
    expect(update).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it("treats a different uri or range as a new item", async () => {
    const { store } = await seeded(1);
    expect((await store.add(selection(0, { uri: "file:///b.ts" }))).added).toBe(true);
    const shifted = { ...range(0), endCharacter: 5 };
    expect((await store.add(selection(0, { range: shifted }))).added).toBe(true);
    expect(store.list()).toHaveLength(3);
  });

  it("does not alias the caller's range object", async () => {
    const { store } = createStore();
    const input = selection(0);
    const { item } = await store.add(input);
    input.range.startLine = 99;
    expect(item.range.startLine).toBe(0);
  });

  it("uses Date.now and crypto.randomUUID by default", async () => {
    vi.spyOn(Date, "now").mockReturnValue(42);
    const { memento } = createMemento();
    const store = new SelectionStore(memento);
    const { item } = await store.add(selection(0));
    expect(item.createdAt).toBe(42);
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("snapshot truncation", () => {
  it("keeps text at the limit untouched", async () => {
    const { store } = createStore();
    const text = "a".repeat(MAX_SNAPSHOT_LENGTH);
    const { item } = await store.add(selection(0, { text }));
    expect(item.text).toBe(text);
    expect(item.truncated).toBe(false);
  });

  it("cuts text over the limit and flags it", async () => {
    const { store } = createStore();
    const { item } = await store.add(selection(0, { text: "a".repeat(MAX_SNAPSHOT_LENGTH + 10) }));
    expect(item.text).toHaveLength(MAX_SNAPSHOT_LENGTH);
    expect(item.truncated).toBe(true);
  });

  it("does not split a surrogate pair straddling the limit", async () => {
    const { store } = createStore();
    // The emoji's high surrogate sits at the last kept index.
    const text = `${"a".repeat(MAX_SNAPSHOT_LENGTH - 1)}\u{1F600}tail`;
    const { item } = await store.add(selection(0, { text }));
    expect(item.text).toBe("a".repeat(MAX_SNAPSHOT_LENGTH - 1));
    expect(item.truncated).toBe(true);
  });

  it("keeps a surrogate pair that ends exactly at the limit", async () => {
    const { store } = createStore();
    const text = `${"a".repeat(MAX_SNAPSHOT_LENGTH - 2)}\u{1F600}tail`;
    const { item } = await store.add(selection(0, { text }));
    expect(item.text).toHaveLength(MAX_SNAPSHOT_LENGTH);
    expect(item.text.endsWith("\u{1F600}")).toBe(true);
  });
});

describe("SelectionStore.updateNote", () => {
  it("trims and stores the note", async () => {
    const { store, update } = await seeded(1);
    expect(await store.updateNote("id-1", "  remember this  ")).toBe(true);
    expect(store.get("id-1")?.note).toBe("remember this");
    expect(update).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, "", "   "])("removes the note property for %j", async (note) => {
    const { store, stored } = await seeded(1);
    await store.updateNote("id-1", "temp");
    await store.updateNote("id-1", note);
    expect(store.get("id-1")).not.toHaveProperty("note");
    const persisted = stored() as { items: SelectionItem[] };
    expect(persisted.items[0]).not.toHaveProperty("note");
  });

  it("returns false for an unknown id without writing", async () => {
    const { store, update } = await seeded(1);
    expect(await store.updateNote("missing", "x")).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("skips the write when the note is unchanged", async () => {
    const { store, update } = await seeded(1);
    await store.updateNote("id-1", "same");
    update.mockClear();
    expect(await store.updateNote("id-1", " same ")).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it("replaces the item immutably", async () => {
    const { store } = await seeded(1);
    const before = store.list();
    const original = store.get("id-1");
    await store.updateNote("id-1", "n");
    expect(store.list()).not.toBe(before);
    expect(original).not.toHaveProperty("note");
  });
});

describe("SelectionStore.replaceSelection", () => {
  it("keeps id, note, and createdAt while replacing the snapshot", async () => {
    const { store } = createStore({
      version: 1,
      items: [storedItem("a", { note: "why", createdAt: 7 })],
    });
    const next = selection(9, {
      uri: "file:///b.py",
      text: "b".repeat(MAX_SNAPSHOT_LENGTH + 1),
      languageId: "python",
    });

    expect(await store.replaceSelection("a", next)).toBe(true);
    expect(store.get("a")).toEqual({
      id: "a",
      uri: "file:///b.py",
      range: range(9),
      text: "b".repeat(MAX_SNAPSHOT_LENGTH),
      truncated: true,
      languageId: "python",
      note: "why",
      createdAt: 7,
    });
  });

  it("clears a stale truncated flag", async () => {
    const { store } = createStore({ version: 1, items: [storedItem("a", { truncated: true })] });
    await store.replaceSelection("a", selection(0));
    expect(store.get("a")?.truncated).toBe(false);
  });

  it("returns false for an unknown id without writing", async () => {
    const { store, update } = await seeded(1);
    expect(await store.replaceSelection("missing", selection(3))).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("SelectionStore.move", () => {
  it("swaps with the neighbor in either direction", async () => {
    const { store } = await seeded(3);
    expect(await store.move("id-1", 1)).toBe(true);
    expect(ids(store)).toEqual(["id-2", "id-1", "id-3"]);
    expect(await store.move("id-3", -1)).toBe(true);
    expect(ids(store)).toEqual(["id-2", "id-3", "id-1"]);
  });

  it("returns false at the boundaries and for unknown ids without writing", async () => {
    const { store, update } = await seeded(2);
    const listener = vi.fn();
    store.onDidChange(listener);

    expect(await store.move("id-1", -1)).toBe(false);
    expect(await store.move("id-2", 1)).toBe(false);
    expect(await store.move("missing", 1)).toBe(false);
    expect(await store.move("missing", -1)).toBe(false);
    expect(ids(store)).toEqual(["id-1", "id-2"]);
    expect(update).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("SelectionStore.remove and clear", () => {
  it("removes several ids and reports the count of matches", async () => {
    const { store, update } = await seeded(4);
    expect(await store.remove(["id-1", "id-3", "missing", "id-3"])).toBe(2);
    expect(ids(store)).toEqual(["id-2", "id-4"]);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("does not write when nothing matches", async () => {
    const { store, update } = await seeded(1);
    expect(await store.remove(["missing"])).toBe(0);
    expect(await store.remove([])).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("clears every item", async () => {
    const { store, stored } = await seeded(2);
    await store.clear();
    expect(store.list()).toEqual([]);
    expect(stored()).toEqual({ version: 1, items: [] });
  });

  it("does not write when clearing an empty list", async () => {
    const { store, update } = createStore();
    await store.clear();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("SelectionStore persistence", () => {
  it("writes the versioned envelope under the items key", async () => {
    const { store, update } = createStore();
    await store.add(selection(0));
    expect(update).toHaveBeenCalledWith(ITEMS_STATE_KEY, {
      version: 1,
      items: [store.get("id-1")],
    });
  });

  it("round-trips through a fresh store", async () => {
    const { store, memento } = await seeded(2);
    await store.updateNote("id-2", "note");
    const reloaded = new SelectionStore(memento);
    expect(reloaded.list()).toEqual(store.list());
  });

  it("does not write on construction even when items were dropped", () => {
    const { update } = createStore({ version: 1, items: [null, storedItem("a")] });
    expect(update).not.toHaveBeenCalled();
  });

  it("persists concurrent mutations in call order", async () => {
    const writes: Array<{ items: SelectionItem[] }> = [];
    const pending: Array<() => void> = [];
    const memento: MementoLike = {
      get: () => undefined,
      update: vi.fn((_key: string, value: unknown) => {
        writes.push(value as { items: SelectionItem[] });
        return new Promise<void>((resolve) => pending.push(resolve));
      }),
    };
    let counter = 0;
    const store = new SelectionStore(memento, { createId: () => `id-${++counter}` });

    const first = store.add(selection(0));
    const second = store.add(selection(1));
    const third = store.move("id-2", -1);
    // In-memory state is updated synchronously even while writes are queued.
    expect(ids(store)).toEqual(["id-2", "id-1"]);

    // Only one write is in flight at a time.
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    pending.shift()?.();
    await vi.waitFor(() => expect(writes).toHaveLength(2));
    pending.shift()?.();
    await vi.waitFor(() => expect(writes).toHaveLength(3));
    pending.shift()?.();
    await Promise.all([first, second, third]);

    expect(writes.map((write) => write.items.map((item) => item.id))).toEqual([
      ["id-1"],
      ["id-1", "id-2"],
      ["id-2", "id-1"],
    ]);
  });

  it("rejects only the failed write and keeps later writes flowing", async () => {
    const { memento, update } = createMemento();
    update.mockImplementationOnce(() => Promise.reject(new Error("disk full")));
    const store = new SelectionStore(memento, { createId: () => crypto.randomUUID() });
    const listener = vi.fn();
    store.onDidChange(listener);

    const failed = store.add(selection(0));
    const succeeded = store.add(selection(1));

    await expect(failed).rejects.toThrow("disk full");
    await expect(succeeded).resolves.toMatchObject({ added: true });
    // Listeners already saw the in-memory change before persistence failed.
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.list()).toHaveLength(2);
    expect(update).toHaveBeenCalledTimes(2);
  });
});

describe("SelectionStore change events", () => {
  it("fires once per effective mutation, before persistence settles", async () => {
    const { store } = await seeded(2);
    const seen: string[][] = [];
    store.onDidChange(() => seen.push(ids(store)));

    const pending = store.move("id-2", -1);
    expect(seen).toEqual([["id-2", "id-1"]]);
    await pending;

    await store.updateNote("id-1", "n");
    await store.replaceSelection("id-1", selection(5));
    await store.remove(["id-2"]);
    await store.clear();
    await store.add(selection(0));
    expect(seen).toHaveLength(6);
  });

  it("keeps notifying other listeners when one throws", async () => {
    const { store } = createStore();
    const after = vi.fn();
    store.onDidChange(() => {
      throw new Error("boom");
    });
    store.onDidChange(after);

    await expect(store.add(selection(0))).resolves.toMatchObject({ added: true });
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("stops a single listener when its subscription is disposed", async () => {
    const { store } = createStore();
    const listener = vi.fn();
    const subscription = store.onDidChange(listener);
    subscription.dispose();
    await store.add(selection(0));
    expect(listener).not.toHaveBeenCalled();
  });

  it("treats repeated registrations of one function as separate subscriptions", async () => {
    const { store } = createStore();
    const listener = vi.fn();
    const first = store.onDidChange(listener);
    store.onDidChange(listener);
    first.dispose();
    await store.add(selection(0));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("drops every listener on dispose but keeps working", async () => {
    const { store, update } = createStore();
    const listener = vi.fn();
    store.onDidChange(listener);
    store.dispose();

    await store.add(selection(0));
    expect(listener).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(store.list()).toHaveLength(1);
  });
});
