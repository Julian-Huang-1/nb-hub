export type Message = {
  id: string;
  content: string;
  timestamp: number;
};
export type Status = "idle" | "loading" | "error" | "success" | "streaming";
