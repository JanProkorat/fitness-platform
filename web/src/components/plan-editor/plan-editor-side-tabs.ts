import { BookOpen, Info } from 'lucide-react';
import type { EditorSideTab } from '@/components/plan-editor/plan-editor-types';

/** Side-panel tabs in display order. */
export const SIDE_TABS: readonly EditorSideTab[] = ['info', 'library'];

export const SIDE_TAB_ICON = { info: Info, library: BookOpen } as const;
