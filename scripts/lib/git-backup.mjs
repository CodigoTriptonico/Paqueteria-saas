export function normalizeGitPath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function isExcludedFromBackup(filePath) {
  const normalizedPath = normalizeGitPath(filePath);
  const filename = normalizedPath.split("/").at(-1) ?? "";

  return (
    normalizedPath === "output" ||
    normalizedPath.startsWith("output/") ||
    filename === ".env" ||
    filename.startsWith(".env.") ||
    filename.endsWith(".pem")
  );
}

export function automaticBackupCommitMessage(now = new Date()) {
  return `backup: automatic snapshot ${now.toISOString().replace(/\.\d{3}Z$/, "Z")}`;
}
