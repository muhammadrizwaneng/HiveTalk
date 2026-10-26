/** In-memory presence: workspaceId -> Map<userId, Set<socketId>> */
const presence = new Map<string, Map<string, Set<string>>>();

export function addPresence(
  workspaceId: string,
  userId: string,
  socketId: string,
) {
  let workspace = presence.get(workspaceId);
  if (!workspace) {
    workspace = new Map();
    presence.set(workspaceId, workspace);
  }
  let sockets = workspace.get(userId);
  if (!sockets) {
    sockets = new Set();
    workspace.set(userId, sockets);
  }
  sockets.add(socketId);
}

export function removePresence(socketId: string): string[] {
  const touchedWorkspaces: string[] = [];
  for (const [workspaceId, users] of presence) {
    for (const [userId, sockets] of users) {
      if (sockets.delete(socketId)) {
        touchedWorkspaces.push(workspaceId);
        if (sockets.size === 0) users.delete(userId);
      }
    }
    if (users.size === 0) presence.delete(workspaceId);
  }
  return [...new Set(touchedWorkspaces)];
}

export function getOnlineUserIds(workspaceId: string): string[] {
  const workspace = presence.get(workspaceId);
  if (!workspace) return [];
  return [...workspace.keys()];
}
