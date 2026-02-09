import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Block } from "@/contexts/BlockEditorContext";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getBlockDimensions = (block: Block) => {
  if (block.subtype === 'System Prompt') {
    return { width: 192, height: 128 };
  }
  return { width: 144, height: 80 };
};
