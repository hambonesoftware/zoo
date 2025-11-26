// src/animals/Anteater/AnteaterDefinition.js

import YAML from 'yaml';

const anteaterYamlUrl = new URL('../../../docs/animals/anteater.yml', import.meta.url);

const AnteaterDefinition = {
  behaviors: [],
  capabilities: [],
  getBehaviorNames() {
    return this.behaviors.map((behavior) => behavior.name);
  },
  toMetadata() {
    return {
      name: this.name,
      scientific_name: this.scientific_name,
      taxonomy: this.taxonomy,
      size: this.size,
      habitat: this.habitat,
      diet: this.diet,
      capabilities: this.capabilities,
      behaviors: this.behaviors
    };
  }
};

async function loadAnteaterSpec() {
  try {
    const response = await fetch(anteaterYamlUrl.href);
    const yamlText = await response.text();
    const parsed = YAML.parse(yamlText) || {};

    Object.assign(AnteaterDefinition, parsed, {
      behaviors: parsed.behaviors || [],
      capabilities: parsed.capabilities || []
    });
  } catch (error) {
    console.error('[AnteaterDefinition] Failed to load anteater.yml:', error);
  }
}

loadAnteaterSpec();

export { AnteaterDefinition };
