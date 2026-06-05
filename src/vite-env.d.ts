/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string
  readonly VITE_VISION_API_KEY: string
  readonly VITE_VISION_MODEL: string
  readonly VITE_VISION_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
