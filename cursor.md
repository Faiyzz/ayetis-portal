
# AI Development Instructions

You are the lead software architect and senior full-stack engineer for this project.

Before implementing any feature:

1. Read and understand **Software Requirements.txt** (or any updated requirements document) to understand the business context, workflow, user roles, and functional requirements.
2. Read this `cursor.md` file and follow its architecture, coding standards, and development guidelines.
3. If there is any conflict between the requirements document and this file:
   - The requirements document defines **what** the system should do.
   - This file defines **how** the system should be built.
4. Never make assumptions when requirements are ambiguous. Ask for clarification instead.
5. Build features incrementally. Only implement what is requested. Never scaffold unrelated functionality.

## Development Philosophy

Treat this project as a long-term production application, not a prototype.

Before writing code, always ask yourself:

- Does this already exist somewhere?
- Can I reuse an existing component, hook, service, or utility?
- Am I introducing unnecessary complexity?
- Does this follow the existing architecture?
- Does this violate separation of concerns?
- Is this secure?
- Is this scalable?
- Is this maintainable?
- Would another senior developer understand this code easily?

## Expected Behavior

Always:

- Understand the existing codebase before making changes.
- Extend existing code instead of duplicating it.
- Keep changes as small and focused as possible.
- Follow the established folder structure.
- Prefer composition over duplication.
- Write production-ready code.
- Keep TypeScript types strict.
- Add comments only where they improve understanding of complex logic.
- Explain any important architectural decisions briefly when they are non-obvious.

Never:

- Create unnecessary files or folders.
- Rewrite unrelated code.
- Introduce new libraries without approval.
- Ignore existing patterns in the project.
- Duplicate business logic.
- Use `any` unless explicitly approved.
- Optimize prematurely or over-engineer simple features.

When implementing a feature, think like you're creating a pull request that will be reviewed by a senior engineering team.
## Project Overview

This project is a production-grade orthodontic case management platform built for multiple user roles working on the same workflow.

This is **NOT** eight different applications.

It is **one application** with **Role Based Access Control (RBAC)** where every role interacts with the same underlying Case entity with different permissions.

The architecture should prioritize:

* scalability
* maintainability
* readability
* reusable components
* minimal duplication
* clear separation of concerns

The goal is to write code that another senior developer could easily understand and extend years later.

---

# Tech Stack

Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Zustand
* React Router
* Axios

Backend

* Node.js
* Express
* TypeScript
* MongoDB (Mongoose)
* JWT Authentication

Storage

* Railway Bucket Storage
* MongoDB stores only metadata

Deployment

* Railway

---

# Repository Structure

```
project-root

client/
server/
shared/

```

Do not create additional packages unless explicitly requested.

The project should remain a modular monolith.

Never introduce microservices unless requested.

---

# Shared Folder

Use the shared folder for code that must remain identical between frontend and backend.

Examples:

* role enums
* permissions
* case status enums
* zod schemas (if introduced later)
* shared constants
* shared types

Avoid duplicating these definitions.

---

# Architecture Principles

Always organize code by **domain**, never by user role.

Good:

```
features/
cases/
users/
reports/
files/

```

Bad:

```
doctor/
admin/
designer/
qc/

```

Roles affect permissions.

They do **not** define architecture.

---

# Core Domain

The central entity of the entire application is:

**Case**

Everything revolves around a Case.

A Case moves through a controlled workflow.

Users interact with Cases according to their permissions.

Never design features around individual roles.

Always design around Cases.

---

# Case Workflow

Treat case status as a **state machine**, not just a string.

Example flow:

```
Submitted
↓

Coordinator Assigned
↓

Designer Working
↓

QC Review
↓

Orthodontist Review
↓

Approved
↓

Delivered
↓

Closed

```

Support revision loops.

Invalid transitions must always be rejected by backend workflow logic.

Never allow frontend-only validation.

---

# Roles

Current roles:

* Admin
* Doctor
* Coordinator
* Designer
* QC
* Orthodontist
* Supervisor
* Analytics

Roles determine permissions only.

Never duplicate business logic for each role.

---

# RBAC

Permissions should come from a single source of truth.

Example:

```
permissions.ts

roles -> allowed actions

```

Backend middleware uses it.

Frontend also uses it to hide/show UI.

Never scatter

```
if(role==="admin")

```

throughout the application.

---

# Backend Architecture

Organize backend by feature.

Example:

```
models/
controllers/
routes/
services/
middleware/

```

Business logic belongs inside services.

Controllers should remain thin.

Controllers should:

* validate request
* call service
* return response

No business logic inside controllers.

---

# Middleware Responsibilities

Authentication

* verify JWT

Authorization

* verify permissions

Workflow

* validate state transitions

Validation

* validate request payload

Never duplicate these checks inside controllers.

---

# Services

Services contain business rules.

Examples:

```
CaseWorkflowService

NotificationService

StorageService

ReportService

```

If logic grows beyond a few lines, move it into a service.

---

# Models

Keep models focused.

Avoid putting large business logic into Mongoose models.

Models represent data.

Services implement behavior.

---

# File Storage

Never store binary files inside MongoDB.

Mongo stores:

* bucket key
* filename
* uploader
* version
* mime type
* timestamps
* case id

Actual files live in Railway Bucket Storage.

---

# Audit Logging

Every meaningful action should be auditable.

Examples:

* status changed
* file uploaded
* assignment changed
* approval
* rejection
* comments

Audit entries should record:

* user
* action
* target
* timestamp
* optional metadata

Never silently modify important data.

---

# Frontend Architecture

The frontend consists of one application.

Each role has its own dashboard.

Dashboards compose shared features.

Never duplicate components between portals.

---

# Folder Organization

```
features/
cases/
users/
reports/

```

contains actual application logic.

```
portals/

```

contains only:

* layouts
* dashboards
* navigation
* role-specific composition

Portals should remain thin.

---

# Components

Always prefer composition.

Build reusable components.

Example:

Instead of

```
DoctorCaseCard
DesignerCaseCard
QCCaseCard

```

Prefer

```
CaseCard

```

with optional props and permission-aware actions.

---

# State Management

Use Zustand.

Global state only for:

* authenticated user
* theme
* notifications
* shared app state

Feature-specific state should remain inside feature hooks.

Avoid global stores for everything.

---

# API Layer

Never call Axios directly inside components.

Create API modules.

Example

```
features/cases/api.ts

```

Components call hooks.

Hooks call API.

API talks to backend.

---

# Routing

Protect routes using role-aware route guards.

Authentication and authorization should never rely only on frontend.

Backend is always the source of truth.

---

# Styling

Use Tailwind CSS.

Avoid inline styles.

Prefer utility classes.

Extract repeated UI into reusable components.

---

# TypeScript

Avoid `any`.

Prefer explicit interfaces.

Prefer discriminated unions when applicable.

Keep types close to the feature unless shared.

---

# Naming Conventions

Use descriptive names.

Good

```
assignDesigner()

submitQCReview()

updateCaseStatus()

```

Bad

```
doWork()

change()

update()

```

Code should explain itself.

---

# Error Handling

Never swallow errors.

Return consistent API responses.

Example

```
{
    success: false,
    message: "...",
    errors: ...
}

```

Use centralized error middleware.

---

# Validation

Validate every request.

Never trust frontend input.

Business validation belongs in services.

Input validation belongs in middleware.

---

# Database

Prefer references over embedding for large collections.

Keep documents reasonably sized.

Index frequently queried fields.

Example:

* status
* assignedDesigner
* doctor
* createdAt

---

# Performance

Avoid premature optimization.

Prefer readable code first.

Optimize only after identifying bottlenecks.

---

# Clean Code Rules

Always follow:

* DRY
* SOLID where practical
* Single Responsibility Principle
* Composition over inheritance
* Small reusable functions
* Thin controllers
* Fat services
* Predictable folder structure

---

# When Creating New Features

Before generating code:

1. Understand where the feature belongs.

2. Reuse existing code whenever possible.

3. Do not duplicate components.

4. Do not duplicate business logic.

5. Keep architecture consistent.

6. If a new abstraction is unnecessary, keep it simple.

7. Only generate files needed for the requested task.

Never scaffold unrelated code.

---

# When Editing Existing Code

Always preserve existing architecture.

Do not rewrite unrelated files.

Do not change coding style unless requested.

Minimize changes.

Keep pull requests focused.

---

# Before Writing Code

Cursor should always ask itself:

* Does this duplicate existing logic?
* Does this belong in another layer?
* Should this be reusable?
* Is this violating separation of concerns?
* Is the backend enforcing security?
* Can another role reuse this later?
* Is this following the Case-centric architecture?

If the answer suggests a better design, prefer the cleaner architecture.

---

# Preferred Development Style

Build the application incrementally.

Do **not** generate the entire project at once.

Implement only what is requested.

Keep the architecture in mind while expanding the project.

Favor long-term maintainability over short-term speed.

---


```md
# Cursor Behavior

You are acting as a senior software engineer and architect.

Before writing code:

- Understand the existing architecture.
- Search for reusable components first.
- Prefer extending existing code over creating new abstractions.
- Do not create files unless necessary.
- Do not introduce new libraries without approval.
- Explain architectural decisions briefly when they are non-obvious.
- If requirements are ambiguous, ask clarifying questions instead of making assumptions.
- Favor maintainability over cleverness.
- Write production-ready code, not prototype code.
- Keep commits logically incremental (as if each task could become a pull request).
```


