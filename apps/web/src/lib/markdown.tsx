import { renderMessageContent } from "./mentions";
import type { PublicUser } from "@hivetalk/shared";

export function renderMarkdown(content: string, members: PublicUser[]) {
  const blocks = content.split(/```/);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] ?? "";
    if (i % 2 === 1) {
      const newline = block.indexOf("\n");
      const lang = newline >= 0 ? block.slice(0, newline).trim() : "";
      const code = newline >= 0 ? block.slice(newline + 1) : block;
      nodes.push(
        <pre
          key={`code-${i}`}
          className="my-2 overflow-x-auto rounded bg-[#0d1117] p-3 text-xs text-[#d1d2d3]"
        >
          {lang ? (
            <div className="mb-1 text-[10px] uppercase text-[#ababad]">{lang}</div>
          ) : null}
          <code>{code.replace(/\n$/, "")}</code>
        </pre>,
      );
      continue;
    }

    const lines = block.split("\n");
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li] ?? "";
      if (!line && li < lines.length - 1) {
        nodes.push(<br key={`br-${i}-${li}`} />);
        continue;
      }
      nodes.push(
        <span key={`line-${i}-${li}`} className="whitespace-pre-wrap">
          {formatInline(line, members)}
          {li < lines.length - 1 ? "\n" : ""}
        </span>,
      );
    }
  }

  return nodes;
}

function formatInline(text: string, members: PublicUser[]) {
  const withBold = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return withBold.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {renderMessageContent(part.slice(2, -2), members)}
        </strong>
      );
    }
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      return (
        <em key={idx} className="italic text-[#d1d2d3]">
          {renderMessageContent(part.slice(1, -1), members)}
        </em>
      );
    }
    return <span key={idx}>{renderMessageContent(part, members)}</span>;
  });
}
