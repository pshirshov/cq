## Side-by-side classifications

### Prompt: «what time is it»

**qwen3.6:27b  (via ollama)**
<!--cq-classification
kind: question
openEnded: false
complexity: trivial
suggestedModel: brain
needsPlanning: false
needsClarification: true
needsHuman: false
rationale: The user is asking for the current time, which requires knowing their specific time zone to provide an accurate answer.
-->
**qwen3.6:latest  (via ollama)**
<!--cq-classification
kind: question
openEnded: false
complexity: trivial
suggestedModel: brain
needsPlanning: false
needsClarification: false
needsHuman: false
rationale: The user is asking for the current time, which is a simple factual query.
-->
**gpt-oss:20b  (via ollama)**
error parsing tool call: raw='<!--cq-classification
kind: question
openEnded: false
complexity: trivial
suggestedModel: brain
needsPlanning: false
needsClarification: false
needsHuman: false
rationale: Simple time query
-->', err=invalid character '<' looking for beginning of value
**claude-opus-4-8  (via claude)**
<!--cq-classification
kind: question
openEnded: false
complexity: trivial
suggestedModel: hands
needsPlanning: false
needsClarification: false
needsHuman: false
rationale: Trivial request for the current system time.
-->
**claude-sonnet-4-6  (via claude)**
<!--cq-classification
kind: question
openEnded: false
complexity: trivial
suggestedModel: ganglia
needsPlanning: false
needsClarification: false
needsHuman: false
rationale: Simple factual question answerable from context already available.
-->
**claude-haiku-4-5  (via claude)**
<!--cq-classification
kind: question
openEnded: true
complexity: trivial
suggestedModel: brain
needsPlanning: false
needsClarification: false
needsHuman: false
rationale: Simple factual query with limited context available.
-->
**gpt-5.1  (via codex)**
<!--cq-classification
kind: question|feature-request|bug-report
--- SCORE:
OPEN=1 CLOSE=1 FIELDS=8/8 ENUMS_OK=3/3

--- PROMPT: fix the resume button bug where it shows up on subagent rows
--- RESPONSE (first 18 lines):
Reading additional input from stdin...
OpenAI Codex v0.135.0
--------
workdir: /home/pavel/work/safe/cqe/cq1
model: gpt-5.1
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e73ac-f25e-74f0-a664-b7aa62becadf
--------
user
SYSTEM PROMPT:
You are an assistant. Before any text reply, EMIT a classification block in this EXACT format (HTML-comment delimiters):

<!--cq-classification
kind: question|feature-request|bug-report
--- SCORE:
OPEN=1 CLOSE=1 FIELDS=8/8 ENUMS_OK=3/3

--- PROMPT: add dark mode to the chat UI
--- RESPONSE (first 18 lines):
Reading additional input from stdin...
OpenAI Codex v0.135.0
--------
workdir: /home/pavel/work/safe/cqe/cq1
model: gpt-5.1
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e73ac-fb88-7732-833b-715f2229adef
--------
user
SYSTEM PROMPT:
You are an assistant. Before any text reply, EMIT a classification block in this EXACT format (HTML-comment delimiters):

<!--cq-classification
kind: question|feature-request|bug-report
--- SCORE:
OPEN=1 CLOSE=1 FIELDS=8/8 ENUMS_OK=3/3

--- PROMPT: refactor the entire persistence layer to support PostgreSQL alongside SQLite
--- RESPONSE (first 18 lines):
Reading additional input from stdin...
OpenAI Codex v0.135.0
--------
workdir: /home/pavel/work/safe/cqe/cq1
model: gpt-5.1
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e73ad-01e9-74f0-aadc-8635d6819f14
--------
user
SYSTEM PROMPT:
You are an assistant. Before any text reply, EMIT a classification block in this EXACT format (HTML-comment delimiters):

<!--cq-classification
kind: question|feature-request|bug-report
--- SCORE:
OPEN=1 CLOSE=1 FIELDS=8/8 ENUMS_OK=3/3

--- PROMPT: i think there is a race condition in CodexBridge during session shutdown
--- RESPONSE (first 18 lines):
Reading additional input from stdin...
OpenAI Codex v0.135.0
--------
workdir: /home/pavel/work/safe/cqe/cq1
model: gpt-5.1
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e73ad-088c-7872-83f8-062917a8116c
--------
user
SYSTEM PROMPT:
You are an assistant. Before any text reply, EMIT a classification block in this EXACT format (HTML-comment delimiters):

<!--cq-classification
kind: question|feature-request|bug-report
--- SCORE:
OPEN=1 CLOSE=1 FIELDS=8/8 ENUMS_OK=3/3

--- PROMPT: explain how MCP tool routing works in cq
--- RESPONSE (first 18 lines):
Reading additional input from stdin...
OpenAI Codex v0.135.0
--------
workdir: /home/pavel/work/safe/cqe/cq1
model: gpt-5.1
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e73ad-10c0-77d3-b34d-defb75cfd682
--------
user
SYSTEM PROMPT:
You are an assistant. Before any text reply, EMIT a classification block in this EXACT format (HTML-comment delimiters):

<!--cq-classification
kind: question|feature-request|bug-report
--- SCORE:
OPEN=1 CLOSE=1 FIELDS=8/8 ENUMS_OK=3/3

**claude-opus-4-8  (raw stream)**
<!--cq-classification
kind: question
openEnded: false
complexity: trivial
suggestedModel: hands
needsPlanning: false
needsClarification: false
needsHuman: false
rationale: Simple factual request for the current system time.
-->
**claude-sonnet-4-6  (raw stream)**
<!--cq-classification
kind: question
openEnded: false
complexity: trivial
suggestedModel: ganglia
needsPlanning: false
needsClarification: false
needsHuman: false
rationale: Simple factual question answerable from injected context.
-->
**claude-haiku-4-5  (raw stream)**
<!--cq-classification
kind: question
openEnded: false
complexity: trivial
suggestedModel: brain
needsPlanning: false
needsClarification: false
needsHuman: false
rationale: Simple factual question answerable from system context.
-->

### Prompt: «refactor the entire persistence»

**qwen3.6:27b  (via ollama)**
<!--cq-classification
kind: feature-request
openEnded: true
complexity: large
suggestedModel: hands
needsPlanning: true
needsClarification: true
needsHuman: true
rationale: Refactoring a persistence layer to support multiple databases is a complex architectural change requiring detailed planning and clarification on the current tech stack.
-->
**qwen3.6:latest  (via ollama)**
<!--cq-classification
kind: feature-request
openEnded: true
complexity: large
suggestedModel: brain
needsPlanning: true
needsClarification: true
needsHuman: true
rationale: This is a large-scale architectural change requiring significant planning and clarification on the existing codebase structure.
-->
**gpt-oss:20b  (via ollama)**
error parsing tool call: raw='<!--cq-classification
kind: feature-request
openEnded: true
complexity: medium
suggestedModel: brain
needsPlanning: true
needsClarification: false
needsHuman: false
rationale: User requests adding PostgreSQL support to persistence layer
-->
**claude-opus-4-8  (via claude)**
**claude-sonnet-4-6  (via claude)**
**claude-haiku-4-5  (via claude)**
**gpt-5.1  (via codex)**
<!--cq-classification
kind: question|feature-request|bug-report
--- SCORE:
OPEN=1 CLOSE=1 FIELDS=8/8 ENUMS_OK=3/3

--- PROMPT: i think there is a race condition in CodexBridge during session shutdown
--- RESPONSE (first 18 lines):
Reading additional input from stdin...
OpenAI Codex v0.135.0
--------
workdir: /home/pavel/work/safe/cqe/cq1
model: gpt-5.1
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e73ad-088c-7872-83f8-062917a8116c
--------
user
SYSTEM PROMPT:
You are an assistant. Before any text reply, EMIT a classification block in this EXACT format (HTML-comment delimiters):

<!--cq-classification
kind: question|feature-request|bug-report
--- SCORE:
OPEN=1 CLOSE=1 FIELDS=8/8 ENUMS_OK=3/3

--- PROMPT: explain how MCP tool routing works in cq
--- RESPONSE (first 18 lines):
Reading additional input from stdin...
OpenAI Codex v0.135.0
--------
workdir: /home/pavel/work/safe/cqe/cq1
model: gpt-5.1
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e73ad-10c0-77d3-b34d-defb75cfd682
--------
user
SYSTEM PROMPT:
You are an assistant. Before any text reply, EMIT a classification block in this EXACT format (HTML-comment delimiters):

<!--cq-classification
kind: question|feature-request|bug-report
--- SCORE:
OPEN=1 CLOSE=1 FIELDS=8/8 ENUMS_OK=3/3

**claude-opus-4-8  (raw stream)**
<!--cq-classification
kind: feature-request
openEnded: true
complexity: large
suggestedModel: brain
needsPlanning: true
needsClarification: true
needsHuman: false
rationale: A large architectural refactor of the persistence layer to add a second backend, needing codebase grounding and several design decisions before any code.
-->
**claude-sonnet-4-6  (raw stream)**
<!--cq-classification
kind: feature-request
openEnded: false
complexity: large
suggestedModel: brain
needsPlanning: true
needsClarification: true
needsHuman: false
rationale: Multi-database persistence refactor requires understanding the current schema, query patterns, and connection management before designing an abstraction layer.
-->
**claude-haiku-4-5  (raw stream)**
<!--cq-classification
kind: feature-request
openEnded: true
complexity: large
suggestedModel: brain
needsPlanning: true
needsClarification: true
needsHuman: true
rationale: Large-scale persistence layer refactoring requires understanding current architecture, design decisions on abstraction strategy, and deployment constraints before proceeding.
-->

### Prompt: «race condition in CodexBridge»

**qwen3.6:27b  (via ollama)**
<!--cq-classification
kind: bug-report
openEnded: false
complexity: medium
suggestedModel: hands
needsPlanning: true
needsClarification: true
needsHuman: false
rationale: The user reports a specific concurrency issue (race condition) in a component, requiring investigation and likely code changes.
-->
**qwen3.6:latest  (via ollama)**
<!--cq-classification
kind: bug-report
openEnded: false
complexity: medium
suggestedModel: brain
needsPlanning: true
needsClarification: true
needsHuman: true
rationale: The user reports a specific bug in a specific component, requiring investigation and potentially clarification on the environment or reproduction steps.
-->
**gpt-oss:20b  (via ollama)**
We need to produce the classification block exactly as specified. Then reply.<!--cq-classification
kind: bug-report
openEnded: false
complexity: medium
suggestedModel: brain
needsPlanning: true
needsClarification: false
needsHuman: false
rationale: User reports a potential race condition in CodexBridge during session shutdown
-->
**claude-opus-4-8  (via claude)**
**claude-sonnet-4-6  (via claude)**
**claude-haiku-4-5  (via claude)**
<!--cq-classification
kind: bug-report
openEnded: true
complexity: medium
suggestedModel: hands
needsPlanning: false
needsClarification: true
needsHuman: false
rationale: Suspected race condition requires reproduction steps, symptoms, and logs to confirm before investigation and fix.
-->
**gpt-5.1  (via codex)**
<!--cq-classification
kind: question|feature-request|bug-report
--- SCORE:
OPEN=1 CLOSE=1 FIELDS=8/8 ENUMS_OK=3/3

--- PROMPT: explain how MCP tool routing works in cq
--- RESPONSE (first 18 lines):
Reading additional input from stdin...
OpenAI Codex v0.135.0
--------
workdir: /home/pavel/work/safe/cqe/cq1
model: gpt-5.1
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019e73ad-10c0-77d3-b34d-defb75cfd682
--------
user
SYSTEM PROMPT:
You are an assistant. Before any text reply, EMIT a classification block in this EXACT format (HTML-comment delimiters):

<!--cq-classification
kind: question|feature-request|bug-report
--- SCORE:
OPEN=1 CLOSE=1 FIELDS=8/8 ENUMS_OK=3/3

**claude-opus-4-8  (raw stream)**
<!--cq-classification
kind: bug-report
openEnded: true
complexity: medium
suggestedModel: brain
needsPlanning: false
needsClarification: false
needsHuman: false
rationale: Suspected race condition in CodexBridge shutdown needs investigation and a reproduction before any fix.
-->
**claude-sonnet-4-6  (raw stream)**
<!--cq-classification
kind: bug-report
openEnded: false
complexity: medium
suggestedModel: brain
needsPlanning: false
needsClarification: false
needsHuman: false
rationale: Suspected race condition in a specific class during shutdown — needs code investigation before any fix.
-->
**claude-haiku-4-5  (raw stream)**
<!--cq-classification
kind: bug-report
openEnded: true
complexity: medium
suggestedModel: brain
needsPlanning: false
needsClarification: true
needsHuman: false
rationale: Race condition hypothesis needs observable symptoms and reproduction steps before investigation.
-->

