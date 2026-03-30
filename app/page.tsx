import ChatWindow from "../components/ChatWindow";

export default function Home() {
  return (
    <main className="flex flex-col h-screen bg-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
          V
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">Vitalize Support</p>
          <p className="text-xs text-zinc-500">Powered by Claude + MCP</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-xs text-zinc-500">Agent online</span>
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <ChatWindow />
      </div>
    </main>
  );
}
