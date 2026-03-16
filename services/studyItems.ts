import { StudyItem, User } from '../types';

export function getStudyItemsStorageKey(user: User | null): string | null {
  if (!user) return null;
  return `studybuddy_study_items_${user.id}`;
}

export function parseStoredStudyItems(raw: string | null): StudyItem[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw).map((item: any) => ({ ...item, createdAt: new Date(item.createdAt) }));
  } catch {
    return [];
  }
}

export function buildActiveStudyContext(studyItems: StudyItem[]): string | undefined {
  const selectedFiles = studyItems.filter((item) => item.type === 'file' && item.selected);
  if (selectedFiles.length === 0) return undefined;

  return selectedFiles
    .map((file) => {
      const goalsSection =
        (file.learningGoals?.length ?? 0) > 0
          ? `\n\nLEERDOELEN:\n${file.learningGoals!.map((goal, idx) => `${idx + 1}. ${goal}`).join('\n')}`
          : '';
      return `--- DOCUMENT: ${file.name} ---\n${file.content ?? ''}${goalsSection}`;
    })
    .join('\n\n');
}

export function countSelectedRegularFiles(studyItems: StudyItem[]): number {
  return studyItems.filter(
    (item) =>
      item.type === 'file' &&
      item.selected &&
      !(item.isLearningGoalsDocument || item.name.toLowerCase().includes('leerdoel'))
  ).length;
}

export function getDescendantFileIds(items: StudyItem[], folderId: string): Set<string> {
  const folderIds = new Set<string>([folderId]);
  const fileIds = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const item of items) {
      if (!item.parentId || !folderIds.has(item.parentId)) continue;
      if (item.type === 'folder' && !folderIds.has(item.id)) {
        folderIds.add(item.id);
        changed = true;
      }
      if (item.type === 'file') fileIds.add(item.id);
    }
  }

  return fileIds;
}

export function buildBreadcrumbs(
  studyItems: StudyItem[],
  currentFolderId: string | null
): StudyItem[] {
  const crumbs: StudyItem[] = [];
  let currentId = currentFolderId;
  while (currentId) {
    const folder = studyItems.find((item) => item.id === currentId);
    if (folder) {
      crumbs.unshift(folder);
      currentId = folder.parentId;
    } else {
      break;
    }
  }
  return crumbs;
}
