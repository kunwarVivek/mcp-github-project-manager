import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { z } from "zod";

const isoTimestamp = z.iso.datetime();

/** What `auth login` persists. Secret material: the file holding it is 0600. */
export const StoredOAuthTokenSchema = z
  .object({
    clientId: z.string().min(1),
    token: z.string().min(1),
    tokenType: z.string().min(1),
    scopes: z.array(z.string()),
    expiresAt: isoTimestamp.optional(),
    refreshToken: z.string().min(1).optional(),
    refreshTokenExpiresAt: isoTimestamp.optional(),
    login: z.string().min(1),
    createdAt: isoTimestamp,
  })
  .refine(
    (stored) =>
      stored.refreshToken === undefined ||
      (stored.expiresAt !== undefined && stored.refreshTokenExpiresAt !== undefined),
    { message: "refreshToken requires expiresAt and refreshTokenExpiresAt" }
  );

export type StoredOAuthToken = z.infer<typeof StoredOAuthTokenSchema>;

export type OAuthStoreReadResult =
  | { readonly status: "absent" }
  | { readonly status: "ok"; readonly token: StoredOAuthToken }
  /** The file is readable by group/other, so it is refused rather than trusted. */
  | { readonly status: "insecure-permissions"; readonly mode: number }
  | { readonly status: "corrupt"; readonly reason: string };

const FILE_MODE = 0o600;
const DIR_MODE = 0o700;
const GROUP_OTHER_BITS = 0o077;

const isPosix = process.platform !== "win32";

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/**
 * Persistent, owner-only storage for the OAuth user token.
 *
 * Writes are atomic: the content goes to a temp file created with mode 0600 in
 * the destination directory and is then renamed over the target, so a reader
 * never observes a partial file and the token is never briefly world-readable.
 */
export class OAuthTokenStore {
  constructor(readonly path: string) {}

  read(): OAuthStoreReadResult {
    let mode: number;
    try {
      const stats = statSync(this.path);
      if (!stats.isFile()) {
        return { status: "corrupt", reason: "not a regular file" };
      }
      mode = stats.mode & 0o777;
    } catch (error) {
      if (isNotFound(error)) return { status: "absent" };
      return { status: "corrupt", reason: error instanceof Error ? error.message : String(error) };
    }

    if (isPosix && (mode & GROUP_OTHER_BITS) !== 0) {
      return { status: "insecure-permissions", mode };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(this.path, "utf8"));
    } catch (error) {
      if (isNotFound(error)) return { status: "absent" };
      return { status: "corrupt", reason: "file is not valid JSON" };
    }

    const parsed = StoredOAuthTokenSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path.length ? issue.path.join(".") : "(root)";
      return { status: "corrupt", reason: `invalid ${where}: ${issue?.message ?? "unknown"}` };
    }
    return { status: "ok", token: parsed.data };
  }

  save(token: StoredOAuthToken): void {
    const validated = StoredOAuthTokenSchema.parse(token);
    const dir = dirname(this.path);
    mkdirSync(dir, { recursive: true, mode: DIR_MODE });

    const temp = join(dir, `.${basename(this.path)}.${process.pid}.${randomUUID()}.tmp`);
    try {
      // `wx` + mode at creation: the token is never on disk with wider access.
      writeFileSync(temp, `${JSON.stringify(validated, null, 2)}\n`, {
        mode: FILE_MODE,
        flag: "wx",
      });
      renameSync(temp, this.path);
    } catch (error) {
      try {
        unlinkSync(temp);
      } catch {
        // Temp file was never created or is already gone.
      }
      throw error;
    }
  }

  /** Deletes the stored token. Succeeds when there is nothing to delete. */
  clear(): void {
    rmSync(this.path, { force: true });
  }
}
