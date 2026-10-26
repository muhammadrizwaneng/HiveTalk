"use client";

import { useEffect, useMemo, useState } from "react";
import { SLASH_COMMANDS } from "@hivetalk/shared";
import type { ChannelSummary, DmSummary } from "@hivetalk/shared";

type Props = {
  open: boolean;
  onClose: () => void;
  channels: ChannelSummary[];
  dms: DmSummary[];
  onSelectChannel: (id: string) => void;
  mode?: "jump" | "help";
};

export function CommandPalette({
  open,
  onClose,
  channels,
  dms,
  onSelectChannel,
  mode = "jump",
}: Props) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const items = useMemo(() => {
    const query = q.toLowerCase().trim();
    const channelItems = channels
      .filter((c) => !query || c.name.includes(query))
      .map((c) => ({
        id: c.id,
        label: `${c.isPrivate ? "🔒 " : "#"}${c.name}`,
        hint: c.department ?? "GENERAL",
      }));
    const dmItems = dms
      .filter((d) => !query || d.peer.displayName.toLowerCase().includes(query))
      .map((d) => ({
        id: d.id,
        label: d.peer.displayName,
        hint: "DM",
      }));
    return [...channelItems, ...dmItems].slice(0, 20);
  }, [channels, dms, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-[#565856] bg-[#1a1d21] shadow-2xl">
        {mode === "jump" ? (
          <>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Jump to channel or DM…"
              className="w-full border-b border-[#2c2d30] bg-transparent px-4 py-3 text-sm text-white outline-none"
            />
            <ul className="max-h-80 overflow-y-auto py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-[#1164a3]"
                    onClick={() => {
                      onSelectChannel(item.id);
                      onClose();
                    }}
                  >
                    <span>{item.label}</span>
                    <span className="text-xs text-[#ababad]">{item.hint}</span>
                  </button>
                </li>
              ))}
              {!items.length && (
                <li className="px-4 py-3 text-sm text-[#ababad]">No matches</li>
              )}
            </ul>
          </>
        ) : (
          <div className="max-h-96 overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-white">Shortcuts & slash commands</p>
              <button type="button" className="text-[#ababad]" onClick={onClose}>
                Esc
              </button>
            </div>
            <ul className="mb-4 space-y-1 text-sm text-[#d1d2d3]">
              <li>
                <kbd className="rounded bg-[#222529] px-1">⌘/Ctrl + K</kbd> Jump to
                conversation
              </li>
              <li>
                <kbd className="rounded bg-[#222529] px-1">⌘/Ctrl + /</kbd> This help
              </li>
              <li>
                <kbd className="rounded bg-[#222529] px-1">@</kbd> Mention someone
              </li>
            </ul>
            <p className="mb-2 text-xs font-semibold uppercase text-[#ababad]">
              Slash commands
            </p>
            <ul className="space-y-2 text-sm">
              {SLASH_COMMANDS.map((cmd) => (
                <li key={cmd.command} className="text-[#d1d2d3]">
                  <code className="text-[#1d9bd1]">{cmd.command}</code>{" "}
                  <span className="text-xs text-[#ababad]">({cmd.department})</span>
                  <div className="text-xs text-[#ababad]">{cmd.help}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <button
        type="button"
        className="absolute inset-0 -z-10"
        aria-label="Close"
        onClick={onClose}
      />
    </div>
  );
}
