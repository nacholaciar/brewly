import ArrowDown from "lucide-react/dist/esm/icons/arrow-down";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up";
import Check from "lucide-react/dist/esm/icons/check";
import Copy from "lucide-react/dist/esm/icons/copy";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import PackageIcon from "lucide-react/dist/esm/icons/package";
import Search from "lucide-react/dist/esm/icons/search";
import { AnimatePresence, domAnimation, LazyMotion, MotionConfig } from "motion/react";
import * as m from "motion/react-m";
import { startTransition, useEffect, useRef, useState } from "react";
import {
  installCommand,
  packagePath,
  type BrewPackage,
} from "../lib/packages";

type Props = {
  initialPackages: BrewPackage[];
  initialPackage?: BrewPackage;
};

type PackageDetailViewProps = {
  copied: boolean;
  headingLevel: "h1" | "h2";
  item: BrewPackage;
  onBack: () => void;
  onCopy: (item: BrewPackage) => void;
};

let catalogPromise: Promise<BrewPackage[]> | null = null;

async function loadCatalog(fallback: BrewPackage[]) {
  if (!catalogPromise) {
    catalogPromise = fetch("/search-index.json")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Search index returned ${response.status}`);
        return response.json() as Promise<BrewPackage[]>;
      })
      .catch(() => fallback);
  }
  return catalogPromise;
}

function localSearch(packages: BrewPackage[], query: string) {
  return packages
    .map((item) => ({ item, score: scorePackage(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (b.item.installs30d ?? 0) - (a.item.installs30d ?? 0))
    .slice(0, 8)
    .map(({ item }) => item);
}

function scorePackage(item: BrewPackage, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return 1;
  const name = item.name.toLowerCase();
  const slug = item.slug.toLowerCase();
  const searchableText = [name, slug, item.description, ...(item.aliases ?? [])]
    .join(" ")
    .toLowerCase();
  const fuzzyTargets = [name, slug, ...(item.aliases ?? [])]
    .join(" ")
    .toLowerCase();
  if (name === query || slug === query) return 100;
  if (name.startsWith(query) || slug.startsWith(query)) return 80;
  if (name.includes(query) || slug.includes(query)) return 60;
  if (searchableText.includes(query)) return 30;
  const letters = query.split("");
  let cursor = 0;
  for (const letter of letters) {
    cursor = fuzzyTargets.indexOf(letter, cursor);
    if (cursor === -1) return 0;
    cursor += 1;
  }
  return 10;
}

function PackageDetailView({ copied, headingLevel: Heading, item, onBack, onCopy }: PackageDetailViewProps) {
  return (
    <article className="package-detail-view">
      <div className="package-detail-toolbar">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to results
        </button>
        <span className={`type-label type-${item.type}`}>
          {item.type === "formula" ? "Formula" : "Cask"}
        </span>
      </div>

      <header className="package-detail-hero">
        <div className="package-detail-identity">
          <span className="package-detail-icon" aria-hidden="true">
            <PackageIcon size={38} strokeWidth={1.45} />
          </span>
          <div>
            <Heading>{item.name}</Heading>
            <code>{item.version}</code>
            <p>{item.description}</p>
          </div>
        </div>

        <div className="package-detail-sections">
          <section>
            <h2>Details</h2>
            <dl className="metadata package-detail-metadata">
              <div>
                <dt>Homepage</dt>
                <dd><a href={item.homepage}>{new URL(item.homepage).hostname}</a></dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{item.type === "formula" ? "Formula" : "Cask"}</dd>
              </div>
              {item.license && (
                <div>
                  <dt>License</dt>
                  <dd>{item.license}</dd>
                </div>
              )}
            </dl>
          </section>

          {item.dependencies.length > 0 && (
            <section>
              <h2>Dependencies</h2>
              <ul className="dependencies">
                {item.dependencies.map((dependency) => <li key={dependency}>{dependency}</li>)}
              </ul>
            </section>
          )}

          {(item.installs30d || (item.aliases?.length ?? 0) > 0) && (
            <section>
              <h2>Package data</h2>
              <dl className="metadata package-detail-metadata">
                {item.installs30d && (
                  <div>
                    <dt>30-day installs</dt>
                    <dd>{item.installs30d.toLocaleString("en-US")}</dd>
                  </div>
                )}
                {(item.aliases?.length ?? 0) > 0 && (
                  <div>
                    <dt>Aliases</dt>
                    <dd>{item.aliases?.join(", ")}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>
      </header>

      <div className="package-detail-grid">
        <section className="package-detail-install">
          <h2>Install</h2>
          <div className="install-command">
            <code>{installCommand(item)}</code>
            <button type="button" onClick={() => onCopy(item)} aria-label="Copy install command">
              <AnimatePresence initial={false}>
                <m.span
                  className="copy-icon"
                  key={copied ? "copied" : "copy"}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.08, ease: "easeOut" }}
                >
                  {copied ? <Check size={19} /> : <Copy size={19} />}
                </m.span>
              </AnimatePresence>
            </button>
          </div>
        </section>
      </div>
    </article>
  );
}

export default function SearchExperience({ initialPackages, initialPackage }: Props) {
  const initialQuery = initialPackage?.slug ?? "post";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState(() => localSearch(initialPackages, initialQuery));
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [openedPackage, setOpenedPackage] = useState<BrewPackage | null>(initialPackage ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = results[Math.min(activeIndex, results.length - 1)] ?? null;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!query.trim()) {
        setResults(initialPackages.slice(0, 8));
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const catalog = await loadCatalog(initialPackages);
      if (!cancelled) {
        startTransition(() => setResults(localSearch(catalog, query)));
      }
      if (!cancelled) setIsSearching(false);
    }, 70);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [initialPackages, query]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    function openSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);

  useEffect(() => {
    document.title = openedPackage
      ? `${openedPackage.name} — Homebrew ${openedPackage.type === "formula" ? "Formula" : "Cask"} | Brewly`
      : "Brewly — Find any Homebrew package";
  }, [openedPackage]);

  useEffect(() => {
    function restoreHistoryState() {
      if (window.location.pathname === "/") {
        setOpenedPackage(null);
        return;
      }

      if (initialPackage && window.location.pathname === packagePath(initialPackage)) {
        setOpenedPackage(initialPackage);
        return;
      }

      window.location.reload();
    }

    window.addEventListener("popstate", restoreHistoryState);
    return () => window.removeEventListener("popstate", restoreHistoryState);
  }, [initialPackage]);

  function openPackage(item: BrewPackage) {
    window.history.pushState({ brewlyPackage: true }, "", packagePath(item));
    setOpenedPackage(item);
    setCopied(false);
  }

  function returnToResults() {
    window.history.replaceState({}, "", "/");
    setOpenedPackage(null);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function updateQuery(value: string) {
    if (openedPackage) {
      window.history.replaceState({}, "", "/");
      setOpenedPackage(null);
    }
    setQuery(value);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, results.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter" && selected) {
      openPackage(selected);
    }
    if (event.key === "Escape") {
      if (openedPackage) {
        returnToResults();
        return;
      }
      setQuery("");
      inputRef.current?.blur();
    }
  }

  async function copyInstallCommand(item: BrewPackage) {
    await navigator.clipboard.writeText(installCommand(item));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 650);
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <m.section
          className={`command-surface ${openedPackage ? "has-package-detail" : ""}`}
          aria-label="Package search"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <label className="search-box" htmlFor="package-search">
              <Search aria-hidden="true" size={24} strokeWidth={1.8} />
              <span className="sr-only">Search formulae and casks</span>
              <input
                ref={inputRef}
                id="package-search"
                type="search"
                autoComplete="off"
                autoFocus
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search formulae and casks…"
                aria-controls="search-results"
                aria-activedescendant={!openedPackage && selected ? `result-${selected.type}-${selected.slug}` : undefined}
              />
              <kbd>⌘ K</kbd>
          </label>

          {openedPackage ? (
            <PackageDetailView
              copied={copied}
              headingLevel={initialPackage ? "h1" : "h2"}
              item={openedPackage}
              onBack={returnToResults}
              onCopy={copyInstallCommand}
            />
          ) : (
            <>
          <div className="search-column">
            <div className="results-header">
              <span>Search results</span>
              <span>{results.length} {results.length === 1 ? "package" : "packages"}</span>
            </div>
            <div id="search-results" className="results" role="listbox" aria-label="Search results">
              {results.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    type="button"
                    id={`result-${item.type}-${item.slug}`}
                    role="option"
                    aria-selected={isActive}
                    className={`result-row ${isActive ? "is-active" : ""}`}
                    key={`${item.type}-${item.slug}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => openPackage(item)}
                  >
                    <span className="result-icon" aria-hidden="true">
                      <PackageIcon size={22} strokeWidth={1.7} />
                    </span>
                    <span className="result-copy">
                      <strong>{item.name}</strong>
                      <span>{item.description}</span>
                    </span>
                    <span className={`type-label type-${item.type}`}>
                      {item.type === "formula" ? "Formula" : "Cask"}
                    </span>
                    <code>{item.version}</code>
                  </button>
                );
              })}
              {results.length === 0 && (
                <div className="empty-state" role="status">
                  <strong>{isSearching ? "Searching…" : "No packages found"}</strong>
                  {!isSearching && <span>Try a name, command, or description.</span>}
                </div>
              )}
            </div>
          </div>

          <aside className="detail-panel" aria-live="polite">
            {selected ? (
              <div className="detail-content">
                  <header className="detail-header">
                    <span className="detail-icon" aria-hidden="true">
                      <PackageIcon size={32} strokeWidth={1.55} />
                    </span>
                    <div>
                      <h2>{selected.name}</h2>
                      <code>{selected.version}</code>
                    </div>
                  </header>
                  <p className="detail-description">{selected.description}</p>
                  <dl className="metadata">
                    <div>
                      <dt>Homepage</dt>
                      <dd><a href={selected.homepage}>{new URL(selected.homepage).hostname}</a></dd>
                    </div>
                    {selected.license && (
                      <div>
                        <dt>License</dt>
                        <dd>{selected.license}</dd>
                      </div>
                    )}
                  </dl>
                  <section className="detail-section">
                    <h3>Install</h3>
                    <div className="install-command">
                      <code>{installCommand(selected)}</code>
                      <button type="button" onClick={() => copyInstallCommand(selected)} aria-label="Copy install command">
                        <AnimatePresence initial={false}>
                          <m.span
                            className="copy-icon"
                            key={copied ? "copied" : "copy"}
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.7 }}
                            transition={{ duration: 0.08, ease: "easeOut" }}
                          >
                            {copied ? <Check size={19} /> : <Copy size={19} />}
                          </m.span>
                        </AnimatePresence>
                      </button>
                    </div>
                  </section>
                  {selected.dependencies.length > 0 && (
                    <section className="detail-section">
                      <h3>Dependencies</h3>
                      <ul className="dependencies">
                        {selected.dependencies.map((dependency) => <li key={dependency}>{dependency}</li>)}
                      </ul>
                    </section>
                  )}
                  {selected.installs30d && (
                    <section className="detail-section analytics">
                      <h3>Analytics</h3>
                      <p>30-day installs: <strong>{selected.installs30d.toLocaleString("en-US")}</strong></p>
                    </section>
                  )}
                  <a className="open-package" href={packagePath(selected)}>
                    Open package page <ExternalLink size={15} aria-hidden="true" />
                  </a>
              </div>
            ) : (
              <div className="detail-placeholder">Start typing to inspect a package.</div>
            )}
          </aside>
            </>
          )}

          <div className="key-rail" aria-hidden="true">
            {openedPackage ? (
              <>
                <span><kbd>Esc</kbd> Results</span>
                <span>Type to search again</span>
              </>
            ) : (
              <>
                <span><kbd><ArrowUp size={13} /><ArrowDown size={13} /></kbd> Navigate</span>
                <span><kbd>↵</kbd> Open</span>
                <span><kbd>Esc</kbd> Clear</span>
              </>
            )}
          </div>
        </m.section>
      </MotionConfig>
    </LazyMotion>
  );
}
