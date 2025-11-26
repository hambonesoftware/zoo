// src/animals/Anteater/AnteaterDefinition.js

import YAML from 'yaml';
import anteaterYaml from '../../../docs/animals/anteater.yml?raw';

const anteaterSpec = YAML.parse(anteaterYaml);

export const AnteaterDefinition = {
  ...anteaterSpec,
  behaviors: anteaterSpec.behaviors || [],
  capabilities: anteaterSpec.capabilities || [],
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
