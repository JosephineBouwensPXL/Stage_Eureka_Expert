import { StudyItem } from '../../types';

export async function syncSelectedStudyItemsToGeminiFileSearch(
  _userId: string,
  _selectedItems: StudyItem[]
): Promise<string | undefined> {
  // File Search sync moved server-side for production security hardening.
  return undefined;
}
