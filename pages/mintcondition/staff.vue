<template>
  <div class="max-w-5xl mx-auto">
    <div class="flex items-center justify-between gap-3 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold">Staff &amp; roles</h1>
        <p class="text-[13px] text-ink-muted dark:text-zinc-400 mt-0.5">
          Who can get in, and what each of them can do.
        </p>
      </div>
      <button
        v-if="can('staff.manage')"
        class="px-3.5 py-2 rounded-lg text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink"
        @click="openCreate"
      >
        Add staff
      </button>
    </div>

    <div class="flex gap-1 mb-5 border-b border-black/[0.06] dark:border-white/[0.08]">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="px-3.5 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors"
        :class="
          tab === t.key
            ? 'border-pokemon-red text-ink dark:text-white'
            : 'border-transparent text-ink-soft dark:text-zinc-500 hover:text-ink dark:hover:text-zinc-300'
        "
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <p v-if="error" class="mb-4 text-[13px] text-red-600 dark:text-red-400">{{ error }}</p>
    <p v-if="loading" class="text-[13px] text-ink-soft dark:text-zinc-500">Loading…</p>

    <!-- ── People ──────────────────────────────────────────────── -->
    <div v-else-if="tab === 'people'" class="space-y-3">
      <div
        v-for="s in staff"
        :key="s.staffId"
        class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-4"
      >
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <p class="font-bold text-sm flex items-center gap-2 flex-wrap">
              <span class="font-mono tracking-wide">{{ s.staffId }}</span>
              <span class="text-ink-muted dark:text-zinc-400 font-semibold">{{ s.name }}</span>
              <span
                class="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-black/[0.05] dark:bg-white/[0.08]"
                >{{ s.roleName }}</span
              >
              <span
                v-if="!s.active"
                class="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                >Deactivated</span
              >
              <span
                v-else-if="s.lockedUntil && s.lockedUntil > now"
                class="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                >Locked out</span
              >
              <span
                v-if="s.mustChangePassword"
                class="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                >Password not set by them</span
              >
            </p>
            <p class="text-[12px] text-ink-soft dark:text-zinc-500 mt-1">
              {{ s.email || "no email" }} ·
              {{ s.lastLoginAt ? `last in ${fmt(s.lastLoginAt)}` : "never signed in" }}
            </p>
          </div>

          <div v-if="can('staff.manage')" class="flex gap-1.5 shrink-0">
            <button class="btn-ghost" @click="openEdit(s)">Edit</button>
            <button
              v-if="s.lockedUntil && s.lockedUntil > now"
              class="btn-ghost"
              :disabled="busy === s.staffId"
              @click="unlock(s)"
            >
              Unlock
            </button>
            <button
              class="btn-ghost"
              :disabled="busy === s.staffId || s.staffId === me?.staffId"
              @click="toggleActive(s)"
            >
              {{ s.active ? "Deactivate" : "Reactivate" }}
            </button>
          </div>
        </div>

        <p
          v-if="s.deniedPermissions?.length || s.extraPermissions?.length"
          class="mt-2.5 text-[11px] text-ink-soft dark:text-zinc-500"
        >
          <span v-if="s.extraPermissions?.length">
            Extra: {{ s.extraPermissions.map(labelFor).join(", ") }}.
          </span>
          <span v-if="s.deniedPermissions?.length">
            Denied: {{ s.deniedPermissions.map(labelFor).join(", ") }}.
          </span>
        </p>
      </div>

      <p v-if="!staff.length" class="text-[13px] text-ink-soft dark:text-zinc-500">
        No staff accounts yet. You're signed in through the marketplace admin
        bridge — create the first account, then use that from now on.
      </p>
    </div>

    <!-- ── Roles ───────────────────────────────────────────────── -->
    <div v-else class="space-y-3">
      <div
        v-for="r in roles"
        :key="r.id"
        class="surface rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-4"
      >
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <p class="font-bold text-sm flex items-center gap-2">
              {{ r.name }}
              <span
                class="font-mono px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/[0.05] dark:bg-white/[0.08]"
                >{{ r.prefix }}····</span
              >
              <span v-if="r.builtin" class="text-[10px] uppercase tracking-wide text-ink-soft dark:text-zinc-600">Built-in</span>
            </p>
            <p class="text-[12px] text-ink-muted dark:text-zinc-400 mt-1 max-w-lg leading-relaxed">
              {{ r.description }}
            </p>
            <p class="text-[11px] text-ink-soft dark:text-zinc-500 mt-1.5">
              {{ r.memberCount }} {{ r.memberCount === 1 ? "person" : "people" }} ·
              {{ r.permissions.includes("*") ? "every permission" : `${r.permissions.length} permission(s)` }}
            </p>
          </div>
          <button v-if="can('roles.manage')" class="btn-ghost shrink-0" @click="openRole(r)">
            Permissions
          </button>
        </div>
      </div>

      <button
        v-if="can('roles.manage')"
        class="w-full py-2.5 rounded-xl border border-dashed border-black/[0.12] dark:border-white/[0.14] text-sm font-semibold text-ink-muted dark:text-zinc-400"
        @click="openRole(null)"
      >
        New role
      </button>
    </div>

    <!-- ── Staff dialog ────────────────────────────────────────── -->
    <div
      v-if="dialog"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
      @click.self="dialog = null"
    >
      <div
        class="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-canvas dark:bg-canvas-inverse p-5"
      >
        <h2 class="text-lg font-bold mb-4">
          {{ dialog.mode === "create" ? "Add staff" : `Edit ${dialog.staffId}` }}
        </h2>

        <div class="space-y-3.5">
          <div>
            <label class="block text-xs font-semibold mb-1.5">Name</label>
            <input v-model="form.name" type="text" class="inp" />
          </div>
          <div>
            <label class="block text-xs font-semibold mb-1.5">Email (optional)</label>
            <input v-model="form.email" type="email" class="inp" />
          </div>
          <div>
            <label class="block text-xs font-semibold mb-1.5">Role</label>
            <select v-model="form.roleId" class="inp">
              <option v-for="r in roles" :key="r.id" :value="r.id">
                {{ r.name }} — IDs start {{ r.prefix }}
              </option>
            </select>
            <p
              v-if="dialog.mode === 'create'"
              class="mt-1.5 text-[11px] text-ink-soft dark:text-zinc-500"
            >
              The ID is issued automatically from the role's prefix.
            </p>
          </div>
          <div>
            <label class="block text-xs font-semibold mb-1.5">
              {{ dialog.mode === "create" ? "Password" : "Reset password (leave blank to keep)" }}
            </label>
            <input v-model="form.password" type="text" autocomplete="off" class="inp font-mono" />
            <p class="mt-1.5 text-[11px] text-ink-soft dark:text-zinc-500">
              At least {{ MIN_PASSWORD_LENGTH }} characters. They'll be asked to
              change it — you know this one.
            </p>
          </div>

          <details v-if="dialog.mode === 'edit'" class="pt-1">
            <summary class="text-xs font-semibold cursor-pointer text-ink-muted dark:text-zinc-400">
              Per-person exceptions
            </summary>
            <p class="mt-2 text-[11px] leading-relaxed text-ink-soft dark:text-zinc-500">
              Use sparingly — a role everyone understands beats a dozen
              one-off exceptions. A denial wins over the role, including an
              admin's blanket access.
            </p>
            <div class="mt-3 space-y-2">
              <div v-for="p in catalogue" :key="p.key" class="flex items-start gap-2 text-[12px]">
                <span class="flex-1 min-w-0">
                  {{ p.label }}
                  <span class="text-ink-soft dark:text-zinc-600">{{ p.group }}</span>
                </span>
                <label class="flex items-center gap-1 shrink-0">
                  <input type="checkbox" :value="p.key" v-model="form.extraPermissions" />
                  <span class="text-emerald-600 dark:text-emerald-400">grant</span>
                </label>
                <label class="flex items-center gap-1 shrink-0">
                  <input type="checkbox" :value="p.key" v-model="form.deniedPermissions" />
                  <span class="text-red-600 dark:text-red-400">deny</span>
                </label>
              </div>
            </div>
          </details>

          <p v-if="dialogError" class="text-[13px] text-red-600 dark:text-red-400">
            {{ dialogError }}
          </p>
          <p v-if="createdId" class="text-[13px] text-emerald-600 dark:text-emerald-400">
            Created <strong class="font-mono">{{ createdId }}</strong>. Give them
            that ID and the password — the password isn't recoverable from here.
          </p>

          <div class="flex gap-2 pt-1">
            <button class="btn-ghost flex-1" @click="dialog = null">Close</button>
            <button
              class="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink disabled:opacity-50"
              :disabled="saving"
              @click="save"
            >
              {{ saving ? "Saving…" : "Save" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Role dialog ─────────────────────────────────────────── -->
    <div
      v-if="roleDialog"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
      @click.self="roleDialog = null"
    >
      <div
        class="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-canvas dark:bg-canvas-inverse p-5"
      >
        <h2 class="text-lg font-bold mb-4">
          {{ roleForm.existing ? `${roleForm.name} permissions` : "New role" }}
        </h2>

        <div class="space-y-3.5">
          <div v-if="!roleForm.existing" class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold mb-1.5">Name</label>
              <input v-model="roleForm.name" type="text" class="inp" placeholder="Warehouse" />
            </div>
            <div>
              <label class="block text-xs font-semibold mb-1.5">ID prefix</label>
              <input
                v-model="roleForm.prefix"
                type="text"
                maxlength="3"
                class="inp font-mono uppercase"
                placeholder="WH"
              />
            </div>
          </div>
          <div v-if="!roleForm.existing">
            <label class="block text-xs font-semibold mb-1.5">Description</label>
            <input v-model="roleForm.description" type="text" class="inp" />
          </div>

          <p
            v-if="roleForm.wildcard"
            class="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed text-amber-800 dark:text-amber-300"
          >
            This role holds every permission, including ones added in future
            releases. Unticking anything below converts it to a fixed list.
          </p>

          <div v-for="(perms, group) in grouped" :key="group">
            <p class="text-[11px] font-bold uppercase tracking-wide text-ink-soft dark:text-zinc-500 mb-1.5">
              {{ group }}
            </p>
            <label
              v-for="p in perms"
              :key="p.key"
              class="flex items-start gap-2.5 py-1.5 cursor-pointer"
            >
              <input
                type="checkbox"
                class="mt-0.5"
                :checked="rolePermChecked(p.key)"
                @change="toggleRolePerm(p.key, ($event.target as HTMLInputElement).checked)"
              />
              <span class="min-w-0">
                <span class="text-[13px] font-semibold">
                  {{ p.label }}
                  <span v-if="p.dangerous" class="ml-1 text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">sensitive</span>
                </span>
                <span class="block text-[11px] leading-relaxed text-ink-soft dark:text-zinc-500">
                  {{ p.description }}
                </span>
              </span>
            </label>
          </div>

          <p v-if="dialogError" class="text-[13px] text-red-600 dark:text-red-400">
            {{ dialogError }}
          </p>

          <div class="flex gap-2 pt-1">
            <button class="btn-ghost flex-1" @click="roleDialog = null">Close</button>
            <button
              class="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-ink text-white dark:bg-white dark:text-ink disabled:opacity-50"
              :disabled="saving"
              @click="saveRole"
            >
              {{ saving ? "Saving…" : "Save" }}
            </button>
          </div>
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

<style scoped>
.inp {
  @apply w-full px-3 py-2.5 rounded-lg border border-black/[0.08] dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-sm;
}
.btn-ghost {
  @apply px-3 py-2 rounded-lg text-sm font-semibold border border-black/[0.08] dark:border-white/[0.10] text-ink-muted dark:text-zinc-300 disabled:opacity-40;
}
</style>
