<script setup lang="ts">
import { ref, shallowRef, computed } from "vue";
import type { AppConfig } from "./config";
import { SipLab, type RegistrationStatus } from "./sip/sipLab";
import type { CallUiState } from "./sip/types";
import LoginPanel from "./components/LoginPanel.vue";
import DashboardPanel from "./components/DashboardPanel.vue";

const props = defineProps<{ initialConfig: AppConfig }>();

const config = ref<AppConfig>(props.initialConfig);

const registrationStatus = ref<RegistrationStatus>("idle");
const registrationError = ref("");
const callState = ref<CallUiState>("idle");
const remoteLabel = ref("");
const callDirection = ref<"in" | "out">("out");
const logLines = ref<string[]>([]);
const instanceId = ref<string | null>(null);

/** Shown after login: same form as entered (user@domain). */
const sipIdentity = ref("");
const displayName = ref("");

const lab = shallowRef<SipLab | null>(null);

const isRegistered = computed(
  () => registrationStatus.value === "registered",
);

function pushLog(line: string): void {
  const t = new Date().toISOString().slice(11, 23);
  logLines.value = [...logLines.value.slice(-80), `[${t}] ${line}`];
}

function createLab(): SipLab {
  return new SipLab(config.value, {
    onRegistrationStatus: (s) => {
      registrationStatus.value = s;
    },
    onRegistrationError: (m) => {
      registrationError.value = m;
    },
    onCallState: (s) => {
      callState.value = s;
    },
    onSessionInfo: (info) => {
      remoteLabel.value = info.remote;
      callDirection.value = info.direction;
    },
    onLog: pushLog,
    remoteAudioElementId: "sip-remote-audio",
  });
}

function onLogin(payload: {
  sipAddress: string;
  password: string;
  displayName: string;
}): void {
  registrationError.value = "";
  sipIdentity.value = payload.sipAddress.trim();
  displayName.value = payload.displayName;
  lab.value?.unregister();
  const client = createLab();
  lab.value = client;
  instanceId.value = null;
  client.register(
    payload.sipAddress,
    payload.password,
    payload.displayName || undefined,
  );
  instanceId.value = client.getInstanceId();
}

function logout(): void {
  lab.value?.unregister();
  lab.value = null;
  instanceId.value = null;
  registrationError.value = "";
  remoteLabel.value = "";
  callState.value = "idle";
}

function onDial(target: string): void {
  lab.value?.dial(target);
}

function answer(): void {
  lab.value?.answer();
}

function reject(): void {
  lab.value?.reject();
}

function hangup(): void {
  lab.value?.hangup();
}

function hold(): void {
  lab.value?.hold();
}

function unhold(): void {
  lab.value?.unhold();
}

function setAutoAnswer(v: boolean): void {
  lab.value?.setAutoAnswer(v);
}
</script>

<template>
  <h1>WebRTC SIP lab</h1>
  <p class="meta">WSS <code>{{ config.sipWssUri }}</code></p>

  <LoginPanel
    v-if="!isRegistered"
    :busy="registrationStatus === 'registering'"
    :error="registrationError"
    @submit="onLogin"
  />

  <DashboardPanel
    v-else
    :sip-identity="sipIdentity"
    :display-name="displayName"
    :instance-id="instanceId"
    :call-state="callState"
    :remote="remoteLabel"
    :direction="callDirection"
    @logout="logout"
    @dial="onDial"
    @answer="answer"
    @reject="reject"
    @hangup="hangup"
    @hold="hold"
    @unhold="unhold"
    @auto-answer="setAutoAnswer"
  />

  <section class="panel" style="margin-top: 1rem">
    <label>Log</label>
    <div class="log">{{ logLines.join("\n") || "…" }}</div>
  </section>
</template>
