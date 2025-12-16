// src/ui/TuningPanel.js
// Schema-driven tuning overlay for animal modules with fixed, collapsible panel.

const STORAGE_KEYS = {
  collapsed: 'zoo.tuning.collapsed',
  width: 'zoo.tuning.width',
  groupOpen: (group) => `zoo.tuning.group.${group}.open`
};

const DEFAULT_GROUP_ORDER = {
  Global: 0,
  Skeleton: 1,
  Torso: 2,
  Trunk: 3,
  Tusks: 4,
  Legs: 5,
  Materials: 6,
  Debug: 7,
  'Debug Rings': 8,
  Advanced: 9
};

const DEFAULT_OPEN_GROUPS = new Set(['Global', 'Skeleton', 'Bones', 'Torso', 'Trunk', 'Tusks']);

export class TuningPanel {
  constructor({
    onTuningChange,
    onReset,
    onPresetLoad,
    onFrame,
    onCameraReset,
    onUndo,
    onRedo,
    onInstrumentChange,
    programOptions = [],
    defaultProgram = null,
    defaultProgramName = 'Default instrument'
  } = {}) {
    this.onTuningChange = onTuningChange;
    this.onReset = onReset;
    this.onPresetLoad = onPresetLoad;
    this.onFrame = onFrame;
    this.onCameraReset = onCameraReset;
    this.onUndo = onUndo;
    this.onRedo = onRedo;
    this.onInstrumentChange = onInstrumentChange;

    this.schema = {};
    this.values = {};
    this.defaults = {};
    this.schemaVersion = '1.0.0';
    this.currentAnimalId = null;
    this.inputs = new Map();
    this.groupEntries = [];
    this.searchQuery = '';
    this.showAdvanced = false;
    this.tierFilter = 'all';
    this.programOptions = programOptions || [];
    this.selectedProgram = typeof defaultProgram === 'number' ? defaultProgram : null;
    this.defaultProgramName = defaultProgramName;

    this.panelWidth = this.readStoredWidth();
    this.collapsed = this.readStoredCollapsed();

    this.root = this.createRoot();
    this.fieldsContainer = this.root.querySelector('.zoo-tuning-fields');
    this.resetButton = this.root.querySelector('#zoo-tuning-reset');
    this.frameButton = this.root.querySelector('#zoo-tuning-frame');
    this.collapseButton = this.root.querySelector('#zoo-tuning-collapse');
    this.cameraResetButton = this.root.querySelector('#zoo-tuning-camera-reset');
    this.rebuildIndicator = this.root.querySelector('#zoo-tuning-rebuilding');
    this.presetSelect = this.root.querySelector('#zoo-tuning-preset-select');
    this.presetNameInput = this.root.querySelector('#zoo-tuning-preset-name');
    this.savePresetButton = this.root.querySelector('#zoo-tuning-save');
    this.loadPresetButton = this.root.querySelector('#zoo-tuning-load');
    this.searchInput = this.root.querySelector('#zoo-tuning-search');
    this.advancedToggle = this.root.querySelector('#zoo-tuning-show-advanced');
    this.tierFilterSelect = this.root.querySelector('#zoo-tuning-tier-filter');
    this.resizeHandle = this.root.querySelector('.zoo-tuning-resize-handle');
    this.pill = document.getElementById('zoo-tuning-pill');
    this.undoButton = this.root.querySelector('#zoo-tuning-undo');
    this.redoButton = this.root.querySelector('#zoo-tuning-redo');
    this.deletePresetButton = this.root.querySelector('#zoo-tuning-delete');
    this.instrumentSelect = this.root.querySelector('#zoo-tuning-instrument');

    this.attachEventListeners();
    this.updateResponsiveMode();
    this.applyCollapsedState();
    this.setInstrumentOptions(this.programOptions, this.selectedProgram, this.defaultProgramName);
  }

  attachEventListeners() {
    this.resetButton?.addEventListener('click', () => {
      if (typeof this.onReset === 'function') {
        this.onReset();
      }
    });

    this.frameButton?.addEventListener('click', () => {
      if (typeof this.onFrame === 'function') {
        this.onFrame();
      }
    });

    this.cameraResetButton?.addEventListener('click', () => {
      if (typeof this.onCameraReset === 'function') {
        this.onCameraReset();
      }
    });

    this.undoButton?.addEventListener('click', () => {
      if (typeof this.onUndo === 'function') {
        this.onUndo();
      }
    });

    this.redoButton?.addEventListener('click', () => {
      if (typeof this.onRedo === 'function') {
        this.onRedo();
      }
    });

    this.collapseButton?.addEventListener('click', () => {
      this.setCollapsed(true);
    });

    this.pill?.addEventListener('click', () => {
      this.setCollapsed(false);
    });

    this.savePresetButton?.addEventListener('click', () => {
      this.savePreset();
    });

    this.loadPresetButton?.addEventListener('click', () => {
      this.loadSelectedPreset();
    });

    this.deletePresetButton?.addEventListener('click', () => {
      this.deleteSelectedPreset();
    });

    this.searchInput?.addEventListener('input', () => {
      this.searchQuery = this.searchInput.value.trim().toLowerCase();
      this.renderFields();
    });

    this.advancedToggle?.addEventListener('change', () => {
      this.showAdvanced = Boolean(this.advancedToggle.checked);
      this.renderFields();
    });

    this.tierFilterSelect?.addEventListener('change', () => {
      this.tierFilter = this.tierFilterSelect.value || 'all';
      this.renderFields();
    });

    this.instrumentSelect?.addEventListener('change', () => {
      const value = this.instrumentSelect.value;
      const programNumber = value === '' ? null : Number(value);
      this.selectedProgram = programNumber;
      if (typeof this.onInstrumentChange === 'function') {
        this.onInstrumentChange(programNumber);
      }
    });

    this.resizeHandle?.addEventListener('mousedown', (event) => {
      if (this.isCompact()) return;
      const startX = event.clientX;
      const startWidth = this.root.getBoundingClientRect().width;
      const maxWidth = Math.min(600, window.innerWidth - 48);
      const minWidth = 320;

      const onMove = (moveEvent) => {
        const delta = startX - moveEvent.clientX;
        const next = Math.min(Math.max(startWidth + delta, minWidth), maxWidth);
        this.applyWidth(next, true);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    window.addEventListener('resize', () => this.updateResponsiveMode());
  }

  createRoot() {
    let panel = document.getElementById('zoo-tuning-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'zoo-tuning-panel';
    panel.className = 'zoo-tuning-panel';
    panel.style.width = this.panelWidth ? `${this.panelWidth}px` : '';

    panel.innerHTML = `
      <div class="zoo-tuning-resize-handle" aria-hidden="true"></div>
      <div class="zoo-tuning-inner">
        <div class="zoo-tuning-header">
          <div class="zoo-tuning-title-row">
            <div class="zoo-tuning-title">
              <h4>Tuning</h4>
              <span id="zoo-tuning-rebuilding" class="zoo-tuning-rebuilding" aria-live="polite">Rebuilding…</span>
            </div>
            <div class="zoo-tuning-actions">
              <button id="zoo-tuning-undo" type="button" class="ghost">Undo</button>
              <button id="zoo-tuning-redo" type="button" class="ghost">Redo</button>
              <button id="zoo-tuning-frame" type="button" class="ghost">Frame</button>
              <button id="zoo-tuning-camera-reset" type="button" class="ghost">Reset Cam</button>
              <button id="zoo-tuning-reset" type="button" class="accent">Reset</button>
              <button id="zoo-tuning-collapse" type="button" class="ghost">Collapse</button>
            </div>
          </div>
          <div class="zoo-tuning-search">
            <input id="zoo-tuning-search" type="search" placeholder="Search controls" aria-label="Search tuning controls" />
          </div>
          <div class="zoo-tuning-filters">
            <label class="zoo-inline-toggle">
              <input id="zoo-tuning-show-advanced" type="checkbox" />
              <span>Show advanced</span>
            </label>
            <label class="zoo-inline-toggle">
              Tier
              <select id="zoo-tuning-tier-filter">
                <option value="all">All</option>
                <option value="A">Tier A</option>
                <option value="B">Tier B</option>
              </select>
            </label>
          </div>
        </div>
          <div class="zoo-tuning-body">
          <div class="zoo-tuning-audio">
            <label for="zoo-tuning-instrument">Instrument</label>
            <select id="zoo-tuning-instrument"></select>
          </div>
          <div class="zoo-tuning-presets">
            <div class="zoo-tuning-presets-row">
              <input id="zoo-tuning-preset-name" type="text" placeholder="Preset name" />
              <button id="zoo-tuning-save" type="button">Save</button>
            </div>
            <div class="zoo-tuning-presets-row">
              <select id="zoo-tuning-preset-select"></select>
              <button id="zoo-tuning-load" type="button">Load</button>
              <button id="zoo-tuning-delete" type="button" class="ghost">Delete</button>
            </div>
          </div>
          <div class="zoo-tuning-fields"></div>
        </div>
      </div>
    `;

    const pill = document.createElement('button');
    pill.id = 'zoo-tuning-pill';
    pill.className = 'zoo-tuning-pill';
    pill.type = 'button';
    pill.textContent = 'Tuning';

    document.body.appendChild(panel);
    document.body.appendChild(pill);

    return panel;
  }

  setSchema(
    schema = {},
    values = {},
    animalId = null,
    defaults = {},
    schemaVersion = '1.0.0',
    audioConfig = {}
  ) {
    this.currentAnimalId = animalId ?? this.currentAnimalId;
    this.schema = schema || {};
    this.schemaVersion = schemaVersion || '1.0.0';
    this.defaults = { ...defaults };
    this.values = { ...this.defaults, ...values };
    const audioOptions = audioConfig || {};
    this.programOptions = audioOptions.programOptions || this.programOptions;
    this.selectedProgram =
      typeof audioOptions.selectedProgram === 'number' ? audioOptions.selectedProgram : null;
    this.defaultProgramName = audioOptions.defaultProgramName || this.defaultProgramName;
    this.setRebuilding(false);
    this.refreshPresetOptions();

    if (this.advancedToggle) {
      this.advancedToggle.checked = this.showAdvanced;
    }
    if (this.tierFilterSelect) {
      this.tierFilterSelect.value = this.tierFilter;
    }

    this.setInstrumentOptions(this.programOptions, this.selectedProgram, this.defaultProgramName);

    this.groupEntries = Object.entries(this.schema).map(([key, meta = {}]) => {
      const label = meta.label || key;
      const type = meta.type || (meta.enum ? 'enum' : 'float');
      const group = meta.group || 'Global';
      const groupOrder = meta.groupOrder ?? DEFAULT_GROUP_ORDER[group] ?? 99;
      const order = meta.order ?? 0;
      const tier = (meta.tier || 'A').toUpperCase();
      const defaultValue = this.getDefaultForKey(key, meta);
      const advanced = Boolean(meta.advanced || group.toLowerCase().includes('advanced') || group.toLowerCase().includes('debug'));

      return { key, label, type, group, groupOrder, order, tier, meta, defaultValue, advanced };
    });

    this.renderFields();
  }

  setInstrumentOptions(programs = [], selectedProgram = null, defaultProgramName = 'Default instrument') {
    this.programOptions = Array.isArray(programs) ? programs : [];
    this.selectedProgram = typeof selectedProgram === 'number' ? selectedProgram : null;
    this.defaultProgramName = defaultProgramName || 'Default instrument';

    if (!this.instrumentSelect) return;

    this.instrumentSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = this.defaultProgramName;
    this.instrumentSelect.appendChild(defaultOption);

    for (const program of this.programOptions) {
      const option = document.createElement('option');
      option.value = program.number;
      option.textContent = program.name
        ? `${program.name} (${program.number})`
        : `Program ${program.number}`;
      if (this.selectedProgram === program.number) {
        option.selected = true;
      }
      this.instrumentSelect.appendChild(option);
    }

    if (this.selectedProgram === null) {
      this.instrumentSelect.value = '';
    }
  }

  setValues(values = {}) {
    this.values = { ...this.values, ...values };
    for (const [key, entry] of this.inputs.entries()) {
      if (!Object.prototype.hasOwnProperty.call(this.values, key)) continue;
      const val = this.values[key];
      const { slider, number, checkbox, valueEl } = entry;
      if (checkbox) {
        checkbox.checked = Boolean(val);
      }
      if (slider) {
        slider.value = val;
      }
      if (number) {
        number.value = val;
      }
      if (valueEl) {
        valueEl.textContent = this.formatValue(val, entry.meta);
      }
    }
  }

  renderFields() {
    if (!this.fieldsContainer) return;
    this.inputs.clear();
    this.fieldsContainer.innerHTML = '';

    const grouped = new Map();
    for (const entry of this.groupEntries) {
      const matchesSearch = this.matchesSearch(entry);
      const matchesTier = this.tierFilter === 'all' || entry.tier === this.tierFilter;
      const isAdvanced = entry.advanced;
      if (!matchesSearch || (!this.showAdvanced && isAdvanced) || !matchesTier) continue;
      if (!grouped.has(entry.group)) {
        grouped.set(entry.group, { order: entry.groupOrder, entries: [] });
      }
      grouped.get(entry.group).entries.push(entry);
    }

    const sortedGroups = Array.from(grouped.entries()).sort((a, b) => a[1].order - b[1].order);

    if (!sortedGroups.length) {
      const empty = document.createElement('div');
      empty.className = 'zoo-tuning-empty';
      empty.textContent = 'No controls match your filters.';
      this.fieldsContainer.appendChild(empty);
      return;
    }

    for (const [groupName, group] of sortedGroups) {
      group.entries.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
      const section = document.createElement('section');
      section.className = 'zoo-tuning-group';

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'zoo-tuning-group-header';
      header.textContent = groupName;

      const content = document.createElement('div');
      content.className = 'zoo-tuning-group-body';
      let storedOpen = this.readGroupOpen(groupName);
      const searchActive = Boolean(this.searchQuery);
      const open = searchActive ? true : storedOpen;
      content.hidden = !open;
      header.setAttribute('aria-expanded', open ? 'true' : 'false');
      header.classList.toggle('closed', !open);

      header.addEventListener('click', () => {
        const toggledOpen = content.hidden;
        storedOpen = toggledOpen;
        this.storeGroupOpen(groupName, storedOpen);
        content.hidden = !toggledOpen;
        header.setAttribute('aria-expanded', toggledOpen ? 'true' : 'false');
        header.classList.toggle('closed', !toggledOpen);
      });

      for (const entry of group.entries) {
        const row = this.createField(entry);
        if (row) content.appendChild(row);
      }

      section.appendChild(header);
      section.appendChild(content);
      this.fieldsContainer.appendChild(section);
    }
  }

  createField(entry) {
    const { key, label, type, meta, defaultValue } = entry;
    if (type === 'bool' || type === 'boolean') {
      return this.createBooleanField(entry, defaultValue);
    }
    return this.createNumericField(entry, defaultValue);
  }

  createBooleanField(entry, defaultValue) {
    const { key, label } = entry;
    const wrapper = document.createElement('label');
    wrapper.className = 'zoo-tuning-field boolean';

    const left = document.createElement('span');
    left.textContent = label;

    const right = document.createElement('div');
    right.className = 'zoo-tuning-boolean-row';

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'zoo-tuning-reset';
    reset.title = 'Reset';
    reset.textContent = '⟳';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(this.values[key] ?? defaultValue);

    input.addEventListener('change', () => {
      const value = input.checked;
      this.applyValue(key, value, entry);
    });

    reset.addEventListener('click', () => {
      const value = Boolean(defaultValue);
      input.checked = value;
      this.applyValue(key, value, entry);
    });

    right.appendChild(reset);
    right.appendChild(input);
    wrapper.appendChild(left);
    wrapper.appendChild(right);

    this.inputs.set(key, { checkbox: input, meta: entry.meta });
    return wrapper;
  }

  createNumericField(entry, defaultValue) {
    const { key, label, meta } = entry;
    const wrapper = document.createElement('div');
    wrapper.className = 'zoo-tuning-field numeric';

    const header = document.createElement('div');
    header.className = 'zoo-tuning-field-header';

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'zoo-tuning-value';
    const currentValue = this.values[key] ?? defaultValue ?? 0;
    valueEl.textContent = this.formatValue(currentValue, meta);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'zoo-tuning-reset';
    reset.title = 'Reset';
    reset.textContent = '⟳';

    header.appendChild(labelEl);
    header.appendChild(valueEl);
    header.appendChild(reset);

    const controls = document.createElement('div');
    controls.className = 'zoo-tuning-control-row';

    const baseStep = meta.step ?? 0.01;
    const fineStep = meta.fineStep ?? (meta.step ? meta.step / 10 : 0.001);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'zoo-tuning-range';
    slider.min = meta.min ?? 0;
    slider.max = meta.max ?? 1;
    slider.step = baseStep;
    slider.value = currentValue;

    const number = document.createElement('input');
    number.type = 'number';
    number.className = 'zoo-tuning-number';
    number.min = meta.min ?? 0;
    number.max = meta.max ?? 1;
    number.step = baseStep;
    number.value = currentValue;

    const applyFromValue = (raw, emit = true) => {
      const numericValue = this.clampValue(raw, meta);
      slider.value = numericValue;
      number.value = numericValue;
      valueEl.textContent = this.formatValue(numericValue, meta);
      if (emit) {
        this.applyValue(key, numericValue, entry);
      }
    };

    slider.addEventListener('pointerdown', (event) => {
      slider.step = event.shiftKey ? fineStep : baseStep;
    });

    slider.addEventListener('pointerup', () => {
      slider.step = baseStep;
    });

    slider.addEventListener('input', () => {
      applyFromValue(slider.value);
    });

    number.addEventListener('change', () => {
      applyFromValue(number.value);
    });

    number.addEventListener('dblclick', () => {
      applyFromValue(defaultValue);
    });

    number.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      const step = event.shiftKey ? fineStep : baseStep;
      const direction = event.key === 'ArrowUp' ? 1 : -1;
      const next = Number(number.value || 0) + direction * step;
      applyFromValue(next);
      event.preventDefault();
    });

    reset.addEventListener('click', () => {
      applyFromValue(defaultValue);
    });

    controls.appendChild(slider);
    controls.appendChild(number);

    wrapper.appendChild(header);
    wrapper.appendChild(controls);

    this.inputs.set(key, { slider, number, valueEl, meta: entry.meta });
    return wrapper;
  }

  applyValue(key, value, entry) {
    this.values[key] = value;
    if (typeof this.onTuningChange === 'function') {
      this.onTuningChange({ key, value, meta: entry.meta, patch: { [key]: value }, values: { ...this.values } });
    }
  }

  matchesSearch(entry) {
    if (!this.searchQuery) return true;
    const haystack = `${entry.key} ${entry.label} ${entry.group}`.toLowerCase();
    return haystack.includes(this.searchQuery);
  }

  getDefaultForKey(key, meta = {}) {
    if (Object.prototype.hasOwnProperty.call(meta, 'default')) return meta.default;
    if (Object.prototype.hasOwnProperty.call(this.defaults, key)) return this.defaults[key];
    return meta.type === 'boolean' ? false : 0;
  }

  clampValue(value, meta = {}) {
    const min = meta.min ?? -Infinity;
    const max = meta.max ?? Infinity;
    const num = Number(value);
    if (Number.isNaN(num)) return min;
    return Math.min(Math.max(num, min), max);
  }

  formatValue(value, meta = {}) {
    if (typeof meta.format === 'function') return meta.format(value);
    const decimals = typeof meta.format === 'number' ? meta.format : 3;
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    return num.toFixed(decimals);
  }

  getPresetStore() {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem('zoo.tuningPresets');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  writePresetStore(store) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('zoo.tuningPresets', JSON.stringify(store));
  }

  refreshPresetOptions() {
    if (!this.presetSelect) return;
    const store = this.getPresetStore();
    const presets = this.currentAnimalId && store[this.currentAnimalId] ? store[this.currentAnimalId] : {};
    this.presetSelect.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = presets && Object.keys(presets).length ? 'Choose preset' : 'No presets';
    this.presetSelect.appendChild(placeholder);

    for (const name of Object.keys(presets)) {
      const option = document.createElement('option');
      option.value = name;
      const meta = presets[name];
      const version = meta?.schemaVersion ? ` · v${meta.schemaVersion}` : '';
      option.textContent = `${name}${version}`;
      this.presetSelect.appendChild(option);
    }
  }

  savePreset() {
    if (!this.currentAnimalId) return;
    const nameInput = this.presetNameInput;
    const presetName = (nameInput?.value || '').trim() || `Preset ${new Date().toLocaleTimeString()}`;
    const store = this.getPresetStore();
    const animalPresets = store[this.currentAnimalId] || {};
    const existing = animalPresets[presetName];

    if (existing && typeof window !== 'undefined') {
      const confirmed = window.confirm(`Preset "${presetName}" exists. Overwrite?`);
      if (!confirmed) return;
    }

    const now = new Date().toISOString();
    const payload = {
      speciesId: this.currentAnimalId,
      schemaVersion: this.schemaVersion,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      tuning: { ...this.values }
    };

    animalPresets[presetName] = payload;
    store[this.currentAnimalId] = animalPresets;
    this.writePresetStore(store);
    this.refreshPresetOptions();
    if (this.presetSelect) {
      this.presetSelect.value = presetName;
    }
  }

  loadSelectedPreset() {
    if (!this.currentAnimalId || !this.presetSelect) return;
    const selected = this.presetSelect.value;
    if (!selected) return;

    const store = this.getPresetStore();
    const animalPresets = store[this.currentAnimalId] || {};
    const presetValues = animalPresets[selected];
    if (!presetValues) return;

    const payload = presetValues.tuning || presetValues;
    this.setValues(payload);
    if (typeof this.onPresetLoad === 'function') {
      this.onPresetLoad({ ...payload }, selected, presetValues);
    } else if (typeof this.onTuningChange === 'function') {
      this.onTuningChange({ values: { ...payload }, patch: { ...payload } });
    }
  }

  deleteSelectedPreset() {
    if (!this.currentAnimalId || !this.presetSelect) return;
    const selected = this.presetSelect.value;
    if (!selected) return;

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Delete preset "${selected}"?`);
      if (!confirmed) return;
    }

    const store = this.getPresetStore();
    const animalPresets = store[this.currentAnimalId] || {};
    delete animalPresets[selected];
    store[this.currentAnimalId] = animalPresets;
    this.writePresetStore(store);
    this.refreshPresetOptions();
    if (this.presetSelect) {
      this.presetSelect.value = '';
    }
  }

  setCollapsed(next) {
    this.collapsed = Boolean(next);
    this.applyCollapsedState();
    this.storeCollapsed(this.collapsed);
  }

  applyCollapsedState() {
    if (!this.root || !this.pill) return;
    this.root.classList.toggle('collapsed', this.collapsed);
    this.pill.classList.toggle('visible', this.collapsed);
  }

  isCompact() {
    return this.root?.classList.contains('compact');
  }

  updateResponsiveMode() {
    if (!this.root) return;
    const compact = window.innerWidth < 900;
    this.root.classList.toggle('compact', compact);
    if (compact) {
      this.root.style.removeProperty('width');
    } else if (this.panelWidth) {
      this.applyWidth(this.panelWidth, false);
    }
  }

  applyWidth(widthPx, persist = false) {
    if (!this.root || this.isCompact()) return;
    this.panelWidth = widthPx;
    this.root.style.width = `${widthPx}px`;
    if (persist) {
      this.storeWidth(widthPx);
    }
  }

  readStoredCollapsed() {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(STORAGE_KEYS.collapsed);
    return raw === 'true';
  }

  storeCollapsed(value) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.collapsed, value ? 'true' : 'false');
  }

  readStoredWidth() {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEYS.width);
    const parsed = raw ? Number(raw) : null;
    if (!parsed || Number.isNaN(parsed)) return null;
    const maxWidth = Math.min(600, window.innerWidth - 48);
    return Math.min(Math.max(parsed, 320), maxWidth);
  }

  storeWidth(value) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.width, `${value}`);
  }

  readGroupOpen(group) {
    const key = STORAGE_KEYS.groupOpen(group);
    if (typeof localStorage !== 'undefined' && localStorage.getItem(key) !== null) {
      return localStorage.getItem(key) === 'true';
    }
    return DEFAULT_OPEN_GROUPS.has(group);
  }

  storeGroupOpen(group, open) {
    if (typeof localStorage === 'undefined') return;
    const key = STORAGE_KEYS.groupOpen(group);
    localStorage.setItem(key, open ? 'true' : 'false');
  }

  setRebuilding(isRebuilding) {
    if (!this.rebuildIndicator) return;
    this.rebuildIndicator.classList.toggle('visible', Boolean(isRebuilding));
  }
}
