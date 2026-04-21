<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  busy: boolean;
  error: string;
}>();

const emit = defineEmits<{
  submit: [payload: { sipAddress: string; password: string; displayName: string }];
}>();

const sipAddress = ref("");
const password = ref("");
const displayName = ref("");

function onSubmit(): void {
  emit("submit", {
    sipAddress: sipAddress.value.trim(),
    password: password.value,
    displayName: displayName.value.trim(),
  });
}
</script>

<template>
  <section class="panel">
    <h2 style="margin: 0 0 1rem; font-size: 1rem">Register (digest)</h2>
    <p v-if="error" class="err">{{ error }}</p>
    <form @submit.prevent="onSubmit">
      <label>SIP address (user@domain)</label>
      <input
        v-model="sipAddress"
        type="text"
        autocomplete="username"
        placeholder="alice@voip.example.com"
        required
      />
      <label>Password</label>
      <input
        v-model="password"
        type="password"
        autocomplete="current-password"
        required
      />
      <label>Display name (optional)</label>
      <input v-model="displayName" type="text" />
      <button type="submit" :disabled="busy">
        {{ busy ? "Registering…" : "Register" }}
      </button>
    </form>
  </section>
</template>
