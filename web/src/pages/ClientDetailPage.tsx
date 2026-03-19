import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getClientDashboard } from '@/api/nutrition-goals';

const humanize = (s: string) => s.replace(/([A-Z])/g, ' $1').trim();

function Tags({ value }: { value: string | undefined | null }) {
  if (!value) return <span className="text-xs text-muted">&mdash;</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {value.split(',').filter(Boolean).map((tag) => (
        <span key={tag} className="rounded bg-gold/10 px-2 py-0.5 text-xs text-gold">
          {tag.trim()}
        </span>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs text-muted">{label}</span>
      <p className="text-sm font-semibold">{value ?? <span className="text-muted">&mdash;</span>}</p>
    </div>
  );
}

export default function ClientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client-dashboard', id],
    queryFn: () => getClientDashboard(id!),
    enabled: !!id,
  });

  const clientName = client
    ? `${client.firstName} ${client.lastName}`
    : '...';

  const ob = client?.onboarding;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-border bg-[#111111] px-6 py-4">
        <Link
          to="/clients"
          className="font-heading text-xs font-semibold uppercase tracking-wide text-gold-dim transition-colors hover:text-gold"
        >
          &larr; {t('clients.backToClients')}
        </Link>
        <div className="h-4 w-px bg-border" />
        <div>
          <h1 className="text-lg font-bold">
            {isLoading ? t('common.loading') : clientName}
          </h1>
          <p className="text-xs text-muted">
            {client?.email}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted">
            {t('common.loading')}
          </div>
        ) : client ? (
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Overview heading */}
            <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-gold">
              {t('clients.overview')}
            </h2>

            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label={t('clients.compliance')}
                value={
                  client.compliancePercent != null
                    ? `${client.compliancePercent}%`
                    : t('clients.noData')
                }
              />
              <StatCard
                label={t('clients.streak')}
                value={
                  client.currentStreak != null
                    ? `${client.currentStreak}`
                    : '0'
                }
              />
              <StatCard
                label={t('clients.measurements')}
                value={`${client.totalMeasurements ?? 0}`}
              />
              <StatCard
                label={t('clients.photos')}
                value={`${client.totalProgressPhotos ?? 0}`}
              />
            </div>

            {ob ? (
              <>
                {/* Profile */}
                <SectionHeading>{t('clients.profile')}</SectionHeading>
                <div className="rounded-sm border border-border bg-surface p-5">
                  <div className="grid grid-cols-2 gap-4">
                    {client.dateOfBirth && (
                      <Field
                        label={t('clients.yearOfBirth')}
                        value={new Date(client.dateOfBirth).getFullYear()}
                      />
                    )}
                    {client.heightCm != null && (
                      <Field label={t('nutritionGoals.height')} value={`${client.heightCm} cm`} />
                    )}
                    {client.weightKg != null && (
                      <Field label={t('nutritionGoals.weight')} value={`${client.weightKg} kg`} />
                    )}
                    {ob.sex && (
                      <Field label={t('clients.sex')} value={humanize(ob.sex)} />
                    )}
                    {ob.targetWeightKg != null && (
                      <Field label={t('clients.targetWeight')} value={`${ob.targetWeightKg} kg`} />
                    )}
                    {ob.bodyType && (
                      <Field label={t('clients.bodyType')} value={humanize(ob.bodyType)} />
                    )}
                    <Field
                      label={t('clients.linkedSince')}
                      value={new Date(client.linkedAt).toLocaleDateString()}
                    />
                  </div>
                </div>

                {/* Goals & Lifestyle */}
                <SectionHeading>{t('clients.goalsLifestyle')}</SectionHeading>
                <div className="rounded-sm border border-border bg-surface p-5">
                  <div className="grid grid-cols-2 gap-4">
                    {ob.primaryGoal && (
                      <Field label={t('clients.primaryGoal')} value={humanize(ob.primaryGoal)} />
                    )}
                    {ob.timeHorizon && (
                      <Field label={t('clients.timeHorizon')} value={humanize(ob.timeHorizon)} />
                    )}
                    {ob.jobType && (
                      <Field label={t('clients.jobType')} value={humanize(ob.jobType)} />
                    )}
                    {ob.sleepHours != null && (
                      <Field label={t('clients.sleep')} value={`${ob.sleepHours} ${t('clients.hoursPerNight')}`} />
                    )}
                    {ob.stressLevel != null && (
                      <Field label={t('clients.stressLevel')} value={`${ob.stressLevel}/5`} />
                    )}
                  </div>
                </div>

                {/* Activity */}
                <SectionHeading>{t('clients.activity')}</SectionHeading>
                <div className="rounded-sm border border-border bg-surface p-5">
                  <div className="grid grid-cols-2 gap-4">
                    {ob.currentTrainingFrequency && (
                      <Field label={t('clients.currentTraining')} value={humanize(ob.currentTrainingFrequency)} />
                    )}
                    {ob.desiredTrainingFrequency && (
                      <Field label={t('clients.desiredTraining')} value={humanize(ob.desiredTrainingFrequency)} />
                    )}
                    {ob.fitnessRating != null && (
                      <Field label={t('clients.fitnessRating')} value={`${ob.fitnessRating}/10`} />
                    )}
                    <div>
                      <span className="text-xs text-muted">{t('clients.preferredActivities')}</span>
                      <div className="mt-1"><Tags value={ob.preferredActivities} /></div>
                    </div>
                    <div>
                      <span className="text-xs text-muted">{t('clients.injuries')}</span>
                      <div className="mt-1"><Tags value={ob.injuries} /></div>
                    </div>
                  </div>
                </div>

                {/* Nutrition */}
                <SectionHeading>{t('clients.nutrition')}</SectionHeading>
                <div className="rounded-sm border border-border bg-surface p-5">
                  <div className="grid grid-cols-2 gap-4">
                    {ob.mealsPerDay && (
                      <Field label={t('clients.mealsPerDay')} value={humanize(ob.mealsPerDay)} />
                    )}
                    {ob.dietaryStyle && (
                      <Field label={t('clients.dietaryStyle')} value={humanize(ob.dietaryStyle)} />
                    )}
                    <div>
                      <span className="text-xs text-muted">{t('clients.allergies')}</span>
                      <div className="mt-1"><Tags value={ob.allergies} /></div>
                    </div>
                  </div>
                </div>

                {/* Motivation */}
                <SectionHeading>{t('clients.motivation')}</SectionHeading>
                <div className="rounded-sm border border-border bg-surface p-5">
                  <div className="grid grid-cols-2 gap-4">
                    {ob.planExperience && (
                      <Field label={t('clients.planExperience')} value={humanize(ob.planExperience)} />
                    )}
                    {ob.primaryMotivation && (
                      <Field label={t('clients.primaryMotivation')} value={humanize(ob.primaryMotivation)} />
                    )}
                    <div>
                      <span className="text-xs text-muted">{t('clients.pastBlockers')}</span>
                      <div className="mt-1"><Tags value={ob.pastBlockers} /></div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* No onboarding data — show basic profile info */}
                <div className="rounded-sm border border-border bg-surface p-5">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {client.heightCm != null && (
                      <Field label={t('nutritionGoals.height')} value={`${client.heightCm} cm`} />
                    )}
                    {client.weightKg != null && (
                      <Field label={t('nutritionGoals.weight')} value={`${client.weightKg} kg`} />
                    )}
                    {client.dateOfBirth && (
                      <Field
                        label={t('clients.yearOfBirth')}
                        value={new Date(client.dateOfBirth).getFullYear()}
                      />
                    )}
                    <Field
                      label={t('clients.linkedSince')}
                      value={new Date(client.linkedAt).toLocaleDateString()}
                    />
                  </div>
                  {client.goals && (
                    <div className="mt-4">
                      <span className="text-xs text-muted">
                        {t('nutritionGoals.goal')}
                      </span>
                      <p className="text-sm">{client.goals}</p>
                    </div>
                  )}
                </div>
                <p className="text-center text-sm text-muted">
                  {t('clients.onboardingNotCompleted')}
                </p>
              </>
            )}

            {/* Latest measurement */}
            {client.latestMeasurement && (
              <div className="rounded-sm border border-border bg-surface p-5">
                <h3 className="mb-3 text-sm font-semibold text-text2">
                  {t('clients.measurements')}
                </h3>
                <div className="flex gap-6">
                  {client.latestMeasurement.weightKg != null && (
                    <div>
                      <span className="text-xs text-muted">
                        {t('clients.latestWeight')}
                      </span>
                      <p className="text-lg font-bold">
                        {client.latestMeasurement.weightKg} kg
                      </p>
                    </div>
                  )}
                  {client.latestMeasurement.bodyFatPercentage != null && (
                    <div>
                      <span className="text-xs text-muted">
                        {t('clients.bodyFat')}
                      </span>
                      <p className="text-lg font-bold">
                        {client.latestMeasurement.bodyFatPercentage}%
                      </p>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  {new Date(
                    client.latestMeasurement.measuredAt,
                  ).toLocaleDateString()}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <Link
                to={`/clients/${id}/nutrition-goals`}
                className="rounded-sm bg-gold px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
              >
                {t('clients.nutritionGoals')} &rarr;
              </Link>
              <button
                type="button"
                disabled
                className="rounded-sm bg-gold/30 px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black/40 cursor-not-allowed"
              >
                {t('clients.nutritionPlans')} &rarr;
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-gold">
      {children}
    </h2>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface p-4 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-text">{value}</p>
    </div>
  );
}
