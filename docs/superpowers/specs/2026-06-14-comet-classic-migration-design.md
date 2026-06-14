# Comet Classic Migration Design

## 1. Summary

Plan 2 migrates the existing Comet 0.3.8 full, hotfix, and tweak workflows onto the
Skill Engine Foundation without changing the commands users invoke.

Users continue to use:

- `/comet`
- `/comet-open`
- `/comet-design`
- `/comet-build`
- `/comet-verify`
- `/comet-archive`
- `/comet-hotfix`
- `/comet-tweak`

Internally, all three workflow profiles use one non-user-facing `comet-classic`
Skill Package and one TypeScript Classic Resolver. Existing shell script names and
command contracts remain available as compatibility facades, but they no longer
parse or mutate `.comet.yaml`.

Plan 2 is based on the completed Plan 1 branch
`codex/comet-skill-engine-foundation`. It must not be implemented directly from
`feat-workflow`, because that branch does not contain the required Skill Engine
interfaces.

## 2. Goals

- Preserve the observable 0.3.8 behavior of full, hotfix, and tweak workflows.
- Make the TypeScript engine the only writer of `.comet.yaml`.
- Automatically and silently migrate legacy changes on first access through any
  existing Comet entry point.
- Keep all 0.3.8 fields as synchronized compatibility projections after migration.
- Represent classic execution as a durable Run with a Skill snapshot, Trajectory,
  Context, Artifacts, Checkpoints, and pending actions.
- Preserve plan-ready pauses, auto-transition, verification failure recovery,
  branch handling, archive confirmation, context recovery, preset upgrades, and
  delegated-agent checkpoints.
- Establish a repeatable classic baseline benchmark before optimizing the classic
  workflow.

## 3. Non-Goals

- Do not change the number or names of user-facing Skills.
- Do not expose `comet-classic` as a slash command.
- Do not implement the Plan 3 `comet skill` authoring commands.
- Do not implement `/comet-any`, Skill generation, or Skill Eval publishing gates.
- Do not remove or deprecate legacy `.comet.yaml` fields.
- Do not introduce a general condition-expression language in Skill YAML.
- Do not make the generic engine understand Comet phases or classic field names.
- Do not directly modify the original Superpowers or OpenSpec Skills.
- Do not optimize the classic workflow based on benchmark results in this plan.

## 4. Chosen Approach

Use one internal `comet-classic` Skill Package with a TypeScript Classic Resolver
and atomic dual projection.

The alternatives were rejected:

1. Three classic Skill Packages would duplicate orchestration and Guardrails and
   would drift over time.
2. Adding classic conditions directly to the generic engine would couple the core
   loop to Comet-specific fields.
3. Encoding filesystem, Git, task, and verification conditions in YAML would create
   a new workflow DSL that is harder to audit than TypeScript.
4. Using adaptive Agent planning for migration would not provide strict 0.3.8
   compatibility.

## 5. Architecture

### 5.1 Generic Engine Extension

Plan 1 supports static deterministic steps through `SkillStep.next`. Plan 2 adds a
small generic resolver boundary so deterministic workflows may calculate their next
step without teaching the core about classic state.

Conceptually:

```ts
export interface DeterministicResolver<TContext = unknown> {
  resolveCurrentStep(pkg: SkillPackage, state: RunState, context: TContext): SkillStep | null;
  resolveAfterOutcome(
    pkg: SkillPackage,
    state: RunState,
    outcome: ActionOutcome,
    context: TContext,
  ): RunState;
}
```

The existing static `next` behavior remains the default resolver. The Classic
Resolver implements this interface from `src/compat/`. `src/engine/` must not import
`src/compat/`.

### 5.2 Compatibility Components

`src/compat/classic-state.ts`

- Defines and validates the complete 0.3.8 state projection.
- Preserves unknown top-level fields.
- Normalizes YAML values without converting missing fields to the string
  `"undefined"`.
- Produces one typed `ClassicState` used by migration, resolution, status, doctor,
  and compatibility commands.

`src/compat/classic-resolver.ts`

- Purely resolves classic steps, transitions, next-skill routing, entry checks, and
  recovery guidance.
- Handles the existing `init`, `get`, `set`, `transition`, `next`, `check`,
  `check --recover`, `scale`, and `task-checkoff` semantics.
- Returns proposed state and evidence; it performs no filesystem writes.

`src/compat/classic-evidence.ts`

- Collects filesystem, task, plan, Git, build, verification, handoff, and archive
  evidence.
- Keeps platform execution separate from state resolution.
- Represents every check as structured evidence before rendering the legacy output.

`src/compat/classic-migrate.ts`

- Detects a legacy change by the absence of `classic_migration`.
- Selects the full, hotfix, or tweak profile.
- Derives the current internal step from legacy fields and evidence.
- Creates and validates the `comet-classic` snapshot.
- Creates the Run files and migration Trajectory event.
- Is silent, automatic, and idempotent.

`src/compat/classic-store.ts`

- Is the only writer for classic `.comet.yaml`.
- Atomically writes Run fields and all legacy compatibility fields together.
- Preserves unknown fields.
- Rejects conflicting Run and legacy projections instead of guessing.

`src/compat/classic-handoff.ts`

- Generates the existing full and beta context packages.
- Uses the same source-file and hash contract as 0.3.8.
- Writes the engine Context Snapshot and legacy `handoff_context` /
  `handoff_hash` projection in one state commit.

`src/compat/classic-archive.ts`

- Models archive as a recoverable pending action.
- Runs OpenSpec archive, verifies the resulting main specs, annotates linked
  documents, and completes state in the moved archive directory.
- Detects an already-moved change after interruption and resumes rather than
  repeating the irreversible OpenSpec operation.

`src/compat/classic-cli.ts`

- Implements the internal command protocol used by shell facades.
- Preserves legacy stdout, stderr, and exit-code contracts.
- Converts unexpected failures to concise diagnostics without stack traces unless
  an explicit debug environment variable is enabled.

### 5.3 Internal Skill Package

Create one internal package in both language asset trees:

```text
assets/skills-zh/comet-classic/
  SKILL.md
  comet/
    skill.yaml
    guardrails.yaml
    evals.yaml

assets/skills/comet-classic/
  SKILL.md
  comet/
    skill.yaml
    guardrails.yaml
    evals.yaml
```

The package declares the existing user-facing Comet Skills as dependencies. Its
steps refer to stable internal step IDs and invoke the same user-facing Skill that
owns the current stage. It is installed and snapshotted but is not registered or
documented as a user command.

Per repository policy, the Chinese Skill Package is authored and reviewed first.
The English package is synchronized only after user confirmation. Generated
runtime bundles are language-neutral and are not independently hand-edited.

## 6. Classic Step Model

Stable internal steps are more precise than the legacy `phase` field:

```text
full.open
full.design.handoff
full.design.document
full.build.plan
full.build.plan-ready
full.build.configure
full.build.execute
full.build.complete
full.build.fix
full.verify.run
full.verify.branch
full.archive.confirm
full.archive.execute
completed
```

Hotfix and tweak use the same semantic suffixes under their profile:

```text
hotfix.open
hotfix.build.execute
hotfix.build.complete
hotfix.verify.run
hotfix.verify.branch
hotfix.archive.confirm
hotfix.archive.execute

tweak.open
tweak.build.execute
tweak.build.complete
tweak.verify.run
tweak.verify.branch
tweak.archive.confirm
tweak.archive.execute
```

Several internal steps may invoke the same user-facing Skill. For example,
`full.build.plan`, `full.build.configure`, and `full.build.execute` all invoke
`comet-build`; the precise step exists for recovery and auditing, not to create new
commands.

Preset upgrade does not replace the Skill snapshot. Changing `workflow` from
hotfix/tweak to full updates `classic_profile` and resolves the next step under the
`full.*` namespace.

## 7. Migration

### 7.1 Trigger

Every existing entry point performs `ensureClassicRun()` before reading or acting
on a change:

- state commands
- guards
- handoff generation
- archive execution
- hook inspection
- status and doctor
- user-facing Comet Skills through their existing script calls

If migration fails, the original command fails closed. No command may fall back to
the old shell state machine.

### 7.2 Migration Fields

Migration adds:

```yaml
skill: comet-classic
classic_profile: full
classic_migration: 1
run_id: <uuid>
skill_version: "1"
skill_hash: <sha256>
orchestration: deterministic
current_step: full.build.execute
iteration: 0
pending: null
pending_ref: .comet/pending-action.json
trajectory_ref: .comet/trajectory.jsonl
context_ref: .comet/context.md
artifacts_ref: .comet/artifacts.json
checkpoint_ref: .comet/checkpoint.json
run_status: running
run_retries: "{}"
```

All 0.3.8 fields remain present and are updated in the same atomic write as these
Run fields.

### 7.3 Step Derivation

Migration derives the internal step deterministically:

- `workflow` selects the profile.
- `phase` selects the coarse stage.
- `handoff_context`, `handoff_hash`, and `design_doc` select the design substep.
- `plan`, `build_pause`, `isolation`, `build_mode`, `subagent_dispatch`,
  `tdd_mode`, and `direct_override` select the build substep.
- OpenSpec and Superpowers plan checkboxes select build execute or complete.
- `verify_result`, `verification_report`, and `branch_status` select verify, fix,
  or branch handling.
- `archived: true` selects `completed`.

Identical legacy state and evidence must produce the same step.

### 7.4 Migration Artifacts

The first successful migration:

- creates the content-addressed classic Skill snapshot;
- creates a Run with one stable `run_id`;
- writes `run_started` and `classic_migrated` Trajectory events;
- imports the existing handoff file and hash as the initial Context Snapshot;
- records linked proposal, design, tasks, Design Doc, Plan, verification report,
  branch, and delegated progress files in Artifacts;
- writes a Checkpoint containing hashes, not duplicate mutable state.

`subagent-progress.md` remains the durable delegated-agent progress file. It is
referenced as an Artifact and covered by Checkpoint hashing; migration must not
create a second independently editable copy.

Repeated migration validates the snapshot and projection. It does not create a new
Run or append duplicate migration events.

## 8. State and Transition Semantics

The engine writes Run and legacy projections together:

```text
read YAML + evidence
  -> validate projection agreement
  -> resolve event
  -> produce next Run + ClassicState
  -> write one temporary YAML file
  -> atomic rename
  -> append/reconcile Trajectory
```

The legacy fields remain a supported compatibility projection for Plan 2 and later
plans. They are not temporary migration scratch fields.

The resolver preserves all existing transition behavior:

- full `open-complete` enters design;
- hotfix/tweak `open-complete` enters build;
- `build-complete` requires build decisions and preserves prior verification
  evidence during a re-verify cycle;
- `verify-fail` returns to build and preserves handled branch state;
- `verify-pass` requires a report and handled branch;
- `archive-reopen` returns to verify only when not archived;
- `archived` marks the moved change complete;
- `auto_transition: false` pauses Skill invocation after state advancement;
- preset upgrade changes profile and continues under full semantics.

## 9. Shell and Distribution Strategy

### 9.1 Generated Runtime Bundle

The installed Skills must remain usable even when Comet was invoked through `npx`
and is not permanently available on `PATH`.

The build produces one self-contained ESM bundle from `src/compat/classic-cli.ts`
and its runtime dependencies:

```text
assets/skills-zh/comet/scripts/comet-runtime.mjs
assets/skills/comet/scripts/comet-runtime.mjs
```

Both files are generated from the same TypeScript source and must be byte-identical.
They are added to `assets/manifest.json`. A build or prepublish check fails if the
generated files are stale.

The runtime bundle is not manually edited. It is regenerated after TypeScript
changes.

### 9.2 Shell Facades

The existing script files remain at their current paths:

- `comet-state.sh`
- `comet-guard.sh`
- `comet-handoff.sh`
- `comet-archive.sh`

They:

- locate `node` and `comet-runtime.mjs`;
- forward arguments and relevant environment variables;
- preserve process output and exit status;
- contain no YAML parser, state transition, hash implementation, or independent
  recovery rules.

`comet-env.sh` exports the runtime path in addition to existing script paths.

`comet-hook-guard.sh` remains a synchronous hook facade. Its write-decision
operation is read-only after `ensureClassicRun()` has completed. The shared
`ensureClassicRun()` precondition may perform the one-time atomic migration before
inspection; the hook contains no separate parser, migration path, or state writer.
It calls the runtime `inspect-write` command and fails closed when an active change
exists but the runtime cannot inspect it.

## 10. Runtime and Side Effects

### 10.1 Guards

The TypeScript compatibility runtime creates a structured check plan and evidence
report. Runtime adapters execute configured build or verification commands without
allowing shell metacharacter injection.

Guard output retains the current `[PASS]`, `[FAIL]`, `BLOCKED`, and
`ALL CHECKS PASSED` text contracts. `--apply` commits the transition only after all
checks pass.

### 10.2 Context Snapshot

Handoff generation preserves:

- full and beta modes;
- source ordering;
- sha256 compatibility;
- JSON and Markdown output;
- source-traceability markers;
- current legacy paths and output text.

The engine Context file records a stable reference to the generated context package
and its hash. The legacy fields continue to point to the existing handoff JSON.

### 10.3 Archive Transaction

Archive confirmation remains in the user-facing `/comet-archive` Skill. After
confirmation:

1. validate entry state and target;
2. persist an archive pending action;
3. run OpenSpec archive;
4. locate the resulting archive directory;
5. verify main specs contain no delta-only headings;
6. annotate the linked Design Doc and Plan idempotently;
7. atomically complete Run and legacy state in the moved directory;
8. clear the pending action;
9. reconcile the final Trajectory event.

If execution stops after the move, resume locates the archive directory and
continues from the pending action. It never reruns OpenSpec archive when the move is
already visible.

## 11. Failure Handling

- Migration failure leaves the original `.comet.yaml` unchanged.
- Snapshot failure prevents migration.
- Conflicting legacy and Run projections report the exact conflicting fields.
- Missing or malformed required evidence blocks transition.
- Missing Node or runtime bundle causes a non-zero facade exit with installation
  repair guidance.
- A pending action inconsistent with filesystem state enters explicit recovery.
- Irreversible operations are never automatically repeated after ambiguous failure.
- Context, Artifact, Checkpoint, and pending-action references must stay inside the
  change directory.
- Trajectory is append-only. If a state commit succeeds but event append fails,
  recovery appends the missing event from the committed state and pending metadata.

## 12. Compatibility Testing

### 12.1 Frozen 0.3.8 Contracts

Before replacing shell implementations, capture fixtures for:

- init defaults for full, hotfix, and tweak;
- get/set validation;
- every transition event;
- every phase guard and `--apply`;
- plan-ready pause and stale-pause recovery;
- auto-transition routing;
- verification fail and re-verify evidence preservation;
- branch handling;
- archive confirmation outcomes and archive resume;
- full and beta context handoff;
- context recovery messages;
- preset upgrade;
- task checkoff;
- scale selection;
- delegated-agent checkpoint recovery;
- hook write decisions.

The contract includes normalized YAML, stdout, stderr, and exit status.

### 12.2 Differential Harness

A differential harness runs each fixture through:

1. a frozen 0.3.8 reference implementation;
2. the TypeScript Classic Resolver through the shell facade.

It compares:

- normalized legacy state;
- Run projection expectations;
- exit status;
- stable output lines;
- created files and hashes.

Expected additions such as Run fields, snapshots, and Trajectory are excluded from
legacy equality but asserted separately.

### 12.3 Engine and Migration Tests

Add direct TypeScript tests for:

- every legacy-to-step mapping;
- idempotent migration;
- migration from each phase and profile;
- projection conflict detection;
- atomic dual writes;
- Context import;
- delegated progress hashing;
- archive interruption recovery;
- facade argument and exit-code forwarding;
- generated runtime bundle parity.

Foundation tests remain independent and must continue to pass without classic
fixtures.

## 13. Classic Baseline Benchmark

Reuse the existing execution benchmark JSON and Markdown conventions. Add a classic
baseline runner that records:

- migration success rate;
- stage completion rate;
- recovery success rate;
- state drift count;
- test pass rate;
- specification coverage;
- token usage;
- duration;
- retries.

The benchmark includes full, hotfix, and tweak fixtures and at least one interruption
and resume case. Dry-run results are deterministic and covered by unit tests. Live
runs are opt-in and may use the existing agent command adapters.

Plan 2 records the baseline. It does not change classic behavior to improve scores.

## 14. Rollout

1. Freeze 0.3.8 contracts and reference fixtures.
2. Add the generic deterministic resolver boundary.
3. Implement ClassicState, migration, resolver, store, and evidence collection.
4. Add and validate the Chinese `comet-classic` Skill Package.
5. After user confirmation, synchronize the English package.
6. Generate and test the bundled runtime.
7. Convert state, guard, handoff, archive, and hook scripts to facades.
8. Switch status and doctor to the shared typed state reader.
9. Run differential compatibility tests.
10. Establish the classic baseline benchmark.
11. Append all behavior changes and tests to the existing `0.4.0` Changelog unless
    master has advanced.

There is no fallback to the old shell writer after rollout. Compatibility is
provided by contracts and facades, not by maintaining two active state machines.

## 15. Success Criteria

- Existing user-facing Skill names and invocation habits are unchanged.
- A legacy full, hotfix, or tweak change silently migrates from any existing entry
  point.
- Repeated access does not create another Run or migration event.
- The TypeScript engine is the only `.comet.yaml` writer.
- Run and all 0.3.8 fields remain synchronized in one atomic state commit.
- Every frozen 0.3.8 compatibility fixture passes through the new facades.
- Plan-ready, auto-transition, verify-fail, branch, archive, context recovery,
  preset upgrade, and delegated checkpoint behavior remains covered.
- Archive interruption is recoverable without repeating OpenSpec archive.
- `comet-classic` is snapshotted but not exposed as a user command.
- Foundation tests and the full existing test suite remain green.
- Classic baseline benchmark output is reproducible in dry-run mode.
