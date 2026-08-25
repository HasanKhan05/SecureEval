Figma Update Prompt — Add “Upload Existing Code” Mode to the Current AI Security Research Platform
Update the current existing AI Security Research Platform design.
Do not redesign the product from scratch.
Do not change the current visual identity, current layout system, typography, animations, benchmark mode, custom prompt mode, repair strategy logic, results logic, or overall workflow.
Preserve the current design language and simply add one new third entry mode:
- Benchmark Mode
- Custom Prompt Mode
- Upload Existing Code Mode
This new mode should let a user upload their own Python code and run the same AI-security analysis and repair workflow on it.
The new mode should feel like a natural extension of the current product, not like a separate product.
1. Add a Third Entry Mode
On the existing starting / mode-selection screen, keep the current two modes:
- Benchmark Mode
- Custom Prompt Mode
Add a third equally important mode:
Upload Existing Code
Possible label:
Code Audit Mode
Short description:
“Upload your own Python code and analyze it for security issues, run repair strategies, and compare results.”

This mode should appear visually consistent with the current mode cards/tabs.
Use the same animation language already used for switching between Benchmark and Custom Prompt modes.
2. Purpose of Upload Existing Code Mode
This mode is for users who already have code and do not want the platform to generate it from a prompt.
The platform should skip the code-generation step and instead begin from the uploaded code.
This mode should support the same downstream pipeline as the rest of the product:
Upload Code → Functional Analysis → Select Scans → Security Analysis → Select Repair → Repair → Verify → Review → Results
This mode should feel useful for:
- analyzing existing Python code
- testing whether uploaded code is vulnerable
- comparing the three repair strategies on real user-provided code
- running the same research-style workflow on external code
3. Add Upload Existing Code UI
Design a dedicated input area for uploaded code.
Allow the user to either:
Option A — Upload .py File
Show a polished drag-and-drop upload area.
Example copy:
Upload Python Code
Drag and drop a .py file here
or
Browse Files
Option B — Paste Code Directly
Allow a secondary option to paste raw Python code into a large code editor area.
Example label:
Or Paste Python Code
This should open or reveal a JetBrains-Mono style code input panel.
This makes the mode more flexible and avoids forcing file uploads.
4. Optional Supporting Inputs
Add optional supporting inputs below the main upload area.
These should be clearly marked as optional.
Optional Expected Behaviour
A multiline field:
Describe what this code is supposed to do
Example placeholder:
“This script should search users in a SQLite database by username and role.”

This will help the platform understand intended functionality.
Optional Test File Upload
Allow optional upload of a test file.
Example:
Upload Tests (optional)
Supports test_*.py
This can help improve functional verification.
Optional Dependencies
Allow a small optional input:
Dependencies / Requirements (optional)
Example placeholder:
“flask, requests, pandas”

This helps if the uploaded code relies on specific libraries.
5. Label This Mode Correctly
Unlike Benchmark Mode, uploaded code does not automatically have predefined hidden benchmark ground truth.
So clearly label this mode:
Exploratory Code Audit
or
Existing Code Analysis
And include a subtle note:
“Uploaded-code experiments are analyzed individually and are not included in official benchmark aggregate statistics unless controlled tests and ground truth are provided.”

Do not make this sound negative.
It should feel like an informative research distinction.
6. Update the Pipeline for Uploaded Code
For this mode, the pipeline should visually adapt.
Instead of:
Prompt → Generate → Functional Test → Scan → Repair → Results
show:
Upload / Paste Code
→ Functional Analysis
→ Select Scans
→ Security Analysis
→ Select Repair
→ Repair
→ Functional Verification
→ Security Verification
→ Reviewer
→ Efficiency
→ Results
This should visually remain part of the same product system.
7. Functional Analysis for Uploaded Code
Since uploaded code may not come with predefined tests, the design should support a slightly more flexible functional-analysis stage.
Show possibilities such as:
- provided test file detected
- expected behaviour provided
- limited functional analysis
- functionality could not be fully verified
- partial verification available
The interface should visually communicate that functionality analysis may vary depending on what the user provides.
For example:
Functional Context
Tests Provided: Yes / No
Expected Behaviour Provided: Yes / No
Verification Confidence: High / Medium / Limited
This should make the workflow honest and research-oriented.
8. Keep the Same Security Scan System
The uploaded code should still use the existing five-category security scan system:
- SQL Injection
- Path Traversal
- Command Injection
- Insecure Deserialization
- Hardcoded Secrets / Credentials
Keep the current multi-select scan UI.
The user should still be able to:
- choose one category
- choose multiple categories
- use Scan All
No need to redesign this part — only ensure the uploaded-code workflow leads into it naturally.
9. Keep the Same Repair Strategies
Uploaded code should still support all existing repair options:
- Generic Security Repair
- Vulnerability-Specific Repair
- Scanner-Feedback Repair
- Run All Strategies
The user should be able to compare how the three repair strategies behave on their uploaded code.
This should be one of the biggest strengths of the new mode.
10. Keep Token / Cost / Latency Tracking
For uploaded code mode, also keep the existing efficiency-related metrics.
Track and display:
- repair tokens
- reviewer tokens
- total tokens
- estimated cost
- latency
- best efficiency
The initial generation step is skipped, so in this mode the resource usage should begin at:
- analysis
- repair
- reviewer
Do not show code-generation token usage if no generation occurred.
11. Results Screen for Uploaded Code
The final results screen for uploaded code should remain very similar to current results, but adapted for uploaded-code context.
Show:
- original uploaded code
- detected vulnerabilities
- repaired versions
- functional verification status
- security findings before and after repair
- reviewer result
- token usage
- estimated cost
- latency
- Best Overall Repair
- Best Efficiency
- Why This Strategy Won
- Was the Additional Token Cost Worth It?
Also include a clear label such as:
Exploratory Uploaded-Code Result
or
Existing Code Audit Result
And a small note:
“This result reflects the uploaded code and provided context. It is not included in official benchmark aggregate statistics.”

12. Add a Dedicated Upload Screen or State
You may either:
- add a completely separate Upload Existing Code screen
- or add it as a third state in the current input screen
Whichever fits the existing design better.
The important requirement is that it should feel fully integrated into the current product.
13. Suggested Upload Screen Elements
Possible content blocks:
Header
Upload Existing Python Code
Main upload area
Drag-and-drop .py file uploader
Secondary input
Paste code editor
Optional context panel
- expected behaviour
- tests upload
- dependencies
Quick info panel
Explain the workflow:
Upload code → scan selected security categories → run repair strategies → compare repaired results

Primary CTA
Start Code Analysis
14. UX Messaging
Throughout this mode, clearly communicate:
- Uploaded code is treated similarly to benchmark/custom experiments in the repair pipeline
- Uploaded code may not have the same controlled benchmark ground truth
- Functional verification depends on provided tests or context
- Security scan findings are not proof of complete security
- Repair strategies are still compared in the same controlled way
15. Animation / Interaction Guidance
Use the current animation language.
Possible additions:
- uploaded file card animates into the analysis pipeline
- pasted code collapses into the functional-analysis screen
- upload success transition
- optional test/dependency inputs expanding smoothly
- code audit mode card glowing when selected
- uploaded-code preview transitioning into scan/repair workflow
Keep animations professional and technical.
16. Preserve the Current Design
Do not redesign:
- existing results screen
- repair comparison system
- scan categories
- strategy cards
- benchmark mode
- custom prompt mode
- typography
- spacing
- color palette
- animation style
Only integrate the new mode in a clean, product-consistent way.
17. Final Goal
The updated design should support three ways to enter the platform:
1. Benchmark Mode
Controlled research tasks
2. Custom Prompt Mode
User-defined code generation
3. Upload Existing Code Mode
User-provided Python code audit and repair workflow
The product should now feel like a complete AI-security experimentation platform that supports:
- controlled benchmark research
- exploratory prompt-based generation
- direct analysis of existing code
The Upload Existing Code mode should feel like a highly useful and natural addition to the current product, not a redesign.