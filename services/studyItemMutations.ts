import { StudyItem } from '../types';
import { getDescendantFileIds } from './studyItems';

export function createFolderItem(name: string, currentFolderId: string | null): StudyItem | null {
  if (!name || !name.trim()) return null;
  return {
    id: Math.random().toString(36).substring(2, 11),
    name: name.trim(),
    type: 'folder',
    parentId: currentFolderId,
    selected: false,
    createdAt: new Date(),
  };
}

export function renameStudyItem(items: StudyItem[], id: string, newName: string): StudyItem[] {
  const item = items.find((entry) => entry.id === id);
  if (!item || !newName || !newName.trim()) return items;
  return items.map((entry) => (entry.id === id ? { ...entry, name: newName.trim() } : entry));
}

export function deleteStudyItem(items: StudyItem[], id: string): StudyItem[] {
  const toDelete = new Set([id]);
  let size = 0;
  while (toDelete.size !== size) {
    size = toDelete.size;
    items.forEach((entry) => {
      if (entry.parentId && toDelete.has(entry.parentId)) toDelete.add(entry.id);
    });
  }
  return items.filter((entry) => !toDelete.has(entry.id));
}

export function moveStudyItem(
  items: StudyItem[],
  movingItemId: string,
  targetFolderId: string | null
): StudyItem[] {
  if (!movingItemId || movingItemId === targetFolderId) return items;
  const movingItem = items.find((entry) => entry.id === movingItemId);
  if (!movingItem) return items;

  if (movingItem.type === 'folder' && targetFolderId) {
    if (targetFolderId === movingItemId) return items;
    const descendants = new Set<string>([movingItemId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const entry of items) {
        if (entry.parentId && descendants.has(entry.parentId) && !descendants.has(entry.id)) {
          descendants.add(entry.id);
          changed = true;
        }
      }
    }
    if (descendants.has(targetFolderId)) return items;
  }

  return items.map((entry) =>
    entry.id === movingItemId ? { ...entry, parentId: targetFolderId } : entry
  );
}

export function toggleFileSelectionInItems(items: StudyItem[], id: string): StudyItem[] {
  return items.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item));
}

export function hasSelectableFilesInFolder(items: StudyItem[], folderId: string): boolean {
  return getDescendantFileIds(items, folderId).size > 0;
}

export function isFolderSelectedInItems(items: StudyItem[], folderId: string): boolean {
  const fileIds = getDescendantFileIds(items, folderId);
  if (fileIds.size === 0) return false;
  return items.filter((entry) => fileIds.has(entry.id)).every((entry) => entry.selected);
}

export function toggleFolderSelectionInItems(items: StudyItem[], folderId: string): StudyItem[] {
  const fileIds = getDescendantFileIds(items, folderId);
  if (fileIds.size === 0) return items;
  const shouldSelect = !items
    .filter((entry) => fileIds.has(entry.id))
    .every((entry) => entry.selected);
  return items.map((entry) =>
    fileIds.has(entry.id) ? { ...entry, selected: shouldSelect } : entry
  );
}

export function setItemIconColorInItems(
  items: StudyItem[],
  id: string,
  color: string
): StudyItem[] {
  return items.map((item) => (item.id === id ? { ...item, iconColor: color } : item));
}
