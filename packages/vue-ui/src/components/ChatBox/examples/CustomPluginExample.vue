<script setup lang="ts">
import { ref } from "vue";
import ChatBox from "../ChatBox.vue";
import { MockAIPlugin } from "../plugins/MockAIPlugin";

// 创建自定义响应生成器
const customResponseGenerator = (input: string): string => {
  const lowerInput = input.toLowerCase();

  if (lowerInput.includes("你好") || lowerInput.includes("hello")) {
    return "你好！很高兴见到你！有什么我可以帮助你的吗？";
  }

  if (lowerInput.includes("天气")) {
    return "今天天气不错，阳光明媚，适合外出活动！🌞";
  }

  if (lowerInput.includes("时间")) {
    const now = new Date();
    return `现在是 ${now.toLocaleString("zh-CN")}`;
  }

  if (lowerInput.includes("笑话")) {
    const jokes = [
      "为什么程序员总是分不清万圣节和圣诞节？因为 Oct 31 == Dec 25！",
      "什么是最好的调试工具？console.log() 😄",
      "Bug：一个藏在代码里的小精灵，只有在上线后才会出现！",
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  return `你说："${input}"，这是一个自定义的响应！我可以根据关键词回复不同的内容。试试说"你好"、"天气"、"时间"或"笑话"！`;
};

// 创建插件实例
const plugin = new MockAIPlugin();

// 自定义插件配置
const pluginConfig = {
  delay: 800,
  streaming: true,
  responseGenerator: customResponseGenerator,
};

const selectedMode = ref<"normal" | "custom">("custom");

const currentPlugin = ref(plugin);
const currentConfig = ref(pluginConfig);

// 切换模式
const switchMode = (mode: "normal" | "custom") => {
  selectedMode.value = mode;

  if (mode === "custom") {
    currentConfig.value = {
      delay: 800,
      streaming: true,
      responseGenerator: customResponseGenerator,
    };
  } else {
    currentConfig.value = {
      delay: 1000,
      streaming: true,
    };
  }
};
</script>

<template>
  <div class="example-container">
    <div class="header">
      <h1>自定义插件示例</h1>
      <p>演示如何自定义插件的响应逻辑</p>

      <div class="mode-switch">
        <button
          :class="['mode-btn', { active: selectedMode === 'custom' }]"
          @click="switchMode('custom')"
        >
          自定义模式
        </button>
        <button
          :class="['mode-btn', { active: selectedMode === 'normal' }]"
          @click="switchMode('normal')"
        >
          普通模式
        </button>
      </div>
    </div>

    <div class="chat-container">
      <ChatBox
        :plugin="currentPlugin"
        :plugin-config="currentConfig"
        :key="selectedMode"
      />
    </div>

    <div class="tips">
      <h3>💡 自定义模式提示</h3>
      <ul>
        <li>试试输入 "你好" 或 "hello"</li>
        <li>询问 "天气"</li>
        <li>询问 "时间"</li>
        <li>让它讲个 "笑话"</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.example-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 24px;
}

.header h1 {
  font-size: 28px;
  margin-bottom: 8px;
  color: #333;
}

.header p {
  color: #666;
  margin-bottom: 16px;
}

.mode-switch {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 16px;
}

.mode-btn {
  padding: 8px 24px;
  background: #f5f5f5;
  border: 2px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.mode-btn:hover {
  background: #e0e0e0;
}

.mode-btn.active {
  background: #1976d2;
  color: white;
  border-color: #1976d2;
}

.chat-container {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.tips {
  margin-top: 24px;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 8px;
  border-left: 4px solid #1976d2;
}

.tips h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #333;
}

.tips ul {
  margin: 0;
  padding-left: 20px;
  color: #666;
}

.tips li {
  margin: 4px 0;
}
</style>
