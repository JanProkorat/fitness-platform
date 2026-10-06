import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HeroMockup from '@/components/home/HeroMockup';
import { IconPeople, IconPlay } from '@/components/home/HomeIcons';
import { scrollToAnchor } from '@/components/home/smoothAnchor';

const STEPS = [
  { key: 'build', progress: 'w-full', bar: 'bg-ink' },
  { key: 'publish', progress: 'w-[55%]', bar: 'bg-marker' },
  { key: 'follow', progress: 'w-0', bar: 'bg-ink' },
  { key: 'see', progress: 'w-0', bar: 'bg-ink' },
] as const;

/** Home hero: headline, calls to action, product collage and the four-step strip. */
export default function HomeHero() {
  const { t } = useTranslation();

  return (
    <section className="@container relative min-w-0 px-4 pt-6 pb-12 sm:px-10 lg:px-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-19 bottom-0 -z-10 bg-no-repeat [background-image:radial-gradient(700px_520px_at_78%_30%,var(--gf-hero-warm),transparent_70%),radial-gradient(620px_520px_at_98%_90%,var(--gf-hero-fresh),transparent_70%),radial-gradient(520px_420px_at_0%_0%,var(--gf-hero-rose),transparent_70%)]"
      />
      <div className="flex flex-col gap-8 @min-[1240px]:flex-row @min-[1240px]:gap-12">
        <div className="flex max-w-[470px] shrink-0 flex-col gap-5.5 pt-4 @min-[1240px]:pt-8.5">
          <span className="text-meta font-semibold tracking-eyebrow text-muted-foreground uppercase">
            {t('home.hero.eyebrow')}
          </span>
          <h1 className="font-display text-home-hero font-semibold tracking-hero text-ink">
            {t('home.hero.headline')} <span className="text-marker">{t('home.hero.headlineAccent')}</span>
          </h1>
          <p className="text-home-sub text-ink-2">{t('home.hero.sub')}</p>
          <div className="flex flex-wrap gap-2.5 pt-1.5">
            <Link
              to="/register"
              className="flex h-[50px] items-center rounded-xl bg-primary px-6 text-subhead font-bold text-primary-foreground hover:opacity-90"
            >
              {t('home.hero.createAccount')}
            </Link>
            <a
              href="#how-it-works"
              onClick={scrollToAnchor}
              className="flex h-[50px] items-center gap-2 rounded-xl border border-border bg-surface px-5 text-subhead font-semibold text-ink hover:bg-sunken"
            >
              <IconPlay size={14} />
              {t('home.hero.seeInAction')}
            </a>
          </div>
          <span className="flex items-center gap-2 text-body text-muted-foreground">
            <IconPeople size={15} />
            {t('home.hero.note')}
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-5.5">
          <div className="hidden @min-[820px]:block">
            <HeroMockup />
          </div>
          <ol className="grid max-w-[766px] grid-cols-2 gap-x-4.5 gap-y-5 @min-[820px]:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.key} className="flex flex-col gap-1.5">
                <div className="h-[3px] rounded-xs bg-border">
                  <div className={`h-[3px] rounded-xs ${step.progress} ${step.bar}`} />
                </div>
                <span
                  className={`text-body font-bold ${index < 2 ? 'text-ink' : 'text-muted-foreground'}`}
                >
                  {index + 1} · {t(`home.steps.${step.key}.title`)}
                </span>
                <span className="text-meta text-muted-foreground">
                  {t(`home.hero.steps.${step.key}`)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
