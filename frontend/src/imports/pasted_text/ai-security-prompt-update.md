Figma Update Prompt — Add Benchmark + Custom Prompt Modes

Update the existing AI-security research platform design so that the initial code-generation step supports BOTH predefined benchmark prompts and user-written custom prompts.

Do not redesign the entire product from scratch. Preserve the current visual system, dark black/grey/white/orange theme, animations, code panels, pipeline flow, and existing screens. Focus on improving the Prompt Selection / Experiment Start experience and updating later screens so the selected mode remains clear throughout the workflow.

Main change

On the initial prompt-selection screen, give the user two clear modes:

1. Benchmark Mode

This is the controlled research mode.

The user can select from 24 predefined benchmark programming tasks divided into three vulnerability categories:

8 SQL Injection related tasks

8 Path Traversal related tasks

8 Command Injection related tasks

Show these as polished interactive cards or rows with:

Task ID

Task title

Vulnerability category

Short task description

Expected functionality

Security requirement

Difficulty or complexity indicator if useful

Allow:

category filtering

search

task preview

selecting one task

visually highlighting the selected task

CTA such as Run Benchmark Task

Make Benchmark Mode visually communicate that it is the official research/evaluation mode with predefined tests and security requirements.

Use a small label such as:

Controlled Research Mode

and a short explanation:

“Use predefined benchmark tasks with fixed functional tests and security requirements for reproducible evaluation.”

2. Custom Prompt Mode

Add a second mode where the user can enter their own Python programming prompt.

Use a visually prominent custom prompt editor area with:

large multiline text input

character count

optional example prompts

clear/reset button

CTA such as Generate From Custom Prompt

Example placeholder:

“Describe the Python program you want the LLM to generate…”

Example prompts can include:

“Create a Python function that retrieves a user from a SQLite database by username.”

“Create a Python file-serving function that reads documents from a local folder.”

“Create a Python utility that runs an approved system command with user-provided arguments.”

Clearly label this mode:

Exploratory Mode

Explain that custom prompts are useful for demonstrations and experimentation, but results are not directly included in the controlled benchmark statistics because arbitrary tasks may not have predefined functional tests or manual security ground truth.

Do not make this warning look negative. Present it as useful research context.

Mode selection UX

At the top of the screen, use a visually strong toggle/tab system:

Benchmark Tasks | Custom Prompt

The transition between the two should be animated.

Ideas:

sliding orange indicator

cards smoothly transforming

fade/scale transitions

background glow changing subtly

prompt content panel sliding horizontally

The user should immediately understand which mode is active.

Update the pipeline indicator

The existing visual pipeline should reflect the selected mode.

For Benchmark Mode:

Select Benchmark → Generate → Functional Test → Security Scan → Select Repair → Repair → Verify → Review → Results

For Custom Prompt Mode:

Write Prompt → Generate → Functional Analysis → Security Scan → Select Repair → Repair → Verify → Review → Results

Keep both experiences visually consistent.

Important distinction for testing custom prompts

For predefined benchmark tasks, continue to show:

pytest functional tests

Bandit

Semgrep

predefined security requirement

manual/research rubric

official benchmark statistics

For custom prompts, visually communicate that functionality assessment may be more limited because no predefined test suite necessarily exists.

On the custom prompt result screens, display a small status such as:

Custom Experiment

instead of:

Benchmark Run

If functional tests are automatically generated or available later, show them, but the UI should not imply that custom-prompt results have the same scientific ground truth as benchmark experiments.

Generation screen update

After the user chooses either mode, show a compact context card above the generated code.

For Benchmark Mode show:

Benchmark Task

Task ID

Category

Task title

For Custom Prompt Mode show:

Custom Prompt

user-entered prompt preview

“Exploratory Experiment” badge

Then continue into the existing animated code-generation experience.

Security scan screen

Keep the existing Bandit and Semgrep analysis.

Show:

Functional status

Bandit findings

Semgrep findings

vulnerability category

severity

affected lines

summary

For benchmark tasks, also display:

Expected Security Requirement

For custom prompts, replace this with:

Detected Security Concerns

so the interface does not pretend there is predefined ground truth.

Repair prompt selection

Keep the existing predefined repair strategies:

Generic Security Repair

The LLM is only instructed to improve the security of the code while preserving functionality.

Vulnerability-Specific Repair

The LLM is told which vulnerability category was detected.

Scanner-Feedback Repair

The LLM receives the actual Bandit/Semgrep security findings.

Run All Strategies

Runs all predefined repair strategies so their results can be compared.

These repair strategies should stay fixed for both Benchmark and Custom Prompt modes.

The user should NOT manually rewrite these official repair prompts in the primary workflow.

However, visually show the exact prompt or information each strategy will provide to the LLM so the experiment remains transparent.

Final results behavior

For Benchmark Mode, show the full scientific comparison:

Functional Pass

Vulnerability Fixed

Scanner Clean

Secure-and-Functional result

Repair Regression

Reviewer Result

Best Repair Strategy

comparison with existing benchmark statistics

For Custom Prompt Mode, show:

original generated code

detected findings

repaired versions

before/after code diff

functional status if available

security scan results

reviewer decision

best-performing repair strategy for this individual experiment

But clearly label the result:

Exploratory Result — not included in benchmark aggregate statistics

Dashboard update

On the main dashboard, distinguish:

Research Benchmark

Statistics based only on the 24 predefined tasks.

Example cards:

Benchmark Runs

Secure-and-Functional Rate

Repair Success Rate

Functional Regression Rate

Scanner Disagreement

Reviewer Correction Rate

Custom Experiments

Show separate lightweight statistics such as:

Custom Experiments Run

Security Findings Detected

Repairs Attempted

Do NOT mix custom experiment data with official research benchmark results.

Visual design requirements

Preserve the current visual language:

black background

charcoal/grey surfaces

white typography

orange accent color

Roboto Condensed for headings

Inter for body copy

JetBrains Mono for code and technical labels

Keep the interface sophisticated and research-oriented rather than looking like a generic chatbot.

Use strong visual distinctions between:

Benchmark Mode
Controlled, reproducible, research-focused

and

Custom Prompt Mode
Flexible, exploratory, interactive

without making them feel like separate products.