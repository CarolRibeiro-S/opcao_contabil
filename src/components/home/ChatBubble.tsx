export default function ChatBubble() {
  return (
    <button
      type="button"
      aria-label="Abrir chat de dúvidas"
      className="fixed bottom-[26px] right-[26px] z-[60] flex h-[58px] w-[58px] items-center justify-center rounded-full bg-lime text-navy shadow-[0_10px_26px_rgba(141,198,63,0.45)] transition-transform duration-200 hover:scale-[1.08]"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}
