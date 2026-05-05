/**
 * FR1 — Remote Root URI Validation and Normalisation
 *
 * SSH URI format: ssh://user@hostname/absolute/path
 * Normalisation: hostname lowercased, trailing slashes on path stripped.
 */

export interface ParsedSSHUri {
  user: string;
  hostname: string;
  path: string;
  sshHost: string;
  normalizedUri: string;
}

/**
 * Validates and normalises an SSH URI.
 * Throws an Error with a user-facing message if the URI is invalid.
 * Returns the normalised URI string on success.
 */
export function validateAndNormalizeSSHUri(uri: string): string {
  return parseSSHUri(uri).normalizedUri;
}

/**
 * Validates and parses an SSH URI into its components.
 * Throws an Error with a user-facing message if the URI is invalid.
 */
export function parseSSHUri(uri: string): ParsedSSHUri {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error(
      `Invalid remote root URI '${uri}': not a valid URI. Expected format: ssh://user@hostname/absolute/path`,
    );
  }

  if (parsed.protocol !== "ssh:") {
    throw new Error(
      `Invalid remote root URI '${uri}': scheme must be ssh:// (got ${parsed.protocol.replace(/:$/, "")}://). Expected format: ssh://user@hostname/absolute/path`,
    );
  }

  const user = parsed.username;
  if (!user) {
    throw new Error(
      `Invalid remote root URI '${uri}': missing user component. Expected format: ssh://user@hostname/absolute/path`,
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new Error(
      `Invalid remote root URI '${uri}': missing hostname. Expected format: ssh://user@hostname/absolute/path`,
    );
  }

  // URL.pathname always starts with '/' for authority-based URIs.
  // A path of '/' alone (or empty) means no real path was provided.
  const rawPath = parsed.pathname;
  if (!rawPath || rawPath === "/") {
    throw new Error(
      `Invalid remote root URI '${uri}': path component is missing or empty. The path must be an absolute path on the remote host (e.g. /home/alice/projects).`,
    );
  }

  // Strip trailing slash from path (normalise)
  const path = rawPath.replace(/\/+$/, "") || "/";

  const sshHost = `${user}@${hostname}`;
  const normalizedUri = `ssh://${sshHost}${path}`;

  return { user, hostname, path, sshHost, normalizedUri };
}
