# Figma Prompt — AI Security Code Repair Research Platform Website

Design a **high-fidelity desktop web application UI/UX concept** for a modern **AI security research platform** that evaluates and repairs **security problems in LLM-generated Python code**.

## Project concept to communicate clearly in the design

This platform is a research and demo system where a user selects a **fixed benchmark coding task**, the system asks an LLM to generate code, then automatically checks whether the code is **functional** and whether it contains **security vulnerabilities**. If vulnerabilities are found, the system uses different **predefined security-repair prompts** to ask the LLM to fix the code. After that, the repaired code is tested again and compared to determine **which repair strategy worked best**.

The platform specifically focuses on:
- **Initial code generation from fixed benchmark tasks**
- **Functional testing**
- **Security scanning**
- **Repairing vulnerable code using different fixed prompt strategies**
- **Comparing results visually**
- **Showing which repair method is most successful and why**

The system evaluates vulnerabilities such as:
- SQL Injection
- Path Traversal
- Command Injection

The design should make this process visually clear, interactive, and easy to understand for:
- university professors
- research supervisors
- AI security reviewers
- technical recruiters
- MITACS application viewers

## Important product behavior to reflect in the design

The interface should **not** look like a generic coding dashboard or a plain cybersecurity admin panel. It should feel like a **premium 2026 AI-security research product**.

The user flow should visually guide the user through the pipeline:

1. **Choose Initial Prompt / Benchmark Task**
   - The user selects from fixed benchmark tasks
   - These are predefined tasks, not arbitrary prompts
   - Examples can be grouped by category:
     - SQL Injection Tasks
     - Path Traversal Tasks
     - Command Injection Tasks

2. **Generate Code**
   - The LLM generates Python code
   - Show a visual “generation in progress” state

3. **Run Functional Testing**
   - Show pytest results visually
   - Pass/fail indicators
   - Number of tests passed

4. **Run Security Analysis**
   - Show scanning via Bandit and Semgrep
   - Show detected vulnerabilities, severity, affected lines, and status
   - Clearly separate “functional” from “secure”

5. **Choose Security Fix Prompt**
   - User can choose one or more fixed repair strategies:
     - Generic Repair Prompt
     - Vulnerability-Specific Repair Prompt
     - Scanner-Feedback Repair Prompt
     - Run All
   - This choice should feel important and interactive

6. **Repair Code**
   - Show the repair process visually
   - Use transitions and animation to show the new repaired versions being created

7. **Re-Test Repaired Code**
   - Re-run functionality tests
   - Re-run security scans
   - Show whether the repair preserved functionality

8. **Final Results**
   - Compare all repair methods visually
   - Show which strategy performed best
   - Show why it was best:
     - fixed vulnerability?
     - preserved functionality?
     - scanner-clean?
     - reviewer accepted?

## Required screens / sections

Create a polished design system and show a connected product flow with multiple screens or states. Include at least these major screens:

### 1. Landing / Overview Screen
Show:
- project title
- short explanation of what the platform does
- quick visual diagram of the full pipeline
- CTA such as “Start Evaluation”
- summary cards:
  - benchmark tasks
  - repair strategies
  - vulnerabilities covered
  - recent experiment statistics

### 2. Benchmark Task Selection Screen
Show:
- categorized benchmark task library
- filter/search by vulnerability type
- cards for each predefined task
- task preview panel with:
  - task description
  - security requirement
  - expected functionality
- selection CTA to continue to next step

### 3. Code Generation Screen
Show:
- selected task on top
- LLM generation area
- animated processing visuals
- code output panel
- step progress bar / timeline
- nice “code generated successfully” transition

### 4. Testing and Security Analysis Screen
Show:
- pipeline layout with visually separate modules:
  - Code Generation
  - Functional Testing
  - Security Scan
- functional test output panel
- Bandit and Semgrep result cards
- vulnerability summary with badges/severity
- visual distinction between:
  - Functional
  - Vulnerable
  - Secure
- this should feel like a live workflow progressing step by step

### 5. Security Fix Prompt Selection Screen
Show:
- repaired-code strategy selection area
- visually rich cards for:
  - Generic Prompt
  - Vulnerability-Specific Prompt
  - Scanner-Feedback Prompt
  - Run All Strategies
- each card should briefly explain what kind of feedback the LLM receives
- user selects one strategy or all strategies
- strong CTA: “Run Security Repair”

### 6. Repair Comparison Screen
Show:
- multiple repaired versions side by side or in tabs
- each repaired version linked to its repair strategy
- status badges such as:
  - Functional ✅ / Failed ❌
  - Vulnerability Fixed ✅ / Not Fixed ❌
  - Scanner Clean ✅ / Flagged ❌
  - Reviewer Accepted ✅ / Rejected ❌
- show diff visualization between original code and repaired code
- use charts or comparison bars

### 7. Final Results / Insights Screen
Show:
- a clear “best repair strategy” summary
- visual comparison table or chart
- explanation panel stating why a strategy won
- metrics such as:
  - Functional Pass Rate
  - Vulnerability Fix Rate
  - Secure-and-Functional Rate
  - Repair Regression Rate
  - Reviewer Acceptance Rate
- make this feel like the main research output

### 8. Detailed Experiment Explorer Screen
Show:
- ability to inspect a specific task/run
- original code
- repaired code
- scanner findings
- test logs
- reviewer explanation
- side-by-side diff
- downloadable report or export UI placeholder

## Visual style and theme

Use a **bold, modern, premium research-tech aesthetic**.

Color direction:
- **Black / dark charcoal**
- **Grey / white for contrast**
- **Orange as the main accent color**
- optional subtle secondary neutral highlights
- avoid neon-cyan hacker clichés unless used very subtly

Overall feel:
- sleek
- intelligent
- advanced
- experimental
- high-end
- technically credible
- elegant rather than noisy

The design should combine:
- AI research visualization
- secure systems / code workflow visuals
- advanced dashboard quality
- interactive product storytelling

## Animation and interaction direction

This is very important.

The prototype should feel **alive**. Use visual cues that show the user moving through a real pipeline.

Include design cues for:
- animated step progression
- glowing active step indicators
- flowing connectors/arrows between steps
- smooth transitions from one stage to the next
- loading states for generation, testing, scanning, and repair
- expandable cards
- hover interactions
- tab transitions
- code diff reveal animations
- result counters and animated metric cards
- progress trackers and stage completion visuals

It should visually communicate:
**choose task → generate code → test → scan → choose repair prompt → repair → compare results → see best outcome**

## UI components to include

Use a polished component system with:
- top navigation and/or sidebar navigation
- progress stepper
- large cards
- code editor style panels
- tabs
- filters
- status chips
- accordions
- metric cards
- comparison tables
- charts/graphs
- diff viewer blocks
- timeline / pipeline diagram
- modal or drawer for deeper inspection

## Content hierarchy and UX priorities

The design should make the following concepts extremely clear:

1. The code may be **functional but insecure**
2. Different repair prompt strategies may produce different results
3. The best repair strategy is the one that fixes security issues **without breaking functionality**
4. The platform is a research benchmark and interactive demo, not just a scanner UI

The interface should emphasize:
- clarity
- flow
- comparison
- explainability
- visual storytelling

## Tone of the final design

The final output should look like:
- a polished SaaS-grade research product
- something that could be presented in a portfolio
- something impressive enough for academic and professional review
- unique and custom-designed, not template-like

## Deliverable expectation for Figma

Create:
- a complete desktop web app design
- multiple connected screens or state-based frames
- a coherent design system
- interactive prototype flow
- smooth step-by-step process visualization
- visually rich comparison of repair strategies
- premium animations/transitions suggested through the mockups

Make the design feel like an **interactive AI-security experiment platform** where the user can clearly see the entire journey from **initial prompt selection** to **final repair comparison results**.