# Animal Creation Framework

This framework provides a prescriptive, machine-friendly process for defining animals with reusable behaviors and capabilities. It is designed so an AI agent can create high-quality, self-consistent animals with minimal human intervention. Elephant and cat examples are provided as complete reference definitions.

---

## Core Principles
- **Schema first**: All animals follow one YAML schema so automated validators can run without custom logic.
- **Behavior reuse**: Prefer parameterized behaviors over species-specific duplicates.
- **Capability-driven**: Behaviors must be justified by declared capabilities (e.g., `spray_water` requires `trunk`).
- **Constraint aware**: Explicitly document timing, environment, and resource constraints for realistic scheduling.
- **Audit ready**: Include validation checklists and quality gates so another agent can score completeness and realism.

---

## Standard Animal Schema
Use this schema verbatim for every new animal definition. Keep values concise and behavior-focused.

```yaml
name: <Common name>
scientific_name: <Latin name>
taxonomy:
  class: Mammalia  # adjust only if non-mammal
  order: <Order>
  family: <Family>
size:
  length: <e.g., 2.7 m>
  weight: <e.g., 2700 kg>
habitat: <Primary environments>
diet: <Primary diet>
capabilities:
  - <capability_name>
behaviors:
  - name: <behavior_name>
    description: <what it does>
    inputs: <parameters or context needed>
    outputs: <expected result or state change>
    constraints: <timing, frequency, limits>
```

### Field-Level Guidance for AI Agents
- **name/scientific_name**: Prefer canonical names from reputable sources; avoid colloquialisms.
- **taxonomy**: Keep `class`, `order`, and `family` consistent; misclassified animals fail validation.
- **size**: Provide ranges where possible; include units.
- **habitat/diet**: Use broad but realistic descriptors (e.g., `Savannas`, `Temperate forests`, `Obligate carnivore`).
- **capabilities**: Declare only if they enable a behavior (e.g., `echolocation`, `burrowing`, `retractable_claws`).
- **behaviors**: Each behavior must cite required inputs and realistic constraints; avoid magical actions.

### Behavior Design Rules
1. **Orthogonality**: One behavior = one action.
2. **Parameterization**: Prefer inputs (e.g., `terrain_type`, `target_distance`) over separate behaviors.
3. **Capability linkage**: Every behavior must be explainable by at least one capability.
4. **Constraint specificity**: Include cadence (per day), situational limits, or resource costs (energy, hydration).
5. **Output usefulness**: Outputs must change state or emit events that the simulation can consume.

### Shared Behavior Library (recommend using these names)
- `forage` – find and consume plant matter.
- `hunt` – pursue and capture prey.
- `graze` – slow feeding in open areas.
- `sleep` – restorative rest; include duration/frequency.
- `groom` – self-cleaning; include triggers and cadence.
- `vocalize` – species communication; include call type and purpose.
- `migrate` – long-distance movement; include seasonal triggers.
- `play` – social or developmental play; include social context.
- `thermoregulate` – actions that adjust body temperature (shade-seeking, ear-flapping, panting).

---

## Validation Workflow (for automated agents)
1. **Schema compliance**: Ensure all fields exist and types match the schema.
2. **Capability-behavior mapping**: Verify every behavior is supported by at least one capability; flag unsupported actions.
3. **Constraint completeness**: Reject behaviors missing constraints or inputs.
4. **Realism checks**: Cross-check habitat/diet against behaviors (e.g., no `swim` without aquatic access capability/habitat).
5. **Reuse preference**: Suggest mapping to the Shared Behavior Library when names deviate but intents match.
6. **Quality scoring** (0–5):
   - 0–1: Missing fields or unrealistic behaviors
   - 2–3: Complete schema but weak linkage or vague constraints
   - 4: Complete with clear linkage and constraints
   - 5: Complete, linked, and includes at least one distinctive capability-driven behavior

---

## Reference Animals

### Elephant (African Bush Elephant)
```yaml
name: African Bush Elephant
scientific_name: Loxodonta africana
taxonomy:
  class: Mammalia
  order: Proboscidea
  family: Elephantidae
size:
  length: 6-7.5 m
  weight: 2700-6000 kg
habitat: Savannas, forests, grasslands
diet: Herbivorous (grasses, leaves, bark)
capabilities:
  - trunk
  - tusks
  - large_ears_for_thermoregulation
  - high_memory
behaviors:
  - name: forage
    description: Search for and consume plant matter.
    inputs: terrain_type, vegetation_density
    outputs: energy_gain, hydration_change
    constraints: 12-18 hours per day; slower in extreme heat.
  - name: spray_water
    description: Draw and spray water for cooling or play.
    inputs: water_source_distance, ambient_temperature
    outputs: temperature_drop, hydration_loss
    constraints: Requires water within trunk reach; used more often above 30°C.
  - name: trumpet_alert
    description: Emit a loud trumpet to warn the herd of threats.
    inputs: threat_level, herd_distance
    outputs: herd_alerted_state
    constraints: Triggered at high threat_level; increases herd cohesion.
  - name: flap_ears
    description: Flap ears to dissipate heat and deter insects.
    inputs: ambient_temperature, insect_density
    outputs: temperature_drop, insect_deterrence
    constraints: More frequent above 28°C or high insect_density; minor energy cost.
```

**Behavior–Capability Mapping**
- `spray_water` → `trunk`
- `trumpet_alert` → `trunk`
- `flap_ears` → `large_ears_for_thermoregulation`
- `forage` → general locomotion (implicit) + `high_memory` (route recall)

### Cat (Domestic Cat)
```yaml
name: Domestic Cat
scientific_name: Felis catus
taxonomy:
  class: Mammalia
  order: Carnivora
  family: Felidae
size:
  length: 46 cm (average)
  weight: 3-5 kg
habitat: Domestic environments, urban areas
diet: Obligate carnivore (small prey, kibble)
capabilities:
  - retractable_claws
  - night_vision
  - agility
  - whisker_navigation
behaviors:
  - name: stalk
    description: Quietly approach prey or toys.
    inputs: target_distance, ambient_light
    outputs: engagement_position
    constraints: More effective in low light; uses retractable_claws for grip.
  - name: groom
    description: Clean fur using tongue and paws.
    inputs: grooming_duration
    outputs: cleanliness_state
    constraints: Multiple short sessions per day; pauses when interrupted.
  - name: purr
    description: Produce rhythmic vibrations when content or seeking comfort.
    inputs: social_context, comfort_level
    outputs: calming_effect, social_bonding
    constraints: Activates during rest, gentle interaction, or mild stress relief.
  - name: climb
    description: Ascend furniture or trees to gain vantage or safety.
    inputs: surface_type, target_height
    outputs: elevated_position
    constraints: Requires grip-friendly surfaces; limited by agility and height tolerance.
```

**Behavior–Capability Mapping**
- `stalk` → `night_vision`, `retractable_claws`, `agility`
- `groom` → general flexibility (implicit)
- `purr` → vocal mechanism (implicit baseline for felids)
- `climb` → `retractable_claws`, `agility`, `whisker_navigation`

---

## Agent Playbook for Creating a New Animal
1. **Gather facts**: Collect taxonomy, size range, primary habitat, and diet.
2. **List capabilities**: Identify physical/physiological enablers (e.g., `echolocation`, `venom`, `burrowing`).
3. **Select behaviors**: Start from the Shared Behavior Library; add species-specific actions powered by capabilities.
4. **Define inputs/outputs**: Make every behavior measurable and state-changing.
5. **Add constraints**: Include frequency, environmental triggers, and resource costs.
6. **Run validation**: Apply the Validation Workflow and target a quality score of 4–5.
7. **Document**: Save as YAML (schema above) in a consistent location (e.g., `docs/animals/<animal>.yml`).

### Quickstart Template
```yaml
name: <Animal>
scientific_name: <Latin name>
taxonomy:
  class: Mammalia
  order: <Order>
  family: <Family>
size:
  length: <value>
  weight: <value>
habitat: <List environments>
diet: <Primary diet>
capabilities:
  - <capability>
behaviors:
  - name: <behavior>
    description: <action>
    inputs: <inputs needed>
    outputs: <outcome>
    constraints: <limits>
```
