import { navigate } from "astro:transitions/client";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Check from "lucide-react/dist/esm/icons/check";
import Copy from "lucide-react/dist/esm/icons/copy";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import PackageIcon from "lucide-react/dist/esm/icons/package";
import Search from "lucide-react/dist/esm/icons/search";
import { startTransition, useEffect, useRef, useState } from "react";
import {
  apiUrl,
  type BrewPackage,
  installCommand,
  type PackageDownload,
  packagePath,
  pullRequestsUrl,
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

type PackagePreviewProps = {
  copied: boolean;
  item: BrewPackage;
  pinned: boolean;
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
  const searchableText = [name, slug, item.description, ...(item.aliases ?? []), ...(item.previousNames ?? [])]
    .join(" ")
    .toLowerCase();
  const fuzzyTargets = [name, slug, ...(item.aliases ?? []), ...(item.previousNames ?? [])].join(" ").toLowerCase();
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

function SourceLinks({ item }: { item: BrewPackage }) {
  return (
    <ul className="source-links">
      <li>
        <a href={pullRequestsUrl(item)}>Pull requests</a>
      </li>
      <li>
        <a href={apiUrl(item)}>JSON API</a>
      </li>
      {item.sourceUrl && (
        <li>
          <a href={item.sourceUrl}>{item.type === "cask" ? "Cask code" : "Formula code"}</a>
        </li>
      )}
    </ul>
  );
}

function AnalyticsMetadata({ item }: { item: BrewPackage }) {
  return (
    <>
      {item.installs30d !== undefined && (
        <div>
          <dt>30-day installs</dt>
          <dd>{item.installs30d.toLocaleString("en-US")}</dd>
        </div>
      )}
      {item.installs90d !== undefined && (
        <div>
          <dt>90-day installs</dt>
          <dd>{item.installs90d.toLocaleString("en-US")}</dd>
        </div>
      )}
      {item.installs365d !== undefined && (
        <div>
          <dt>365-day installs</dt>
          <dd>{item.installs365d.toLocaleString("en-US")}</dd>
        </div>
      )}
    </>
  );
}

function DownloadTable({ downloads }: { downloads: PackageDownload[] }) {
  return (
    <div className="download-table-wrap">
      <table className="download-table">
        <thead>
          <tr>
            <th>Architecture</th>
            <th>Platforms</th>
            <th>Version</th>
            <th>Download</th>
          </tr>
        </thead>
        <tbody>
          {downloads.map((download) => (
            <tr key={[download.architecture, download.platforms.join(), download.url].join("-")}>
              <td>{download.architecture ?? "Universal"}</td>
              <td>{download.platforms.join(", ")}</td>
              <td>{download.version ?? "Current"}</td>
              <td>
                <a href={download.url}>File</a>
                {download.sha256 && (
                  <details className="checksum">
                    <summary>SHA-256</summary>
                    <code>{download.sha256}</code>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PackageStatusNotice({ item }: { item: BrewPackage }) {
  const status = item.disabled ?? item.deprecated;
  if (!status) return null;
  const label = item.disabled ? "Disabled" : "Deprecated";
  return (
    <aside className="package-status-notice" aria-label={`${label} package`}>
      <strong>{label}</strong>
      {status.date && <span> since {status.date}</span>}
      {status.reason && <span>: {status.reason}</span>}
      {status.replacement && <span>. Use {status.replacement} instead.</span>}
    </aside>
  );
}

function PackageDetailView({ copied, headingLevel: Heading, item, onBack, onCopy }: PackageDetailViewProps) {
  return (
    <article className="package-detail-view">
      <div className="package-detail-toolbar">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to results
        </button>
        <span className={`type-label type-${item.type}`}>{item.type === "formula" ? "Formula" : "Cask"}</span>
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
        <PackageStatusNotice item={item} />
      </header>

      <div className="package-detail-grid">
        <section className="package-detail-install">
          <h2>Install</h2>
          <div className="install-command">
            <code>{installCommand(item)}</code>
            <button
              className={copied ? "is-copied" : undefined}
              type="button"
              onClick={() => onCopy(item)}
              aria-label={copied ? "Install command copied" : "Copy install command"}
            >
              <span className="copy-icon" aria-hidden="true">
                {copied ? <Check size={19} /> : <Copy size={19} />}
              </span>
              <span className="sr-only" aria-live="polite">
                {copied ? "Copied to clipboard" : ""}
              </span>
            </button>
          </div>
        </section>
      </div>

      <div className="package-detail-sections">
        <section className="package-detail-section-details">
          <h2>Details</h2>
          <dl className="metadata package-detail-metadata">
            <div>
              <dt>Homepage</dt>
              <dd>
                <a href={item.homepage}>{new URL(item.homepage).hostname}</a>
              </dd>
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
            {item.tap && (
              <div>
                <dt>Tap</dt>
                <dd>{item.tap}</dd>
              </div>
            )}
            {item.macosRequirement && (
              <div>
                <dt>Requirements</dt>
                <dd>{item.macosRequirement}</dd>
              </div>
            )}
            {item.autoUpdates !== undefined && (
              <div>
                <dt>Auto-updates</dt>
                <dd>{item.autoUpdates ? "Yes" : "No"}</dd>
              </div>
            )}
            {item.container && (
              <div>
                <dt>Container</dt>
                <dd>{item.container}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="package-detail-section-sources">
          <h2>Sources</h2>
          <SourceLinks item={item} />
        </section>

        {(item.downloads?.length ?? 0) > 0 && (
          <section className="package-detail-section-downloads">
            <h2>Supported platforms</h2>
            <DownloadTable downloads={item.downloads ?? []} />
          </section>
        )}

        {item.dependencies.length > 0 && (
          <section className="package-detail-section-dependencies">
            <h2>Dependencies</h2>
            <ul className="dependencies">
              {item.dependencies.map((dependency) => (
                <li key={dependency}>{dependency}</li>
              ))}
            </ul>
          </section>
        )}

        {(item.installs30d !== undefined ||
          item.installs90d !== undefined ||
          item.installs365d !== undefined ||
          (item.aliases?.length ?? 0) > 0 ||
          (item.previousNames?.length ?? 0) > 0) && (
          <section className="package-detail-section-data">
            <h2>Package data</h2>
            <dl className="metadata package-detail-metadata">
              <AnalyticsMetadata item={item} />
              {(item.aliases?.length ?? 0) > 0 && (
                <div>
                  <dt>Aliases</dt>
                  <dd>{item.aliases?.join(", ")}</dd>
                </div>
              )}
              {(item.previousNames?.length ?? 0) > 0 && (
                <div>
                  <dt>Previous names</dt>
                  <dd>{item.previousNames?.join(", ")}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {((item.conflicts?.length ?? 0) > 0 || (item.artifacts?.length ?? 0) > 0) && (
          <section className="package-detail-section-installation">
            <h2>Installation data</h2>
            <dl className="metadata package-detail-metadata">
              {(item.artifacts?.length ?? 0) > 0 && (
                <div>
                  <dt>Installs</dt>
                  <dd>{item.artifacts?.join(", ")}</dd>
                </div>
              )}
              {(item.conflicts?.length ?? 0) > 0 && (
                <div>
                  <dt>Conflicts with</dt>
                  <dd>{item.conflicts?.join(", ")}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {(item.languages?.length ?? 0) > 0 && (
          <section className="package-detail-section-languages">
            <h2>Languages</h2>
            <p className="package-list-copy">{item.languages?.join(", ")}</p>
          </section>
        )}

        {item.caveats && (
          <section className="package-detail-section-caveats">
            <h2>Caveats</h2>
            <pre className="caveats-copy">{item.caveats}</pre>
          </section>
        )}
      </div>
    </article>
  );
}

function PackagePreview({ copied, item, pinned, onCopy }: PackagePreviewProps) {
  return (
    <div className="detail-content" data-pinned={pinned || undefined}>
      <header className="detail-header">
        <span className="detail-icon" aria-hidden="true">
          <PackageIcon size={32} strokeWidth={1.55} />
        </span>
        <div>
          <div className="detail-title-row">
            <h2>{item.name}</h2>
            <span className={`type-label type-${item.type}`}>{item.type === "formula" ? "Formula" : "Cask"}</span>
          </div>
          <code>{item.version}</code>
        </div>
      </header>
      <p className="detail-description">{item.description}</p>
      <section className="detail-section detail-install-primary">
        <h3>Install</h3>
        <div className="install-command">
          <code>{installCommand(item)}</code>
          <button
            className={copied ? "is-copied" : undefined}
            type="button"
            onClick={() => onCopy(item)}
            aria-label={copied ? "Install command copied" : "Copy install command"}
          >
            <span className="copy-icon" aria-hidden="true">
              {copied ? <Check size={19} /> : <Copy size={19} />}
            </span>
            <span className="sr-only" aria-live="polite">
              {copied ? "Copied to clipboard" : ""}
            </span>
          </button>
        </div>
      </section>
      <dl className="metadata">
        <div>
          <dt>Homepage</dt>
          <dd>
            <a href={item.homepage}>{new URL(item.homepage).hostname}</a>
          </dd>
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
        {item.macosRequirement && (
          <div>
            <dt>Requirements</dt>
            <dd>{item.macosRequirement}</dd>
          </div>
        )}
        {item.autoUpdates !== undefined && (
          <div>
            <dt>Auto-updates</dt>
            <dd>{item.autoUpdates ? "Yes" : "No"}</dd>
          </div>
        )}
        {(item.aliases?.length ?? 0) > 0 && (
          <div>
            <dt>Aliases</dt>
            <dd>{item.aliases?.join(", ")}</dd>
          </div>
        )}
      </dl>
      <PackageStatusNotice item={item} />
      {item.dependencies.length > 0 && (
        <section className="detail-section">
          <h3>Dependencies</h3>
          <ul className="dependencies">
            {item.dependencies.map((dependency) => (
              <li key={dependency}>{dependency}</li>
            ))}
          </ul>
        </section>
      )}
      {(item.installs30d !== undefined || item.installs90d !== undefined || item.installs365d !== undefined) && (
        <section className="detail-section analytics">
          <h3>Analytics</h3>
          <dl className="metadata compact-metadata">
            <AnalyticsMetadata item={item} />
          </dl>
        </section>
      )}
      <a className="open-package" href={packagePath(item)}>
        Open full page <ExternalLink size={15} aria-hidden="true" />
      </a>
    </div>
  );
}

export default function SearchExperience({ initialPackages, initialPackage }: Props) {
  const initialQuery = initialPackage?.slug ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState(() =>
    initialQuery ? localSearch(initialPackages, initialQuery) : initialPackages.slice(0, 8),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [openedPackage, setOpenedPackage] = useState<BrewPackage | null>(initialPackage ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchColumnRef = useRef<HTMLDivElement>(null);

  const selected = results[Math.min(activeIndex, results.length - 1)] ?? null;
  const detailItem = openedPackage ?? selected;
  const isStandalonePackage = Boolean(openedPackage && (initialPackage || isMobileLayout));

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 600px)");
    const updateLayout = () => setIsMobileLayout(mediaQuery.matches);
    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);
    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

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

  useEffect(() => {
    if (isStandalonePackage || !selected) return;

    const container = searchColumnRef.current;
    const row = document.getElementById(`result-${selected.type}-${selected.slug}`);
    if (!container || !row) return;

    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const stickyHeader = container.querySelector<HTMLElement>(".results-header");
    const visibleTop = containerRect.top + (stickyHeader?.offsetHeight ?? 0);

    if (rowRect.top < visibleTop) {
      container.scrollTop += rowRect.top - visibleTop;
    } else if (rowRect.bottom > containerRect.bottom) {
      container.scrollTop += rowRect.bottom - containerRect.bottom;
    }
  }, [isStandalonePackage, selected]);

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
    if (window.matchMedia("(max-width: 600px)").matches) {
      void navigate(packagePath(item));
      return;
    }

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
    if (openedPackage && isStandalonePackage) {
      window.history.replaceState({}, "", "/");
      setOpenedPackage(null);
    }
    setQuery(value);
    setActiveIndex(0);
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
      setActiveIndex(0);
      inputRef.current?.blur();
    }
  }

  async function copyInstallCommand(item: BrewPackage) {
    await navigator.clipboard.writeText(installCommand(item));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 650);
  }

  return (
    <section
      className={`command-surface ${isStandalonePackage ? "has-package-detail" : ""}`}
      aria-label="Package search"
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
          aria-activedescendant={
            !isStandalonePackage && selected ? `result-${selected.type}-${selected.slug}` : undefined
          }
        />
        <kbd>⌘ K</kbd>
      </label>

      {isStandalonePackage && openedPackage ? (
        <PackageDetailView
          copied={copied}
          headingLevel={initialPackage ? "h1" : "h2"}
          item={openedPackage}
          onBack={returnToResults}
          onCopy={copyInstallCommand}
        />
      ) : (
        <>
          <div ref={searchColumnRef} className="search-column">
            <div className="results-header">
              <span>Search results</span>
              <span>
                {results.length} {results.length === 1 ? "package" : "packages"}
              </span>
            </div>
            <div id="search-results" className="results" role="listbox" aria-label="Search results">
              {results.map((item, index) => {
                const isActive = index === activeIndex;
                const isPinned = openedPackage?.type === item.type && openedPackage.slug === item.slug;
                return (
                  <button
                    type="button"
                    id={`result-${item.type}-${item.slug}`}
                    role="option"
                    aria-selected={isPinned}
                    className={`result-row ${isActive ? "is-active" : ""} ${isPinned ? "is-selected" : ""}`}
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

          <aside className="detail-panel" aria-label="Package details" aria-live="polite">
            {detailItem ? (
              <PackagePreview
                copied={copied}
                item={detailItem}
                pinned={Boolean(openedPackage)}
                onCopy={copyInstallCommand}
              />
            ) : (
              <div className="detail-placeholder">Start typing to inspect a package.</div>
            )}
          </aside>
        </>
      )}
    </section>
  );
}
