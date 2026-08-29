export type Cleanup = () => void;

export type CursorType = "none" | "cat" | "bunny" | "bear";

export interface Mascot {
  name: string;
  role: string;
  color: string;
  ground: string;
  fact: string;
  svg: string;
}

declare global {
  interface Window {
    __plushCursorCleanup?: Cleanup;
  }
}
