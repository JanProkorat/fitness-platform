const KNOWN_KINDS = new Set([
  'multi_select',
  'single_choice',
  'number',
  'short_text',
  'smiley_rating',
  'star_rating',
  'scale',
  'file_upload',
]);

/** i18n key of a type's display name; an unknown type falls back to a generic name. */
export function kindNameKey(kind: string): string {
  return KNOWN_KINDS.has(kind) ? `forms.builder.kinds.${kind}.name` : 'forms.builder.kinds.other.name';
}

/** i18n key of a palette type's one-line hint. */
export function kindHintKey(kind: string): string {
  return `forms.builder.kinds.${kind}.hint`;
}
