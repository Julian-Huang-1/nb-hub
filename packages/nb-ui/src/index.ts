import type { App } from "vue";
import Button from "./components/Button";

// 导出组件
export { Button };

// 导出类型
export * from "./components/Button/types";

// 安装函数
const components = [Button];

const install = (app: App) => {
  components.forEach((component) => {
    app.component(component.name || "NbButton", component);
  });
};

export default {
  install,
};
