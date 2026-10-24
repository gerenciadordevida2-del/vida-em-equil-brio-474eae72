import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { attachCloud, detachCloud, emptyData, readLegacyLocal, type AppData } from "@/lib/store";

/** Loads the signed-in user's data from Supabase (RLS: own row only). On first login the
 * device's legacy localStorage data is uploaded once (revision 0 insert is idempotent) and
 * the legacy copy is left untouched as a backup. Saves are serialized with optimistic revisions. */
export function useCloudSync(userId: string): "loading" | "ready" {
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    let pending: AppData | null = null;
    let running = false;

    async function flush() {
      if (running || !pending) return;
      running = true;
      while (pending && !cancelled) {
        const payload = pending;
        pending = null;
        const { data, error } = await supabase.rpc("save_app_data", {
          payload: payload as never,
          expected_revision: revision,
        });
        if (error) {
          toast.error(`Não foi possível sincronizar: ${error.message}`);
          break;
        }
        revision = Number(data);
      }
      running = false;
    }

    const save = (d: AppData) => {
      pending = d;
      void flush();
    };

    (async () => {
      const { data: row, error } = await supabase
        .from("app_data")
        .select("data, revision")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error("Não foi possível carregar seus dados da nuvem.");
        return;
      }
      if (row) {
        revision = Number(row.revision);
        attachCloud(userId, row.data, save);
      } else {
        const legacy = readLegacyLocal();
        const initial = legacy ?? emptyData();
        attachCloud(userId, initial, save);
        save(initial);
        if (legacy) toast.success("Dados deste aparelho importados para sua conta. A cópia local foi mantida.");
      }
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
      detachCloud();
    };
  }, [userId]);

  return status;
}
