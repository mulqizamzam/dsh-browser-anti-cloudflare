# Better Harness Task-Loop Report

## At a Glance

- Loop Effectiveness: 34/100 (changes only after comparable later task outcomes)
- Asset Health / Repair Progress: 0/100 (0 verified, 0 partial, 5 pending)
- Demonstrated autonomy radius: not observed (not observed; not observed confidence)
- Strongest loop: Not enough evidence difference to name one.
- Largest observed leak: Use the priority moves; no single loop is uniquely weakest.
- Top expected gain: No priority benefit is available in this evidence boundary.

## What You Can Rely On Today

- No reliable user outcome has been demonstrated in this evidence boundary yet.

## What You Gain Next

- No priority Harness move is available in this evidence boundary.



### Why these moves matter

### No AGENTS.md or scoped instruction directs agents to project entrypoints
- Priority: Medium · Evidence: not observed in this boundary
- Reason: New DSH plugin package lacks AGENTS.md, CLAUDE.md, or any scoped instructions. Agents working in this workspace have no guidance on how to build, test, or install the plugin. README.md describes manual installation but does not connect to agent workflows. Consequence: every task requires manual source code traversal to understand plugin mechanics.
- Expected Output:
  1. Agent can find build and install commands without reading full source.

### No automated tests for core stealth browser pathways
- Priority: High · Evidence: not observed in this boundary
- Reason: Source has 3 files (~290 lines) with anti-detection logic (navigator.webdriver patch, WebGL randomization, CDP interception) but zero test files. No verification mechanism is exercised — every code change risks breaking stealth behavior undetected. Consequence: production regressions in anti-detection go unnoticed.
- Expected Output:
  1. npx vitest run tests/stealth.test.ts passes

### package.json missing build and typecheck scripts
- Priority: Medium · Evidence: not observed in this boundary
- Reason: tsdown.config.ts and strict tsconfig.json exist, but package.json defines no build, typecheck, or prepare scripts. Agents lack standard commands to verify TypeScript changes remain compile-safe. Consequence: breaking type changes can reach lib/ undetected.
- Expected Output:
  1. npm run typecheck exits 0
  2. npm run build produces lib/

### Plugin installation relies on manual README docs, no automated hook
- Priority: Low · Evidence: not observed in this boundary
- Reason: README explains manual cordis.patch.yml insert but provides no ready-to-use profile template or helper script. Agents must copy-paste YAML configuration manually — YAML type errors cause silent boot failures. Consequence: high friction for first-time adoption.
- Expected Output:
  1. Agent can install the plugin with one command or clear document.

### browserUse slot conflict prevention relies on README warning, not technical enforcement
- Priority: Medium · Evidence: not observed in this boundary
- Reason: Plugin claims exclusive browserUse slot and README warns about conflicts, but no runtime precondition check validates the slot is free before registration. If two providers register simultaneously, errors surface only at boot and are hard to diagnose. Consequence: increased debug time on profile conflicts.
- Expected Output:
  1. Informative error message on slot conflict, not generic registration failure.

## Five Lifecycle Dimensions

| Dimension | What the evidence proves | Evidence boundary | Summary | Boundary / blocker |
| --- | --- | --- | --- | --- |
| Task Understanding | Not observed yet | not observed in this boundary | No AGENTS.md; agent lacks acceptance boundary from authoritative project source. | not observed |
| Controlled Execution | Not observed yet | not observed in this boundary | Build command not defined in package.json; tsdown config exists but without standard script. | not observed |
| Change Validation | Not observed yet | not observed in this boundary | Zero test files; zero mechanised lint/typecheck gate. TypeScript strict enabled but not auto-executed. | not observed |
| Reliable Delivery | Not observed yet | not observed in this boundary | Installation only manual documentation; zero CI/PR gate; browserUse slot exclusivity only README warning. | not observed |
| Learning Capture | Not observed yet | not observed in this boundary | Zero comparable task history; no learning opportunity detected or transformed yet. | not observed |

## The 15 Small Checks

| Dimension | Small check | What the evidence proves | Evidence boundary |
| --- | --- | --- | --- |


## Evidence and Boundaries

- Episode coverage: 0 episodes, 0 edited, 0 closed, 0 repaired-and-passed
- Model: agent-work-loop-v4
- Session selection: not observed; 0 sessions analyzed of 0 eligible sessions; not observed confidence
- Delivery grades observed: not observed
- Source gaps: not observed
- Learning comparison: Not observed; 0 declared intervention(s)
