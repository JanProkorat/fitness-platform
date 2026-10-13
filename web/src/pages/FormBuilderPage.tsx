import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import FormBuilder from '@/components/forms/builder/FormBuilder';
import { useTrainerQuestionnaire } from '@/hooks/useQuestionnaireQueries';
import { getErrorStatus } from '@/lib/api-errors';

function BackLink() {
  const { t } = useTranslation();
  return (
    <Button asChild variant="ghost" size="sm" className="w-fit gap-1.5 px-0 font-semibold text-ink">
      <Link to="/forms">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('forms.title')}
      </Link>
    </Button>
  );
}

/** The form builder page: loads one form and hosts the builder. */
export default function FormBuilderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const formQuery = useTrainerQuestionnaire(id);

  if (formQuery.isPending) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-full w-full rounded-2xl" />
      </div>
    );
  }

  if (formQuery.isError) {
    const status = getErrorStatus(formQuery.error);
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <BackLink />
        {status === 404 ? (
          <div className="flex flex-col items-start gap-1">
            <p className="text-copy font-bold text-ink">{t('forms.builder.notFound.title')}</p>
            <p className="text-body text-muted-foreground">{t('forms.builder.notFound.body')}</p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-body text-muted-foreground">{t('forms.builder.loadError')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void formQuery.refetch()}>
              {t('forms.retry')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return <FormBuilder key={formQuery.data.publicId} initial={formQuery.data} onBack={() => navigate('/forms')} />;
}
