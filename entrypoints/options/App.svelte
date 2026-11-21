<script lang="ts">
  import { toast } from "svelte-sonner";
  import { Toaster } from "@/lib/components/ui/sonner";
  import { Button } from "@/lib/components/ui/button";
  import { Switch } from "@/lib/components/ui/switch";
  import { Input } from "@/lib/components/ui/input";
  import { Badge } from "@/lib/components/ui/badge";
  import { Separator } from "@/lib/components/ui/separator";
  import * as ToggleGroup from "@/lib/components/ui/toggle-group";
  import CodeEditor from "@/lib/components/CodeEditor.svelte";
  import { valeIniLanguage } from "@/lib/editor/vale-ini";
  import { parsePackages } from "@/lib/packages";
  import { formats } from "@/lib/format";
  import type { ResolvedConfig, SyncResponse } from "@/lib/messages";
  import { bytesToBase64, defaultINI, defaultSettings, loadSettings, saveSettings, type Settings } from "@/lib/settings";
  import BookOpenIcon from "@lucide/svelte/icons/book-open";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import UploadIcon from "@lucide/svelte/icons/upload";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import LoaderIcon from "@lucide/svelte/icons/loader-circle";
  import PackageIcon from "@lucide/svelte/icons/package";

  let settings = $state<Settings | null>(null);
  let resolved = $state<ResolvedConfig | null>(null);
  let resolving = $state(false);
  let syncing = $state(false);
  let saveState = $state<"saved" | "saving" | "unsaved">("saved");
  let rail = $state<"rules" | "packages" | "sites" | "yours">("rules");
  let newWord = $state("");
  // A first install arrives here with ?welcome.
  let welcome = $state(new URLSearchParams(location.search).has("welcome"));

  // A dismissal is stored as rule, words before, words flagged, words after;
  // see dismissKey.
  const dismissedRows = $derived(
    (settings?.dismissed ?? []).map((key) => {
      const [check, before, match, after] = key.split("\u0000");
      return { key, check: check ?? "", before: before ?? "", match: match ?? "", after: after ?? "" };
    }),
  );

  async function addWord() {
    if (!settings) return;
    const word = newWord.trim();
    if (!word || settings.vocab.includes(word)) return;
    settings.vocab = [...settings.vocab, word];
    newWord = "";
    await save();
  }

  async function removeFrom(list: "vocab" | "disabledRules" | "dismissed", value: string) {
    if (!settings) return;
    settings[list] = settings[list].filter((v) => v !== value);
    await save();
  }

  async function clearDismissed() {
    if (!settings) return;
    settings.dismissed = [];
    await save();
  }
  let newHost = $state("");
  let newFormat = $state("md");
  let pkgName = $state("");
  let pkgFile = $state<FileList | undefined>(undefined);

  const declared = $derived(settings ? parsePackages(settings.ini) : []);
  const isMac = navigator.platform.toUpperCase().includes("MAC");

  $effect(() => {
    void loadSettings().then((s) => {
      settings = s;
      void resolve(s.ini);
    });
  });

  let saveTimer: number | undefined;
  // Edits apply live: the profile is saved shortly after each change.
  // The formats to offer a site: the list, and the site's own if it isn't on it.
  function formatOptions(current: string) {
    return formats.some((f) => f.id === current) ? formats : [...formats, { id: current, label: current }];
  }

  function changed() {
    saveState = "unsaved";
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void save(), 600);
  }

  async function save() {
    if (!settings) return;
    saveState = "saving";
    await saveSettings($state.snapshot(settings));
    saveState = "saved";
  }

  let resolveTimer: number | undefined;
  function onIni(v: string) {
    if (!settings) return;
    settings.ini = v;
    changed();
    window.clearTimeout(resolveTimer);
    resolveTimer = window.setTimeout(() => void resolve(v), 400);
  }

  async function resolve(ini: string) {
    resolving = true;
    resolved = (await browser.runtime.sendMessage({ type: "resolve", ini })) as ResolvedConfig;
    resolving = false;
  }

  async function sync() {
    if (!settings) return;
    syncing = true;
    await save();
    const res = (await browser.runtime.sendMessage({ type: "sync" })) as SyncResponse;
    settings = await loadSettings();
    syncing = false;
    const failed = res.outcomes.filter((o) => !o.ok);
    if (failed.length) toast.error(failed.map((o) => `${o.name}: ${o.error}`).join("; "));
    else toast.success(res.outcomes.length ? `Synced ${res.outcomes.length} package(s).` : "The configuration names no packages.");
    void resolve(settings.ini);
  }

  async function upload() {
    const file = pkgFile?.[0];
    if (!settings || !file) return;
    const name = pkgName.trim() || file.name.replace(/\.zip$/i, "");
    const data = await bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    settings.packages = [...settings.packages.filter((p) => p.name !== name), { name, data, source: "upload" }];
    pkgName = "";
    pkgFile = undefined;
    await save();
    toast.success(`Added ${name}.`);
    void resolve(settings.ini);
  }

  async function removePackage(name: string) {
    if (!settings) return;
    settings.packages = settings.packages.filter((p) => p.name !== name);
    await save();
    void resolve(settings.ini);
  }

  async function addSite() {
    if (!settings) return;
    const host = newHost.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    if (!host) return;
    settings.sites[host] = { enabled: true, format: newFormat.replace(/^\./, "") || "txt" };
    newHost = "";
    await save();
  }

  async function removeSite(host: string) {
    if (!settings) return;
    delete settings.sites[host];
    await save();
  }

  async function reset() {
    settings = structuredClone(defaultSettings);
    await save();
    toast.success("Reset to defaults.");
    void resolve(settings.ini);
  }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      window.clearTimeout(saveTimer);
      void save();
    }
  }
</script>

<svelte:window onkeydown={onKey} />
<Toaster />

<div class="flex h-screen flex-col text-sm">
  {#if welcome}
    <div class="bg-muted/50 flex items-start gap-3 border-b px-4 py-3">
      <div class="flex-1 leading-relaxed">
        <p class="font-medium">Vale is on for GitHub and GitLab.</p>
        <p class="text-muted-foreground">
          Type in a comment or a description and Vale underlines what your style guide flags. Click a mark for the
          reason and the fix, or press <kbd class="font-mono">Alt+Enter</kbd> with the cursor on it. Every site uses the
          profile below; turn a site on from the toolbar button.
        </p>
      </div>
      <Button size="sm" variant="ghost" onclick={() => (welcome = false)}>Got it</Button>
    </div>
  {/if}
  <header class="flex h-11 shrink-0 items-center gap-3 border-b px-4">
    <img src="/icon/32.png" alt="" class="size-5 rounded" />
    <span class="font-semibold">Vale</span>
    <span class="text-muted-foreground">Options</span>
  </header>

  {#if settings}
    <div class="flex min-h-0 flex-1">
      <section class="flex min-w-0 flex-1 flex-col border-r">
        <div class="flex h-9 shrink-0 items-center gap-2 border-b px-3">
          <span class="font-mono text-xs">.vale.ini</span>
          <span class="text-muted-foreground text-xs">profile · used on every site that’s on</span>
          <div class="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" onclick={() => { if (settings) { settings.ini = defaultINI; onIni(defaultINI); } }}>Default</Button>
            <Button size="sm" variant="ghost" onclick={reset}>Reset all</Button>
          </div>
        </div>
        <div class="flex h-9 shrink-0 items-center gap-2 border-b px-3 text-xs">
          <PackageIcon class="text-muted-foreground size-3.5" />
          {#if declared.length}
            <span><span class="text-muted-foreground">{declared.length} package{declared.length === 1 ? "" : "s"} declared:</span> <span class="font-mono">{declared.join(", ")}</span></span>
          {:else}
            <span class="text-muted-foreground">No packages declared</span>
          {/if}
          <div class="ml-auto flex items-center gap-1">
            <Button size="sm" variant="outline" href="https://docs.vale.sh/topics/.vale.ini" target="_blank" rel="noopener">
              <BookOpenIcon data-icon="inline-start" />
              Reference
            </Button>
            <Button size="sm" variant="outline" onclick={sync} disabled={syncing}>
              {#if syncing}<LoaderIcon data-icon="inline-start" class="animate-spin" />{:else}<RefreshIcon data-icon="inline-start" />{/if}
              Sync packages
            </Button>
          </div>
        </div>
        <div class="min-h-0 flex-1">
          <CodeEditor value={settings.ini} language={valeIniLanguage} onChange={onIni} />
        </div>
      </section>

      <aside class="bg-card flex w-[400px] shrink-0 flex-col">
        <div class="flex h-9 shrink-0 items-center gap-2 border-b px-3">
          <span class="text-muted-foreground text-xs font-medium tracking-wider uppercase">Profile</span>
          <ToggleGroup.Root type="single" variant="outline" size="sm" value={rail} onValueChange={(v) => { if (v === "rules" || v === "packages" || v === "sites" || v === "yours") rail = v; }}>
            <ToggleGroup.Item value="rules">Rules</ToggleGroup.Item>
            <ToggleGroup.Item value="packages">Packages</ToggleGroup.Item>
            <ToggleGroup.Item value="sites">Sites</ToggleGroup.Item>
            <ToggleGroup.Item value="yours">Yours</ToggleGroup.Item>
          </ToggleGroup.Root>
          {#if resolving}<LoaderIcon class="text-muted-foreground ml-auto size-3.5 animate-spin" />{/if}
        </div>

        <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 *:shrink-0">
          {#if rail === "rules"}
            {#if resolved?.error}
              <p class="border-sev-error/30 bg-sev-error/5 text-sev-error rounded-lg border p-3 font-mono text-xs">{resolved.error}</p>
            {/if}
            {#if resolved}
              {#each resolved.sections as sec (sec.glob)}
                <div class="bg-background overflow-hidden rounded-lg border">
                  <div class="flex items-center gap-2 px-3 py-2.5">
                    <span class="font-mono">[{sec.glob}]</span>
                    <span class="text-muted-foreground ml-auto text-xs tabular-nums">
                      {sec.active} on{#if sec.overridden}<span class="text-sev-warn">{" · "}{sec.overridden} tuned</span>{/if}{#if sec.disabled}<span class="text-muted-foreground/70">{" · "}{sec.disabled} off</span>{/if}
                    </span>
                  </div>
                  <div class="border-t">
                    {#each sec.rules as r (r.ref)}
                      <div class="flex items-center gap-2 px-3 py-1.5 {r.state === 'disabled' ? 'text-muted-foreground line-through' : ''}">
                        <span class="size-1.5 shrink-0 rounded-full {r.state === 'active' ? 'bg-ok' : r.state === 'override' ? 'bg-sev-warn' : 'bg-muted-foreground/50'}"></span>
                        <span class="font-mono">{r.ref}</span>
                        {#if r.level}<span class="text-sev-warn ml-auto text-xs">→ {r.level}</span>{/if}
                      </div>
                    {/each}
                    {#if sec.rules.length === 0}
                      <div class="text-muted-foreground px-3 py-2 text-xs">No rules here yet. Sync the packages this section's styles come from.</div>
                    {/if}
                  </div>
                </div>
              {/each}
              {#if resolved.sections.length === 0 && !resolved.error}
                <p class="text-muted-foreground text-xs">No sections. Add one, such as <code>[*]</code> with <code>BasedOnStyles = Vale</code>.</p>
              {/if}
            {/if}
          {:else if rail === "packages"}
            <div class="bg-background rounded-lg border">
              {#each settings.packages as pkg (pkg.name)}
                <div class="flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
                  <span class="font-mono">{pkg.name}</span>
                  {#if pkg.source === "url"}<Badge variant="outline" class="text-muted-foreground">library</Badge>{:else}<Badge variant="secondary">uploaded</Badge>{/if}
                  <Button size="icon-sm" variant="ghost" class="ml-auto" aria-label="Remove {pkg.name}" onclick={() => removePackage(pkg.name)}><TrashIcon /></Button>
                </div>
              {:else}
                <p class="text-muted-foreground px-3 py-2 text-xs">No packages yet. Name them in the configuration and sync, or upload a <code>.zip</code>.</p>
              {/each}
            </div>
            <div class="flex flex-col gap-2">
              <Input placeholder="Name (optional)" bind:value={pkgName} />
              <Input type="file" accept=".zip" bind:files={pkgFile} />
              <Button size="sm" variant="secondary" onclick={upload} disabled={!pkgFile?.length}>
                <UploadIcon data-icon="inline-start" />
                Upload archive
              </Button>
            </div>
          {:else if rail === "yours"}
            <p class="text-muted-foreground text-xs">What you've said from the cards. It applies on every site.</p>

            <div class="bg-background flex flex-col gap-2.5 rounded-lg border p-3">
              <div class="flex items-center gap-3">
                <label for="hover" class="flex-1">Open a card by pointing at a mark</label>
                <Switch id="hover" size="sm" bind:checked={settings.hover} onCheckedChange={changed} />
              </div>
              <div class="flex items-center gap-3">
                <label for="delay" class="flex-1">Wait after typing before checking</label>
                <Input id="delay" type="number" min="0" step="50" class="w-20 font-mono" bind:value={settings.delay} oninput={changed} />
                <span class="text-muted-foreground text-xs">ms</span>
              </div>
              <p class="text-muted-foreground text-xs leading-relaxed">
                <kbd class="font-mono">Alt+Enter</kbd> opens the card at the cursor · <kbd class="font-mono">Alt+Shift+Enter</kbd> applies its first fix ·
                <kbd class="font-mono">Esc</kbd> closes it
              </p>
            </div>

            <div class="bg-background rounded-lg border">
              <div class="flex items-center gap-2 border-b px-3 py-2">
                <span class="font-medium">Vocabulary</span>
                <span class="text-muted-foreground text-xs">words spelling rules accept · <code>Vocab = Personal</code></span>
              </div>
              {#each settings.vocab as word (word)}
                <div class="flex items-center gap-2 border-b px-3 py-1.5 last:border-b-0">
                  <span class="font-mono">{word}</span>
                  <Button size="icon-sm" variant="ghost" class="ml-auto" aria-label="Remove {word}" onclick={() => removeFrom("vocab", word)}><TrashIcon /></Button>
                </div>
              {:else}
                <p class="text-muted-foreground border-b px-3 py-2 text-xs">None yet. A spelling alert's card can add its word here.</p>
              {/each}
              <div class="flex items-center gap-2 p-2">
                <Input placeholder="Add a word" bind:value={newWord} class="flex-1" onkeydown={(e: KeyboardEvent) => e.key === "Enter" && addWord()} />
                <Button size="sm" variant="secondary" onclick={addWord}><PlusIcon data-icon="inline-start" />Add</Button>
              </div>
            </div>

            <div class="bg-background rounded-lg border">
              <div class="border-b px-3 py-2 font-medium">Rules turned off</div>
              {#each settings.disabledRules as rule (rule)}
                <div class="flex items-center gap-2 border-b px-3 py-1.5 last:border-b-0">
                  <span class="font-mono">{rule}</span>
                  <Button size="sm" variant="ghost" class="ml-auto" onclick={() => removeFrom("disabledRules", rule)}>Turn on</Button>
                </div>
              {:else}
                <p class="text-muted-foreground px-3 py-2 text-xs">None. A card's “Turn off” adds its rule here.</p>
              {/each}
            </div>

            <div class="bg-background rounded-lg border">
              <div class="flex items-center gap-2 border-b px-3 py-2">
                <span class="font-medium">Dismissed</span>
                <span class="text-muted-foreground text-xs tabular-nums">{dismissedRows.length}</span>
                {#if dismissedRows.length}<Button size="sm" variant="ghost" class="ml-auto" onclick={clearDismissed}>Clear all</Button>{/if}
              </div>
              {#each dismissedRows as row (row.key)}
                <div class="flex items-center gap-2 border-b px-3 py-1.5 last:border-b-0">
                  <span class="min-w-0 truncate"><span class="text-muted-foreground font-mono text-xs">{row.check}</span> {row.before} <mark class="bg-sev-warn/20 rounded px-0.5 text-inherit">{row.match}</mark> {row.after}</span>
                  <Button size="icon-sm" variant="ghost" class="ml-auto shrink-0" aria-label="Show it again" onclick={() => removeFrom("dismissed", row.key)}><TrashIcon /></Button>
                </div>
              {:else}
                <p class="text-muted-foreground px-3 py-2 text-xs">None. A card's “Dismiss” hides that one alert, and it's listed here.</p>
              {/each}
            </div>
          {:else}
            <div class="bg-background rounded-lg border">
              {#each Object.entries(settings.sites) as [host, site] (host)}
                <div class="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
                  <Switch id="site-{host}" size="sm" bind:checked={site.enabled} onCheckedChange={changed} />
                  <label for="site-{host}" class="truncate">{host}</label>
                  <select
                    aria-label="Format for {host}"
                    class="border-input bg-background ml-auto h-7 rounded-md border px-2 text-xs"
                    bind:value={site.format}
                    onchange={changed}
                  >
                    {#each formatOptions(site.format) as f (f.id)}<option value={f.id}>{f.label}</option>{/each}
                  </select>
                  <Button size="icon-sm" variant="ghost" aria-label="Remove {host}" onclick={() => removeSite(host)}><TrashIcon /></Button>
                </div>
              {/each}
            </div>
            <div class="flex items-center gap-2">
              <Input placeholder="example.com" bind:value={newHost} class="flex-1" />
              <select aria-label="Format" class="border-input bg-background h-8 rounded-md border px-2 text-xs" bind:value={newFormat}>
                {#each formats as f (f.id)}<option value={f.id}>{f.label}</option>{/each}
              </select>
              <Button size="sm" variant="secondary" onclick={addSite}><PlusIcon data-icon="inline-start" />Add</Button>
            </div>
            <p class="text-muted-foreground text-xs">The format is what the text in a site's editors is written in. In GitHub's and GitLab's file editors, the file's own extension decides: a <code>.rst</code> file is checked as reStructuredText.</p>
          {/if}
        </div>
      </aside>
    </div>

    <footer class="bg-muted/40 text-muted-foreground flex h-6 shrink-0 items-center gap-4 border-t px-3 text-xs tabular-nums select-none">
      <span>{settings.packages.length} package{settings.packages.length === 1 ? "" : "s"}</span>
      <Separator orientation="vertical" class="h-3" />
      <span>{Object.values(settings.sites).filter((s) => s.enabled).length} sites on</span>
      <span class="hidden sm:inline">edits apply live · <kbd class="font-mono">{isMac ? "⌘" : "Ctrl+"}S</kbd> saves</span>
      <div class="flex-1"></div>
      {#if saveState === "saving"}<span>saving…</span>{:else if saveState === "unsaved"}<span class="text-sev-warn">unsaved</span>{:else}<span>saved</span>{/if}
    </footer>
  {/if}
</div>
