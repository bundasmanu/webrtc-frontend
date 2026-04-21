<script setup lang="ts">
import { ref, computed } from "vue";
import type { CallUiState } from "@/sip/types";

const props = defineProps<{
  /** e.g. user@domain as entered at login */
  sipIdentity: string;
  displayName: string;
  instanceId: string | null;
  callState: CallUiState;
  remote: string;
  direction: "in" | "out";
}>();

const emit = defineEmits<{
  logout: [];
  dial: [target: string];
  answer: [];
  reject: [];
  hangup: [];
  hold: [];
  unhold: [];
  "auto-answer": [value: boolean];
}>();

const dialTarget = ref("");
const autoAnswer = ref(false);

const statusLabel = computed(() => {
  const m: Record<CallUiState, string> = {
    idle: "Idle",
    ringing_in: "Incoming call",
    ringing_out: "Ringing…",
    active: "In call",
    held: "On hold",
  };
  return m[props.callState];
});

const canDial = computed(() => props.callState === "idle");

const incomingRinging = computed(
  () => props.callState === "ringing_in" && props.direction === "in",
);

const inCall = computed(() =>
  ["active", "held", "ringing_out"].includes(props.callState),
);

function onAutoAnswerChange(): void {
  emit("auto-answer", autoAnswer.value);
}
</script>

<template>
  <section class="panel">
    <div class="row" style="justify-content: space-between">
      <div>
        <span class="badge">Registered</span>
        <strong style="margin-left: 0.5rem">{{ sipIdentity }}</strong>
        <span v-if="displayName" class="meta" style="margin-left: 0.35rem"
          >({{ displayName }})</span
        >
      </div>
      <button type="button" class="secondary" @click="emit('logout')">
        Log out
      </button>
    </div>
    <p v-if="instanceId" class="meta">
      <code>+sip.instance</code>:
      <code style="word-break: break-all">{{ instanceId }}</code>
    </p>

    <p><strong>Call</strong> — {{ statusLabel }}</p>
    <p v-if="remote" class="meta">Remote: {{ remote }}</p>

    <audio id="sip-remote-audio" autoplay playsinline />

    <div class="row">
      <input
        v-model="dialTarget"
        type="text"
        placeholder="Destination (e.g. 1001 or sip:bob@other-domain.com)"
        :disabled="!canDial"
        style="flex: 1; margin: 0"
      />
      <button type="button" :disabled="!canDial || !dialTarget.trim()" @click="emit('dial', dialTarget)">
        Call
      </button>
    </div>

    <div v-if="incomingRinging" class="row">
      <button type="button" @click="emit('answer')">Accept</button>
      <button type="button" class="danger" @click="emit('reject')">Reject</button>
    </div>

    <div v-if="inCall && !incomingRinging" class="row">
      <button type="button" class="danger" @click="emit('hangup')">Hang up</button>
      <button
        type="button"
        class="secondary"
        :disabled="callState === 'held'"
        @click="emit('hold')"
      >
        Hold
      </button>
      <button
        type="button"
        class="secondary"
        :disabled="callState !== 'held'"
        @click="emit('unhold')"
      >
        Unhold
      </button>
    </div>

    <div class="row" style="margin-top: 0.5rem">
      <label style="display: flex; align-items: center; gap: 0.35rem; margin: 0">
        <input
          v-model="autoAnswer"
          type="checkbox"
          @change="onAutoAnswerChange"
        />
        Auto-answer incoming
      </label>
    </div>
  </section>
</template>
