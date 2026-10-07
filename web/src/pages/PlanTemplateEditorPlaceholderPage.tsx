import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/library/PageHeader';
import { usePlanTemplate } from '@/hooks/usePlanTemplatesQueries';

/** Stand-in for the plan template editor: shows the template's name until the editor screen replaces it. */
export default function PlanTemplateEditorPlaceholderPage() {
  const { t } = useTranslation();
  const { templateId } = useParams();
  const templateQuery = usePlanTemplate(templateId);

  return (
    <div className="flex h-full flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="w-fit gap-1.5 px-0 font-semibold text-ink">
        <Link to="/plan-templates">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('planTemplates.editorPlaceholder.back')}
        </Link>
      </Button>

      {templateQuery.isPending && <Skeleton className="h-16 w-80" />}

      {templateQuery.isError && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-body text-muted-foreground">{t('common.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void templateQuery.refetch()}>
            {t('planTemplates.retry')}
          </Button>
        </div>
      )}

      {templateQuery.data && (
        <>
          <PageHeader eyebrow={t('planTemplates.title')} title={templateQuery.data.name ?? ''} />
          <p className="text-body text-muted-foreground">{t('planTemplates.editorPlaceholder.body')}</p>
        </>
      )}
    </div>
  );
}
