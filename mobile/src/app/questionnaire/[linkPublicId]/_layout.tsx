import { useState } from 'react';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { classifyQuestionnaireError } from '@/api/questionnaires';
import { FillProvider } from '@/components/questionnaire/FillContext';
import { FlowState } from '@/components/questionnaire/FlowState';
import { useClientQuestionnaire } from '@/hooks/useQuestionnaireFill';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A route param that is a single, well-formed id; anything else is treated as missing. */
const readId = (value: string | string[] | undefined): string | null => {
  const single = Array.isArray(value) ? value[0] : value;
  return single !== undefined && UUID.test(single) ? single : null;
};

/**
 * The questionnaire flow: loads the form once and keeps the typed answers for every screen below.
 * Route: /questionnaire/[linkPublicId]?responsePublicId= (the optional id opens one open response).
 */
export default function QuestionnaireLayout() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ linkPublicId?: string; responsePublicId?: string }>();
  // Read once: the params must not change under a half-filled form.
  const [target] = useState(() => ({
    link: readId(params.linkPublicId),
    response: readId(params.responsePublicId),
  }));
  const query = useClientQuestionnaire(target.link, target.response);
  const close = () => navigation.goBack();

  if (target.link === null) {
    return (
      <FlowState
        kind="message"
        title={t('questionnaireFill.errors.unavailable.title')}
        body={t('questionnaireFill.errors.unavailable.body')}
        onClose={close}
      />
    );
  }

  if (query.isPending) {
    return <FlowState kind="loading" onClose={close} />;
  }

  if (query.isError) {
    const failure = classifyQuestionnaireError(query.error);
    if (failure === 'unavailable' || failure === 'alreadySent') {
      return (
        <FlowState
          kind="message"
          title={t(`questionnaireFill.errors.${failure}.title`)}
          body={t(`questionnaireFill.errors.${failure}.body`)}
          onClose={close}
        />
      );
    }
    return (
      <FlowState
        kind="retry"
        title={t('questionnaireFill.errors.loadTitle')}
        body={t(failure === 'network' ? 'questionnaireFill.errors.network' : 'questionnaireFill.errors.load')}
        onRetry={() => void query.refetch()}
        onClose={close}
      />
    );
  }

  if (query.data.existingResponseStatus?.toLowerCase() === 'submitted') {
    return (
      <FlowState
        kind="message"
        title={t('questionnaireFill.errors.alreadySent.title')}
        body={t('questionnaireFill.errors.alreadySent.body')}
        onClose={close}
      />
    );
  }

  return (
    <FillProvider linkPublicId={target.link} data={query.data}>
      <Stack screenOptions={{ headerShown: false }} />
    </FillProvider>
  );
}
