/**
 * useUndoRedo — 通用撤销/重做栈
 *
 * 捕获状态的快照，支持撤销（Ctrl+Z）和重做（Ctrl+Y/Ctrl+Shift+Z）。
 * 适用于文本编辑器、表单编辑等场景。
 */

const MAX_HISTORY = 100

export function useUndoRedo() {
  const undoStack = ref<string[]>([])
  const redoStack = ref<string[]>([])

  /** 记录一个新快照 */
  function pushSnapshot(current: string) {
    undoStack.value.push(current)
    // 限制历史深度
    if (undoStack.value.length > MAX_HISTORY) {
      undoStack.value.shift()
    }
    // 新操作清空重做栈
    redoStack.value = []
  }

  /** 撤销（返回上一个状态） */
  function undo(current: string): string | null {
    if (undoStack.value.length === 0) return null
    const previous = undoStack.value.pop()!
    redoStack.value.push(current)
    return previous
  }

  /** 重做（返回下一个状态） */
  function redo(current: string): string | null {
    if (redoStack.value.length === 0) return null
    const next = redoStack.value.pop()!
    undoStack.value.push(current)
    return next
  }

  /** 清空历史 */
  function clear() {
    undoStack.value = []
    redoStack.value = []
  }

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  return { pushSnapshot, undo, redo, clear, canUndo, canRedo }
}
