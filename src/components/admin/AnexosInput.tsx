'use client'

import { useRef } from 'react'

export default function AnexosInput({
  files,
  onChange,
}: {
  files: File[]
  onChange: (next: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function adicionarArquivos(selecionados: FileList | null) {
    if (!selecionados) return
    onChange([...files, ...Array.from(selecionados)])
    if (inputRef.current) inputRef.current.value = ''
  }

  function removerArquivo(index: number) {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={(e) => adicionarArquivos(e.target.files)}
        className="block w-full text-sm text-charcoal file:mr-3 file:rounded-[3px] file:border-[1.3px] file:border-navy file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy file:transition-colors file:duration-200 hover:file:bg-navy hover:file:text-paper"
      />

      {files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between rounded-md border border-rule bg-white px-3 py-2 text-sm text-charcoal"
            >
              {file.name}
              <button
                type="button"
                onClick={() => removerArquivo(index)}
                className="text-xs font-semibold text-navy-soft hover:text-red-600"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
