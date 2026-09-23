import {
  ITEMS_STATE_KEY,
  MAX_SNAPSHOT_LENGTH,
  PERSISTED_SELECTIONS_VERSION,
  type PersistedSelections,
  type SelectionItem,
  type SelectionRange,
} from "./protocol";

/** Structural subset of `vscode.Memento`, so the store stays testable without `vscode`. */
export interface MementoLike {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
}

export interface Disposable {
  dispose(): void;
}

/** Capture of a selection before it becomes an item; `text` is uncapped (store caps it). */
export interface NewSelection {
  uri: string;
  range: SelectionRange;
  text: string;
  languageId: string;
}

export interface AddResult {
  item: SelectionItem;
  /** False when an item with the same uri and range already existed and was returned instead. */
  added: boolean;
}

export interface SelectionStoreOptions {
  /** Clock for `createdAt`; defaults to `Date.now`. */
  now?: () => number;
  /** Item id factory; defaults to `crypto.randomUUID`. */
  createId?: () => string;
}

/**
 * Thrown by mutations when stored state has an unknown version. The store refuses
 * to overwrite it so data written by a newer extension build is not destroyed.
 */
export class UnsupportedStateError extends Error {
  constructor() {
    super(`Unsupported persisted state under "${ITEMS_STATE_KEY}"; refusing to overwrite it.`);
    this.name = "UnsupportedStateError";
  }
}

/** Result of reading the persisted document once at construction. */
interface LoadedState {
  items: SelectionItem[];
  readOnly: boolean;
}

/**
 * Ordered collection of selection snapshots backed by a workspace memento.
 *
 * In-memory state is authoritative: each mutation swaps in a new array, notifies
 * listeners synchronously, then persists. Writes are chained so concurrent mutations
 * reach the memento in call order; a failed write rejects only its own caller.
 */
export class SelectionStore implements Disposable {
  /** True when stored state has an unknown version; every mutation then rejects. */
  readonly readOnly: boolean;

  readonly #memento: MementoLike;
  readonly #now: () => number;
  readonly #createId: () => string;
  readonly #listeners = new Set<() => void>();
  #items: readonly SelectionItem[];
  /** Tail of the write queue; never rejects so one failure does not block later writes. */
  #writeTail: Promise<void> = Promise.resolve();

  constructor(memento: MementoLike, options?: SelectionStoreOptions) {
    this.#memento = memento;
    this.#now = options?.now ?? (() => Date.now());
    this.#createId = options?.createId ?? (() => crypto.randomUUID());
    const loaded = loadState(memento.get<unknown>(ITEMS_STATE_KEY));
    this.#items = loaded.items;
    this.readOnly = loaded.readOnly;
  }

  list(): readonly SelectionItem[] {
    return this.#items;
  }

  get(id: string): SelectionItem | undefined {
    return this.#items.find((item) => item.id === id);
  }

  /** Fires after every effective in-memory change, before persistence settles. */
  onDidChange(listener: () => void): Disposable {
    // Wrap so registering the same function twice yields independent subscriptions.
    const entry = (): void => listener();
    this.#listeners.add(entry);
    return { dispose: () => void this.#listeners.delete(entry) };
  }

  /**
   * Appends a snapshot of `selection`. A selection with the same uri and range as an
   * existing item is not duplicated; the existing item is returned without a write.
   */
  async add(selection: NewSelection): Promise<AddResult> {
    this.#assertWritable();
    const existing = this.#items.find(
      (item) => item.uri === selection.uri && sameRange(item.range, selection.range),
    );
    if (existing) {
      return { item: existing, added: false };
    }

    const item: SelectionItem = {
      id: this.#createId(),
      ...snapshotFields(selection),
      createdAt: this.#now(),
    };
    await this.#commit([...this.#items, item]);
    return { item, added: true };
  }

  /**
   * Sets the note after trimming; an empty or missing note removes the property.
   *
   * @returns False when `id` is unknown. An unchanged note returns true without a write.
   */
  async updateNote(id: string, note: string | undefined): Promise<boolean> {
    this.#assertWritable();
    const index = this.#indexOf(id);
    const current = this.#items[index];
    if (!current) {
      return false;
    }

    const normalized = normalizeNote(note);
    if (normalized === current.note) {
      return true;
    }

    const { note: _previous, ...rest } = current;
    const next: SelectionItem = normalized === undefined ? rest : { ...rest, note: normalized };
    await this.#commit(this.#items.with(index, next));
    return true;
  }

  /** Re-captures an item from a new selection, keeping its id, note, and createdAt. */
  async replaceSelection(id: string, selection: NewSelection): Promise<boolean> {
    this.#assertWritable();
    const index = this.#indexOf(id);
    const current = this.#items[index];
    if (!current) {
      return false;
    }

    const next: SelectionItem = {
      ...current,
      ...snapshotFields(selection),
    };
    await this.#commit(this.#items.with(index, next));
    return true;
  }

  /** @returns False for an unknown id or when the item is already at the boundary. */
  async move(id: string, delta: -1 | 1): Promise<boolean> {
    this.#assertWritable();
    const index = this.#indexOf(id);
    const target = index + delta;
    const current = this.#items[index];
    const neighbor = this.#items[target];
    if (index < 0 || !current || !neighbor) {
      return false;
    }

    await this.#commit(this.#items.with(index, neighbor).with(target, current));
    return true;
  }

  /** @returns How many of `ids` matched an item; unknown ids are ignored. */
  async remove(ids: readonly string[]): Promise<number> {
    this.#assertWritable();
    const doomed = new Set(ids);
    const next = this.#items.filter((item) => !doomed.has(item.id));
    const removed = this.#items.length - next.length;
    if (removed > 0) {
      await this.#commit(next);
    }
    return removed;
  }

  async clear(): Promise<void> {
    this.#assertWritable();
    if (this.#items.length > 0) {
      await this.#commit([]);
    }
  }

  /** Drops all listeners. Mutations still work afterwards but no longer notify. */
  dispose(): void {
    this.#listeners.clear();
  }

  #assertWritable(): void {
    if (this.readOnly) {
      throw new UnsupportedStateError();
    }
  }

  #indexOf(id: string): number {
    return this.#items.findIndex((item) => item.id === id);
  }

  /** Applies `items` in memory, notifies, then waits for this change's queued write. */
  async #commit(items: readonly SelectionItem[]): Promise<void> {
    this.#items = items;
    this.#fire();

    // Capture the envelope now so each queued write persists the state as of its own call.
    const envelope: PersistedSelections = {
      version: PERSISTED_SELECTIONS_VERSION,
      items: [...items],
    };
    const write = this.#writeTail.then(() => this.#memento.update(ITEMS_STATE_KEY, envelope));
    this.#writeTail = write.catch(() => undefined);
    await write;
  }

  #fire(): void {
    // Snapshot so listeners that subscribe or dispose mid-dispatch do not change this round.
    for (const listener of Array.from(this.#listeners)) {
      try {
        listener();
      } catch {
        // A faulty listener must not starve the others or fail the mutation; the store
        // has no logger of its own, so the error is intentionally dropped here.
      }
    }
  }
}

/** Cuts `text` to the snapshot limit without leaving a lone high surrogate at the end. */
function capSnapshot(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_SNAPSHOT_LENGTH) {
    return { text, truncated: false };
  }

  let end = MAX_SNAPSHOT_LENGTH;
  if (isHighSurrogate(text.charCodeAt(end - 1))) {
    end -= 1;
  }
  return { text: text.slice(0, end), truncated: true };
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/** Fields derived from a fresh selection capture, shared by add and replace. */
function snapshotFields(
  selection: NewSelection,
): Pick<SelectionItem, "uri" | "range" | "text" | "truncated" | "languageId"> {
  const { text, truncated } = capSnapshot(selection.text);
  return {
    uri: selection.uri,
    range: copyRange(selection.range),
    text,
    truncated,
    languageId: selection.languageId,
  };
}

function copyRange(range: SelectionRange): SelectionRange {
  return {
    startLine: range.startLine,
    startCharacter: range.startCharacter,
    endLine: range.endLine,
    endCharacter: range.endCharacter,
  };
}

function sameRange(a: SelectionRange, b: SelectionRange): boolean {
  return (
    a.startLine === b.startLine &&
    a.startCharacter === b.startCharacter &&
    a.endLine === b.endLine &&
    a.endCharacter === b.endCharacter
  );
}

/** Keeps the invariant that a stored note is either absent or non-blank and trimmed. */
function normalizeNote(note: string | undefined): string | undefined {
  const trimmed = note?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Interprets the raw memento value.
 *
 * - Missing, non-object, array, or version-less values are treated as absent or
 *   corrupt: the list starts empty and stays writable.
 * - An object whose `version` is not the current one is assumed to come from another
 *   extension build; it is left untouched and the store becomes read-only.
 * - A current-version envelope keeps every individually valid item, first id wins.
 */
function loadState(raw: unknown): LoadedState {
  if (!isRecord(raw) || !("version" in raw)) {
    return { items: [], readOnly: false };
  }
  if (raw.version !== PERSISTED_SELECTIONS_VERSION) {
    return { items: [], readOnly: true };
  }
  if (!Array.isArray(raw.items)) {
    return { items: [], readOnly: false };
  }

  const seen = new Set<string>();
  const items: SelectionItem[] = [];
  for (const candidate of raw.items as unknown[]) {
    const item = parseItem(candidate);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  return { items, readOnly: false };
}

/** Rebuilds a stored item from known fields only, or returns undefined if any is invalid. */
function parseItem(value: unknown): SelectionItem | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, uri, range, text, truncated, languageId, note, createdAt } = value;
  if (
    typeof id !== "string" ||
    id === "" ||
    typeof uri !== "string" ||
    typeof text !== "string" ||
    typeof truncated !== "boolean" ||
    typeof languageId !== "string" ||
    (note !== undefined && typeof note !== "string") ||
    typeof createdAt !== "number" ||
    !Number.isFinite(createdAt)
  ) {
    return undefined;
  }
  const parsedRange = parseRange(range);
  if (!parsedRange) {
    return undefined;
  }

  const item: SelectionItem = {
    id,
    uri,
    range: parsedRange,
    text,
    truncated,
    languageId,
    createdAt,
  };
  const normalizedNote = normalizeNote(note);
  if (normalizedNote !== undefined) {
    item.note = normalizedNote;
  }
  return item;
}

function parseRange(value: unknown): SelectionRange | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { startLine, startCharacter, endLine, endCharacter } = value;
  if (
    !isPosition(startLine) ||
    !isPosition(startCharacter) ||
    !isPosition(endLine) ||
    !isPosition(endCharacter)
  ) {
    return undefined;
  }
  return { startLine, startCharacter, endLine, endCharacter };
}

/** Finite, non-negative integer, as VS Code line and character offsets are. */
function isPosition(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
