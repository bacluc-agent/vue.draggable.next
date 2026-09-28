import { createApp, h } from "vue";
import Draggable from "vuedraggable";

createApp({
  render: () => h(Draggable, { itemKey: "id", modelValue: [{ id: 1 }] }),
}).mount("#app");
