import type { VisualConfigValidationErrors, VisualConfigValues } from '@/types/visualConfig';

/** Uniform signature for section components: form values controlled by useVisualConfig +
 * patch-style onChange. */
export type ConfigSectionProps = {
  values: VisualConfigValues;
  validationErrors?: VisualConfigValidationErrors;
  disabled: boolean;
  /** true only for the first-load entrance (captured on page mount); tab switches do not replay. */
  animateIn?: boolean;
  onChange: (patch: Partial<VisualConfigValues>) => void;
};
