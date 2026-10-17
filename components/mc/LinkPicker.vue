<template>
  <!-- Where a banner goes when tapped. Pages inside TCGo only: common pages
       from a list, a listing/auction/profile from its ID or a pasted link, a
       microsite, or a typed path. -->
  <div class="space-y-2">
    <label class="block text-xs font-semibold text-ink dark:text-white" :for="selectId">Link</label>
    <select :id="selectId" v-model="mode" class="mc-inp" @change="onMode">
      <option value="none">No link</option>
      <optgroup label="Pages">
        <option v-for="p in LINK_PRESETS" :key="p.path" :value="`preset:${p.path}`">{{ p.label }}</option>
      </optgroup>
      <optgroup label="Something specific">
        <option v-for="k in LINK_KINDS" :key="k.key" :value="`kind:${k.key}`">{{ k.label }}</option>
        <option value="microsite">A microsite</option>
        <option value="custom">Another page (type the path)</option>
      </optgroup>
    </select>

    <input
      v-if="kind"
      v-model="idInput"
      type="text"
      autocapitalize="off"
      autocomplete="off"
      spellcheck="false"
      class="mc-inp"
      :placeholder="`Paste the ${kind.label.replace(/^An? /, '').toLowerCase()} link or ID`"
      @input="emitKind"
    />

    <template v-else-if="mode === 'microsite'">
      <select v-model="micrositeSlug" class="mc-inp" @change="emit('update:modelValue', micrositeSlug ? micrositePath(micrositeSlug) : '')">
        <option value="" disabled>{{ microsites.length ? "Choose a microsite" : "No microsites yet" }}</option>
        <option v-for="m in microsites" :key="m.slug" :value="m.slug">
          {{ m.title }}{{ m.published ? "" : " (draft)" }}
        </option>
      </select>
      <p v-if="pickedDraft" class="text-[11px] text-amber-700 dark:text-amber-400">
        This microsite is a draft, so the banner leads to "page not found" until it's published.
      </p>
    </template>

    <input
      v-else-if="mode === 'custom'"
      v-model="customInput"
      type="text"
      autocapitalize="off"
      autocomplete="off"
      spellcheck="false"
      class="mc-inp font-mono"
      placeholder="/cards/abc123 or a tcgo.shop link"
      @input="emitCustom"
    />

    <p v-if="invalid" class="text-xs text-red-600 dark:text-red-400">
      Links can only go to pages inside TCGo.
    </p>
    <p v-else-if="modelValue" class="truncate font-mono text-[11px] text-ink-soft dark:text-zinc-500">
      Opens {{ modelValue }}
    </p>
  </div>
</template>

<script setup lang="ts">
import {
  APP_HOSTS,
  LINK_KINDS,
  LINK_PRESETS,
  idFromInput,
  micrositePath,
  normaliseLinkPath,
} from "~/shared/site-content";

const props = defineProps<{
  modelValue: string;
  microsites: { slug: string; title: string; published: boolean }[];
}>();
const emit = defineEmits<{ "update:modelValue": [value: string]; invalid: [value: boolean] }>();

const selectId = useId();
const hosts = () => [...APP_HOSTS, ...(import.meta.client ? [window.location.host] : [])];

// Work out which option the saved path belongs to.
const modeFor = (path: string): string => {
  if (!path) return "none";
  if (LINK_PRESETS.some((p) => p.path === path)) return `preset:${path}`;
  if (/^\/p\/[a-z0-9-]+$/.test(path)) return "microsite";
  const k = LINK_KINDS.find((k) => path.startsWith(k.prefix) && /^[A-Za-z0-9_-]+$/.test(path.slice(k.prefix.length)));
  return k ? `kind:${k.key}` : "custom";
};

const mode = ref(modeFor(props.modelValue));
const kind = computed(() => LINK_KINDS.find((k) => mode.value === `kind:${k.key}`));
const idInput = ref(kind.value ? props.modelValue.slice(kind.value.prefix.length) : "");
const micrositeSlug = ref(mode.value === "microsite" ? props.modelValue.slice(3) : "");
const customInput = ref(mode.value === "custom" ? props.modelValue : "");
const invalid = ref(false);

const pickedDraft = computed(
  () => !!micrositeSlug.value && props.microsites.some((m) => m.slug === micrositeSlug.value && !m.published),
);

watch(invalid, (v) => emit("invalid", v));

// The parent remounts this (with :key) when it loads different content, so the
// starting option is worked out once from the saved path.
const onMode = () => {
  invalid.value = false;
  if (mode.value === "none") emit("update:modelValue", "");
  else if (mode.value.startsWith("preset:")) emit("update:modelValue", mode.value.slice(7));
  else if (kind.value) emitKind();
  else if (mode.value === "microsite") emit("update:modelValue", micrositeSlug.value ? micrositePath(micrositeSlug.value) : "");
  else emitCustom();
};

const emitKind = () => {
  if (!kind.value) return;
  const raw = idInput.value.trim();
  const id = idFromInput(raw);
  invalid.value = !!raw && !id;
  emit("update:modelValue", id ? kind.value.prefix + id : "");
};

const emitCustom = () => {
  const path = normaliseLinkPath(customInput.value, hosts());
  invalid.value = path === null;
  emit("update:modelValue", path ?? "");
};
</script>
