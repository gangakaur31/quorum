# Quorum founder-journey demo: exact fields, paste content and narration

25 October shortcut: use the [current Autofill presentation route](QUORUM_HACKATHON_POLISH.md). It fills the new ScopeSignal script, including notes and result editors, without manual typing. Saved examples are labelled Demo and excluded from real validation. The manual material below remains an older, separate fictional walkthrough.

Historical 24 October note, superseded by the 25 October update above: the runtime **Demo Autofill** buttons use a separate, centrally typed ScopeSignal scenario: agencies with 5-30 employees, unknown pricing and a proposed eight-owner/four-recent-example test. Use that consistent path when demonstrating the new buttons. The older manual files below deliberately contain fictional interviews/results; do not mix their invented customer events or older segment/pricing with the autofill scenario or describe them as real evidence. Autofill supplies no participant notes, real source, completed result or consent. See the [current implementation and verification](QUORUM_CLAUDE_AUTOFILL_REPORT.md), including successful current Claude/Groq connectivity checks.

Prepared against the current Quorum screens on 21 October 2026. Use your presentation date wherever this guide says TODAY. For example, TODAY is `2026-10-21` if you rehearse on the preparation date. Do not enter a future date or a result date earlier than its saved experiment plan.

The story: a solo founder wants to build **ScopeSignal**, a client change-request approval tool for small Indian web agencies. Quorum helps turn that initial enthusiasm into a sourced offer, AI criticism, explicit assumptions, a small test and a decision to revise the delivery model.

All supplied interviews, pilot observations and commitments are **fictional demo material**. Their titles and limitations deliberately say so. Actual API responses and an actual test email capture are separate from those fictional customer events. This guide does not pre-create records or make provider calls.

## 1. Prepare the presentation

Run the existing preflight before presenting:

```powershell
npm.cmd run check:apis
# If the app is already running, use its actual address:
npm.cmd run check:apis -- --base-url http://localhost:3000
```

Use the port printed by your running Quorum server. Start a fresh demo project; keep existing projects intact. Each page load plays the five-second intro and then shows the landing page. Click Start your Quorum to enter; saved projects resume only after that click. Have these authored sample files open:

- [Founder brief](demo/01-founder-brief.md): upload to Knowledge.
- [Agency A interview](demo/02-interview-agency-a.txt): import into Interviews.
- [Agency B interview](demo/03-interview-agency-b.txt): optional second interview.
- [Pilot register](demo/04-pilot-register.md): reference for the simulated experiment and ledger entries.

Allow about 25-35 minutes to enter every field and cover the complete walkthrough. AI response time varies. For a short presentation, pre-generate the offer and panel in a clearly labelled demo project, then use the eight-minute route at the end. Do not type every command block as one request: run each command separately unless the block explicitly combines reviewer roles.

Opening narration:

> A founder usually arrives with an idea and a lot of assumptions. I'll follow one fictional founder through Quorum: from discovering a problem to deciding what deserves the next week of development. The customer notes and pilot numbers are labelled demo data; the software operations you see are live.

## 2. Arrival and Discover

Show the signal intro, landing feature cards and Start your Quorum. Explain that research, AI perspectives and real observations have different roles. Open:

```text
/discover
```

Fill every Discover field:

| Field | Enter or select |
| --- | --- |
| Market or recurring problem | Client change requests, scope changes and written approval of extra work in small web-design agencies |
| Target customer | Owners and project managers of Indian web-design agencies with 2-10 people and 3-8 concurrent client projects |
| Geographic market | India; initial outreach in Bengaluru and Pune |
| Your skills and available resources | Solo Next.js developer; four weeks; INR 15,000 prototype budget; can manually support a small pilot |
| Desired complexity | Small software MVP |
| Source collection | Live public research (Tavily configuration required) |

Click **Research opportunities**. Open an original source and a source-ledger detail. Show the distinction between what a source reports, the AI's interpretation, the proposed product and what remains untested. Responses and titles will vary; do not promise a particular quotation or score.

For the supplied-excerpt mode, use the same constraints and these additional fields instead. This is an alternative to live search, not another required search:

| Field | Enter |
| --- | --- |
| Source collection | Analyze a source excerpt I provide |
| Source title | AIGA: Freelance Brand Design Practice Guide 2026 |
| Public source URL | `https://designcareers.aiga.org/career-resources/freelance-graphic-design-10/freelance-brand-design-practice-guide-2026-119` |
| Publication date, if known | Leave blank; a year in a title is not an exact publication date |
| Relevant excerpt | Track inquiries, briefs, proposals, approvals, changes, handoffs, invoices, and project notes in a way you can retrieve. |

That short excerpt was checked against the [AIGA guide](https://designcareers.aiga.org/career-resources/freelance-graphic-design-10/freelance-brand-design-practice-guide-2026-119). It supports investigating record keeping, not the prevalence of scope problems or willingness to pay. Quorum labels supplied excerpts as founder supplied rather than independently fetched.

Select the opportunity closest to change-request/approval workflows and click **Use this idea**. The selected opportunity, sources, draft idea and assumptions carry forward. Review the draft; generation does not start until you submit it. Discovery may add its own stored assumptions, which should remain visible later. If no relevant opportunity is returned, use the direct-entry founder idea below and describe Discover as research you considered, rather than selecting an unrelated result.

Narration:

> This gives the founder a sourced starting point. It has not established that agencies need another tool or will pay for one.

## 3. Add project knowledge before generation

Open `/knowledge`. Under **Add a document or website**, fill:

| Field | Enter or select |
| --- | --- |
| Import method | Paste text or upload TXT / Markdown |
| Title | DEMO ONLY - ScopeSignal founder brief and assumptions |
| Publisher / origin | Quorum demonstration author; fictional founder scenario |
| Source URL (optional) | Leave blank; this is an authored local document |
| Upload text / Markdown | Choose `docs/demo/01-founder-brief.md` |
| Original source text | The upload fills this automatically; if pasting instead, paste the file's entire text |
| Publication date | TODAY, the date you prepared this authored demo material |
| Source jurisdiction | India |
| Features allowed to retrieve this document | Keep all offered feature checkboxes selected |
| Limitations, biases or missing context | Fictional demo brief. Product, price, workflow and customer needs are untested founder hypotheses. Not customer research, legal guidance or proof of demand. |
| Permission checkbox | Tick for this authored demo material |

Click **Import source**. An imported document can inform the ordinary feature workflows; private legal preparation uses its curated authority references rather than treating uploaded documents as legal authority.

Under **Ask your sources**, fill:

| Field | Enter or select |
| --- | --- |
| Feature | General research |
| Location filter | India |
| Question | What is ScopeSignal's proposed monthly price, which current alternatives does the brief name, and what assumption about client accounts still needs testing? |

First expand **Preview retrieval**: this does not call an AI. Then click **Ask with cited passages**. Open one exact source excerpt. The answer may vary; check that it identifies hypotheses as hypotheses.

To demonstrate website extraction, add a second document:

| Field | Enter or select |
| --- | --- |
| Import method | Extract a public website with Tavily |
| Title | SBA - market research and competitive analysis |
| Publisher / origin | U.S. Small Business Administration |
| Source URL | `https://www.sba.gov/counseling/plan-your-business/` |
| Original source text / upload | Not shown in website mode; Tavily supplies the extracted page |
| Publication date | Leave blank if an exact date is not known |
| Source jurisdiction | Global / not specific |
| Features | Keep all offered feature checkboxes selected |
| Limitations | General business-research guidance from a US agency. Included for research methodology only, not Indian market facts or local legal guidance. It does not establish demand for ScopeSignal. |
| Permission checkbox | Confirm permission and applicable source terms before importing |

The [SBA page](https://www.sba.gov/counseling/plan-your-business/) was checked for its market-research section. A page can change or fail extraction; the authored founder brief is the reliable rehearsal input. A failed extraction is not a successful import.

Show **Inspect stored source and metadata**, **Pause source**, **Enable source**, then **Edit source**. For an edit, keep the existing fields and replace Limitations with:

```text
Fictional demo brief, revised during the presentation. No customers were interviewed for this document. Price, demand and client-account adoption remain unvalidated. The document is context for questions, not evidence of demand.
```

Click **Save updated source**. Editing or pausing sources invalidates earlier evaluations, so finish these controls before generating the offer/panel. The current preview's matches may change; a source pause does not guarantee an empty preview because curated and other project sources remain.

Narration:

> Every feature can retrieve relevant project context from the same library. I can inspect what was supplied, and a citation takes me back to a stored excerpt. It still takes judgment to decide whether that excerpt supports the claim.

## 4. State the founder's offer and generate it

Open `/artifact`. Expand **Tell the jury what you are assuming**. If Discover filled these values, replace them with the founder's narrower choices:

| Field | Paste |
| --- | --- |
| Who is this for? | Owners and project managers of Indian web-design agencies with 2-10 people and several concurrent client projects |
| What might it cost? | INR 1,499 per agency per month; initially a manually supported one-month pilot for one client project |
| What problem do they have? | Client changes arrive in email and WhatsApp; additional work, price and written approval may not be recorded together before implementation |
| What do they use now? | Email, WhatsApp, Google Docs, spreadsheets and an existing project-management tool |

Paste this into the terminal. If you used Discover, replace its draft with this founder-authored refinement before pressing RUN:

```text
Build a static landing offer for ScopeSignal DEMO, a fictional early concept for owner-led Indian web-design agencies with 2-10 people. The proposed workflow puts an agreed brief, a new client change request, a human-reviewed estimate and written approval in one place before extra work starts. AI may suggest whether a request differs from the brief; an agency owner reviews the suggestion and decides what to propose. The initial concept asks clients to create an account in an approval portal; that requirement is an untested adoption risk. The proposed price is INR 1,499 per agency per month, starting with a manually supported one-month pilot for one client project. The call to action is to request a research conversation about the pilot. Clearly label this as a demo concept. There are no verified customers, testimonials, payments, conversion rates or measured time savings. Do not imply legal enforceability or automatic billing.
```

Show the generated Offer, the sandboxed preview and **Inspect sources**. Generation is a real provider request, so the wording and rendering may differ between rehearsals. The request does not make the proposed product functional; Quorum Live supplies its own separate working capture form later.

Narration:

> The founder now has something concrete to challenge. This page expresses the offer; it is not evidence that the offer works.

## 5. Define a focused simulated buyer

Open `/perspectives` before running the main panel:

| Field | Paste or select |
| --- | --- |
| Profile name | DEMO Indian agency owner - protects client relationships |
| Panel role | Budget-conscious |
| Behavior, responsibilities, budget, alternatives, authority and switching constraints | Paste the block below |

```text
Fictional customer profile for simulation, not an interviewed person. Owns a four-person web-design agency in Bengaluru and manages five client projects. Personally approves software purchases and handles difficult client conversations. Uses WhatsApp, email, Google Docs and a project board. Can consider INR 1,499 per month only if a tool solves a recurring problem without adding coordination work. Will not casually ask established clients to create another account. Has no IT administrator and needs a workflow understandable in ten minutes. Wants a clear record of the request, extra cost and approval, but existing templates may already be sufficient. Evaluate the proposed portal against these alternatives. Do not invent customer behavior, savings or purchase commitments.
```

Click **Save simulated customer profile**. Saving/removing a profile resets current reviews, so do it before the panel. Show the simulation label.

## 6. Convene all six reviewers, inspect and compare

Run this as one combined reviewer request:

```text
/analyst /skeptic /advocate /first-time-buyer /competitor-user /budget-conscious
```

Read the first arriving reviewer and leave it selected while the others arrive. Show the unread perspective notice. Scroll up in terminal history to demonstrate that new activity does not force you back down; use **Jump to latest** when ready.

After completion, run these separately:

```text
/reviews
/inspect skeptic
/scorecard
```

These views need no pasted form content. Show strongest case, main objection, unknowns, what evidence could change the assessment and one source drawer. A high price-resistance score is unfavorable. Panel agreement is simulated agreement, not a customer sample or success probability.

The main panel also prepares an interview kit when it gets valid results. Wait for it to finish before starting another AI request. If a request fails, show the error and retry explicitly; do not present a saved result as fresh inference. Individual reviewer commands can retry one role. `/randomize` is an optional new AI run with three roles, not required after showing all six.

Narration:

> These perspectives help us find weak assumptions before we spend on development. They are simulations. The next step is to ask what a real person would have to do for the idea to deserve more work.

## 7. Marketing angles, interview kit and summary

Run `/angles`. This generates a new result. Read the generated messages; click **Review this angle - AI request** on one card. Open its comparison, then click **Return to main reviews**. Angle judgments remain separate from the original offer; they are not an A/B conversion test.

Open the **Interview kit** tab to reuse the generated kit. If none exists, run `/kit`. Show its questions, outreach and proposed experiment. Open the recorded decision context, then run `/summary`. These are generated/read-only results rather than fields to paste into.

If you want a ready outreach message to read aloud or copy outside Quorum:

```text
Hi, I'm exploring how small web agencies handle client change requests. Could you spare 15 minutes to walk through the last request that changed the agreed work? I'm interested in what you did, what tools you used and how approval happened. This is research, not a sales pitch. Please avoid sharing client names or confidential material. Participation is optional; I would ask separately before storing notes or processing them with an AI tool.
```

Quorum does not send this message or recruit people automatically.

## 8. Legal preparation for the proposed product

Open `/legal`. These fields describe ScopeSignal, not Quorum:

| Field | Paste or select |
| --- | --- |
| What does the product do? | ScopeSignal is a proposed B2B change-request approval tool for Indian web agencies. It stores project briefs, client request text, estimates, approvals and work emails. AI may suggest differences from the agreed brief, with a human reviewing every suggestion. A future paid version would charge an agency subscription; the demo does not collect payments. |
| Where is the business based? | India |
| Product sector | General software / services |
| Where will your customers be? | India only |
| State, country or other location details | Founder based in Karnataka; initial agency outreach in Bengaluru and Pune, Maharashtra. Hosting and AI-provider processing locations still need to be confirmed. |
| Planned activities - select | Collect personal data; Accept payments, deposits or paid pilots; Offer recurring subscriptions or free trials; Use cookies, analytics, advertising or marketing messages; Use AI models, generated content or automated decisions; Host user posts, uploads or a marketplace |
| Planned activities - leave unselected | Sensitive data; children; selling to individual consumers |

The payment/subscription selections describe planned ScopeSignal activity, not a payment integration in Quorum. Click **Create preparation checklist**. Show a topic and its official references; this screen does not check live law or grant legal clearance.

Each task has two fields. Use **Preparing** rather than claiming adviser review happened. Here is content for every topic generated by the scope above:

| Topic | Preparation status | Private task notes |
| --- | --- | --- |
| Confirm which laws and authorities to check | Preparing | DEMO: Map Karnataka business base, Indian agency customers, client users and planned hosting/provider locations. Prepare unresolved location questions for a qualified adviser. |
| Business structure, registration, tax and licences | Preparing | DEMO: Identify the intended operator and seller. Prepare the one-month pilot price, proposed subscription flow and invoicing questions for local business/tax advice. No registration or tax conclusion is claimed. |
| Ownership, brand and third-party licences | Preparing | DEMO: List founder code, open-source dependencies, model-provider terms and permission to use customer briefs. Investigate the proposed name before commercial use. |
| Customer agreements and truthful product claims | Preparing | DEMO: Draft the pilot scope, experimental-feature limits, support contact and termination process. Remove claims of guaranteed savings or legally binding approval unless independently supported and reviewed. |
| Personal data, privacy and security | Preparing | DEMO: Inventory work emails, request text, approval records and AI inputs. Prepare a retention/deletion plan, vendor map and questions about access controls. Do not upload confidential client material for this demo. |
| Payments, refunds and tax handling | Preparing | DEMO: Diagram the intended agency subscription and manual pilot payment. Confirm merchant, invoicing, refund and dispute responsibilities before accepting real money. Quorum itself is not collecting a payment. |
| Recurring billing and cancellation | Preparing | DEMO: Draft clear INR 1,499 monthly pricing, pilot duration and cancellation steps. No automatic renewal should be implied before a real purchase flow is designed and reviewed. |
| Cookies, analytics and marketing | Preparing | DEMO: List intended analytics and outreach channels. Start with minimal measurement; prepare permission and opt-out questions. No advertising tracker is needed for the prototype. |
| AI use, disclosures and human oversight | Preparing | DEMO: Document that AI suggests a scope difference; an agency owner reviews it. Prepare provider/input permissions, limitations and escalation questions. The model does not decide legal rights or an amount owed. |
| User content, marketplace roles and complaints | Preparing | DEMO: Describe permission to store briefs and requests, restricted access, deletion and a reporting contact. ScopeSignal does not operate a marketplace in this concept. |

Save one or two tasks live and show **Download private checklist**. You can prepare the rest before a longer presentation. Do not mark **Discussed with an adviser** unless that occurred. Private notes and the legal profile are excluded from AI prompts and public briefs. Changing the legal scope resets progress, so leave changes until after showing the saved checklist.

## 9. Turn the risks into explicit assumptions

Open `/evidence`. In **Testable assumption**, paste and save these one at a time. H1/H2 below are guide labels; the dropdown shows the full claim.

H1:

```text
DEMO H1: Target agency owners can show a recent client change request for which the original brief, additional cost and written approval are difficult to inspect together.
```

H2:

```text
DEMO H2: At least two of five qualified agency owners will sign an INR 1,499 one-month pilot agreement for a separate client approval portal that requires a client account.
```

Discover-created assumptions may also be listed. Keep them visible rather than pretending only H1/H2 exist. New evidence/assumptions change project context; earlier reviews can be inspected but are not current assessments.

Open `/decision` now. With stored assumptions and no direct observations, the expected rule state is **TEST**. Click **Record this decision in history**.

Narration:

> The AI panel has finished, but Quorum still asks for a real test. We have now named the behavior we need to observe and saved the starting decision.

## 10. Import interviews and retain the source

Open `/interviews`. Fill:

| Field | Interview A | Optional interview B |
| --- | --- | --- |
| Assumption | DEMO H2 | DEMO H2 |
| Participant alias | DEMO ONLY - Agency A owner | DEMO ONLY - Agency B owner |
| Interview date | TODAY | TODAY |
| Original source text | Entire text of `docs/demo/02-interview-agency-a.txt` | Entire text of `docs/demo/03-interview-agency-b.txt` |
| Permission checkbox | Tick for this authored fictional material | Tick for this authored fictional material |

Click **Save interview source**, then **Synthesize notes with AI**. Expand **Inspect original notes** and compare a generated finding's exact excerpt. A model may select different valid excerpts; do not script its wording. Click **Add as mixed evidence** for one relevant finding. This deliberately creates mixed customer-statement evidence, not a purchase or independent verification. Multiple findings from one interview remain one participant.

Narration:

> For the demonstration we're advancing to fictional interview notes. Quorum keeps the source text beside the interpretation. I explicitly decide which finding belongs in the ledger; AI does not silently turn an interview into a sale.

## 11. Evidence ledger: all fields and all four categories

Open `/evidence`. The rows below supply every field in **Record real evidence**. Despite that form title, these entries must keep their DEMO labels. Use TODAY for Collection date in every example. For the research row, TODAY is the date you collected/read the source, not its publication date.

### A. External research

| Field | Enter or select |
| --- | --- |
| Assumption | DEMO H1 |
| Evidence category | Externally sourced research |
| Effect on assumption | Mixed |
| What was observed | DEMO CONTEXT: A professional design-practice guide discusses keeping project and approval records inspectable. It does not measure this problem among Indian web agencies. |
| Source link or collection context | `https://designcareers.aiga.org/career-resources/freelance-graphic-design-10/freelance-brand-design-practice-guide-2026-119` |
| Original excerpt or quote, if available | Leave blank; the short checked excerpt is already supplied in Discover |
| Collection date | TODAY |
| People or observations in this source | Leave blank; a guidance page is not a participant sample |
| Quality and limitations | General professional guidance, not Indian customer research, prevalence data, willingness to pay or a legal opinion. Included only to illustrate research provenance. |

### B. Contradicting customer statement

| Field | Enter or select |
| --- | --- |
| Assumption | DEMO H2 |
| Evidence category | Customer statement |
| Effect on assumption | Contradicts |
| What was observed | DEMO ONLY: Fictional Agency A owner rejects the initial requirement to create another client account and would consider an approval link instead. |
| Source link or collection context | DEMO ONLY - Agency A interview; authored fictional notes; same participant as the imported source |
| Original excerpt or quote | I will not ask an existing client to create another account just to approve one change. I would send a clear approval link, but a separate login is a blocker for me. |
| Collection date | TODAY |
| People or observations | 1 |
| Quality and limitations | Entirely fictional demo statement. Not real customer research. Same participant as imported Agency A notes; do not count the promoted finding and this entry as separate people. It raises a segment-specific objection, not a universal rejection. |

Click **Save observation**, then show `/decision`: the current rule should now say **ITERATE**, because it sees a contradicting direct record. Record this second decision snapshot.

### C. Observed behavior

| Field | Enter or select |
| --- | --- |
| Assumption | DEMO H1 |
| Evidence category | Observed user behavior |
| Effect on assumption | Supports |
| What was observed | DEMO ONLY: In the fictional five-agency walkthrough, four owners displayed a recent change-request workflow. Their request, estimate or approval was spread across separate records. |
| Source link or collection context | DEMO ONLY - docs/demo/04-pilot-register.md; fictional walkthrough register |
| Original excerpt or quote | Leave blank; this is an aggregate observation rather than a verbatim participant quotation |
| Collection date | TODAY |
| People or observations | 5 |
| Quality and limitations | Invented demonstration events; no actual walkthrough occurred. Five is the fictional cohort size, not five confirmations. Four displayed the described workflow. Agencies overlap with the interview and pilot examples. No measured savings or representative prevalence. |

### D. Concrete commitment

Enter this after saving the experiment result in step 12:

| Field | Enter or select |
| --- | --- |
| Assumption | DEMO H2 |
| Evidence category | Purchase / signed pilot / concrete commitment |
| Effect on assumption | Supports |
| What was observed | DEMO ONLY: Fictional Agencies B and C signed the specified INR 1,499 one-month pilot agreement. No payment, delivery or repeat usage is claimed. |
| Source link or collection context | DEMO ONLY - docs/demo/04-pilot-register.md; invented agreements, not real signatures |
| Original excerpt or quote | Leave blank; no authentic signed document exists for this fictional example |
| Collection date | TODAY |
| People or observations | 2 |
| Quality and limitations | Entirely fictional demonstration commitments. Not revenue or verified signatures. The same two agencies are included in the five-owner test denominator. Existing adoption objections and mixed statements remain unresolved. |

Show **Edit** on an entry, keep its substantive values and append `Reviewed during demo; fiction label retained.` to its limitations. Save. To demonstrate deletion, add a clearly labelled throwaway research record with the same field structure, then delete only that throwaway record. Keep substantive contradictions intact.

## 12. Prespecify an experiment, then advance to a sample result

Open `/experiments`. Under **Prespecify a small test**, fill:

| Field | Enter or select |
| --- | --- |
| Assumption | DEMO H2 |
| Experiment name | DEMO ONLY - five-agency paid-pilot commitment test |
| Method and recruitment | Fictional demo plan: approach five owner-led Indian web agencies with 2-10 staff and a recent client change request. Use the same brief/request/estimate/approval walkthrough. Disclose that the client portal requires an account. Ask for a written one-month pilot agreement at INR 1,499 for one project. Count distinct agency owners; exclude compliments, email signups and verbal interest. This is a teaching scenario, not actual recruitment. |
| What observable action counts? | A distinct qualified agency owner signs the specified INR 1,499 one-month pilot agreement for one client project; not an email signup or compliment |
| Minimum people approached | 5 |
| Required actions to pass | 2 |

Click **Save experiment plan** before entering any result. Show that the criterion is saved. In a real study, save it before collecting outcomes. For this demo explicitly say: **"We are now advancing to a fictional result."** The sample's same-day date is for rehearsal, not evidence of an actual prospective study.

In the experiment's result form:

| Field | Enter |
| --- | --- |
| Observed actions | 2 |
| People approached / denominator | 5 |
| Result date | TODAY, after saving the plan; never earlier than the plan date |
| Collection method and limitations | DEMO ONLY: Fictional pilot register. Five qualified agency owners approached, two specified pilot agreements signed, zero payments. Agencies overlap with the interview examples. Convenience recruitment, small cohort, no independent signature verification, no retention or measured time savings. The client-account objection remains unresolved. These numbers did not come from Quorum Live. |

Click **Save reported result**. Add the commitment ledger record from step 11D. The notebook's small criterion passes in this fictional example, but `/decision` remains **ITERATE** because contradicting direct evidence remains. This is intentional: a small threshold and AI enthusiasm do not erase an adoption objection. Save another dated decision if useful.

Optional failure branch, only if you want to demonstrate it: change Observed actions to `1` and explain that you are substituting another hypothetical outcome. A missed sampled criterion plus the stored direct contradiction yields **PIVOT** under the current rule. Restore `2` if continuing the primary narrative; the final state should not be described as actual customer validation in either branch.

## 13. Quorum Live: an actual form submission

Stay in `/experiments`. Under **Publish a bounded offer test**, fill:

| Field | Enter or select |
| --- | --- |
| Assumption | DEMO H2 |
| Public experiment title | DEMO ONLY - ScopeSignal research-interest form |
| Call to action | Request a research interview |
| Who owns the data and what follow-up will happen? | Use the disclosure block below after replacing the two bracketed presenter details |
| Publication confirmation | Tick after reviewing the generated offer and disclosure |

```text
DEMO ONLY. [PRESENTER NAME] operates this ScopeSignal concept experiment. Contact [PRESENTER CONTACT ADDRESS] to ask questions or request deletion. This presentation uses an internal test address to demonstrate storage; it is not a customer interview or purchase. In a real study I would use a submitted email only to arrange the requested research conversation. Quorum sends no automatic email and does not verify addresses. This experiment and its contacts expire 14 days after experiment creation. Do not submit client-confidential or sensitive information.
```

Use your own actual contact details for a public presentation, or keep it a local internal demonstration. This guide has not invented an owner identity or contact address for you. Review any generated text for disclosure before clicking **Publish offer experiment**.

Open the generated public URL in another tab, preferably appending `?utm_source=hackathon-demo` for a visible source tag. Keep the original private workspace tab open. A localhost URL can be demonstrated on your own machine; remote attendees need a reachable deployed host. A phone's localhost points to the phone rather than your laptop.

On the public page:

| Field/control | Enter or do |
| --- | --- |
| Visit measurement | Click Allow anonymous visit measurement if you want to demonstrate measured visits |
| Your email | `scope-signal-demo@example.invalid` for a clearly internal test capture, or your own address for a real self-test |
| Contact consent | Tick after reading the disclosure |
| Submit | Request a research interview; allow a few seconds to read the form before submitting |

The `.invalid` example is intentionally not a deliverable email address. Quorum stores consented input and does not verify or send email. Return to the private tab and click **Refresh actual observations**. Show the actual counts produced by your actions, not a promised number. If it is the only clean run with measurement accepted, expect one contact and one consenting browser visit; repeat browser sessions or previous visits can change that.

Expand **Consented contacts** and **Traffic-source tags**. Click **Add actual observations to ledger**. It creates a mixed observation from the real form actions. Explain that the signal came from you during a demo, not a recruited customer, and edit its ledger limitations to append:

```text
DEMO SELF-TEST: these contact and visit events were generated by the presenter to demonstrate the form. No recruited customer participated. Not buying intent, payment or an independent participant in the fictional five-agency register.
```

The five-agency notebook data and this actual form's counts are separate. Never label the two fictional pilot agreements as two real Quorum Live conversions.

## 14. Revisit the decision and show continuity

Open `/decision` and inspect the rule and dated snapshots. The expected primary ending is **ITERATE**, not BUILD. Keep the contradicting and mixed evidence visible.

Closing product decision to read aloud:

> The initial offer asked clients to join another portal. Even with two fictional pilot commitments meeting our small test criterion, the client-account objection remains. The next bounded step is to test a no-account approval link with the same agency segment before expanding the product. That is a hypothesis for the next iteration, not an achieved result.

Show these commands separately:

```text
/history
/reviews
/scorecard
/brief
```

In history, click **View result** on an older review. Point out timestamp, earlier-context label and source inspection. Opening it makes no new inference request. **Run again** explicitly uses current project context and makes a new AI request; it does not reproduce the old inputs. If you want a fresh panel, run it after finishing evidence changes, then open the updated `/brief`. Earlier AI results may be stale or reset as source/profile changes occur; that is visible and expected.

The revised idea does not overwrite an already generated offer. To generate the next version of the product concept, use **NEW PROJECT** and describe the no-account version. Preserve the original project's decision trail.

## 15. Sharing, export, restore and cleanup

These controls mostly act on existing records; there are no extra text fields to paste:

| Feature | What to do and say |
| --- | --- |
| `/share` | Read the disclosure, then Create / refresh share link only after reviewing the brief. It includes selected output and aggregate decision counts; excludes raw evidence, interviews, legal notes, imported source documents, output history and the project key. Generated text can still reflect private inputs. |
| Shared brief | Open the read-only link. Point out the warning that original evidence is omitted. You control whether a link is made public. |
| Revoke shared snapshot | Revoke the demo link after showing it. A saved link is an explicit snapshot, so later project changes need a refresh if you want a new snapshot. |
| `/export` | Download a private JSON archive. Do not display its contents on the projector: it contains the project access key. |
| `/reload` | Recover server-saved state; open `/evidence` and show the saved records. No new AI request. |
| `/restore` | Select that private JSON file in the file chooser. Restores access to the existing server record, not an expired or deleted project and not edited AI results. |
| Project selector | Switch to another project and back to show continuity. |
| `/help` | Show command descriptions and prerequisites. Type `/kn`, use Tab to accept `/knowledge`, then Enter to navigate. Ctrl/Cmd+K focuses/reveals the terminal. |
| `/cancel` | During an optional new AI request, cancel and reload saved results. Earlier committed results remain inspectable. This is a real cancellation, not a completion shortcut. |
| Live cleanup | In Experiments refresh observations, delete your test contact and close the public experiment. Reopen its URL to show closure. If retaining a self-test ledger record, keep its demo limitation. |
| Source controls | Show refresh on an extracted website if needed. Delete only a disposable imported source; retained generated outputs may still contain earlier text. Source changes invalidate relevant evaluations. |
| Other delete controls | Imported interviews, evidence entries, decision snapshots, legal preparation and saved output versions can each be removed through their own controls. Use throwaway demo material for demonstrations; retain the main story until the presentation ends. |
| `/clear` | Starts another project while preserving this one. It is not deletion. |
| `/delete` | Deletes the current demo project and associated public records after confirmation. Use only at the end if you want to remove it. Downloaded archives need separate deletion. |

Final narration:

> Quorum gave this founder a traceable next decision: research the problem, make the offer concrete, challenge the assumptions, inspect sources, collect evidence and choose the next bounded test. The value is being able to explain what changed and why, rather than treating an AI opinion as market validation.

## Eight-minute presentation route

This is a suggested pace, not a guarantee of live provider latency. Prepare saved AI outputs in advance if your slot is strict; tell the audience when you are opening saved output.

| Segment | Show |
| --- | --- |
| 0:00-0:30 | Founder story, intro and landing features |
| 0:30-1:15 | Discover source, inference and opportunity handoff |
| 1:15-2:00 | Knowledge document, retrieval preview and a cited answer |
| 2:00-3:00 | Offer, custom profile, saved panel and scorecard |
| 3:00-3:30 | One angle and the interview kit |
| 3:30-4:00 | Legal scope, one topic and private notes |
| 4:00-5:15 | Fictional interview quote, mixed finding and contradicting ledger record |
| 5:15-6:00 | Saved test criterion, fictional 2/5 result and ITERATE decision |
| 6:00-7:00 | Actual self-test contact capture and private observations |
| 7:00-8:00 | Decision history, output history, brief/export and next test |

Do a full rehearsal before choosing this route. AI scores, generated wording and external-service availability are not scripted. An honest missing result can be inspected and retried; it should not be replaced with an unlabeled fictional success.
