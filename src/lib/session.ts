import { supabase } from "@/integrations/supabase/client";

let pending: Promise<void> | null = null;

/** Forget the in-flight session promise, e.g. after signing out. */
export function resetSession() {
  pending = null;
}

/**
 * The app has no sign-in screen: every visitor gets a persistent anonymous
 * account so their threads are saved and restored on this device.
 */
export function ensureSession(): Promise<void> {
  if (pending) return pending;
  pending = (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  })().catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}
