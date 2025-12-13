// src/ui/TuningPanel.js
// Simple schema-driven tuning overlay for animal modules.

export class TuningPanel {
  constructor({ onTuningChange, onReset, onPresetLoad } = {}) {
    this.onTuningChange = onTuningChange;
    this.onReset = onReset;
    this.onPresetLoad = onPresetLoad;
    this.schema = {};
    this.values = {};
    this.currentAnimalId = null;
    this.inputs = new Map();
    this.root = this.createRoot();
    this.fieldsContainer = this.root.querySelector('.zoo-tuning-fields');
    this.resetButton = this.root.querySelector('#zoo-tuning-reset');
    this.presetSelect = this.root.querySelector('#zoo-tuning-preset-select');
    this.presetNameInput = this.root.querySelector('#zoo-tuning-preset-name');
    this.savePresetButton = this.root.querySelector('#zoo-tuning-save');
    this.loadPresetButton = this.root.querySelector('#zoo-tuning-load');
    this.resetButton?.addEventListener('click', () => {
      if (typeof this.onReset === 'function') {
        this.onReset();
      }
    });

    this.savePresetButton?.addEventListener('click', () => {
      this.savePreset();
    });

    this.loadPresetButton?.addEventListener('click', () => {
      this.loadSelectedPreset();
    });
  }

  createRoot() {
    let existing = document.getElementById('zoo-tuning-panel');
    if (existing) return existing;

    const panel = document.createElement('div');
    panel.id = 'zoo-tuning-panel';
    panel.style.position = 'fixed';
    panel.style.top = '16px';
    panel.style.right = '16px';
    panel.style.background = 'rgba(0,0,0,0.7)';
    panel.style.color = '#fff';
    panel.style.padding = '12px';
    panel.style.borderRadius = '8px';
    panel.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';
    panel.style.width = '260px';
    panel.style.zIndex = '1200';
    panel.style.backdropFilter = 'blur(4px)';

    panel.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <h4 style="margin: 0; font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase;">Tuning</h4>
        <div style="display: flex; gap: 6px;">
          <button id="zoo-tuning-reset" type="button" style="background: #ffd166; color: #111; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-weight: 600;">Reset</button>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
        <div style="display: flex; gap: 6px;">
          <input id="zoo-tuning-preset-name" type="text" placeholder="Preset name" style="flex: 1; padding: 6px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #fff;" />
          <button id="zoo-tuning-save" type="button" style="background: #06d6a0; color: #111; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-weight: 600;">Save</button>
        </div>
        <div style="display: flex; gap: 6px;">
          <select id="zoo-tuning-preset-select" style="flex: 1; padding: 6px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #fff;"></select>
          <button id="zoo-tuning-load" type="button" style="background: #118ab2; color: #fff; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-weight: 600;">Load</button>
        </div>
      </div>
      <div class="zoo-tuning-fields" style="margin-top: 8px; display: flex; flex-direction: column; gap: 10px;"></div>
    `;

    document.body.appendChild(panel);
    return panel;
  }

  clearFields() {
    this.inputs.clear();
    if (this.fieldsContainer) {
      this.fieldsContainer.innerHTML = '';
    }
  }

  setSchema(schema = {}, values = {}, animalId = null) {
    this.currentAnimalId = animalId ?? this.currentAnimalId;
    this.schema = schema || {};
    this.values = { ...values };
    this.clearFields();

    this.refreshPresetOptions();

    const entries = Object.entries(this.schema);
    for (const [key, meta] of entries) {
      const type = meta?.type || 'number';
      const label = meta?.label || key;
      const value = Object.prototype.hasOwnProperty.call(this.values, key)
        ? this.values[key]
        : meta?.default ?? (type === 'boolean' ? false : 0);

      if (type === 'boolean') {
        this.createBooleanField(key, label, Boolean(value));
      } else {
        this.createRangeField(key, label, value, meta);
      }
    }
  }

  setValues(values = {}) {
    this.values = { ...values };
    for (const [key, input] of this.inputs.entries()) {
      if (!Object.prototype.hasOwnProperty.call(this.values, key)) continue;
      const val = this.values[key];
      if (input.type === 'checkbox') {
        input.checked = Boolean(val);
      } else {
        input.value = val;
        const display = input.parentElement?.querySelector('.zoo-tuning-value');
        if (display) display.textContent = Number(val).toFixed(3);
      }
    }
  }

  createBooleanField(key, label, value) {
    const wrapper = document.createElement('label');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'space-between';
    wrapper.style.gap = '8px';
    wrapper.style.fontSize = '13px';

    const span = document.createElement('span');
    span.textContent = label;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value;
    input.addEventListener('change', () => {
      this.values[key] = input.checked;
      this.emitChange(key, input.checked);
    });

    wrapper.appendChild(span);
    wrapper.appendChild(input);
    this.fieldsContainer?.appendChild(wrapper);
    this.inputs.set(key, input);
  }

  createRangeField(key, label, value, meta = {}) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '4px';
    wrapper.style.fontSize = '13px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.gap = '8px';

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'zoo-tuning-value';
    valueEl.style.fontVariantNumeric = 'tabular-nums';
    valueEl.style.opacity = '0.8';
    valueEl.textContent = Number(value).toFixed(3);

    header.appendChild(labelEl);
    header.appendChild(valueEl);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = meta.min ?? 0;
    input.max = meta.max ?? 1;
    input.step = meta.step ?? 0.01;
    input.value = value;
    input.addEventListener('input', () => {
      const numericValue = Number(input.value);
      valueEl.textContent = numericValue.toFixed(3);
      this.values[key] = numericValue;
      this.emitChange(key, numericValue);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(input);
    this.fieldsContainer?.appendChild(wrapper);
    this.inputs.set(key, input);
  }

  emitChange(key, value) {
    if (typeof this.onTuningChange === 'function') {
      this.onTuningChange({ [key]: value }, { ...this.values });
    }
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
      option.textContent = name;
      this.presetSelect.appendChild(option);
    }
  }

  savePreset() {
    if (!this.currentAnimalId) return;
    const nameInput = this.presetNameInput;
    const presetName = (nameInput?.value || '').trim() || `Preset ${new Date().toLocaleTimeString()}`;
    const store = this.getPresetStore();
    const animalPresets = store[this.currentAnimalId] || {};
    animalPresets[presetName] = { ...this.values };
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

    this.setValues(presetValues);
    if (typeof this.onPresetLoad === 'function') {
      this.onPresetLoad({ ...presetValues }, selected);
    } else if (typeof this.onTuningChange === 'function') {
      this.onTuningChange({ ...presetValues }, { ...presetValues });
    }
  }
}
