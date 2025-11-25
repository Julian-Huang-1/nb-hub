<template>
  <button
    :class="[
      'nb-button',
      `nb-button--${type}`,
      `nb-button--${size}`,
      {
        'is-disabled': disabled,
        'is-loading': loading,
        'is-round': round,
        'is-circle': circle,
      },
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="nb-button__loading">
      <svg class="loading-icon" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="3"
          fill="none"
          stroke-dasharray="31.4 31.4"
        />
      </svg>
    </span>
    <span class="nb-button__content">
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
interface ButtonProps {
  type?: "primary" | "success" | "warning" | "danger" | "info" | "default";
  size?: "large" | "default" | "small";
  disabled?: boolean;
  loading?: boolean;
  round?: boolean;
  circle?: boolean;
}

interface ButtonEmits {
  (e: "click", event: MouseEvent): void;
}

const props = withDefaults(defineProps<ButtonProps>(), {
  type: "default",
  size: "default",
  disabled: false,
  loading: false,
  round: false,
  circle: false,
});

const emit = defineEmits<ButtonEmits>();

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit("click", event);
  }
};
</script>

<style scoped>
.nb-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  white-space: nowrap;
  outline: none;
}

/* Types */
.nb-button--default {
  background-color: #ffffff;
  border-color: #d1d5db;
  color: #374151;
}

.nb-button--default:hover:not(.is-disabled) {
  border-color: #3b82f6;
  color: #3b82f6;
}

.nb-button--primary {
  background-color: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
}

.nb-button--primary:hover:not(.is-disabled) {
  background-color: #2563eb;
  border-color: #2563eb;
}

.nb-button--success {
  background-color: #10b981;
  border-color: #10b981;
  color: #ffffff;
}

.nb-button--success:hover:not(.is-disabled) {
  background-color: #059669;
  border-color: #059669;
}

.nb-button--warning {
  background-color: #f59e0b;
  border-color: #f59e0b;
  color: #ffffff;
}

.nb-button--warning:hover:not(.is-disabled) {
  background-color: #d97706;
  border-color: #d97706;
}

.nb-button--danger {
  background-color: #ef4444;
  border-color: #ef4444;
  color: #ffffff;
}

.nb-button--danger:hover:not(.is-disabled) {
  background-color: #dc2626;
  border-color: #dc2626;
}

.nb-button--info {
  background-color: #6b7280;
  border-color: #6b7280;
  color: #ffffff;
}

.nb-button--info:hover:not(.is-disabled) {
  background-color: #4b5563;
  border-color: #4b5563;
}

/* Sizes */
.nb-button--large {
  padding: 12px 20px;
  font-size: 16px;
}

.nb-button--small {
  padding: 4px 12px;
  font-size: 12px;
}

/* States */
.nb-button.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.nb-button.is-loading {
  cursor: not-allowed;
  opacity: 0.8;
}

.nb-button.is-round {
  border-radius: 20px;
}

.nb-button.is-circle {
  border-radius: 50%;
  padding: 8px;
}

/* Loading */
.nb-button__loading {
  display: inline-flex;
  align-items: center;
}

.loading-icon {
  width: 14px;
  height: 14px;
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.nb-button__content {
  display: inline-flex;
  align-items: center;
}
</style>
