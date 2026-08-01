import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

type AccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function friendlyError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("already") && text.includes("registered")) {
    return "That email already has an account. Use the Sign in tab instead.";
  }
  if (text.includes("email address") && text.includes("invalid")) return "That email looks invalid.";
  if (text.includes("invalid login")) return "Wrong email or password.";
  if (text.includes("password") && text.includes("6")) {
    return "Password must be at least 6 characters.";
  }
  return message;
}

export function AccountDialog({ open, onOpenChange }: AccountDialogProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"create" | "signin">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setPassword("");
      setBusy(false);
    }
  }, [open]);

  async function finish(message: string) {
    await queryClient.invalidateQueries();
    toast.success(message);
    onOpenChange(false);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data: current } = await supabase.auth.getUser();
      const isGuest = !current.user?.email;

      if (isGuest && current.user) {
        // Attach credentials to the existing guest account so all chats are kept.
        const { error: updateError } = await supabase.auth.updateUser({ email, password });
        if (updateError) throw updateError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
      }
      await finish("Your account is ready — your chats are saved to it.");
    } catch (caught) {
      setError(friendlyError(caught instanceof Error ? caught.message : "Could not create account"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      await finish("Welcome back.");
    } catch (caught) {
      setError(friendlyError(caught instanceof Error ? caught.message : "Could not sign in"));
    } finally {
      setBusy(false);
    }
  }

  const fields = (idPrefix: string) => (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-email`}>Email</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className="text-base sm:text-sm"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-password`}>Password</Label>
        <Input
          id={`${idPrefix}-password`}
          type="password"
          required
          minLength={6}
          className="text-base sm:text-sm"
          autoComplete={idPrefix === "create" ? "new-password" : "current-password"}
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Save your chats</DialogTitle>
          <DialogDescription>
            Add an email and password to keep your conversations and open them on any device.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as "create" | "signin")}>
          <TabsList className="w-full">
            <TabsTrigger value="create" className="flex-1">
              Create account
            </TabsTrigger>
            <TabsTrigger value="signin" className="flex-1">
              Sign in
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              {fields("create")}
              <Button type="submit" className="w-full aozora-glow" disabled={busy}>
                {busy ? <Spinner /> : "Create account"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Your current conversations stay with this account.
              </p>
            </form>
          </TabsContent>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4 pt-4">
              {fields("signin")}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Spinner /> : "Sign in"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}