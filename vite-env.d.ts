/// <reference types="vite/client" />

interface BuildInfo {
  commit: string;
  buildTime: string;
}

declare const __BUILD_INFO__: BuildInfo;
