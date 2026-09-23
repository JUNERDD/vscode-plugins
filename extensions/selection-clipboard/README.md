# Selection Clipboard

Selection Clipboard copies the exact location of what you selected, such as
`src/app/foo.ts:12:5-14:20`, so you can paste precise references into reviews, chats, issues, or
AI prompts. You can also collect several selections into a list in the Activity Bar and copy
them all at once.

## Copy a selection location

Select some code, right-click in the editor, and choose **Selection Clipboard > Copy Selection
Location**. You can also run **Selection Clipboard: Copy Selection Location** from the Command
Palette. With several cursors, every selection is
copied on its own line in document order. With no selection, the cursor position is copied as a
single point, such as `src/app/foo.ts:12:5`.

## Collect selections

Open the **Selection Clipboard** view in the Activity Bar. Add the current selection with the `+`
button in the view title, the editor context menu (**Selection Clipboard > Add Selection to
List**), or the Command Palette. Adding the same file and range twice keeps the existing entry.

Each entry can:

- **Go to Selection** when clicked.
- **Copy Location**, **Edit Note**, or **Remove** with its inline buttons.
- **Replace with Current Selection**, **Move Up**, or **Move Down** from its context menu.

Select several entries to copy or remove them together. Use **Copy All Locations** to copy the
whole list in order, and **Clear List** to empty it after a confirmation prompt.

The list is saved per workspace, so it survives reloads but is not shared between workspaces.

## Commands

| Command                                           | Where                                               |
| ------------------------------------------------- | --------------------------------------------------- |
| Selection Clipboard: Copy Selection Location      | Editor context submenu, Command Palette             |
| Selection Clipboard: Add Selection to List        | Editor context submenu, view title, Command Palette |
| Selection Clipboard: Copy All Locations           | View title, Command Palette                         |
| Selection Clipboard: Clear List                   | View title, Command Palette                         |
| Go to Selection                                   | Clicking an entry                                   |
| Copy Location / Edit Note / Remove                | Entry inline buttons and context menu               |
| Replace with Current Selection                    | Entry context menu                                  |
| Move Up / Move Down                               | Entry context menu                                  |
| Selection Clipboard: Configure Keyboard Shortcuts | View title, Command Palette                         |

Entry commands are hidden from the Command Palette because they act on a specific list entry.
Their keyboard shortcuts act on the entries selected in the focused list.
In the Command Palette, every command is shown with the **Selection Clipboard** category.

## Settings

All settings live under `selectionClipboard`:

- `selectionClipboard.locationStyle` (default `lineColumn`) chooses the location format.
- `selectionClipboard.pathStyle` (default `workspaceRelative`) chooses `workspaceRelative` or
  `absolute` paths. Workspace-relative paths get the folder name as a prefix in multi-root
  workspaces. Files outside the workspace fall back to the absolute path, and untitled files use
  their title.
- `selectionClipboard.includeCode` (default `false`) adds the selected code below each location as
  a fenced code block tagged with the document language. When copying several entries, each one is
  separated by a blank line.

Settings apply right away, including to entries already in the list.

## Location formats

For a selection from line 12, column 5 to line 14, column 20:

| `locationStyle` | Multi-line                    | Single line (line 12)         |
| --------------- | ----------------------------- | ----------------------------- |
| `lineColumn`    | `src/app/foo.ts:12:5-14:20`   | `src/app/foo.ts:12:5-12:20`   |
| `lineRange`     | `src/app/foo.ts:12-14`        | `src/app/foo.ts:12`           |
| `githubAnchor`  | `src/app/foo.ts#L12C5-L14C20` | `src/app/foo.ts#L12C5-L12C20` |

Lines and columns are 1-based, and the end column is inclusive. When a selection ends at the very
start of the next line, for example after selecting whole lines, the location stops at the end of
the previous line.

### How columns are counted

Columns are UTF-16 character offsets, the same as the VS Code extension API uses. A tab counts as
one character no matter how wide it looks, so the column can differ from the `Col` shown in the
status bar when a line contains tabs. Characters outside the Basic Multilingual Plane, such as
most emoji, count as two.

## Snapshot behavior

A collected entry is a snapshot of the file, range, and text at the moment you added it. Later edits
to the file do not move the entry, so its location can drift away from the code it pointed to. Use
**Replace with Current Selection** to update it. If the file has become shorter, **Go to
Selection** clamps the range to the end of the file.

## Keyboard shortcuts

Default shortcuts (macOS in parentheses):

| Shortcut                            | Command                          | Active when                      |
| ----------------------------------- | -------------------------------- | -------------------------------- |
| `Ctrl+Shift+Alt+C` (`⌃⌥⇧C`)         | Copy Selection Location          | Editor focused                   |
| `Ctrl+Shift+Alt+A` (`⌃⌥⇧A`)         | Add Selection to List            | Editor or list focused           |
| `Ctrl+Shift+Alt+E` (`⌃⌥⇧E`)         | Copy All Locations               | Editor or list focused           |
| `Ctrl+C` (`⌘C`)                     | Copy Location (selected entries) | List focused                     |
| `F2`                                | Edit Note                        | List focused, one entry selected |
| `Alt+Up` / `Alt+Down` (`⌥↑` / `⌥↓`) | Move Up / Move Down              | List focused, one entry selected |
| `Delete` (`⌘⌫`)                     | Remove (selected entries)        | List focused                     |

The global actions use the Ctrl+Shift+Alt family (on macOS, Control+Option+Shift, not Command)
because VS Code and common extensions rarely bind it. The list actions follow Explorer conventions
and only fire while the Selection Clipboard list has focus; there, `Alt+Up` / `Alt+Down` replace the
generic list "focus without selecting" navigation. **Clear List** and **Replace with Current
Selection** have no default shortcut.

Hovering a view title button shows its shortcut. To change or add shortcuts, click the keyboard
button in the list's view title (**Configure Keyboard Shortcuts**). It opens the Keyboard Shortcuts
editor filtered to this extension, where every command can be rebound. On keyboard layouts where
Ctrl+Alt acts as AltGr, rebind the global actions if they clash with character input.

## Install from VSIX

Build the package with `pnpm --dir extensions/selection-clipboard package:vsix`, then run
**Extensions: Install from VSIX...** in VS Code and choose the generated `.vsix` file, or run
`code --install-extension selection-clipboard-<version>.vsix`.

## 中文说明

选区剪贴板可以把选区的精确位置（例如 `src/app/foo.ts:12:5-14:20`）复制到剪贴板，也可以把多个选区收集到活动栏的列表中，再一次性复制全部位置。

- 在编辑器中右键打开 **选区剪贴板** 子菜单，选择 **复制选区位置** 或 **添加选区到列表**；也可以在命令面板中运行 **选区剪贴板: 复制选区位置**。
- 列表条目支持跳转、复制、编辑备注、用当前选区替换、上移、下移和删除；可多选后批量复制或删除。
- 列表按工作区保存。条目是添加时的快照，之后编辑文件不会移动它的位置；跳转时如果文件变短，会裁剪到文件末尾。
- 行号和列号从 1 开始。列号按 UTF-16 字符偏移计算，tab 算一个字符，因此可能与状态栏的 `Col` 不同。
- 通过 `selectionClipboard.locationStyle`、`selectionClipboard.pathStyle`、`selectionClipboard.includeCode` 调整输出格式。
- 默认快捷键：编辑器中 `Ctrl+Shift+Alt+C`（macOS `⌃⌥⇧C`）复制选区位置、`Ctrl+Shift+Alt+A`（`⌃⌥⇧A`）添加选区、`Ctrl+Shift+Alt+E`（`⌃⌥⇧E`）复制全部位置；列表聚焦时 `Ctrl+C`（`⌘C`）复制所选条目、`F2` 编辑备注、`Alt+↑/↓` 上下移动、`Delete`（`⌘⌫`）删除。清空列表没有默认快捷键。
- 点击列表标题栏的键盘按钮（**配置快捷键**）会打开已筛选到本扩展的键盘快捷方式编辑器，所有命令都可以在那里改绑或新增快捷键。
