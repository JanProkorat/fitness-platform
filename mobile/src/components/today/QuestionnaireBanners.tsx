import { usePendingQuestionnaires } from '@/hooks/usePendingQuestionnaires';

import { fillableForms } from './pendingForms';
import { QuestionnaireBanner } from './QuestionnaireBanner';

/** A banner per questionnaire waiting on the client, oldest first; nothing while loading or on failure. */
export function QuestionnaireBanners() {
  const { data } = usePendingQuestionnaires();
  return (
    <>
      {fillableForms(data?.questionnaires).map((item) => (
        <QuestionnaireBanner
          key={`${item.linkPublicId}:${item.responsePublicId ?? item.questionnairePublicId ?? ''}`}
          item={item}
        />
      ))}
    </>
  );
}
