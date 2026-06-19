export function useKeyboard(handlers: {
  prevChapter: () => void
  nextChapter: () => void
}) {
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      handlers.prevChapter()
    } else if (e.key === 'ArrowRight') {
      handlers.nextChapter()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
