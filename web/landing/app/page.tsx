import Link from "next/link";
import React from "react";
import { engineeringLanes, workspaceStats } from "@vscode-plugins/shared";

import styles from "./page.module.css";

const workflowSteps = [
  {
    label: "Design",
    title: "Editor-first package lanes",
    copy: "Extensions live in extensions/* while reusable contracts stay in packages/*, keeping command surfaces and shared code separate.",
  },
  {
    label: "Check",
    title: "Oxc quality gate",
    copy: "Fast linting keeps the plugin surface tidy while TypeScript guards contribution points and message contracts.",
  },
  {
    label: "Bundle",
    title: "Rolldown release output",
    copy: "Package builds are prepared for compact VS Code extension bundles without coupling the landing app to extension internals.",
  },
];

const stackItems = [
  "Next.js App Router in web/*",
  ...engineeringLanes,
  "Turborepo task graph at the root",
  "React Server Components by default",
];

const targetItems = [
  {
    name: "Command palette tools",
    detail: "Focused commands that make daily editor work faster.",
  },
  {
    name: "Workspace automation",
    detail: "Repo-aware actions for build, test, and release routines.",
  },
  {
    name: "Developer signals",
    detail: "Status views that surface actionable project context.",
  },
];

export default function Home() {
  return (
    <>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="ZProject VS Code Plugins home">
          <span className={styles.brandMark} aria-hidden="true">
            ZP
          </span>
          <span>ZProject Plugins</span>
        </Link>
        <nav className={styles.nav} aria-label="Primary navigation">
          <a href="#stack">Stack</a>
          <a href="#workflow">Workflow</a>
          <a href="#targets">Targets</a>
        </nav>
      </header>

      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>VS Code extension workspace</p>
            <h1 id="hero-title">Ship editor plugins from one disciplined monorepo.</h1>
            <p className={styles.lede}>
              A compact Next.js landing page for the Turborepo that will house VS Code extensions,
              shared packages, fast Oxc checks, and Rolldown-powered builds.
            </p>
            <div className={styles.actions} aria-label="Landing page actions">
              <a className={styles.primaryAction} href="#workflow">
                Review workflow
              </a>
              <a className={styles.secondaryAction} href="#targets">
                See plugin targets
              </a>
            </div>
          </div>

          <aside className={styles.workbench} aria-label="Monorepo build preview">
            <div className={styles.workbenchTop}>
              <span>zproject.code-workspace</span>
              <span>Ready</span>
            </div>
            <div className={styles.workbenchBody}>
              <div className={styles.activityRail} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className={styles.editorPane}>
                <div className={styles.tabRow}>
                  <span>turbo</span>
                  <span>oxc</span>
                  <span>rolldown</span>
                </div>
                <pre className={styles.codePreview} aria-label="Workspace command preview">
                  {`extensions/<plugin>  build  cached
packages/shared      lint   passed
web/landing          page   ready`}
                </pre>
                <div className={styles.statusGrid}>
                  {workspaceStats.map((stat) => (
                    <React.Fragment key={stat.label}>
                      <span>{stat.label}</span>
                      <strong>{stat.value}</strong>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className={styles.stackSection} id="stack" aria-labelledby="stack-title">
          <div>
            <p className={styles.sectionKicker}>Stack</p>
            <h2 id="stack-title">Built to fit the parent monorepo contract.</h2>
          </div>
          <ul className={styles.stackList}>
            {stackItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className={styles.workflowSection} id="workflow" aria-labelledby="workflow-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionKicker}>Workflow</p>
            <h2 id="workflow-title">A release path for many focused extension packages.</h2>
          </div>
          <div className={styles.workflowGrid}>
            {workflowSteps.map((step) => (
              <article className={styles.workflowCard} key={step.label}>
                <p>{step.label}</p>
                <h3>{step.title}</h3>
                <span>{step.copy}</span>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.targetsSection} id="targets" aria-labelledby="targets-title">
          <div>
            <p className={styles.sectionKicker}>Targets</p>
            <h2 id="targets-title">The plugin set can grow without reshaping the web app.</h2>
          </div>
          <div className={styles.targetList}>
            {targetItems.map((target) => (
              <article className={styles.targetItem} key={target.name}>
                <h3>{target.name}</h3>
                <p>{target.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
