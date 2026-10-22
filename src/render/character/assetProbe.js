function withRelativeFallback(path) {
  const relative = path.startsWith("/") ? path.slice(1) : path;
  if (relative === path) {
    return [path];
  }
  return [path, relative];
}

async function tryFetchFirstSuccess(pathCandidates) {
  for (const pathCandidate of pathCandidates) {
    const fetchCandidates = withRelativeFallback(pathCandidate);

    for (const candidate of fetchCandidates) {
      try {
        const response = await fetch(candidate, { cache: "no-store" });
        if (!response.ok) {
          continue;
        }

        const buffer = await response.arrayBuffer();

        return {
          ok: true,
          path: candidate,
          byteLength: buffer.byteLength,
          bytes: new Uint8Array(buffer.slice(0, 8)),
        };
      } catch {
        continue;
      }
    }
  }

  return {
    ok: false,
    path: pathCandidates[0],
    byteLength: 0,
    bytes: new Uint8Array(),
  };
}

function hexSignature(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");
}

export async function probeNoviceAssets(resolvedAssets) {
  const [spr, act, imf] = await Promise.all([
    tryFetchFirstSuccess(resolvedAssets.bodySpritePathCandidates),
    tryFetchFirstSuccess(resolvedAssets.bodyActPathCandidates),
    tryFetchFirstSuccess(resolvedAssets.imfPathCandidates),
  ]);

  const loaded = spr.ok && act.ok;

  return {
    loaded,
    sprite: {
      ...spr,
      signature: hexSignature(spr.bytes),
    },
    act: {
      ...act,
      signature: hexSignature(act.bytes),
    },
    imf: {
      ...imf,
      signature: hexSignature(imf.bytes),
    },
  };
}
