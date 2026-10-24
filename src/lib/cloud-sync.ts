import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  LEGACY_KEY,
  attachCloud,
  detachCloud,
  emptyData,
  readLegacyLocal,
  readLocalCopy,
  type AppData,
} from "@/lib/store";

/**
 * Sync between this device and the account's JSON row (RLS: own row only).
 *
 * Every local change is written to the per-user cache first and marked "dirty" together with the
 * revision it was based on, so a reload, crash or network failure never loses it. Pending changes
 * are re-sent only when the cloud is still at that base revision (save_app_data enforces it);
 * otherwise both versions are kept and the user picks one — nothing is overwritten silently.
 * The legacy pre-login key is never modified or deleted.
 */
export type SyncMeta = { baseRevision: number; dirty: boolean };
export type Conflict = { local: AppData; remote: AppData; remoteRevision: number };
export type SyncState = "loading" | "ready";

const metaKey = (userId: string) => `${LEGACY_KEY}:user:${userId}:sync`;
const cacheKey = (userId: string) => `${LEGACY_KEY}:user:${userId}`;

export function readMeta(userId: string): SyncMeta | null {
  try {
    const raw = localStorage.getItem(metaKey(userId));
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<SyncMeta>;
    return typeof m.baseRevision === "number" && typeof m.dirty === "boolean"
      ? { baseRevision: m.baseRevision, dirty: m.dirty }
      : null;
  } catch {
    return null;
  }
}

function writeMeta(userId: string, meta: SyncMeta) {
  try {
    localStorage.setItem(metaKey(userId), JSON.stringify(meta));
  } catch {
    /* the data cache itself already reported storage errors */
  }
}

/** Pure decision for the startup reconciliation (unit-tested). */
export function decideStartup(input: {
  remote: { data: unknown; revision: number } | null;
  cache: AppData | null;
  meta: SyncMeta | null;
  legacy: AppData | null;
}):
  | { kind: "use-remote" }
  | { kind: "push"; data: AppData; expected: number; fromLegacy: boolean }
  | { kind: "conflict" } {
  const { remote, cache, meta, legacy } = input;
  if (!remote) {
    if (cache && meta?.dirty) return { kind: "push", data: cache, expected: 0, fromLegacy: false };
    if (cache && meta && meta.baseRevision > 0) return { kind: "conflict" }; // row vanished: never re-create silently
    const data = cache ?? legacy ?? emptyData();
    return { kind: "push", data, expected: 0, fromLegacy: !cache && !!legacy };
  }
  if (!cache || !meta?.dirty) return { kind: "use-remote" };
  if (meta.baseRevision === remote.revision)
    return { kind: "push", data: cache, expected: remote.revision, fromLegacy: false };
  return { kind: "conflict" };
}

export function isRevisionConflict(message: string | undefined) {
  return !!message && message.includes("REVISION_CONFLICT");
}

function backupFile(data: unknown, label: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-gerenciador-de-vida-${label}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function useCloudSync(userId: string) {
  const [status, setStatus] = useState<SyncState>("loading");
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [offline, setOffline] = useState(false);
  const api = useRef<{ resolve: (choice: "remote" | "local") => Promise<void> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    let pending: AppData | null = null;
    let running = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 5_000;
    let blocked = false; // true while a conflict is unresolved: nothing is sent to the cloud
    let warned = false;

    const scheduleRetry = () => {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void flush(), retryDelay);
      retryDelay = Math.min(retryDelay * 2, 120_000);
    };

    async function fetchRemote() {
      const { data, error } = await supabase
        .from("app_data")
        .select("data, revision")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ? { data: data.data, revision: Number(data.revision) } : null;
    }

    async function enterConflict() {
      blocked = true;
      pending = null;
      const local = readLocalCopy(userId) ?? emptyData();
      try {
        localStorage.setItem(`${cacheKey(userId)}:conflict:${Date.now()}`, JSON.stringify(local));
      } catch {
        /* best effort extra copy */
      }
      const remote = await fetchRemote().catch(() => null);
      if (cancelled) return;
      setConflict({
        local,
        remote: (remote?.data as AppData) ?? emptyData(),
        remoteRevision: remote?.revision ?? 0,
      });
    }

    async function flush() {
      if (running || blocked || cancelled) return;
      if (!pending) {
        // Recovery after reload/failure: resend the cached copy if it is still dirty.
        const meta = readMeta(userId);
        if (!meta?.dirty) return;
        pending = readLocalCopy(userId);
        if (!pending) return;
      }
      running = true;
      while (pending && !cancelled && !blocked) {
        const payload = pending;
        pending = null;
        const { data, error } = await supabase.rpc("save_app_data", {
          payload: payload as never,
          expected_revision: revision,
        });
        if (error) {
          if (isRevisionConflict(error.message)) {
            running = false;
            await enterConflict();
            return;
          }
          pending = pending ?? payload; // keep the newest unsent version
          setOffline(true);
          if (!warned) {
            warned = true;
            toast.warning("Sem conexão com a nuvem. Suas alterações estão salvas neste aparelho e serão reenviadas.");
          }
          scheduleRetry();
          break;
        }
        revision = Number(data);
        writeMeta(userId, { baseRevision: revision, dirty: pending !== null });
        retryDelay = 5_000;
        if (warned) toast.success("Alterações sincronizadas com a nuvem.");
        warned = false;
        setOffline(false);
      }
      running = false;
    }

    const save = (d: AppData) => {
      // Local cache is already written by the store; persist the dirty flag before any network call.
      writeMeta(userId, { baseRevision: revision, dirty: true });
      if (blocked) return;
      pending = d;
      void flush();
    };

    async function start() {
      const cache = readLocalCopy(userId);
      const meta = readMeta(userId);
      const legacy = readLegacyLocal();
      let remote: { data: unknown; revision: number } | null;
      try {
        remote = await fetchRemote();
      } catch {
        if (cancelled) return;
        // Network failure on read: work from this device's copy, never push blindly.
        if (cache) {
          revision = meta?.baseRevision ?? 0;
          attachCloud(userId, cache, save);
          setOffline(true);
          toast.warning("Sem conexão: mostrando a cópia salva neste aparelho. Vamos sincronizar quando a conexão voltar.");
          setStatus("ready");
          retryTimer = setTimeout(() => {
            if (!cancelled) void start();
          }, 15_000);
        } else {
          toast.error("Não foi possível carregar seus dados da nuvem. Verifique a conexão.");
          retryTimer = setTimeout(() => {
            if (!cancelled) void start();
          }, 10_000);
        }
        return;
      }
      if (cancelled) return;
      setOffline(false);
      const decision = decideStartup({ remote, cache, meta, legacy });
      if (decision.kind === "use-remote") {
        revision = remote!.revision;
        attachCloud(userId, remote!.data, save);
        writeMeta(userId, { baseRevision: revision, dirty: false });
        if (!cache && legacy && JSON.stringify(legacy) !== JSON.stringify(remote!.data)) {
          toast.info("Este aparelho tem dados antigos diferentes da sua conta. Eles foram mantidos.", {
            action: { label: "Baixar cópia", onClick: () => backupFile(legacy, "aparelho") },
            duration: 15_000,
          });
        }
      } else if (decision.kind === "push") {
        revision = decision.expected;
        attachCloud(userId, decision.data, save);
        save(decision.data);
        if (decision.fromLegacy)
          toast.success("Dados deste aparelho importados para sua conta. A cópia local foi mantida.");
      } else {
        revision = remote?.revision ?? 0;
        attachCloud(userId, cache ?? emptyData(), save);
        blocked = true;
        await enterConflict();
      }
      setStatus("ready");
    }

    api.current = {
      resolve: async (choice) => {
        const remote = await fetchRemote();
        if (choice === "remote") {
          revision = remote?.revision ?? 0;
          blocked = false;
          attachCloud(userId, remote?.data ?? emptyData(), save);
          writeMeta(userId, { baseRevision: revision, dirty: false });
          if (!remote) save(emptyData());
        } else {
          const local = readLocalCopy(userId) ?? emptyData();
          revision = remote?.revision ?? 0;
          blocked = false;
          attachCloud(userId, local, save);
          save(local);
        }
        setConflict(null);
      },
    };

    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    void start();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      window.removeEventListener("online", onOnline);
      detachCloud();
    };
  }, [userId]);

  return {
    status,
    offline,
    conflict,
    resolve: (choice: "remote" | "local") => api.current?.resolve(choice) ?? Promise.resolve(),
    downloadCopy: (data: AppData, label: string) => backupFile(data, label),
  };
}
