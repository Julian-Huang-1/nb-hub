<!-- components/common/file-uploader.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import type { ImageContent } from "../../base/ai-provider/aiProvider.interface";

export type UploadFile = ImageContent | FileContent;

export interface FileContent {
  type: "file";
  file: {
    filename: string;
    file_data: string;
  };
}

interface Props {
  // 接受的文件类型
  accept?: string;
  // 是否支持多选
  multiple?: boolean;
  // 最大文件数量
  maxFiles?: number;
  // 最大文件大小（字节）
  maxSize?: number;
  // 是否自动生成图片预览
  autoPreview?: boolean;
  // 是否禁用
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  accept: "*",
  multiple: true,
  maxFiles: 10,
  maxSize: 10 * 1024 * 1024, // 10MB
  autoPreview: true,
  disabled: false,
});

const emit = defineEmits<{
  change: [files: UploadFile[]];
  add: [files: UploadFile[]];
  remove: [file: UploadFile];
  error: [error: { type: string; message: string; file?: File }];
}>();

// 文件列表
const files = ref<UploadFile[]>([]);
// 文件输入引用
const inputRef = ref<HTMLInputElement | null>(null);
// 是否正在拖拽
const isDragging = ref(false);

// 计算属性
const fileCount = computed(() => files.value.length);
const canAddMore = computed(() => fileCount.value < props.maxFiles);
const totalSize = computed(() =>
  files.value.reduce((sum, file) => sum + file.size, 0)
);

/**
 * 验证文件
 */
const validateFile = (file: File): { valid: boolean; error?: string } => {
  // 检查文件大小
  if (file.size > props.maxSize) {
    return {
      valid: false,
      error: `文件 "${file.name}" 超过最大限制 ${formatFileSize(
        props.maxSize
      )}`,
    };
  }

  // 检查文件类型
  if (props.accept !== "*") {
    const acceptTypes = props.accept.split(",").map((t) => t.trim());
    const fileExt = `.${file.name.split(".").pop()?.toLowerCase()}`;
    const mimeType = file.type;

    const isAccepted = acceptTypes.some((accept) => {
      if (accept.startsWith(".")) {
        return fileExt === accept.toLowerCase();
      }
      if (accept.endsWith("/*")) {
        const prefix = accept.replace("/*", "");
        return mimeType.startsWith(prefix);
      }
      return mimeType === accept;
    });

    if (!isAccepted) {
      return {
        valid: false,
        error: `文件类型不支持。支持的类型：${props.accept}`,
      };
    }
  }

  // 检查文件数量
  if (!props.multiple && files.value.length > 0) {
    return {
      valid: false,
      error: "只能上传一个文件",
    };
  }

  if (files.value.length >= props.maxFiles) {
    return {
      valid: false,
      error: `最多只能上传 ${props.maxFiles} 个文件`,
    };
  }

  return { valid: true };
};

/**
 * 读取文件为 DataURL（用于预览）
 */
const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * 创建上传文件对象
 */
const createUploadFile = async (file: File): Promise<UploadFile> => {
  let uploadFile: UploadFile;
  if (file.type.startsWith("image/")) {
    uploadFile = {
      type: "image_url",
      imageUrl: {
        url: "",
      },
    };
  } else {
    uploadFile = {
      type: "file",
      file: {
        filename: file.name,
        file_data: "",
      },
    };
  }

  // 如果是图片且启用了自动预览
  if (file.type.startsWith("image/")) {
    try {
      (uploadFile as ImageContent).imageUrl.url = await readFileAsDataURL(file);
    } catch (error) {
      console.warn("Failed to generate preview:", error);
    }
  } else {
    (uploadFile as FileContent).file.file_data = await readFileAsDataURL(file);
  }

  return uploadFile;
};

/**
 * 添加文件
 */
const addFiles = async (fileList: FileList | File[]) => {
  if (props.disabled) return;

  const filesToAdd: UploadFile[] = [];
  const errors: { type: string; message: string; file?: File }[] = [];

  for (const file of Array.from(fileList)) {
    const validation = validateFile(file);

    if (!validation.valid) {
      errors.push({
        type: "validation",
        message: validation.error!,
        file,
      });
      continue;
    }

    const uploadFile = await createUploadFile(file);
    filesToAdd.push(uploadFile);
  }

  // 添加文件
  if (filesToAdd.length > 0) {
    if (!props.multiple) {
      files.value = filesToAdd;
    } else {
      files.value.push(...filesToAdd);
    }

    emit("add", filesToAdd);
    emit("change", files.value);
  }

  // 发出错误
  errors.forEach((error) => emit("error", error));
};

/**
 * 移除文件
 */
const removeFile = (id: string) => {
  const index = files.value.findIndex((f) => f.id === id);
  if (index > -1) {
    const [removed] = files.value.splice(index, 1);
    emit("remove", removed);
    emit("change", files.value);
  }
};

/**
 * 清空所有文件
 */
const clear = () => {
  files.value = [];
  emit("change", files.value);
  if (inputRef.value) {
    inputRef.value.value = "";
  }
};

/**
 * 触发文件选择
 */
const openFilePicker = () => {
  if (!props.disabled) {
    inputRef.value?.click();
  }
};

/**
 * 处理文件选择
 */
const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    addFiles(input.files);
  }
  // 重置 input 以允许选择相同文件
  input.value = "";
};

/**
 * 处理拖拽进入
 */
const handleDragEnter = (event: DragEvent) => {
  event.preventDefault();
  if (!props.disabled) {
    isDragging.value = true;
  }
};

/**
 * 处理拖拽离开
 */
const handleDragLeave = (event: DragEvent) => {
  event.preventDefault();
  isDragging.value = false;
};

/**
 * 处理拖拽覆盖
 */
const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
};

/**
 * 处理文件拖放
 */
const handleDrop = (event: DragEvent) => {
  event.preventDefault();
  isDragging.value = false;

  if (props.disabled) return;

  const droppedFiles = event.dataTransfer?.files;
  if (droppedFiles && droppedFiles.length > 0) {
    addFiles(droppedFiles);
  }
};

/**
 * 处理粘贴事件
 */
const handlePaste = async (event: ClipboardEvent) => {
  if (props.disabled) return;

  const items = event.clipboardData?.items;
  if (!items) return;

  const pastedFiles: File[] = [];

  for (const item of Array.from(items)) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) {
        pastedFiles.push(file);
      }
    }
  }

  if (pastedFiles.length > 0) {
    event.preventDefault();
    addFiles(pastedFiles);
  }
};

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * 获取文件图标（基于类型）
 */
const getFileIcon = (file: UploadFile): string => {
  const type = file.type;
  if (type.startsWith("image/")) return "🖼️";
  if (type.startsWith("video/")) return "🎥";
  if (type.startsWith("audio/")) return "🎵";
  if (type.includes("pdf")) return "📄";
  if (type.includes("word") || type.includes("document")) return "📝";
  if (type.includes("excel") || type.includes("spreadsheet")) return "📊";
  if (
    type.includes("zip") ||
    type.includes("rar") ||
    type.includes("compressed")
  )
    return "📦";
  return "📎";
};

// 暴露方法给父组件
defineExpose({
  files,
  addFiles,
  removeFile,
  clear,
  openFilePicker,
});
</script>

<template>
  <input
    ref="inputRef"
    type="file"
    :accept="accept"
    :multiple="multiple"
    :disabled="disabled"
    @change="handleFileSelect"
  />
  <slot
    v-bind="{
      // 状态
      files,
      fileCount,
      canAddMore,
      totalSize,
      isDragging,
      disabled,

      // 方法
      openFilePicker,
      removeFile,
      clear,
      formatFileSize,
      getFileIcon,

      // 事件处理器
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handlePaste,

      // refs
      inputRef,
    }"
  >
  </slot>
</template>
