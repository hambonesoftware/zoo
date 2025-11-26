# AGENT_ANIMAL_CREATION

## Purpose
Create a complete, validated creature definition for the Zoo project using a reusable YAML schema and behavior library. The agent should produce a self-consistent animal that downstream systems can load without manual fixes.

## Inputs
- Species facts: taxonomy, size ranges with units, habitat(s), and diet.
- Capability research: anatomical or physiological enablers (e.g., trunk, echolocation, venom).
- Shared Behavior Library (preferred behavior names listed below).
- Target output path (recommended): `docs/animals/<animal>.yml`.

## Outputs
- YAML animal definition conforming to the standard schema.
- Behavior–capability mapping notes.
- Completed validation checklist with self-assigned quality score (0–5).

## Standard Animal Schema (use verbatim)
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

### Field Guidance
- **name/scientific_name**: Prefer canonical names; avoid colloquialisms.
- **taxonomy**: Keep class/order/family consistent; misclassification fails validation.
- **size**: Provide ranges where possible; include units.
- **habitat/diet**: Broad but realistic descriptors (e.g., `Savannas`, `Obligate carnivore`).
- **capabilities**: Declare only if they enable behaviors (e.g., `echolocation`, `burrowing`).
- **behaviors**: Each behavior needs inputs, outputs, and constraints; avoid magical actions.

**Required fields**: `name`, `scientific_name`, full `taxonomy`, both `size` dimensions, `habitat`, `diet`, ≥1 `capability`, and ≥1 `behavior` with all subfields.

**Recommended**: Multiple habitats/diets if seasonal, capability qualifiers (e.g., `venom_strength`), and detailed constraints such as energy cost or time-of-day.

## Shared Behavior Library (reuse these names when possible)
- `forage` – find and consume plant matter.
- `hunt` – pursue and capture prey.
- `graze` – slow feeding in open areas.
- `sleep` – restorative rest; include duration/frequency.
- `groom` – self-cleaning; include triggers and cadence.
- `vocalize` – species communication; include call type and purpose.
- `migrate` – long-distance movement; include seasonal triggers.
- `play` – social or developmental play; include social context.
- `thermoregulate` – actions that adjust body temperature (shade-seeking, ear-flapping, panting).

### Behavior Design Rules
1. One behavior = one action (orthogonality).
2. Prefer parameterization over duplicates (e.g., `terrain_type`, `target_distance`).
3. Every behavior must map to at least one capability.
4. Constraints must express cadence or limits (frequency per day, triggers, resource costs).
5. Outputs must change state or emit events the simulation can consume.

### Behavior Input/Output Cheatsheet
- **Inputs**: context the agent must supply (e.g., `terrain_type`, `prey_size`, `ambient_temperature`).
- **Outputs**: state changes the simulation can track (e.g., `energy_gain`, `threat_alerted`, `hydration_loss`).
- **Constraints**: cadence/limits (frequency, environmental triggers, resource trade-offs).

## Workflow
1. **Gather facts**: Collect taxonomy, size range with units, primary habitat, and diet.
2. **List capabilities**: Identify enablers that justify behaviors (e.g., `echolocation`, `venom`, `burrowing`).
3. **Select behaviors**: Start from the Shared Behavior Library; add species-specific actions powered by capabilities.
4. **Define I/O**: Give each behavior measurable inputs, outputs, and realistic constraints.
5. **Map linkage**: Document capability–behavior mappings; remove behaviors with no supporting capability.
6. **Validate**: Run the validation workflow and assign a quality score (target 4–5).
7. **Save**: Write the YAML using the standard schema to `docs/animals/<animal>.yml` (or provided path).

## Validation Workflow
1. **Schema compliance**: Ensure all fields exist and types match the schema.
2. **Capability–behavior mapping**: Every behavior is justified by at least one capability.
3. **Constraint completeness**: Behaviors include constraints and inputs; reject vague entries.
4. **Realism checks**: Habitat/diet align with behaviors (e.g., no `swim` without aquatic access/capability).
5. **Reuse preference**: Map to Shared Behavior Library when names deviate but intents match.
6. **Quality scoring (0–5)**:
   - 0–1: Missing fields or unrealistic behaviors.
   - 2–3: Complete schema but weak linkage or vague constraints.
   - 4: Complete with clear linkage and constraints.
   - 5: Complete, linked, and includes at least one distinctive capability-driven behavior.

## Completeness Checklist (fill before finalizing)
- [ ] All required fields present with concrete values and units where applicable.
- [ ] Each behavior links to at least one declared capability.
- [ ] Inputs, outputs, and constraints are specific and measurable (no empty or generic text).
- [ ] Habitats and diet logically support the behaviors.
- [ ] YAML validates against the schema with no extra keys.

## Reference Animals
Use these as templates or sanity checks when crafting new creatures.

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
