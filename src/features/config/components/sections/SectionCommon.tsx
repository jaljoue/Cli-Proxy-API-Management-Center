import { useTranslation } from 'react-i18next';
import { CONFIG_TAB_ICONS } from '../../constants';
import type { ConfigSectionProps } from '../../types';
import { getValidationMessage } from '../blocks/shared';
import { SectionCard } from '../SectionCard';
import { FieldGrid, FieldStack } from '../fields/FieldPrimitives';
import {
  ApiKeysField,
  DebugToggle,
  HostField,
  LoggingToFileToggle,
  PortField,
  ProxyUrlField,
  QuotaSwitchPreviewModelToggle,
  QuotaSwitchProjectToggle,
} from '../fields/sharedFields';

const Icon = CONFIG_TAB_ICONS.common;

/**
 * "Common" tab: the 8 high-frequency fields from the old simple mode, as an alias view (takes
 * no section number). Render source is shared with the canonical sections (sharedFields), and
 * the data is the same single useVisualConfig state.
 */
export function SectionCommon({
  values,
  validationErrors,
  disabled,
  animateIn,
  onChange,
}: ConfigSectionProps) {
  const { t } = useTranslation();
  const portError = getValidationMessage(t, validationErrors?.port);

  return (
    <SectionCard
      icon={<Icon size={16} />}
      title={t('config_management.visual.sections.common.title')}
      description={t('config_management.visual.sections.common.description')}
      animateIn={animateIn}
    >
      <FieldStack>
        <FieldGrid>
          <HostField
            values={values}
            disabled={disabled}
            onChange={onChange}
          />
          <PortField
            values={values}
            disabled={disabled}
            onChange={onChange}
            error={portError}
          />
          <ProxyUrlField values={values} disabled={disabled} onChange={onChange} />
        </FieldGrid>

        <ApiKeysField values={values} disabled={disabled} onChange={onChange} />

        <FieldGrid>
          <DebugToggle values={values} disabled={disabled} onChange={onChange} />
          <LoggingToFileToggle values={values} disabled={disabled} onChange={onChange} />
          <QuotaSwitchProjectToggle values={values} disabled={disabled} onChange={onChange} />
          <QuotaSwitchPreviewModelToggle values={values} disabled={disabled} onChange={onChange} />
        </FieldGrid>
      </FieldStack>
    </SectionCard>
  );
}
