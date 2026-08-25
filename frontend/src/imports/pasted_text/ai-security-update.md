Figma Update Prompt — Add Token Usage, Estimated Cost, and Repair Efficiency
Update the existing AI Security Research Platform design.
Do not redesign the platform from scratch.
Do not change the current visual style, current screens, benchmark flow, repair strategies, security scanning flow, animations, typography, layout structure, or navigation.
Only add the following cost/efficiency-related research information into the existing design.
1. Track Token Usage
For each LLM-based stage, show approximate:
- Input Tokens
- Output Tokens
- Total Tokens
Track this separately for:
- initial code generation
- Generic Repair
- Vulnerability-Specific Repair
- Scanner-Feedback Repair
- independent reviewer
Example compact UI:
LLM Usage
Input
1,420 tokens
Output
486 tokens
Total
1,906 tokens
These values should be treated as dynamic experiment data, not fixed results.
2. Estimated API Cost
Using the recorded token usage and configured model pricing, show:
Estimated Cost
Example:
$0.0048
Add a small tooltip or research note:
“Estimated cost depends on the configured model/provider pricing.”

Do not make dollar cost the only efficiency measure. Raw token usage should always remain visible because provider pricing can change.
3. Latency
For each repair strategy also show approximate:
Latency
Example:
2.4 s
Keep latency visually secondary.
4. Add Usage Metrics to Repair Comparison
On the existing repair comparison screen, keep all current metrics and add:
- Repair Tokens
- Reviewer Tokens
- Total Tokens
- Estimated Cost
- Latency
Example:
Metric	Generic	Vulnerability-Specific	Scanner-Feedback
Issues Fixed	2/3	3/3	3/3
Functional	9/12	12/12	12/12
Total Tokens	2.4K	2.7K	3.2K
Estimated Cost	$0.004	$0.005	$0.007
Latency	2.8 s	3.1 s	3.7 s


Use the existing visual card style rather than relying only on a table.
5. Add Repair Efficiency
Add one simple new research metric:
Repair Efficiency
The purpose is to show whether a strategy achieves strong repair results without consuming unnecessarily large amounts of LLM tokens.
Show:
Successful Repairs per 1,000 Tokens
Concept:
Secure-and-Functional Repairs
────────────────────────────── × 1000
Total Repair Tokens
Higher is better.
Example placeholder:
Generic
0.28 successful repairs / 1K tokens
Vulnerability-Specific
0.44 / 1K tokens
Scanner-Feedback
0.41 / 1K tokens
Do not hard-code these values.
They must eventually come from actual experiment results.
6. Add “Best Efficiency”
Keep the existing:
Best Repair Strategy
Do not replace it.
Add a second smaller result card:
Best Efficiency
This should identify which strategy achieved the best repair outcome relative to token usage.
Example:
Vulnerability-Specific Repair
“Achieved similar repair performance to Scanner-Feedback while consuming fewer tokens.”

This result must be dynamic.
Do not assume any particular strategy will always win.
7. Add Cost Context to “Why This Strategy Won”
Keep the existing detailed Why This Strategy Won explanation.
Add one small additional subsection:
Resource Efficiency
Explain whether the winning strategy required:
- more tokens
- fewer tokens
- higher estimated cost
- lower estimated cost
and whether the additional resource usage was justified by better repair performance.
Example:
“Scanner-Feedback consumed more input tokens because scanner findings were included, but the additional context resulted in a higher complete-repair rate.”

or:
“Scanner-Feedback used significantly more tokens without improving the repair result, making Vulnerability-Specific Repair the more efficient option.”

8. Add “Was the Extra Cost Worth It?”
On the final Results screen, add a small analytical card:
Was the Additional Token Cost Worth It?
Compare the strongest strategies.
Example:
“Scanner-Feedback used 22% more tokens than Vulnerability-Specific Repair and improved Complete Repair Rate by 7 percentage points.”

This text should change dynamically according to experiment results.
9. Aggregate Benchmark Cost Metrics
In Benchmark Mode, add a small Efficiency Metrics group containing:
- Average Tokens per Repair
- Total Benchmark Tokens
- Average Estimated Cost per Repair
- Total Estimated Benchmark Cost
- Average Repair Latency
- Successful Repairs per 1K Tokens
Do not add excessive new dashboards.
Fit these metrics into the existing research-results screen.
10. Visual Requirements
Preserve the current design exactly.
Use the existing:
- color scheme
- typography
- card styles
- metric cards
- spacing
- animations
- comparison layout
Add token/cost information using compact technical labels and metric cards.
Use JetBrains Mono for:
- token counts
- dollar values
- latency
- efficiency values
Do not make the platform look like a billing dashboard.
The primary focus should still be:
Security + Functionality
with:
Token/Cost Efficiency
as an additional research dimension.
Final Goal
The updated Results screen should answer two questions:
Which repair strategy worked best?
and:
Which repair strategy was most efficient in terms of LLM token usage and estimated cost?
Do not hard-code the answers.
Both must depend on actual experiment results.
The update should feel like a small natural extension of the current design, not a redesign.