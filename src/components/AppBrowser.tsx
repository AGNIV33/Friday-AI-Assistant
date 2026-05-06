import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Plus, Gamepad2, Globe, Code, Music, Briefcase, Monitor, LayoutGrid, Loader2, Trash2, FolderOpen } from 'lucide-react';

interface AppItem {
  name: string;
  appId: string;
  custom?: boolean;
}

interface AppBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
  accentRgb: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  'Social Media': Globe,
  'Games': Gamepad2,
  'Development': Code,
  'Media': Music,
  'Office': Briefcase,
  'Browsers': Globe,
  'System': Monitor,
  'Other': LayoutGrid,
};

const CATEGORY_COLORS: Record<string, string> = {
  'Social Media': '#ec4899',
  'Games': '#ef4444',
  'Development': '#8b5cf6',
  'Media': '#f59e0b',
  'Office': '#3b82f6',
  'Browsers': '#06b6d4',
  'System': '#6b7280',
  'Other': '#64748b',
};

const CUSTOM_APPS_KEY = 'friday-custom-apps';

function loadCustomApps(): AppItem[] {
  try {
    const stored = localStorage.getItem(CUSTOM_APPS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveCustomApps(apps: AppItem[]) {
  localStorage.setItem(CUSTOM_APPS_KEY, JSON.stringify(apps));
}

export default function AppBrowser({ isOpen, onClose, accentColor, accentRgb }: AppBrowserProps) {
  const [categories, setCategories] = useState<Record<string, AppItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppCategory, setNewAppCategory] = useState('Other');
  const [customApps, setCustomApps] = useState<AppItem[]>(loadCustomApps);

  const loadApps = useCallback(async () => {
    if (!window.electronAPI?.getAllApps) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.getAllApps();
      if (result.success && result.categories) {
        // Merge custom apps into categories
        const merged = { ...result.categories };
        for (const app of customApps) {
          const cat = 'Other';
          if (!merged[cat]) merged[cat] = [];
          merged[cat].push({ ...app, custom: true });
        }
        setCategories(merged);
      }
    } catch (err) {
      console.error('Failed to load apps:', err);
    } finally {
      setLoading(false);
    }
  }, [customApps]);

  useEffect(() => {
    if (isOpen) loadApps();
  }, [isOpen, loadApps]);

  const handleAddApp = () => {
    if (!newAppName.trim()) return;
    const app: AppItem = { name: newAppName.trim(), appId: '', custom: true };
    const updated = [...customApps, app];
    setCustomApps(updated);
    saveCustomApps(updated);
    setNewAppName('');
    setShowAddDialog(false);
    // Re-merge
    setCategories(prev => {
      const cat = newAppCategory || 'Other';
      const copy = { ...prev };
      if (!copy[cat]) copy[cat] = [];
      copy[cat] = [...copy[cat], { ...app, custom: true }];
      return copy;
    });
  };

  const handleRemoveCustomApp = (appName: string) => {
    const updated = customApps.filter((a: AppItem) => a.name !== appName);
    setCustomApps(updated);
    saveCustomApps(updated);
    // Remove from categories
    setCategories(prev => {
      const copy: Record<string, AppItem[]> = {};
      for (const [cat, apps] of Object.entries(prev)) {
        copy[cat] = (apps as AppItem[]).filter((a: AppItem) => !(a.custom && a.name === appName));
      }
      return copy;
    });
  };

  const handleOpenApp = async (appName: string) => {
    if (window.electronAPI?.openApp) {
      await window.electronAPI.openApp(appName);
    }
  };

  // Filter apps by search
  const filteredCategories: Record<string, AppItem[]> = {};
  const q = search.toLowerCase();
  for (const [cat, apps] of Object.entries(categories)) {
    const filtered = q ? (apps as AppItem[]).filter((a: AppItem) => a.name.toLowerCase().includes(q)) : (apps as AppItem[]);
    if (filtered.length > 0) filteredCategories[cat] = filtered;
  }

  const categoryOrder = ['Games', 'Social Media', 'Browsers', 'Development', 'Media', 'Office', 'System', 'Other'];
  const sortedCats = Object.keys(filteredCategories).sort((a, b) => {
    const ia = categoryOrder.indexOf(a);
    const ib = categoryOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative w-[92vw] max-w-[1100px] h-[85vh] rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, rgba(15,15,20,0.97), rgba(8,8,12,0.99))',
              border: `1px solid rgba(${accentRgb}, 0.2)`,
              boxShadow: `0 0 60px rgba(${accentRgb}, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)`,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: `rgba(${accentRgb}, 0.15)` }}>
              <div className="flex items-center gap-3">
                <LayoutGrid size={22} style={{ color: accentColor }} />
                <h2 className="text-lg font-semibold text-white tracking-wide">App Browser</h2>
                {!loading && (
                  <span className="text-xs text-white/30 ml-2">
                    {Object.values(categories).reduce((sum: number, arr: unknown) => sum + (arr as AppItem[]).length, 0)} apps detected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAddDialog(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                  style={{ background: `rgba(${accentRgb}, 0.15)`, color: accentColor, border: `1px solid rgba(${accentRgb}, 0.3)` }}
                >
                  <Plus size={14} /> Add App
                </button>
                <button
                  onClick={loadApps}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  Refresh
                </button>
                <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-6 py-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search apps..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid rgba(${accentRgb}, 0.15)`,
                  }}
                />
              </div>
            </div>

            {/* App Grid */}
            <div className="overflow-y-auto px-6 pb-6" style={{ height: 'calc(100% - 130px)' }}>
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-white/40">
                  <Loader2 size={32} className="animate-spin" style={{ color: accentColor }} />
                  <span className="text-sm">Scanning system apps...</span>
                </div>
              ) : sortedCats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-white/40">
                  <FolderOpen size={40} />
                  <span className="text-sm">No apps found{search ? ` matching "${search}"` : ''}</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {sortedCats.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat] || LayoutGrid;
                    const catColor = CATEGORY_COLORS[cat] || '#64748b';
                    const apps = filteredCategories[cat];
                    return (
                      <div key={cat}>
                        <div className="flex items-center gap-2 mb-3">
                          <Icon size={16} style={{ color: catColor }} />
                          <span className="text-sm font-semibold tracking-wide" style={{ color: catColor }}>{cat}</span>
                          <span className="text-[10px] text-white/20 ml-1">({apps.length})</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                          {apps.map((app, i) => (
                            <motion.button
                              key={`${app.name}-${i}`}
                              whileHover={{ scale: 1.03, y: -2 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => handleOpenApp(app.name)}
                              className="group relative flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all"
                              style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                              }}
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ background: `${catColor}20`, color: catColor }}>
                                {app.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs text-white/70 group-hover:text-white/90 truncate transition-colors flex-1">
                                {app.name}
                              </span>
                              {app.custom && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveCustomApp(app.name); }}
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-500/20"
                                >
                                  <Trash2 size={10} className="text-red-400" />
                                </button>
                              )}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add App Dialog */}
            <AnimatePresence>
              {showAddDialog && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
                  onClick={(e) => { if (e.target === e.currentTarget) setShowAddDialog(false); }}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-[360px] rounded-xl p-5"
                    style={{
                      background: 'rgba(20,20,28,0.98)',
                      border: `1px solid rgba(${accentRgb}, 0.3)`,
                      boxShadow: `0 0 40px rgba(${accentRgb}, 0.1)`,
                    }}
                  >
                    <h3 className="text-sm font-semibold text-white/90 mb-4">Add Custom App</h3>
                    <input
                      type="text"
                      value={newAppName}
                      onChange={(e) => setNewAppName(e.target.value)}
                      placeholder="App name (e.g., Blender)"
                      className="w-full px-3 py-2 mb-3 rounded-lg text-sm text-white placeholder-white/30 outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid rgba(${accentRgb}, 0.2)` }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddApp(); }}
                      autoFocus
                    />
                    <select
                      value={newAppCategory}
                      onChange={(e) => setNewAppCategory(e.target.value)}
                      className="w-full px-3 py-2 mb-4 rounded-lg text-sm text-white/80 outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid rgba(${accentRgb}, 0.2)` }}
                    >
                      {categoryOrder.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowAddDialog(false)}
                        className="px-4 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddApp}
                        disabled={!newAppName.trim()}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
                        style={{ background: accentColor, color: '#000' }}
                      >
                        Add
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
