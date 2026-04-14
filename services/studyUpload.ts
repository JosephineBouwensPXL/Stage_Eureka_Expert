import { StudyItem } from '../types';

type UploadOptions = {
  currentFolderId: string | null;
  markAsLearningGoalsDocument?: boolean;
};

export type UploadProcessingResult = {
  uploadedItems: StudyItem[];
  failedFiles: string[];
  failedReasons: string[];
};

async function extractTextFromDocxWithZip(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('Bestand is geen geldig DOCX-zipbestand.');
  }
  
  const jsZipLib = (window as any).JSZip;
  if (!jsZipLib || typeof jsZipLib.loadAsync !== 'function') {
    throw new Error('DOCX parser ontbreekt (JSZip niet geladen).');
  }
  
  const zip = await jsZipLib.loadAsync(arrayBuffer);
  const xmlCandidates = [
    'word/document.xml',
    'word/header1.xml',
    'word/header2.xml',
    'word/footer1.xml',
    'word/footer2.xml',
    'word/footnotes.xml',
    'word/endnotes.xml',
  ];
  
  const parser = new DOMParser();
  const chunks: string[] = [];
  
  const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();
  const readNodeText = (node: Element) => {
    const textNodes = Array.from(node.getElementsByTagName('w:t'));
    return normalizeText(textNodes.map((n) => n.textContent || '').join(' '));
  };
  
  for (const xmlPath of xmlCandidates) {
    const xmlFile = zip.file(xmlPath);
    if (!xmlFile) continue;
    const xmlString = await xmlFile.async('string');
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const rowLines = Array.from(xmlDoc.getElementsByTagName('w:tr'))
    .map((row) => {
      const cellTexts = Array.from(row.getElementsByTagName('w:tc'))
      .map((cell) => readNodeText(cell))
      .filter(Boolean);
      return cellTexts.join('\t').trim();
    })
    .filter(Boolean);
    if (rowLines.length > 0) chunks.push(rowLines.join('\n'));
    
    const paragraphLines = Array.from(xmlDoc.getElementsByTagName('w:p'))
    .map((p) => readNodeText(p))
    .filter(Boolean);
    if (paragraphLines.length > 0) chunks.push(paragraphLines.join('\n'));
  }
  
  if (chunks.length === 0) {
    throw new Error('Geen leesbare tekst gevonden in DOCX.');
  }
  
  return chunks.join('\n\n');
}



function htmlListsToText(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  
  for (const ol of Array.from(container.querySelectorAll('ol'))) {
    let index = 1;
    for (const li of Array.from(ol.children)) {
      if (li.tagName.toLowerCase() !== 'li') continue;
      li.innerHTML = `${index}. ${li.innerHTML}`;
      index++;
    }
  }
  
  for (const ul of Array.from(container.querySelectorAll('ul'))) {
    for (const li of Array.from(ul.children)) {
      if (li.tagName.toLowerCase() !== 'li') continue;
      li.innerHTML = `- ${li.innerHTML}`;
    }
  }
  
  return container.innerHTML
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<\/li>/gi, '\n')
  .replace(/<\/ol>/gi, '\n')
  .replace(/<\/ul>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .trim();
}

async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'txt') return file.text();
  
  if (extension === 'docx') {
    if (file.size === 0) {
      throw new Error(
        'Bestand is leeg (0 bytes). Dit gebeurt vaak bij cloud-bestanden die nog niet lokaal gedownload zijn (bijv. OneDrive/Teams). Open het bestand eerst en sla lokaal op, upload daarna opnieuw.'
      );
    }
    
    const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const isZipHeader = header.length >= 4 && header[0] === 0x50 && header[1] === 0x4b;
    const isLegacyDocHeader =
    header.length >= 4 &&
    header[0] === 0xd0 &&
    header[1] === 0xcf &&
    header[2] === 0x11 &&
    header[3] === 0xe0;
    if (!isZipHeader && isLegacyDocHeader) {
      throw new Error(
        'Dit lijkt een oud .doc-bestand (geen .docx). Sla het document eerst op als .docx en upload opnieuw.'
      );
    }
    
    let mammothError = '';
    let mammothText = '';
    try {
      const mammothLib = (window as any).mammoth;
      if (mammothLib && typeof mammothLib.convertToHtml === 'function') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammothLib.convertToHtml({ arrayBuffer });
        console.log('Mammoth result:', result);
        
        const html = result?.value || '';
        mammothText = htmlListsToText(html);
      }
    } catch (error) {
      console.error(error);
    }
    
    try {
      const zipText = await extractTextFromDocxWithZip(file);
      if (mammothText && zipText) return `${mammothText}\n\n${zipText}`;
      if (zipText) return zipText;
      if (mammothText) return mammothText;
      return '';
    } catch (zipError) {
      if (mammothText) return mammothText;
      const zipMessage = zipError instanceof Error ? zipError.message : 'Onbekende ZIP fout.';
      throw new Error(`DOCX lezen mislukt. Mammoth: ${mammothError}. ZIP fallback: ${zipMessage}`);
    }
  }
  
  if (extension === 'pdf') {
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib?.getDocument) {
      throw new Error('PDF parser ontbreekt (pdf.js niet geladen).');
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }
    return text;
  }
  
  if (extension === 'pptx') {
    const arrayBuffer = await file.arrayBuffer();
    const jsZipLib = (window as any).JSZip;
    if (!jsZipLib || typeof jsZipLib.loadAsync !== 'function') {
      throw new Error('PPTX parser ontbreekt (JSZip niet geladen).');
    }
    const zip = await jsZipLib.loadAsync(arrayBuffer);
    let text = '';
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
    );
    for (const name of slideFiles.sort()) {
      const content = await zip.file(name).async('string');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');
      const textNodes = xmlDoc.getElementsByTagName('a:t');
      for (let j = 0; j < textNodes.length; j++) text += textNodes[j].textContent + ' ';
      text += '\n';
    }
    return text;
  }
  
  throw new Error('Bestandstype niet ondersteund');
}

function createUploadedStudyItem(
  file: File,
  extractedText: string,
  options: UploadOptions
): StudyItem {
  return {
    id: Math.random().toString(36).substring(2, 11),
    name: file.name,
    type: 'file',
    parentId: options.currentFolderId,
    content: extractedText,
    fileType: file.name.split('.').pop() || 'txt',
    selected: true,
    iconColor: options.markAsLearningGoalsDocument ? '#16a34a' : undefined,
    isLearningGoalsDocument: options.markAsLearningGoalsDocument ? true : undefined,
    createdAt: new Date(),
  };
}

export async function processUploadedFiles(
  files: File[],
  options: UploadOptions
): Promise<UploadProcessingResult> {
  const isDebugEnabled =
  typeof window !== 'undefined' && window.localStorage?.getItem('debugLearningGoals') === '1';
  const debug = (...args: unknown[]) => {
    if (isDebugEnabled) console.log('[LearningGoalsDebug]', ...args);
  };
  
  const uploadedItems: StudyItem[] = [];
  const failedFiles: string[] = [];
  const failedReasons: string[] = [];
  
  for (const file of files) {
    try {
      const extractedText = await extractTextFromFile(file);
      debug('Upload extracted', {
        file: file.name,
        extension: file.name.split('.').pop()?.toLowerCase(),
        isLearningGoalsDocument: !!options.markAsLearningGoalsDocument,
        extractedLength: extractedText.length,
        preview: extractedText.slice(0, 600),
      });
      uploadedItems.push(createUploadedStudyItem(file, extractedText, options));
    } catch (error) {
      failedFiles.push(file.name);
      const reason = error instanceof Error ? error.message : 'Onbekende fout';
      failedReasons.push(`${file.name}: ${reason}`);
      console.error(`[Upload] Fout bij verwerken van "${file.name}":`, error);
    }
  }
  
  return { uploadedItems, failedFiles, failedReasons };
}
