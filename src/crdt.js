const splitLines = (text) => (text ?? '').split('\n');

export const mergeTextCrdt = ({ base = '', local = '', remote = '' }) => {
  if (local === base) return remote;
  if (remote === base) return local;
  if (local === remote) return local;

  const baseLines = splitLines(base);
  const localLines = splitLines(local);
  const remoteLines = splitLines(remote);
  const maxLines = Math.max(baseLines.length, localLines.length, remoteLines.length);
  const merged = [];

  for (let i = 0; i < maxLines; i += 1) {
    const b = baseLines[i] ?? '';
    const l = localLines[i] ?? '';
    const r = remoteLines[i] ?? '';

    if (l === r) merged.push(l);
    else if (l === b) merged.push(r);
    else if (r === b) merged.push(l);
    else merged.push(r);
  }

  return merged.join('\n');
};

