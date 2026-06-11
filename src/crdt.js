const splitLines = (text) => (text ?? '').split('\n');

const chooseLine = (baseLine, localLine, remoteLine) => {
  if (localLine === remoteLine) return localLine;
  if (localLine === baseLine) return remoteLine;
  if (remoteLine === baseLine) return localLine;

  // Both collaborators changed the same line. Prefer the remote version so every
  // client resolves the conflict the same way on the next snapshot.
  return remoteLine;
};

export const mergeTextCrdt = ({ base = '', local = '', remote = '' }) => {
  if (local === remote) return local;
  if (local === base) return remote;
  if (remote === base) return local;

  const baseLines = splitLines(base);
  const localLines = splitLines(local);
  const remoteLines = splitLines(remote);
  const lineCount = Math.max(baseLines.length, localLines.length, remoteLines.length);

  return Array.from({ length: lineCount }, (_, index) => (
    chooseLine(baseLines[index] ?? '', localLines[index] ?? '', remoteLines[index] ?? '')
  )).join('\n');
};
