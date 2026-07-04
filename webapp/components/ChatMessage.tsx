"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[78%] rounded-2xl px-4 py-3 text-[14px]",
          isUser
            ? "bg-accent2/15 border border-accent2/30 text-text"
            : "bg-panel border border-border text-text",
        ].join(" ")}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose-coach">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || "…"}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
