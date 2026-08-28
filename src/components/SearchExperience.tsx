import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Package as PackageIcon,
  Search,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  installCommand,
  packagePath,
  type BrewPackage,
} from "../lib/packages";

type Props = {
  initialPackages: BrewPackage[];
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
    .slice(0, 5)
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

export default function SearchExperience({ initialPackages }: Props) {
  const [query, setQuery] = useState("post");
  const [results, setResults] = useState(() => localSearch(initialPackages, "post"));
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = results[Math.min(activeIndex, results.length - 1)] ?? null;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!query.trim()) {
        setResults(initialPackages.slice(0, 5));
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const catalog = await loadCatalog(initialPackages);
      if (!cancelled) setResults(localSearch(catalog, query));
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
      window.location.assign(packagePath(selected));
    }
    if (event.key === "Escape") {
      setQuery("");
      inputRef.current?.blur();
    }
  }

  async function copyInstallCommand() {
    if (!selected) return;
    await navigator.clipboard.writeText(installCommand(selected));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="command-surface" aria-label="Package search">
      <div className="search-column">
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
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search formulae and casks…"
            aria-controls="search-results"
            aria-activedescendant={selected ? `result-${selected.type}-${selected.slug}` : undefined}
          />
          <kbd>⌘ K</kbd>
        </label>

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
                onClick={() => window.location.assign(packagePath(item))}
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
          <>
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
                <button type="button" onClick={copyInstallCommand} aria-label="Copy install command">
                  {copied ? <Check size={19} /> : <Copy size={19} />}
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
          </>
        ) : (
          <div className="detail-placeholder">Start typing to inspect a package.</div>
        )}
      </aside>

      <div className="key-rail" aria-hidden="true">
        <span><kbd><ArrowUp size={13} /><ArrowDown size={13} /></kbd> Navigate</span>
        <span><kbd>↵</kbd> Open</span>
        <span><kbd>Esc</kbd> Clear</span>
      </div>
    </section>
  );
}
