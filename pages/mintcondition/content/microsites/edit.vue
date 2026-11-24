<template>
  <div class="mc-page"><div class="max-w-3xl">
    <NuxtLink
      to="/mintcondition/content/microsites"
      class="-ml-2 mb-2 inline-flex min-h-[44px] items-center gap-1 px-2 text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)]"
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      Microsites
    </NuxtLink>
    <h1 class="mc-h1 mb-5">{{ originalSlug ? form.title || "Edit page" : "New page" }}</h1>

    <div v-if="loading" class="flex justify-center py-16">
      <div class="mc-spin" aria-label="Loading" />
    </div>
    <p v-else-if="loadError" class="text-sm text-[var(--danger)]">{{ loadError }}</p>

    <div v-else class="space-y-5">
      <!-- Published -->
      <div class="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-[var(--ink)]">Published</p>
          <p class="text-xs text-[var(--ink-2)]">
            {{ form.published ? "Anyone with the link can open it." : "A draft: only staff can preview it." }}
          </p>
        </div>
        <McSwitch v-model="form.published" label="Published" />
      </div>

      <!-- Type -->
      <div>
        <p class="mb-1.5 text-xs font-semibold text-[var(--ink)]">Kind of page</p>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="t in TYPES"
            :key="t.key"
            type="button"
            class="rounded-xl border px-3 py-3 text-left transition-colors"
            :class="form.type === t.key ? 'border-ink bg-[var(--surface-2)]' : 'border-[var(--line)]'"
            :aria-pressed="form.type === t.key"
            @click="form.type = t.key"
          >
            <span class="block text-sm font-semibold text-[var(--ink)]">{{ t.label }}</span>
            <span class="mt-0.5 block text-micro leading-snug text-[var(--ink-2)]">{{ t.hint }}</span>
          </button>
        </div>
      </div>

      <div>
        <label class="mb-1.5 block text-xs font-semibold text-[var(--ink)]" for="ms-title">Title</label>
        <input id="ms-title" v-model="form.title" :maxlength="MICROSITE_TITLE_MAX" type="text" class="mc-inp" placeholder="Weekend auction drop" @input="onTitle" />
        <p v-if="form.type === 'image'" class="mt-1 text-micro text-[var(--ink-3)]">
          Not shown on the page; used for the browser tab and read aloud for the image.
        </p>
      </div>

      <div>
        <label class="mb-1.5 block text-xs font-semibold text-[var(--ink)]" for="ms-slug">Address</label>
        <div class="flex items-stretch overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <span class="flex items-center pl-3 font-mono text-sm text-[var(--ink-3)]">/p/</span>
          <input
            id="ms-slug"
            v-model="form.slug"
            type="text"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            class="min-w-0 flex-1 bg-transparent py-2.5 pr-3 font-mono text-base text-[var(--ink)] outline-none sm:text-sm"
            placeholder="weekend-drop"
            @input="onSlug"
          />
        </div>
        <p v-if="originalSlug && form.slug !== originalSlug" class="mt-1 text-micro text-[var(--ink-2)]">
          The old address /p/{{ originalSlug }} stops working, including any banner or shared link to it.
        </p>
      </div>

      <McImageField
        v-model="form.imageUrl"
        :label="form.type === 'image' ? 'Page image' : 'Banner image (optional)'"
        :hint="
          form.type === 'image'
            ? 'The whole page. Shown full width on phones; tall posters scroll. At least 1080 px wide.'
            : 'Across the top, never cropped: edge to edge on phones, in the text column on wider screens. A listing banner (3:1) or a 16:9 image both work; at least 1500 px wide.'
        "
      />

      <div v-if="form.type === 'article'">
        <label class="mb-1.5 block text-xs font-semibold text-[var(--ink)]" for="ms-body">Text</label>
        <textarea id="ms-body" v-model="form.body" rows="12" :maxlength="MICROSITE_BODY_MAX" class="mc-inp leading-relaxed" placeholder="Write the article here." />
        <p class="mt-1 text-micro leading-relaxed text-[var(--ink-3)]">
          A blank line starts a new paragraph. Start a line with <span class="font-mono"># </span> for a heading,
          <span class="font-mono">## </span> for a smaller one, and <span class="font-mono">- </span> for a bullet.
        </p>
      </div>

      <!-- Article preview: the text as it will read. -->
      <div v-if="form.type === 'article' && form.body.trim()" class="rounded-xl border border-[var(--line)] p-4">
        <p class="mb-2 text-xs font-semibold text-[var(--ink-3)]">Text preview</p>
        <p class="text-xl font-bold text-[var(--ink)]">{{ form.title }}</p>
        <ArticleBody :body="form.body" class="mt-3" />
      </div>

      <p v-if="error" class="text-sm text-[var(--danger)]">{{ error }}</p>

      <div class="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          class="mc-btn mc-btn-primary"
          :disabled="busy || (!!originalSlug && !dirty)"
          @click="save"
        >
          {{ busy ? "Saving…" : originalSlug ? "Save" : "Create page" }}
        </button>
        <a
          v-if="originalSlug"
          :href="`/p/${originalSlug}?preview`"
          target="_blank"
          rel="noopener"
          class="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--line)] px-4 text-sm font-semibold text-[var(--ink)]"
        >
          {{ saved?.published ? "Open page" : "Preview draft" }}
        </a>
        <button
          v-if="originalSlug && saved?.published"
          type="button"
          class="min-h-[44px] px-2 text-sm font-semibold text-[var(--ink-2)]"
          @click="copyLink"
        >
          {{ copied ? "Copied" : "Copy link" }}
        </button>
        <span v-if="justSaved" class="text-sm text-[var(--st-done)]">Saved</span>
        <button
          v-if="originalSlug"
          type="button"
          class="ml-auto min-h-[44px] px-2 text-sm font-semibold text-[var(--danger)]"
          :disabled="busy"
          @click="remove"
        >
          Delete
        </button>
      </div>
      <p v-if="dirty && originalSlug" class="text-micro text-[var(--ink-3)]">
        Unsaved changes. Preview shows the saved version.
      </p>
    </div>
  </div></div>
</template>

<script setup lang="ts">
import {
  BANNER_PLACEMENTS,
  BANNER_PLACEMENT_LABELS,
  MICROSITE_BODY_MAX,
  MICROSITE_TITLE_MAX,
  micrositePath,
  slugify,
  type Banner,
  type Microsite,
  type MicrositeType,
} from "~/shared/site-content";

definePageMeta({ layout: "admin", middleware: "mintcondition" });
useHead({ title: "Microsite — TCGo Admin" });

const TYPES: { key: MicrositeType; label: string; hint: string }[] = [
  { key: "image", label: "Image only", hint: "One uploaded image fills the page." },
  { key: "article", label: "Article", hint: "Banner image, title and text." },
];

const route = useRoute();
const router = useRouter();
const { mcFetch } = useMcFetch();

const blank = (): Microsite => ({ slug: "", type: "image", title: "", imageUrl: "", body: "", published: false });
const form = reactive<Microsite>(blank());
const saved = ref<Microsite | null>(null);
const originalSlug = ref("");
const loading = ref(true);
const loadError = ref("");
const error = ref("");
const busy = ref(false);
const justSaved = ref(false);
const copied = ref(false);
// A new page's address follows its title until someone edits the address.
const slugTouched = ref(false);

const FIELDS = ["slug", "type", "title", "imageUrl", "body", "published"] as const;
const dirty = computed(() => !saved.value || FIELDS.some((k) => form[k] !== saved.value![k]));

const take = (m: Microsite) => {
  saved.value = { ...blank(), ...m };
  Object.assign(form, saved.value);
  originalSlug.value = m.slug;
  slugTouched.value = true;
};

const onTitle = () => {
  if (!slugTouched.value) form.slug = slugify(form.title);
};
const onSlug = () => {
  slugTouched.value = true;
  form.slug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
};

const load = async () => {
  const slug = String(route.query.slug || "");
  loading.value = true;
  loadError.value = "";
  if (!slug) {
    Object.assign(form, blank());
    saved.value = null;
    originalSlug.value = "";
    slugTouched.value = false;
    loading.value = false;
    return;
  }
  try {
    take((await mcFetch<{ microsite: Microsite }>(`/api/mc/content/microsites?slug=${encodeURIComponent(slug)}`)).microsite);
  } catch (e: any) {
    loadError.value = e?.data?.message || e?.message || "Couldn't load this page.";
  } finally {
    loading.value = false;
  }
};

const save = async () => {
  busy.value = true;
  error.value = "";
  form.slug = form.slug.replace(/^-+|-+$/g, "");
  try {
    const res = await mcFetch<{ microsite: Microsite }>("/api/mc/content/microsite", {
      method: "POST",
      body: { ...form, originalSlug: originalSlug.value || undefined },
    });
    take(res.microsite);
    if (route.query.slug !== res.microsite.slug) {
      await router.replace({ query: { slug: res.microsite.slug } });
    }
    justSaved.value = true;
    setTimeout(() => (justSaved.value = false), 2000);
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't save the page.";
  } finally {
    busy.value = false;
  }
};

const remove = async () => {
  const slug = originalSlug.value;
  // Say which banners point here, since deleting leaves them on a dead link.
  let linked: string[] = [];
  try {
    const b = await mcFetch<{ banners: Record<string, Banner> }>("/api/mc/content/banners");
    linked = BANNER_PLACEMENTS.filter((p) =>
      (b.banners[p]?.slides ?? []).some((s) => s.linkPath === micrositePath(slug)),
    ).map(
      (p) => BANNER_PLACEMENT_LABELS[p],
    );
  } catch {
    // Not knowing shouldn't block a delete.
  }
  const warn = linked.length ? `\n\nA ${linked.join(" and ")} banner links here and will lead to "page not found".` : "";
  if (!confirm(`Delete /p/${slug}? This can't be undone.${warn}`)) return;
  busy.value = true;
  error.value = "";
  try {
    await mcFetch("/api/mc/content/microsite-delete", { method: "POST", body: { slug } });
    await navigateTo("/mintcondition/content/microsites");
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't delete the page.";
    busy.value = false;
  }
};

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/p/${originalSlug.value}`);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // Clipboard blocked: the Open page button still shows the address.
  }
};

watch(() => route.query.slug, (s) => {
  if (String(s || "") !== originalSlug.value) load();
});
onMounted(load);
</script>
