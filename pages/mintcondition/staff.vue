<template>
  <div class="mc-page">
    <div class="mc-page-head">
      <div>
        <p class="mc-eyebrow mb-1">Admin</p>
        <h1 class="mc-h1">Staff and roles</h1>
        <p class="mc-meta mt-1">
          <template v-if="!loading && staff.length">
            {{ activeCount }} active {{ activeCount === 1 ? "account" : "accounts" }} in {{ roles.length }} {{ roles.length === 1 ? "role" : "roles" }}.
          </template>
          <template v-else>Who can get in, and what each of them can do.</template>
        </p>
      </div>
      <button v-if="can('staff.manage') && tab === 'people'" class="mc-btn mc-btn-primary" @click="openCreate">
        Add staff
      </button>
      <button v-else-if="can('roles.manage') && tab === 'roles'" class="mc-btn mc-btn-primary" @click="openRole(null)">
        New role
      </button>
    </div>

    <div class="mc-tabs mb-5" role="tablist" aria-label="Staff">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        role="tab"
        :aria-selected="tab === t.key"
        @click="tab = t.key"
      >
        {{ t.label }}<span class="mc-tab-count">{{ t.key === "people" ? staff.length : roles.length }}</span>
      </button>
    </div>

    <p v-if="error" class="mc-callout mb-4" data-tone="bad" role="alert">{{ error }}</p>

    <div v-if="loading" class="grid gap-2" aria-busy="true" aria-label="Loading">
      <div class="mc-skel h-[72px]" />
      <div class="mc-skel h-[72px]" />
    </div>

    <!-- ── People ──────────────────────────────────────────────── -->
    <template v-else-if="tab === 'people'">
      <p v-if="!staff.length" class="mc-card mc-empty">
        No staff accounts yet. You're signed in through the marketplace admin
        bridge. Create the first account, then use that from now on.
      </p>
      <ul v-else class="mc-card mc-list">
        <li v-for="s in sortedStaff" :key="s.staffId" class="mc-item" :class="!s.active ? 'opacity-60' : ''">
          <div class="mc-item-head">
            <div>
              <p class="mc-list-title flex items-center gap-2 flex-wrap">
                <span>{{ s.name }}</span>
                <span class="mc-mono mc-ink-3 font-normal">{{ s.staffId }}</span>
              </p>
              <p class="mc-small mt-0.5">
                {{ s.roleName }} · {{ s.email || "no email" }} ·
                {{ s.lastLoginAt ? `last in ${fmt(s.lastLoginAt)}` : "never signed in" }}
              </p>
              <p v-if="s.extraPermissions?.length || s.deniedPermissions?.length" class="mc-small mt-1">
                <span v-if="s.extraPermissions?.length">Extra: {{ s.extraPermissions.map(labelFor).join(", ") }}. </span>
                <span v-if="s.deniedPermissions?.length">Denied: {{ s.deniedPermissions.map(labelFor).join(", ") }}.</span>
              </p>
              <div v-if="flags(s).length" class="flex gap-1.5 flex-wrap mt-2">
                <span v-for="f in flags(s)" :key="f.text" class="mc-tag">
                  <span class="mc-dot" :data-tone="f.tone" aria-hidden="true" />{{ f.text }}
                </span>
              </div>
            </div>

            <div v-if="can('staff.manage')" class="flex gap-2 shrink-0">
              <button
                v-if="s.lockedUntil && s.lockedUntil > now"
                class="mc-btn mc-btn-sm"
                :disabled="busy === s.staffId"
                @click="unlock(s)"
              >
                Unlock
              </button>
              <button class="mc-btn mc-btn-sm" @click="openEdit(s)">Edit</button>
              <button
                class="mc-btn mc-btn-sm mc-btn-ghost"
                :class="s.active ? 'mc-btn-danger' : ''"
                :disabled="busy === s.staffId || s.staffId === me?.staffId"
                @click="toggleActive(s)"
              >
                {{ s.active ? "Deactivate" : "Reactivate" }}
              </button>
            </div>
          </div>
        </li>
      </ul>
    </template>

    <!-- ── Roles ───────────────────────────────────────────────── -->
    <ul v-else class="mc-card mc-list">
      <li v-for="r in roles" :key="r.id" class="mc-item">
        <div class="mc-item-head">
          <div>
            <p class="mc-list-title flex items-center gap-2 flex-wrap">
              {{ r.name }}
              <span class="mc-mono mc-ink-3 font-normal">{{ r.prefix }}····</span>
              <span v-if="r.builtin" class="mc-tag">Built-in</span>
            </p>
            <p class="mc-meta mt-1 max-w-[34rem]">{{ r.description }}</p>
            <p class="mc-small mt-1">
              {{ r.memberCount }} {{ r.memberCount === 1 ? "person" : "people" }} ·
              {{ r.permissions.includes("*") ? "every permission" : `${r.permissions.length} ${r.permissions.length === 1 ? "permission" : "permissions"}` }}
            </p>
          </div>
          <button v-if="can('roles.manage')" class="mc-btn mc-btn-sm shrink-0" @click="openRole(r)">
            Permissions
          </button>
        </div>
      </li>
    </ul>

    <!-- ── Staff dialog ────────────────────────────────────────── -->
    <div v-if="dialog" class="mc-overlay" @click.self="dialog = null">
      <div class="mc-modal" role="dialog" aria-modal="true" aria-labelledby="mc-staff-title">
        <div class="mc-modal-head flex items-center justify-between gap-3">
          <h2 id="mc-staff-title" class="mc-h2">
            {{ dialog.mode === "create" ? "Add staff" : `Edit ${dialog.staffId}` }}
          </h2>
          <button class="mc-btn mc-btn-ghost mc-btn-icon" aria-label="Close" @click="dialog = null">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="mc-modal-body grid gap-4">
          <label class="mc-field">
            <span>Name</span>
            <input v-model="form.name" type="text" class="mc-input" />
          </label>
          <label class="mc-field">
            <span>Email (optional)</span>
            <input v-model="form.email" type="email" class="mc-input" />
          </label>
          <label class="mc-field">
            <span>Role</span>
            <select v-model="form.roleId" class="mc-input">
              <option v-for="r in roles" :key="r.id" :value="r.id">
                {{ r.name }}: IDs start {{ r.prefix }}
              </option>
            </select>
            <span v-if="dialog.mode === 'create'" class="mc-small">
              The ID is issued automatically from the role's prefix.
            </span>
          </label>
          <label class="mc-field">
            <span>{{ dialog.mode === "create" ? "Password" : "Reset password (leave blank to keep)" }}</span>
            <input v-model="form.password" type="text" autocomplete="off" class="mc-input mc-mono" />
            <span class="mc-small">
              At least {{ MIN_PASSWORD_LENGTH }} characters. They'll be asked to
              change it, because you know this one.
            </span>
          </label>

          <details v-if="dialog.mode === 'edit'">
            <summary class="mc-label cursor-pointer">Per-person exceptions</summary>
            <p class="mt-2 mc-small">
              Use sparingly: a role everyone understands beats a dozen
              one-off exceptions. A denial wins over the role, including an
              admin's blanket access.
            </p>
            <div class="mt-3 grid gap-2">
              <div v-for="p in catalogue" :key="p.key" class="flex items-start gap-3 text-[13px]">
                <span class="flex-1 min-w-0">
                  {{ p.label }}
                  <span class="mc-ink-3">{{ p.group }}</span>
                </span>
                <label class="flex items-center gap-1.5 shrink-0 mc-meta">
                  <input type="checkbox" :value="p.key" v-model="form.extraPermissions" /> grant
                </label>
                <label class="flex items-center gap-1.5 shrink-0 mc-meta">
                  <input type="checkbox" :value="p.key" v-model="form.deniedPermissions" /> deny
                </label>
              </div>
            </div>
          </details>

          <p v-if="dialogError" class="mc-callout" data-tone="bad" role="alert">{{ dialogError }}</p>
          <p v-if="createdId" class="mc-callout" data-tone="good">
            Created <strong class="mc-mono">{{ createdId }}</strong>. Give them
            that ID and the password. The password isn't recoverable from here.
          </p>
        </div>

        <div class="mc-modal-foot">
          <button class="mc-btn mc-btn-ghost" @click="dialog = null">Close</button>
          <button class="mc-btn mc-btn-primary" :disabled="saving" @click="save">
            {{ saving ? "Saving…" : "Save" }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Role dialog ─────────────────────────────────────────── -->
    <div v-if="roleDialog" class="mc-overlay" @click.self="roleDialog = false">
      <div class="mc-modal" role="dialog" aria-modal="true" aria-labelledby="mc-role-title">
        <div class="mc-modal-head flex items-center justify-between gap-3">
          <h2 id="mc-role-title" class="mc-h2">
            {{ roleForm.existing ? `${roleForm.name} permissions` : "New role" }}
          </h2>
          <button class="mc-btn mc-btn-ghost mc-btn-icon" aria-label="Close" @click="roleDialog = false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="mc-modal-body grid gap-4">
          <div v-if="!roleForm.existing" class="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
            <label class="mc-field">
              <span>Name</span>
              <input v-model="roleForm.name" type="text" class="mc-input" placeholder="Warehouse" />
            </label>
            <label class="mc-field">
              <span>ID prefix</span>
              <input v-model="roleForm.prefix" type="text" maxlength="3" class="mc-input mc-mono uppercase" placeholder="WH" />
            </label>
          </div>
          <label v-if="!roleForm.existing" class="mc-field">
            <span>Description</span>
            <input v-model="roleForm.description" type="text" class="mc-input" />
          </label>

          <p v-if="roleForm.wildcard" class="mc-callout">
            This role holds every permission, including ones added in future
            releases. Unticking anything below converts it to a fixed list.
          </p>

          <fieldset v-for="(perms, group) in grouped" :key="group" class="grid gap-1">
            <legend class="mc-eyebrow mb-1">{{ group }}</legend>
            <label v-for="p in perms" :key="p.key" class="flex items-start gap-2.5 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                class="mt-0.5 shrink-0"
                :checked="rolePermChecked(p.key)"
                @change="toggleRolePerm(p.key, ($event.target as HTMLInputElement).checked)"
              />
              <span class="min-w-0">
                <span class="text-[13.5px] font-[550]">
                  {{ p.label }}
                  <span v-if="p.dangerous" class="mc-tag ml-1 !h-5">
                    <span class="mc-dot" data-tone="bad" aria-hidden="true" />sensitive
                  </span>
                </span>
                <span class="block mc-small">{{ p.description }}</span>
              </span>
            </label>
          </fieldset>

          <p v-if="dialogError" class="mc-callout" data-tone="bad" role="alert">{{ dialogError }}</p>
        </div>

        <div class="mc-modal-foot">
          <button class="mc-btn mc-btn-ghost" @click="roleDialog = false">Close</button>
          <button class="mc-btn mc-btn-primary" :disabled="saving" @click="saveRole">
            {{ saving ? "Saving…" : "Save" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ALL_PERMISSIONS,
  MIN_PASSWORD_LENGTH,
  PERMISSION_GROUPS,
  PERMISSIONS,
} from "~/shared/staff";
import type { PermissionDef } from "~/shared/staff";

definePageMeta({ layout: "admin", middleware: "mintcondition" });
useHead({ title: "Staff — Mint Condition" });

const { me, can } = useStaffAuth();
const { mcFetch } = useMcFetch();

const tabs = [
  { key: "people" as const, label: "People" },
  { key: "roles" as const, label: "Roles" },
];
const tab = ref<"people" | "roles">("people");

const staff = ref<any[]>([]);
const roles = ref<any[]>([]);
const catalogue = ref<PermissionDef[]>(PERMISSIONS);
const grouped = computed(() => PERMISSION_GROUPS);
const loading = ref(true);
const error = ref("");
const busy = ref("");
const now = Date.now();

const activeCount = computed(() => staff.value.filter((s) => s.active).length);

// Accounts that need someone first (locked out, password not theirs yet),
// deactivated ones last.
const flags = (s: any) => {
  const out: { text: string; tone?: "bad" | "warn" | "info" }[] = [];
  if (!s.active) out.push({ text: "Deactivated" });
  else if (s.lockedUntil && s.lockedUntil > now) out.push({ text: "Locked out", tone: "bad" });
  if (s.mustChangePassword && s.active) out.push({ text: "Still on the password you gave them", tone: "warn" });
  return out;
};
const rank = (s: any) =>
  !s.active ? 3 : s.lockedUntil && s.lockedUntil > now ? 0 : s.mustChangePassword ? 1 : 2;
const sortedStaff = computed(() => [...staff.value].sort((a, b) => rank(a) - rank(b)));

const labelFor = (key: string) =>
  PERMISSIONS.find((p) => p.key === key)?.label ?? key;

const fmt = (ms: number) =>
  new Date(ms).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    const [s, r] = await Promise.all([
      mcFetch<any>("/api/mc/staff"),
      mcFetch<any>("/api/mc/roles"),
    ]);
    staff.value = s.staff;
    roles.value = r.roles;
    catalogue.value = r.catalogue;
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't load staff.";
  } finally {
    loading.value = false;
  }
};
onMounted(load);

// ── Staff dialog ──────────────────────────────────────────────────
const dialog = ref<{ mode: "create" | "edit"; staffId?: string } | null>(null);
const dialogError = ref("");
const createdId = ref("");
const saving = ref(false);
const form = reactive({
  name: "",
  email: "",
  roleId: "staff",
  password: "",
  extraPermissions: [] as string[],
  deniedPermissions: [] as string[],
});

const openCreate = () => {
  Object.assign(form, {
    name: "",
    email: "",
    roleId: roles.value[0]?.id ?? "staff",
    password: "",
    extraPermissions: [],
    deniedPermissions: [],
  });
  dialogError.value = "";
  createdId.value = "";
  dialog.value = { mode: "create" };
};

const openEdit = (s: any) => {
  Object.assign(form, {
    name: s.name,
    email: s.email ?? "",
    roleId: s.roleId,
    password: "",
    extraPermissions: [...(s.extraPermissions ?? [])],
    deniedPermissions: [...(s.deniedPermissions ?? [])],
  });
  dialogError.value = "";
  createdId.value = "";
  dialog.value = { mode: "edit", staffId: s.staffId };
};

const save = async () => {
  saving.value = true;
  dialogError.value = "";
  try {
    if (dialog.value?.mode === "create") {
      const res = await mcFetch<{ staffId: string }>("/api/mc/staff/create", {
        method: "POST",
        body: { name: form.name, email: form.email, roleId: form.roleId, password: form.password },
      });
      createdId.value = res.staffId;
    } else {
      await mcFetch("/api/mc/staff/update", {
        method: "POST",
        body: {
          staffId: dialog.value?.staffId,
          name: form.name,
          email: form.email,
          roleId: form.roleId,
          ...(form.password ? { password: form.password } : {}),
          extraPermissions: form.extraPermissions,
          deniedPermissions: form.deniedPermissions,
        },
      });
      dialog.value = null;
    }
    await load();
  } catch (e: any) {
    dialogError.value = e?.data?.message || e?.message || "Couldn't save.";
  } finally {
    saving.value = false;
  }
};

const unlock = async (s: any) => {
  busy.value = s.staffId;
  try {
    await mcFetch("/api/mc/staff/update", {
      method: "POST",
      body: { staffId: s.staffId, unlock: true },
    });
    await load();
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't unlock them.";
  } finally {
    busy.value = "";
  }
};

const toggleActive = async (s: any) => {
  busy.value = s.staffId;
  try {
    await mcFetch("/api/mc/staff/update", {
      method: "POST",
      body: { staffId: s.staffId, active: !s.active },
    });
    await load();
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Couldn't change that.";
  } finally {
    busy.value = "";
  }
};

// ── Role dialog ───────────────────────────────────────────────────
const roleDialog = ref(false);
const roleForm = reactive({
  existing: false,
  id: "",
  name: "",
  prefix: "",
  description: "",
  permissions: [] as string[],
  wildcard: false,
});

const openRole = (r: any | null) => {
  dialogError.value = "";
  Object.assign(roleForm, {
    existing: !!r,
    id: r?.id ?? "",
    name: r?.name ?? "",
    prefix: r?.prefix ?? "",
    description: r?.description ?? "",
    permissions: [...(r?.permissions ?? [])],
    wildcard: !!r?.permissions?.includes(ALL_PERMISSIONS),
  });
  roleDialog.value = true;
};

// A wildcard role shows every box ticked. Unticking one has to expand the
// wildcard into a concrete list first, or the change would appear to save and
// then do nothing.
const rolePermChecked = (key: string) =>
  roleForm.wildcard || roleForm.permissions.includes(key);

const toggleRolePerm = (key: string, checked: boolean) => {
  if (roleForm.wildcard) {
    roleForm.permissions = PERMISSIONS.map((p) => p.key);
    roleForm.wildcard = false;
  }
  roleForm.permissions = checked
    ? [...new Set([...roleForm.permissions, key])]
    : roleForm.permissions.filter((k) => k !== key);
};

const saveRole = async () => {
  saving.value = true;
  dialogError.value = "";
  try {
    await mcFetch("/api/mc/roles/upsert", {
      method: "POST",
      body: {
        id: roleForm.existing ? roleForm.id : roleForm.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
        name: roleForm.name,
        prefix: roleForm.prefix,
        description: roleForm.description,
        permissions: roleForm.wildcard ? [ALL_PERMISSIONS] : roleForm.permissions,
      },
    });
    roleDialog.value = false;
    await load();
  } catch (e: any) {
    dialogError.value = e?.data?.message || e?.message || "Couldn't save the role.";
  } finally {
    saving.value = false;
  }
};
</script>
