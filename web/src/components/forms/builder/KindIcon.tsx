import { CircleDot, FileUp, Hash, List, SlidersHorizontal, Smile, Star, Type } from 'lucide-react';

interface Props {
  kind: string;
  className?: string;
}

/** Icon of a question type; an unknown type gets the text icon. */
export default function KindIcon({ kind, className }: Props) {
  switch (kind) {
    case 'multi_select':
      return <List className={className} aria-hidden="true" />;
    case 'single_choice':
      return <CircleDot className={className} aria-hidden="true" />;
    case 'number':
      return <Hash className={className} aria-hidden="true" />;
    case 'smiley_rating':
      return <Smile className={className} aria-hidden="true" />;
    case 'star_rating':
      return <Star className={className} aria-hidden="true" />;
    case 'scale':
      return <SlidersHorizontal className={className} aria-hidden="true" />;
    case 'file_upload':
      return <FileUp className={className} aria-hidden="true" />;
    default:
      return <Type className={className} aria-hidden="true" />;
  }
}
