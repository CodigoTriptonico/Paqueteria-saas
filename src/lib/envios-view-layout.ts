export {
  DEFAULT_VIEW_LAYOUT as DEFAULT_ENVIOS_VIEW_LAYOUT,
  LEGACY_ENVIOS_VIEW_LAYOUT_STORAGE_KEY as ENVIOS_VIEW_LAYOUT_STORAGE_KEY,
  VIEW_LAYOUT_STORAGE_KEY,
  type ViewLayout as EnviosViewLayout,
  parseViewLayout as parseEnviosViewLayout,
  readViewLayout as readEnviosViewLayout,
  toggleViewLayout as toggleEnviosViewLayout,
  viewLayoutAriaLabel as enviosViewLayoutAriaLabel,
  viewLayoutToggleLabel as enviosViewLayoutToggleLabel,
  writeViewLayout as writeEnviosViewLayout,
} from "@/lib/view-layout";
