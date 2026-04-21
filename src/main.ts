import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { loadAppConfig } from "./config";

void loadAppConfig().then((config) => {
  const app = createApp(App, { initialConfig: config });
  app.mount("#app");
});
