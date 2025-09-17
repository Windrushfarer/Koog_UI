import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { kotlin } from '@codemirror/legacy-modes/mode/clike'
import { StreamLanguage } from '@codemirror/language'
import { darcula } from '@uiw/codemirror-theme-darcula';

type CodeViewModalProps = {
  isOpen: boolean
  onClose: () => void
  code: string
}

export default function CodeViewModal({
  isOpen,
  onClose,
  code,
}: CodeViewModalProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!isOpen || !editorRef.current) return

    if (viewRef.current) {
      viewRef.current.destroy()
    }

    const state = EditorState.create({
      doc: code,
      extensions: [
        basicSetup,
        StreamLanguage.define(kotlin),
        // EditorState.readOnly.of(true),
        EditorView.lineWrapping,
        darcula
      ],
    })

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    })

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [isOpen, code])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-[90vw] max-w-4xl rounded-lg bg-neutral-900 border border-neutral-700 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-100">View Code</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
            aria-label="Close modal"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4">
          <div
            ref={editorRef}
            className="rounded-lg border border-neutral-800"
          />
        </div>
      </div>
    </div>
  )
}
