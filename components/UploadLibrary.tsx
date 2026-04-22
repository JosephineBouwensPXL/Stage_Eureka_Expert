import React from 'react';
import { EVENTS, Joyride, STATUS, type EventData, type Step } from 'react-joyride';
import { StudyItem } from '../types';

interface UploadLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolderId: string | null;
  onOpenFolder: (folderId: string | null) => void;
  breadcrumbs: StudyItem[];
  movingItemId: string | null;
  onSetMovingItemId: (id: string | null) => void;
  onMoveItem: (targetFolderId: string | null) => void;
  onCreateFolder: (name: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLearningGoalsFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileDrop: (files: File[]) => void;
  isExtracting: boolean;
  currentItems: StudyItem[];
  onRenameItem: (id: string, newName: string) => void;
  onDeleteItem: (id: string) => void;
  onToggleFileSelection: (id: string) => void;
  onToggleFolderSelection: (id: string) => void;
  isFolderSelected: (id: string) => boolean;
  hasSelectableFilesInFolder: (id: string) => boolean;
  onSetItemIconColor: (id: string, color: string) => void;
  selectedCount: number;
  walkthroughResetToken: number;
  walkthroughMode?: 'full' | 'learning-goals-only';
  narrateWalkthrough?: boolean;
  isDarkMode?: boolean;
  onWalkthroughCompleted?: (status: 'finished' | 'skipped') => void;
}

const UPLOAD_LIBRARY_WALKTHROUGH_KEY = 'studybuddy_upload_library_walkthrough_seen_v1';

const UploadLibraryModal: React.FC<UploadLibraryModalProps> = ({
  isOpen,
  onClose,
  currentFolderId,
  onOpenFolder,
  breadcrumbs,
  movingItemId,
  onSetMovingItemId,
  onMoveItem,
  onCreateFolder,
  onFileUpload,
  onLearningGoalsFileUpload,
  onFileDrop,
  isExtracting,
  currentItems,
  onRenameItem,
  onDeleteItem,
  onToggleFileSelection,
  onToggleFolderSelection,
  isFolderSelected,
  hasSelectableFilesInFolder,
  onSetItemIconColor,
  selectedCount,
  walkthroughResetToken,
  walkthroughMode = 'full',
  narrateWalkthrough = false,
  isDarkMode = false,
  onWalkthroughCompleted,
}) => {
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState('');
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState('');
  const [dragOverFolderId, setDragOverFolderId] = React.useState<string | null>(null);
  const [isDragOverCurrentFolder, setIsDragOverCurrentFolder] = React.useState(false);
  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = React.useState<StudyItem | null>(null);
  const [colorPickerItemId, setColorPickerItemId] = React.useState<string | null>(null);
  const [hasSeenWalkthrough, setHasSeenWalkthrough] = React.useState(false);
  const [runWalkthrough, setRunWalkthrough] = React.useState(false);
  const lastNarratedStepKeyRef = React.useRef<string | null>(null);
  const lastHandledWalkthroughResetTokenRef = React.useRef(0);
  const walkthroughSteps = React.useMemo<Step[]>(() => {
    if (walkthroughMode === 'learning-goals-only') {
      return [
        {
          target: '.walkthrough-upload-goals',
          title: 'Upload leerdoelen',
          content:
            'Upload hier een leerdoel-document. Zodra je dit hebt gedaan, gaan we verder met de leerdoelen-rondleiding.',
          disableBeacon: true,
        },
      ];
    }

    return [
      {
        target: '.walkthrough-upload-material',
        title: 'Upload lesmateriaal',
        content: 'Voeg hier je cursusdocumenten toe.',
        disableBeacon: true,
      },
      {
        target: '.walkthrough-upload-goals',
        title: 'Upload leerdoelen',
        content: 'Upload hier een leerdoel-document zodat StudyBuddy je leerdoelen kan herkennen en gebruiken.',
      },
      {
        target: '.walkthrough-create-folder',
        title: 'Maak mappen',
        content: 'Hiermee kun je je bibliotheek organiseren met mappen.',
      },
      {
        target: '.walkthrough-start-study',
        title: 'Start studie',
        content: 'Als je selectie klaar is, klik hier om je studiesessie te starten.',
      },
    ];
  }, [walkthroughMode]);

  const toNarrationText = (value: React.ReactNode): string => {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return '';
  };

  const speakWalkthroughStep = (title?: React.ReactNode, content?: React.ReactNode) => {
    if (!narrateWalkthrough) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const titleText = toNarrationText(title).trim();
    const contentText = toNarrationText(content).trim();
    const fullText = [titleText, contentText].filter(Boolean).join('. ');
    if (!fullText) return;
    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = 'nl-NL';
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handleWalkthroughEvent = ({ status, type, index, step }: EventData) => {
    if (type === EVENTS.TOOLTIP) {
      const stepKey = `${index}-${toNarrationText(step.title)}`;
      if (lastNarratedStepKeyRef.current !== stepKey) {
        lastNarratedStepKeyRef.current = stepKey;
        speakWalkthroughStep(step.title, step.content);
      }
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunWalkthrough(false);
      setHasSeenWalkthrough(true);
      localStorage.setItem(UPLOAD_LIBRARY_WALKTHROUGH_KEY, 'true');
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      onWalkthroughCompleted?.(status);
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      setColorPickerItemId(null);
      setPendingDeleteItem(null);
      setEditingItemId(null);
    }
  }, [isOpen]);
  React.useEffect(() => {
    const hasSeen = localStorage.getItem(UPLOAD_LIBRARY_WALKTHROUGH_KEY) === 'true';
    setHasSeenWalkthrough(hasSeen);
  }, []);

  React.useEffect(() => {
    if (!isOpen || hasSeenWalkthrough) {
      setRunWalkthrough(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setRunWalkthrough(true);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [isOpen, hasSeenWalkthrough]);

  React.useEffect(() => {
    if (walkthroughResetToken < 1) return;
    if (lastHandledWalkthroughResetTokenRef.current === walkthroughResetToken) return;

    lastHandledWalkthroughResetTokenRef.current = walkthroughResetToken;
    localStorage.removeItem(UPLOAD_LIBRARY_WALKTHROUGH_KEY);
    setHasSeenWalkthrough(false);
    if (!isOpen) return;
    setRunWalkthrough(false);
    const timer = window.setTimeout(() => {
      setRunWalkthrough(true);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [walkthroughResetToken, isOpen]);

  React.useEffect(() => {
    if (isOpen) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
  }, [isOpen]);
  const startEditing = (item: StudyItem) => {
    setEditingItemId(item.id);
    setEditingName(item.name);
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditingName('');
  };

  const submitEditing = (id: string) => {
    onRenameItem(id, editingName);
    cancelEditing();
  };

  const startCreatingFolder = () => {
    setIsCreatingFolder(true);
    setNewFolderName('');
  };

  const cancelCreatingFolder = () => {
    setIsCreatingFolder(false);
    setNewFolderName('');
  };

  const submitCreatingFolder = () => {
    onCreateFolder(newFolderName);
    cancelCreatingFolder();
  };

  const handleRowDragStart = (e: React.DragEvent<HTMLDivElement>, itemId: string) => {
    setDraggedItemId(itemId);
    onSetMovingItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-study-item-id', itemId);
  };

  const handleRowDragEnd = () => {
    setDraggedItemId(null);
    setDragOverFolderId(null);
    setIsDragOverCurrentFolder(false);
    onSetMovingItemId(null);
  };

  const handleDropOnCurrentFolder = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverCurrentFolder(false);
    const internalItemId = e.dataTransfer.getData('application/x-study-item-id');
    if (internalItemId) {
      onSetMovingItemId(internalItemId);
      onMoveItem(currentFolderId);
      return;
    }
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) onFileDrop(droppedFiles);
  };

  const handleDropOnFolder = (e: React.DragEvent<HTMLDivElement>, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    const internalItemId = e.dataTransfer.getData('application/x-study-item-id');
    if (!internalItemId) return;
    onSetMovingItemId(internalItemId);
    onMoveItem(folderId);
  };

  const getFileIconClass = (fileType?: string) => {
    const ext = (fileType || '').toLowerCase();
    if (ext === 'txt') return 'fa-file-lines';
    if (ext === 'docx') return 'fa-file-word';
    if (ext === 'pptx') return 'fa-file-powerpoint';
    if (ext === 'pdf') return 'fa-file-pdf';
    return 'fa-file';
  };

  const getDefaultIconColor = (item: StudyItem) => {
    if (item.type === 'folder') return '#fbc02d';
    const ext = (item.fileType || '').toLowerCase();
    if (ext === 'txt') return '#64748b';
    if (ext === 'docx') return '#3b82f6';
    if (ext === 'pptx') return '#f97316';
    if (ext === 'pdf') return '#ef4444';
    return '#e61e6e';
  };

  const iconColorOptions = [
    '#2563eb',
    '#16a34a',
    '#f97316',
    '#ef4444',
    '#a855f7',
    '#e61e6e',
    '#fbc02d',
    '#64748b',
  ];

  const openDeleteConfirm = (item: StudyItem) => {
    setPendingDeleteItem(item);
  };

  const closeDeleteConfirm = () => {
    setPendingDeleteItem(null);
  };

  const confirmDelete = () => {
    if (!pendingDeleteItem) return;
    onDeleteItem(pendingDeleteItem.id);
    setPendingDeleteItem(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <Joyride
        run={runWalkthrough}
        steps={walkthroughSteps}
        continuous
        showProgress
        showSkipButton
        disableScrolling
        onEvent={handleWalkthroughEvent}
        locale={{
          back: 'Vorige',
          close: 'Sluiten',
          last: 'Klaar',
          next: 'Volgende',
          skip: 'Overslaan',
        }}
        styles={{
          options: {
            primaryColor: '#0ea5e9',
            zIndex: 80,
          },
          beaconInner: {
            backgroundColor: isDarkMode ? '#ffffff' : '#111827',
          },
          beaconOuter: {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.35)' : 'rgba(17, 24, 39, 0.28)',
            borderColor: isDarkMode ? '#ffffff' : '#111827',
          },
        }}
      />
      <div className="bg-white dark:bg-slate-800 w-full max-w-6xl h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-white dark:border-slate-700 flex flex-col">
        <div className="p-8 border-b dark:border-slate-700 flex flex-wrap gap-4 justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3 text-sm overflow-hidden">
            <button
              onClick={() => onOpenFolder(null)}
              className="text-studybuddy-blue font-black hover:underline whitespace-nowrap"
            >
              Bibliotheek
            </button>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                <i className="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
                <button
                  onClick={() => onOpenFolder(crumb.id)}
                  className={`font-bold truncate max-w-[100px] ${idx === breadcrumbs.length - 1 ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            {movingItemId && (
              <div className="flex items-center space-x-2 bg-studybuddy-yellow/20 p-1 pl-3 rounded-xl border border-studybuddy-yellow/40">
                <span className="text-[10px] font-black uppercase text-studybuddy-yellow-dark">
                  Verplaatsen...
                </span>
                <button
                  onClick={() => onMoveItem(currentFolderId)}
                  className="px-3 py-1.5 bg-studybuddy-yellow text-studybuddy-dark text-xs font-black rounded-lg hover:scale-105 transition-all"
                >
                  Hier
                </button>
                <button onClick={() => onSetMovingItemId(null)} className="p-1.5 text-slate-400">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            )}

            <label className="walkthrough-upload-material px-4 py-2 bg-studybuddy-blue text-white rounded-xl font-bold cursor-pointer hover:bg-blue-600 transition-all flex items-center">
              <i className="fa-solid fa-cloud-arrow-up mr-2"></i>
              <span>Upload lesmateriaal</span>
              <input
                type="file"
                className="hidden"
                multiple
                accept=".txt,.docx,.pdf,.pptx"
                onChange={onFileUpload}
              />
            </label>

            <label className="walkthrough-upload-goals px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer hover:bg-emerald-700 transition-all flex items-center">
              <i className="fa-solid fa-bullseye mr-2"></i>
              <span>Upload leerdoelen</span>
              <input
                type="file"
                className="hidden"
                multiple
                accept=".txt,.docx,.pdf,.pptx"
                onChange={onLearningGoalsFileUpload}
              />
            </label>

            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-white dark:bg-slate-800">
          {isCreatingFolder && (
            <div className="mb-6 p-4 rounded-2xl border-2 border-studybuddy-blue/20 bg-studybuddy-blue/5 flex items-center gap-2">
              <i className="fa-solid fa-folder text-studybuddy-yellow"></i>
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCreatingFolder();
                  if (e.key === 'Escape') cancelCreatingFolder();
                }}
                placeholder="Naam van nieuwe map"
                autoFocus
                className="flex-1 bg-transparent border-b border-studybuddy-blue/40 outline-none font-bold text-slate-700 dark:text-slate-200"
              />
              <button
                onClick={submitCreatingFolder}
                className="w-8 h-8 rounded-xl bg-green-50 dark:bg-green-900/10 text-green-500 hover:bg-green-500 hover:text-white transition-all"
              >
                <i className="fa-solid fa-check text-xs"></i>
              </button>
              <button
                onClick={cancelCreatingFolder}
                className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>
          )}

          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              {currentItems.length} items in deze map
            </h3>
            <button
              onClick={startCreatingFolder}
              className="walkthrough-create-folder px-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:border-studybuddy-blue transition-all flex items-center"
            >
              <i className="fa-solid fa-folder-plus mr-2 text-studybuddy-yellow"></i>
              <span>Map</span>
            </button>
          </div>

          {isExtracting && (
            <div className="p-12 text-center animate-pulse">
              <i className="fa-solid fa-spinner fa-spin text-3xl text-studybuddy-blue"></i>
              <p className="font-bold text-slate-400 mt-4">Bezig met verwerken...</p>
            </div>
          )}

          {!isExtracting && (
            <div
              className={`rounded-2xl border overflow-visible bg-white dark:bg-slate-900 ${
                isDragOverCurrentFolder
                  ? 'border-studybuddy-blue'
                  : 'border-slate-100 dark:border-slate-700'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOverCurrentFolder(true);
              }}
              onDragLeave={() => setIsDragOverCurrentFolder(false)}
              onDrop={handleDropOnCurrentFolder}
            >
              <div className="grid grid-cols-[120px_minmax(220px,1fr)_100px_120px_140px] gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-slate-800/60">
                <span className="truncate">Lesmateriaal</span>
                <span>Naam</span>
                <span>Type</span>
                <span>Datum</span>
                <span className="text-center">Acties</span>
              </div>

              {[...currentItems]
                .sort((a, b) => {
                  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                  return a.name.localeCompare(b.name, 'nl');
                })
                .map((item) => {
                  const isRowSelected =
                    item.type === 'folder' ? isFolderSelected(item.id) : !!item.selected;
                  const iconColor = item.iconColor || getDefaultIconColor(item);
                  const hasLearningGoalState =
                    !!item.isLearningGoalsDocument || (item.learningGoals?.length ?? 0) > 0;
                  const rowStateClass = isRowSelected
                    ? hasLearningGoalState
                      ? 'bg-emerald-100 dark:bg-emerald-900/25 ring-2 ring-emerald-400/70'
                      : 'bg-studybuddy-yellow/20 ring-2 ring-studybuddy-yellow/60'
                    : hasLearningGoalState
                      ? 'bg-emerald-50/70 dark:bg-emerald-900/10'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40';
                  return (
                    <React.Fragment key={item.id}>
                      <div
                        draggable
                        onDragStart={(e) => handleRowDragStart(e, item.id)}
                        onDragEnd={handleRowDragEnd}
                        onDragOver={(e) => {
                          if (item.type !== 'folder') return;
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverFolderId(item.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverFolderId === item.id) setDragOverFolderId(null);
                        }}
                        onDrop={(e) => item.type === 'folder' && handleDropOnFolder(e, item.id)}
                        className={`grid grid-cols-[120px_minmax(220px,1fr)_100px_120px_140px] gap-3 px-4 py-3 items-center border-t border-slate-100 dark:border-slate-800 ${rowStateClass} ${
                          dragOverFolderId === item.id ? 'bg-studybuddy-blue/10' : ''
                        } ${draggedItemId === item.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center justify-center">
                          {item.type === 'file' ? (
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => onToggleFileSelection(item.id)}
                              className="w-5 h-5 rounded-lg border-2 border-slate-200 text-studybuddy-magenta cursor-pointer"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={isFolderSelected(item.id)}
                              disabled={!hasSelectableFilesInFolder(item.id)}
                              onChange={() => onToggleFolderSelection(item.id)}
                              className="w-5 h-5 rounded-lg border-2 border-slate-200 text-studybuddy-magenta cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex items-center gap-3">
                          <button
                            onClick={() =>
                              item.type === 'folder'
                                ? onOpenFolder(item.id)
                                : onToggleFileSelection(item.id)
                            }
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                          >
                            {item.type === 'folder' ? (
                              <i
                                className="fa-solid fa-folder text-xl"
                                style={{ color: iconColor }}
                              ></i>
                            ) : (
                              <i
                                className={`fa-solid ${item.isLearningGoalsDocument ? 'fa-bullseye' : getFileIconClass(item.fileType)} text-xl`}
                                style={{ color: iconColor }}
                              ></i>
                            )}
                          </button>
                          {editingItemId === item.id ? (
                            <input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') submitEditing(item.id);
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              autoFocus
                              className="w-full font-bold text-slate-800 dark:text-slate-100 bg-transparent border-b border-studybuddy-blue/40 outline-none"
                            />
                          ) : (
                            <span
                              onDoubleClick={() => startEditing(item)}
                              onClick={() => item.type === 'folder' && onOpenFolder(item.id)}
                              className={`truncate font-bold ${item.type === 'folder' ? 'cursor-pointer' : ''} text-slate-800 dark:text-slate-100`}
                            >
                              {item.name}
                            </span>
                          )}
                        </div>

                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {item.type === 'folder'
                            ? 'Map'
                            : (item.fileType || 'bestand').toUpperCase()}
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {new Date(item.createdAt).toLocaleDateString('nl-NL')}
                        </span>

                        <div className="relative flex items-center justify-center gap-1.5">
                          {editingItemId === item.id ? (
                            <>
                              <button
                                onClick={() => submitEditing(item.id)}
                                className="w-8 h-8 rounded-xl bg-green-50 dark:bg-green-900/10 text-green-500 hover:bg-green-500 hover:text-white transition-all"
                              >
                                <i className="fa-solid fa-check text-xs"></i>
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all"
                              >
                                <i className="fa-solid fa-xmark text-xs"></i>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() =>
                                setColorPickerItemId(colorPickerItemId === item.id ? null : item.id)
                              }
                              className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-studybuddy-blue transition-all"
                            >
                              <i className="fa-solid fa-paintbrush text-xs"></i>
                            </button>
                          )}
                          <button
                            onClick={() => openDeleteConfirm(item)}
                            className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                          >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                          {colorPickerItemId === item.id && (
                            <div className="absolute top-10 right-0 z-40 w-48 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-3">
                              <div className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">
                                Icoonkleur
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {iconColorOptions.map((color) => (
                                  <button
                                    key={`${item.id}-${color}`}
                                    onClick={() => onSetItemIconColor(item.id, color)}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                                      iconColor === color
                                        ? 'border-slate-900 dark:border-white scale-105'
                                        : 'border-white dark:border-slate-700'
                                    }`}
                                    style={{ backgroundColor: color }}
                                    title="Kies kleur"
                                  />
                                ))}
                              </div>
                              <button
                                onClick={() => setColorPickerItemId(null)}
                                className="mt-3 w-full px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs font-bold"
                              >
                                Sluit
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
            </div>
          )}
        </div>

        {pendingDeleteItem && (
          <div className="absolute inset-0 z-30 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center">
                  <i className="fa-solid fa-triangle-exclamation text-xl"></i>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                    Ben je zeker?
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                    Je staat op het punt deze{' '}
                    {pendingDeleteItem.type === 'folder' ? 'map' : 'document'} te verwijderen:
                  </p>
                  <p className="mt-1 font-bold text-slate-700 dark:text-slate-100 truncate">
                    "{pendingDeleteItem.name}"
                  </p>
                  {pendingDeleteItem.type === 'folder' && (
                    <p className="mt-2 text-xs font-bold uppercase tracking-wide text-red-500">
                      Ook alle inhoud in deze map wordt verwijderd.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={closeDeleteConfirm}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                >
                  Annuleer
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-xl bg-red-500 text-white font-black hover:bg-red-600 transition-all flex items-center gap-2"
                >
                  <i className="fa-solid fa-trash-can"></i>
                  <span>Verwijderen</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t dark:border-slate-700 flex flex-wrap gap-6 items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-studybuddy-magenta shadow-sm">
              <i className="fa-solid fa-book-open-reader text-xl"></i>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Studie Selectie
              </p>
              <p className="font-bold text-slate-700 dark:text-slate-200">
                {selectedCount === 0
                  ? 'Geen bestanden gekozen'
                  : `${selectedCount} document(s) geselecteerd`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="walkthrough-start-study px-10 py-5 bg-studybuddy-magenta text-white rounded-[1.5rem] font-black shadow-xl hover:scale-105 transition-all text-lg flex items-center space-x-3"
          >
            <span>Start Studie</span>
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadLibraryModal;
