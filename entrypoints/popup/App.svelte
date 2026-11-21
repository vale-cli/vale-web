<script lang="ts">
  import { Button } from "@/lib/components/ui/button";
  import { Switch } from "@/lib/components/ui/switch";
  import { Label } from "@/lib/components/ui/label";
  import { Separator } from "@/lib/components/ui/separator";
  import * as Alert from "@/lib/components/ui/alert";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import CheckIcon from "@lucide/svelte/icons/spell-check";
  import type { StatusResponse } from "@/lib/messages";

  let status = $state<StatusResponse | null>(null);
  let url = $state("");

  async function refresh() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    url = tab?.url ?? "";
    status = (await browser.runtime.sendMessage({ type: "status", url })) as StatusResponse;
  }

  async function setEnabled(enabled: boolean) {
    status = (await browser.runtime.sendMessage({ type: "toggle", url, enabled })) as StatusResponse;
  }

  async function setLive(live: boolean) {
    await browser.runtime.sendMessage({ type: "mode", mode: live ? "live" : "manual" });
    await refresh();
  }

  async function runNow() {
    await browser.runtime.sendMessage({ type: "run-now" });
    window.close();
  }

  $effect(() => {
    void refresh();
  });
</script>

<main class="flex w-[320px] flex-col gap-4 p-4">
  <header class="flex items-center gap-2">
    <img src="/icon/32.png" alt="" class="size-6 rounded-md" />
    <h1 class="text-sm font-semibold">Vale</h1>
  </header>

  {#if status}
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <Label for="site" class="font-normal">Lint on <span class="font-medium">{status.host || "this site"}</span></Label>
        <Switch id="site" checked={status.enabled} onCheckedChange={setEnabled} />
      </div>
      {#if status.enabled}
        <div class="flex items-center justify-between gap-3">
          <Label for="live" class="font-normal">Check as you type</Label>
          <Switch id="live" checked={status.mode === "live"} onCheckedChange={setLive} />
        </div>
        {#if status.mode === "manual"}
          <p class="text-muted-foreground text-xs">
            Off while you type, so another checker can have the field. Check with the button or
            <kbd class="bg-muted rounded px-1 font-mono">Alt+Shift+V</kbd>.
          </p>
        {/if}
        <Button variant="outline" size="sm" onclick={runNow}>
          <CheckIcon data-icon="inline-start" />
          Check the focused field
        </Button>
        <p class="text-muted-foreground text-xs">
          Using your profile, as <code>{status.format}</code>.
          {#if !status.ready}
            Loading the engine…
          {/if}
        </p>
        {#if status.error}
          <Alert.Root variant="destructive">
            <Alert.Description>{status.error}</Alert.Description>
          </Alert.Root>
        {/if}
      {/if}
    </div>
  {:else}
    <p class="text-muted-foreground text-xs">Loading…</p>
  {/if}

  <Separator />
  <Button variant="ghost" size="sm" class="justify-start" onclick={() => browser.runtime.openOptionsPage()}>
    <SettingsIcon data-icon="inline-start" />
    Options
  </Button>
</main>
