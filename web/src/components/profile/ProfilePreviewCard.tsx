import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Award, Eye, Globe, MapPin } from 'lucide-react';
import { InstagramIcon, LinkedinIcon } from '@/components/profile/SocialIcons';
import { instagramUrl, linkedinUrl, websiteUrl } from '@/components/profile/profileLinks';
import ProfileAvatar from '@/components/profile/ProfileAvatar';
import { initialsOf, type ProfileFormValues } from '@/components/profile/profile-form';

const ROLE_ORDER = ['trainer', 'nutritionist'] as const;

interface Props {
  avatarUrl: string | undefined;
  roles: string[];
}

/** Live "How clients see you" card, rebuilt from the form values on every keystroke. */
export default function ProfilePreviewCard({ avatarUrl, roles }: Props) {
  const { t } = useTranslation();
  const { control } = useFormContext<ProfileFormValues>();
  const values = useWatch({ control }) as ProfileFormValues;

  const held = new Set(roles.map((role) => role.toLowerCase()));
  const roleLine = ROLE_ORDER.filter((role) => held.has(role))
    .map((role) => t(`roles.${role}`))
    .join(' · ');
  const name = `${values.firstName ?? ''} ${values.lastName ?? ''}`.trim();
  const collaboration =
    values.collaborationType === 'online'
      ? t('profile.page.preview.online')
      : values.collaborationType === 'inperson'
        ? t('profile.page.preview.inPerson')
        : t('profile.page.preview.both');
  const where = [values.city?.trim(), collaboration].filter(Boolean).join(' · ');
  const tags = values.specializations ?? [];
  const languages = (values.languages ?? []).join(', ');
  const certificates = (values.certificates ?? [])
    .filter((item) => item.title.trim() !== '')
    .map((item) => ({
      id: item.id,
      title: item.title,
      detail: [item.issuer.trim(), item.year.trim()].filter(Boolean).join(' · '),
    }));
  const links = [
    { key: 'website', Icon: Globe, href: websiteUrl(values.website), label: t('profile.website') },
    { key: 'instagram', Icon: InstagramIcon, href: instagramUrl(values.instagram), label: t('profile.instagram') },
    { key: 'linkedIn', Icon: LinkedinIcon, href: linkedinUrl(values.linkedIn), label: t('profile.linkedin') },
  ].filter((link): link is typeof link & { href: string } => link.href !== null);

  return (
    <aside aria-label={t('profile.page.preview.title')} className="flex flex-col gap-3 xl:sticky xl:top-0 xl:self-start">
      <h2 className="flex items-center gap-1.75 text-label font-semibold tracking-label text-muted-foreground uppercase">
        <Eye className="size-3.5" aria-hidden="true" />
        {t('profile.page.preview.title')}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-3">
            <ProfileAvatar
              url={avatarUrl}
              initials={initialsOf(values.firstName ?? '', values.lastName ?? '')}
              className="size-14 text-lede"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-subhead font-semibold text-ink">{name || t('profile.page.preview.noName')}</span>
              {roleLine && <span className="truncate text-meta text-muted-foreground">{roleLine}</span>}
              {where && (
                <span className="flex items-center gap-1 text-meta text-muted-foreground">
                  <MapPin className="size-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{where}</span>
                </span>
              )}
            </div>
          </div>

          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-meta font-semibold ${
              values.acceptNewClients ? 'bg-success-soft text-success-ink' : 'bg-muted text-muted-foreground'
            }`}
          >
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {values.acceptNewClients ? t('profile.page.preview.taking') : t('profile.page.preview.notTaking')}
          </span>

          <p className="line-clamp-4 text-body leading-relaxed whitespace-pre-line text-ink-2">
            {values.bio?.trim() || t('profile.page.preview.noBio')}
          </p>

          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <li key={tag} className="rounded-full bg-muted px-2.5 py-1 text-meta font-medium text-ink-2">
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>

        <dl className="grid grid-cols-2 border-t border-border">
          <div className="flex min-w-0 flex-col gap-1 p-4">
            <dt className="text-label font-semibold tracking-label text-muted-foreground uppercase">
              {t('profile.page.preview.price')}
            </dt>
            <dd className="truncate text-body font-semibold text-ink">{values.estimatedPrice?.trim()
                ? `${values.estimatedPrice.trim()} ${t('profile.page.preview.perMonth')}`
                : '—'}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1 border-l border-border p-4">
            <dt className="text-label font-semibold tracking-label text-muted-foreground uppercase">
              {t('profile.page.preview.languages')}
            </dt>
            <dd className="text-body font-semibold break-words text-ink">{languages || '—'}</dd>
          </div>
        </dl>

        {certificates.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border p-4">
            <h3 className="text-label font-semibold tracking-label text-muted-foreground uppercase">
              {t('profile.page.preview.certificates')}
            </h3>
            <ul className="flex flex-col gap-2">
              {certificates.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-nutrition">
                    <Award className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body font-medium break-words text-ink">{item.title.trim()}</span>
                    {item.detail && <span className="text-meta break-words text-muted-foreground">{item.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {links.length > 0 && (
          <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-meta text-muted-foreground">
            {links.map(({ key, Icon, href, label }) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={label}
                aria-label={label}
                className="rounded-sm outline-none transition-colors hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </a>
            ))}
          </div>
        )}
      </div>
      <p className="text-meta text-muted-foreground">{t('profile.page.preview.note')}</p>
    </aside>
  );
}
