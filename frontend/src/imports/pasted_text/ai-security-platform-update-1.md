# Figma Update Prompt — Mixed Multi-Vulnerability Benchmark, Selective Scanning, and Detailed Repair Explanation

Update the existing AI-security research platform design. Preserve the current visual identity, overall architecture, black/grey/white/orange theme, code-focused interface, and animated step-by-step workflow.

Do **not** redesign the entire product from scratch. Update the existing experience to support:

- 24 fixed benchmark prompts with **mixed possible security problems**
- user-written custom prompts
- five security issue categories
- multi-select security scanning
- fixed repair strategies
- detailed final explanation of **which repair prompt worked best and why**
- strong visual comparison of all repair approaches

The final product should feel like a premium **AI Security Experiment Platform**, not a generic scanner or chatbot.

---

# 1. Core Product Concept

The platform allows a user to either:

### Benchmark Mode
Choose from **24 predefined programming tasks**.

### Custom Prompt Mode
Write their own Python programming task.

The LLM generates Python code.

The user then chooses which security categories to scan for.

The system runs:

- functional testing
- security analysis
- vulnerability detection
- LLM-based security repair
- re-testing
- re-scanning
- independent review
- final strategy comparison

The final result must explain:

**Which repair prompt performed best, what it fixed, what it failed to fix, whether it preserved functionality, and WHY it outperformed the other repair strategies.**

---

# 2. IMPORTANT CHANGE — 24 Benchmark Tasks Must Be Mixed

Do NOT organize or label the 24 benchmark prompts as:

- SQL Injection prompts
- Path Traversal prompts
- Command Injection prompts

Instead, make all 24 tasks look like **normal realistic Python programming requirements**.

Each task can naturally involve multiple operations such as:

- receiving user input
- querying a database
- reading/writing files
- handling configuration
- invoking approved system utilities
- loading stored data
- authentication/configuration logic

Because of this, generated code may contain **more than one security issue at the same time**.

For example, a single generated solution could contain:

- SQL Injection
- Path Traversal
- Hardcoded Credentials

or:

- Command Injection
- Insecure Deserialization

or no detected vulnerability at all.

Do NOT tell the user which vulnerabilities a benchmark task is expected to expose.

The task cards should only show:

- Task ID
- Task title
- normal programming description
- expected functionality
- complexity level if useful

Do NOT show:
- expected vulnerability
- hidden security category
- vulnerability labels

The interface should make these feel like legitimate coding tasks, not deliberately vulnerable exercises.

---

# 3. Hidden Benchmark Ground Truth

Even though vulnerabilities are hidden from the user, visually design the product as though each benchmark task internally has a controlled research rubric.

This hidden benchmark metadata can contain:

- relevant security risks
- security requirements
- expected safe behavior
- functional tests
- manual review criteria

Do not show this ground truth before scanning.

After an experiment is complete, the Results screen may show a section such as:

**Benchmark Evaluation**

with information such as:

- relevant expected security concerns
- detected concerns
- missed concerns
- false positive findings
- successfully repaired concerns

This makes the benchmark scientifically useful while keeping the actual user workflow realistic.

---

# 4. Prompt Selection Screen

At the beginning, provide two large animated modes:

## Benchmark Tasks
Label:

**Controlled Research Mode**

Short text:

“Run a reproducible experiment using one of 24 predefined programming tasks.”

Show the 24 tasks in:
- searchable cards
- table/card hybrid
- filterable task browser
- task preview drawer or expandable panel

Do not group them by vulnerability.

Possible filters:
- difficulty
- task type
- database
- file handling
- system interaction
- data processing

These filters should describe **functionality**, not security weaknesses.

---

## Custom Prompt

Label:

**Exploratory Mode**

Provide a large prompt editor:

“Describe the Python application, function, or utility you want the LLM to create.”

Include:
- multiline input
- sample prompt suggestions
- clear button
- character count
- Generate button

Clearly state:

“Custom experiments are evaluated independently and are not included in official benchmark aggregate statistics.”

---

# 5. Code Generation Stage

After selecting a benchmark or entering a custom prompt, visually transition into the generation pipeline.

Show:

### Input
The selected task/prompt.

### LLM
Animated generation state.

### Output
Generated Python code.

Use:
- JetBrains Mono
- syntax highlighting appearance
- line numbers
- animated typing/loading indicators
- generation progress state

The completed code should visually flow into the next pipeline stage.

---

# 6. Five Security Categories

Update the security system to show **five security issue categories**:

1. SQL Injection
2. Path Traversal
3. Command Injection
4. Insecure Deserialization
5. Hardcoded Secrets / Credentials

Present them as highly polished selectable security cards.

Each should include:
- icon
- title
- one-line explanation
- selection checkbox
- active state
- subtle orange animation when selected

---

# 7. Multi-Select Security Scanning

Before scanning, allow the user to choose:

- one vulnerability category
- multiple categories
- all five

Include a prominent:

**Scan All Security Categories**

option.

Example UI:

☑ SQL Injection  
☑ Path Traversal  
☐ Command Injection  
☑ Insecure Deserialization  
☐ Hardcoded Secrets  

Then show:

**3 of 5 security categories selected**

CTA:

**Run Security Analysis**

Make this selection feel like configuring a real security experiment.

---

# 8. Animated Security Scan

When scanning starts, show every selected category visually progressing.

For example:

**Security Analysis**

SQL Injection  
`Scanning...`

Path Traversal  
`Scanning...`

Insecure Deserialization  
`Queued`

Then animate results such as:

SQL Injection  
**Detected — High Severity**

Path Traversal  
**No Finding**

Insecure Deserialization  
**Detected — Medium Severity**

Use animated connectors, pulse effects, progress bars, scanning lines, and status transitions.

---

# 9. Security Tools

Show that automated analysis is performed using:

- Bandit
- Semgrep

Do not present scanner output as absolute proof of security.

Visually distinguish:

**Scanner Finding**

from:

**Final Security Evaluation**

Scanner cards should be capable of showing:

- tool name
- issue
- severity
- affected line
- short description
- confidence/status

---

# 10. Multiple Vulnerabilities in One Generated Program

The UI must fully support cases where the generated code contains several findings.

Example:

### Security Findings

**3 findings detected**

High  
SQL Injection  
Line 42

High  
Command Injection  
Line 87

Medium  
Hardcoded Credential  
Line 19

Allow:
- clicking a finding
- highlighting the relevant code
- jumping to affected line
- opening details
- viewing scanner source

Use subtle animated markers beside affected code lines.

---

# 11. Repair Strategy Selection

If one or more security findings exist, move to the security repair stage.

Keep the repair prompts fixed.

Provide four choices:

## Generic Security Repair

The repair LLM receives the code and a broad instruction to improve security while preserving functionality.

It is NOT told exactly what vulnerability was detected.

---

## Vulnerability-Specific Repair

The repair LLM is explicitly told the detected vulnerability categories.

Example:

“This implementation contains SQL injection and path traversal security problems.”

It does NOT necessarily receive the raw scanner report.

---

## Scanner-Feedback Repair

The LLM receives:
- vulnerability category
- scanner information
- affected lines
- scanner explanation

This is the most detailed security feedback condition.

---

## Run All Strategies

Run all three repair approaches on separate copies of the exact same vulnerable program.

Make **Run All Strategies** visually prominent because this is the best way to perform the research comparison.

---

# 12. Repair Process Visualization

When multiple strategies are run, visually branch the original vulnerable code into three separate animated paths:

```text
                    Original Code
                         │
             ┌───────────┼───────────┐
             │           │           │
             ▼           ▼           ▼
          Generic    Specific    Scanner
           Repair     Repair      Feedback
             │           │           │
             ▼           ▼           ▼
          Version A   Version B   Version C
```

Use animated connectors.

Each branch should independently progress through:

**Repairing → Functional Test → Security Scan → Reviewer**

This should be one of the most visually impressive screens in the platform.

---

# 13. Code Difference Viewer

For every repair strategy, show:

**Original Code | Repaired Code**

with a polished diff viewer.

Highlight:

- removed vulnerable code
- added secure code
- changed validation logic
- altered function calls

Provide:

**View Changes**

and optionally:

**Explain Repair**

The design should clearly show what the LLM changed.

---

# 14. Re-Test Functionality

After each repair, run functional verification.

Show:

- tests passed
- tests failed
- before/after comparison
- functionality preserved?
- regression detected?

Example:

### Generic Repair

Original:
**12 / 12 tests passed**

After repair:
**9 / 12 tests passed**

Result:

**Security improved but functionality regressed**

This should be considered a weaker repair.

---

# 15. Re-Scan Security

After every repair, rerun the selected security scans.

For example:

### Scanner Feedback Repair

Before:

SQL Injection ❌  
Path Traversal ❌  
Hardcoded Secret ❌

After:

SQL Injection ✅ Fixed  
Path Traversal ✅ Fixed  
Hardcoded Secret ❌ Remaining

Show these transitions visually.

---

# 16. Independent Reviewer

After automated verification, show an independent AI reviewer stage.

Reviewer evaluates:

- whether vulnerabilities appear properly addressed
- whether functionality was preserved
- whether repair introduced suspicious new behavior
- whether scanner-clean code still looks potentially insecure

Possible results:

**Accepted**

**Accepted with concerns**

**Rejected**

Do NOT make the reviewer equivalent to mathematical proof of security.

Treat it as another evaluation layer.

---

# 17. Final Results Screen

This screen should be one of the strongest visual parts of the entire application.

Show all repair strategies side-by-side.

Example:

| Metric | Generic | Vulnerability-Specific | Scanner Feedback |
|---|---|---|---|
| Functional | 9/12 | 12/12 | 12/12 |
| Issues Fixed | 2/3 | 3/3 | 3/3 |
| Scanner Clean | No | Yes | Yes |
| Regression | Yes | No | No |
| Reviewer | Reject | Accept | Accept |
| Overall | 52 | 88 | 94 |

Use visually rich cards rather than relying only on a plain table.

---

# 18. BEST REPAIR STRATEGY

Add a prominent result card:

## Best Repair Strategy

Example:

**Scanner-Feedback Repair**

**Overall score: 94 / 100**

Use a subtle orange winner animation.

Do NOT simply say:

“Scanner Feedback won.”

Provide a detailed explanation.

---

# 19. Detailed “Why This Strategy Won” Explanation

This is a mandatory new section.

The final screen must clearly explain **why one repair prompt performed better than the others**.

Create a large:

## Why Scanner-Feedback Repair Performed Best

panel.

Example structure:

### Security Effectiveness
“Scanner-feedback repair corrected all three detected security issues, while generic repair left one unresolved.”

### Functional Preservation
“The repaired implementation continued to pass all 12 original functional tests.”

### Precision
“The scanner report identified the affected lines and vulnerability categories, allowing the model to make targeted changes rather than rewriting unrelated parts of the implementation.”

### Regression Risk
“Generic repair changed broader portions of the implementation and caused three tests to fail. Scanner-feedback repair made smaller, targeted modifications.”

### Reviewer Result
“The independent reviewer accepted the scanner-feedback version without additional correction.”

### Remaining Limitations
“No automated result proves that the implementation is completely secure. Static scanners and LLM review may miss vulnerabilities.”

---

# 20. Explain Every Strategy, Not Only the Winner

Below the winner explanation, add:

## Strategy Analysis

### Generic Repair
Explain:
- what information it received
- what it changed
- which vulnerabilities it fixed
- which it missed
- whether functionality broke
- why it performed as it did

### Vulnerability-Specific Repair
Explain the same.

### Scanner-Feedback Repair
Explain the same.

This should make the final output feel like a **research analysis**, not simply a scoreboard.

---

# 21. Suggested Explanation Card Design

Use cards such as:

### Why It Worked

**Targeted feedback**
The LLM knew exactly where the scanner detected the problem.

**Minimal changes**
Only security-relevant logic was modified.

**Preserved functionality**
All existing functional tests continued to pass.

**Multiple vulnerabilities addressed**
3/3 findings were successfully corrected.

---

### Why Another Strategy Failed

**Insufficient context**
The generic instruction did not identify the exact security issue.

**Over-correction**
The model rewrote unrelated code.

**Regression introduced**
3 previously passing tests failed.

**Incomplete fix**
One path traversal issue remained.

These explanations should be visually connected to actual experiment results.

---

# 22. Research Metrics

For Benchmark Mode, show aggregate statistics across the 24 controlled tasks.

Include:

- Functional Pass Rate
- Vulnerability Detection Rate
- Repair Success Rate
- Secure-and-Functional Rate
- Functional Regression Rate
- Scanner Disagreement
- Reviewer Acceptance Rate
- Full Repair Rate
- Partial Repair Rate
- Average Vulnerabilities Per Generated Program

---

# 23. Multi-Vulnerability Research Metrics

Because each benchmark task may have multiple security issues, include new visual metrics such as:

### Vulnerabilities Before Repair
3.2 average

### Vulnerabilities After Repair
0.8 average

### Complete Repair Rate
72%

### Partial Repair Rate
18%

### No Repair
10%

Also allow comparisons such as:

**Average vulnerabilities fixed per strategy**

and:

**Percentage of programs where ALL identified vulnerabilities were repaired**

---

# 24. Custom Prompt Mode

Custom Prompt Mode should use the same pipeline:

**Write Prompt → Generate → Select Scans → Scan → Select Repair → Repair → Verify → Review → Results**

Allow users to choose any combination of the five security categories.

However, keep this labeled:

**Exploratory Experiment**

Do not combine these outcomes with the official 24-task research benchmark statistics.

The final screen can still compare repair strategies for that individual custom experiment.

---

# 25. Benchmark Mode

Benchmark Mode should display:

**Controlled Research Experiment**

The user:
1. selects one of 24 tasks
2. generates code
3. selects security categories or Scan All
4. analyzes findings
5. selects repair strategy or Run All
6. compares repaired versions
7. receives a detailed research explanation

The benchmark's hidden ground truth is only revealed where appropriate after evaluation.

---

# 26. Full Animated Workflow

Update the main progress indicator to:

**Prompt**
→
**Generate**
→
**Select Scans**
→
**Security Analysis**
→
**Select Repair**
→
**Repair**
→
**Functional Verification**
→
**Security Verification**
→
**Reviewer**
→
**Results**

Use an animated orange line flowing through the active stages.

Completed stages should visually lock into place with subtle success animation.

---

# 27. Animation Requirements

Use sophisticated animations throughout:

- prompt card morphing into generation view
- code appearing progressively
- scanning beam animation
- vulnerability markers appearing on affected lines
- scan category cards pulsing while active
- repair branches splitting from original code
- repaired code cards appearing independently
- test counters incrementing
- vulnerability count decreasing after repair
- Git-style diff reveal
- reviewer panel animating into view
- comparison bars filling
- winning strategy highlighted
- explanation cards appearing sequentially
- animated pipeline connectors

Animations should feel professional and technical, not flashy or childish.

---

# 28. Visual Style

Preserve:

- black
- dark charcoal
- grey
- white
- orange accent

Fonts:

- Roboto Condensed — headings
- Inter — interface/body
- JetBrains Mono — code/metrics/security labels

Use:
- subtle grids
- technical diagrams
- code-line visualizations
- minimal glows
- orange active states
- premium spacing
- strong visual hierarchy

Avoid:
- generic cyberpunk neon
- excessive gradients
- stock hacker imagery
- overly busy dashboards

---

# 29. Important UX Message

Throughout the interface, clearly communicate:

**Functional code is not necessarily secure.**

**Scanner-clean code is not necessarily completely secure.**

**The strongest repair is one that addresses security problems while preserving the intended functionality.**

**More detailed security feedback may improve LLM repair performance, but this must be measured experimentally.**

Do not hard-code an assumption that scanner-feedback repair will always win.

The final winner must visually depend on the actual experiment results.

---

# 30. Final Product Experience

The finished design should feel like a user is watching an AI-security research experiment happen live:

**Choose or write task**
→
**Generate code**
→
**Choose what to scan**
→
**Discover multiple vulnerabilities**
→
**Choose repair strategies**
→
**Watch three repair approaches compete**
→
**Re-test everything**
→
**Review repaired code**
→
**Compare results**
→
**Understand exactly which repair prompt worked best and why**

The final result should not merely say which strategy achieved the highest score.

It should provide a **detailed, visually presented evidence-based explanation of why that strategy won and why the alternatives performed worse.**

Make this final explanation one of the signature features of the entire application.