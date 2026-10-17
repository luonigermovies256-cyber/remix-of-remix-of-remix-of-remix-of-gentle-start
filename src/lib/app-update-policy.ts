let activeUploads = 0;

export function beginUpload() {
  activeUploads++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeUploads--;
  };
}

export function hasActiveUploads() {
  return activeUploads > 0;
}

export function isNewRelease(current: string, incoming: unknown): incoming is string {
  return typeof incoming === "string" && incoming.length > 0 && incoming !== current;
}